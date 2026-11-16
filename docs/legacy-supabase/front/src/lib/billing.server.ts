// Helpers serveur pour la facturation (importés par billing.functions.ts).
import {
  activateSubscription,
  computeAmount,
  createDirectCharge,
  createGatewayPayment,
  fetchRemoteStatus,
  settlePayment,
  type Cycle,
  type PaymentMethod,
} from "./djomy.server";

export const CYCLES: Cycle[] = ["mensuel", "annuel"];

export async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function assertOrgAdmin(supabase: any, userId: string, orgId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  const ok = (data ?? []).some((r: { role: string }) => r.role === "owner" || r.role === "hr_admin");
  if (!ok) throw new Error("Non autorisé : rôle administrateur requis pour cette organisation.");
}

export function siteOrigin(): string {
  const raw = process.env.SITE_URL || "https://konkoure.lovable.app";
  return raw.replace(/\/+$/, "");
}

/** Crée la ligne de paiement + l'intention Djomy. Utilisé par la server fn et le CRON. */
export async function startSubscriptionPayment(args: {
  admin: any;
  orgId: string;
  planCode: string;
  cycle: Cycle;
  payerNumber?: string | null;
  paymentMethod?: PaymentMethod | null;
  auto?: boolean;
}): Promise<{ redirectUrl: string; merchantReference: string }> {
  const { admin, orgId, planCode, cycle } = args;

  const { data: plan, error: planError } = await admin
    .from("plans")
    .select("id, code, nom, prix_gnf")
    .eq("code", planCode)
    .maybeSingle();
  if (planError) throw new Error(planError.message);
  if (!plan) throw new Error("Offre introuvable.");
  if (Number(plan.prix_gnf) <= 0) throw new Error("Cette offre est gratuite, aucun paiement requis.");

  // Montant calculé exclusivement à partir de la base.
  const amount = computeAmount(Number(plan.prix_gnf), cycle);
  const merchantReference = crypto.randomUUID();

  const { error: insertError } = await admin.from("subscription_payments").insert({
    org_id: orgId,
    plan_id: plan.id,
    cycle,
    merchant_reference: merchantReference,
    expected_amount: amount,
    currency: "GNF",
    status: "pending",
    method: args.auto ? "auto-renew" : (args.paymentMethod ?? null),
  });
  if (insertError) throw new Error(insertError.message);

  const origin = siteOrigin();
  const { redirectUrl, transactionId } = await createGatewayPayment({
    amount,
    merchantReference,
    payerNumber: args.payerNumber ?? null,
    paymentMethod: args.paymentMethod ?? null,
    returnUrl: `${origin}/app/billing/return?ref=${merchantReference}`,
    cancelUrl: `${origin}/app/billing/return?ref=${merchantReference}&cancelled=1`,
    metadata: { org_id: orgId, plan_id: plan.id, cycle },
    description: `Konkouré — abonnement ${plan.nom} (${cycle})`,
  });

  if (transactionId) {
    await admin
      .from("subscription_payments")
      .update({ djomy_transaction_id: transactionId })
      .eq("merchant_reference", merchantReference);
  }

  return { redirectUrl, merchantReference };
}

/**
 * Paiement Mobile Money sans redirection : crée la ligne de paiement puis
 * déclenche la collecte directe (le client valide sur son téléphone).
 */
export async function startDirectSubscriptionPayment(args: {
  admin: any;
  orgId: string;
  planCode: string;
  cycle: Cycle;
  payerNumber: string;
  paymentMethod: "orange_money" | "mtn_momo";
}): Promise<{ merchantReference: string; amount: number; status: string }> {
  const { admin, orgId, planCode, cycle } = args;

  const { data: plan, error: planError } = await admin
    .from("plans")
    .select("id, code, nom, prix_gnf")
    .eq("code", planCode)
    .maybeSingle();
  if (planError) throw new Error(planError.message);
  if (!plan) throw new Error("Offre introuvable.");
  if (Number(plan.prix_gnf) <= 0) throw new Error("Cette offre est gratuite, aucun paiement requis.");

  const amount = computeAmount(Number(plan.prix_gnf), cycle);
  const merchantReference = crypto.randomUUID();

  const { error: insertError } = await admin.from("subscription_payments").insert({
    org_id: orgId,
    plan_id: plan.id,
    cycle,
    merchant_reference: merchantReference,
    expected_amount: amount,
    currency: "GNF",
    status: "pending",
    method: args.paymentMethod,
  });
  if (insertError) throw new Error(insertError.message);

  const { transactionId } = await createDirectCharge({
    amount,
    merchantReference,
    payerNumber: args.payerNumber,
    paymentMethod: args.paymentMethod,
    metadata: { org_id: orgId, plan_id: plan.id, cycle },
    description: `Konkouré — abonnement ${plan.nom} (${cycle})`,
  });

  if (transactionId) {
    await admin
      .from("subscription_payments")
      .update({ djomy_transaction_id: transactionId })
      .eq("merchant_reference", merchantReference);
  }

  return { merchantReference, amount, status: "pending" };
}

/** Vérifie le statut réel auprès de Djomy puis l'applique en base si besoin. */
export async function syncPaymentStatus(
  admin: any,
  merchantReference: string,
): Promise<{ status: string }> {
  const { data: payment } = await admin
    .from("subscription_payments")
    .select("status, djomy_transaction_id, merchant_reference")
    .eq("merchant_reference", merchantReference)
    .maybeSingle();
  if (!payment) throw new Error("Paiement introuvable.");
  if (payment.status !== "pending") return { status: payment.status };
  if (!payment.djomy_transaction_id) return { status: "pending" };

  const { status, payload } = await fetchRemoteStatus(payment.djomy_transaction_id);
  if (status === "pending") return { status: "pending" };

  await settlePayment(admin, {
    merchantReference,
    status,
    paidAmount: payload?.paidAmount ?? payload?.amount ?? null,
    currency: payload?.currency ?? "GNF",
    transactionId: payment.djomy_transaction_id,
    method: payload?.paymentMethod ?? null,
    rawEvent: payload,
  });

  const { data: fresh } = await admin
    .from("subscription_payments")
    .select("status")
    .eq("merchant_reference", merchantReference)
    .maybeSingle();
  return { status: fresh?.status ?? status };
}

// ---------------------------------------------------------------------------
// Paiement anticipé : régler une offre AVANT d'avoir un compte / une organisation.
// Le paiement est stocké sans organisation, avec un code de rattachement.
// ---------------------------------------------------------------------------

export async function startAnonymousPayment(args: {
  admin: any;
  planCode: string;
  cycle: Cycle;
  email: string;
  payerNumber: string;
  paymentMethod: PaymentMethod;
}): Promise<{
  merchantReference: string;
  claimToken: string;
  amount: number;
  redirectUrl?: string;
}> {
  const { admin, planCode, cycle } = args;

  const { data: plan, error: planError } = await admin
    .from("plans")
    .select("id, code, nom, prix_gnf")
    .eq("code", planCode)
    .maybeSingle();
  if (planError) throw new Error(planError.message);
  if (!plan) throw new Error("Offre introuvable.");
  if (Number(plan.prix_gnf) <= 0) throw new Error("Cette offre est gratuite, aucun paiement requis.");

  const amount = computeAmount(Number(plan.prix_gnf), cycle);
  const merchantReference = crypto.randomUUID();
  const claimToken = crypto.randomUUID();
  const email = args.email.trim().toLowerCase();

  const { error: insertError } = await admin.from("subscription_payments").insert({
    org_id: null,
    plan_id: plan.id,
    cycle,
    merchant_reference: merchantReference,
    expected_amount: amount,
    currency: "GNF",
    status: "pending",
    method: args.paymentMethod,
    claim_token: claimToken,
    claim_email: email,
  });
  if (insertError) throw new Error(insertError.message);

  const description = `Konkouré — abonnement ${plan.nom} (${cycle})`;
  const metadata = { plan_id: plan.id, cycle, claim_email: email };

  if (args.paymentMethod === "card") {
    const origin = siteOrigin();
    const { redirectUrl, transactionId } = await createGatewayPayment({
      amount,
      merchantReference,
      payerNumber: args.payerNumber,
      paymentMethod: "card",
      returnUrl: `${origin}/paiement/retour?ref=${merchantReference}&claim=${claimToken}`,
      cancelUrl: `${origin}/paiement/retour?ref=${merchantReference}&claim=${claimToken}&cancelled=1`,
      metadata,
      description,
    });
    if (transactionId) {
      await admin
        .from("subscription_payments")
        .update({ djomy_transaction_id: transactionId })
        .eq("merchant_reference", merchantReference);
    }
    return { merchantReference, claimToken, amount, redirectUrl };
  }

  const { transactionId } = await createDirectCharge({
    amount,
    merchantReference,
    payerNumber: args.payerNumber,
    paymentMethod: args.paymentMethod,
    metadata,
    description,
  });
  if (transactionId) {
    await admin
      .from("subscription_payments")
      .update({ djomy_transaction_id: transactionId })
      .eq("merchant_reference", merchantReference);
  }

  return { merchantReference, claimToken, amount };
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "***";
  const head = user.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
}

export interface ClaimSummary {
  status: string;
  cycle: string;
  planName: string | null;
  planCode: string | null;
  emailMasked: string;
  claimed: boolean;
  amount: number;
  currency: string;
  method: string | null;
  merchantReference: string;
  createdAt: string | null;
}

/** Résumé public (non sensible) d'un paiement anticipé à partir de son code. */
export async function getClaimSummary(
  admin: any,
  claimToken: string,
): Promise<ClaimSummary | null> {
  const { data } = await admin
    .from("subscription_payments")
    .select(
      "status, cycle, claim_email, claimed_at, org_id, expected_amount, currency, method, merchant_reference, created_at, plans(nom, code)",
    )
    .eq("claim_token", claimToken)
    .maybeSingle();
  if (!data) return null;
  return {
    status: data.status,
    cycle: data.cycle,
    planName: (data as any).plans?.nom ?? null,
    planCode: (data as any).plans?.code ?? null,
    emailMasked: maskEmail(data.claim_email ?? ""),
    claimed: !!data.claimed_at || !!data.org_id,
    amount: Number(data.expected_amount ?? 0),
    currency: data.currency ?? "GNF",
    method: data.method ?? null,
    merchantReference: data.merchant_reference,
    createdAt: data.created_at ?? null,
  };
}

/**
 * Revalide le statut réel du paiement auprès du prestataire puis renvoie le
 * résumé à jour. Utilisé par le suivi en temps réel côté navigateur.
 */
export async function syncClaimStatus(
  admin: any,
  claimToken: string,
): Promise<ClaimSummary | null> {
  const summary = await getClaimSummary(admin, claimToken);
  if (!summary) return null;
  if (summary.status !== "pending") return summary;
  try {
    await syncPaymentStatus(admin, summary.merchantReference);
  } catch {
    /* la revalidation distante ne doit pas casser l'affichage */
  }
  return await getClaimSummary(admin, claimToken);
}



/** Rattache un paiement anticipé réglé à l'organisation créée par l'utilisateur. */
export async function claimPayment(args: {
  admin: any;
  claimToken: string;
  orgId: string;
  userEmail: string;
  userId: string;
}): Promise<{ claimed: boolean; reason?: string }> {
  const { admin, claimToken, orgId } = args;

  const { data: payment } = await admin
    .from("subscription_payments")
    .select("id, status, cycle, plan_id, merchant_reference, claim_email, claimed_at, org_id")
    .eq("claim_token", claimToken)
    .maybeSingle();

  if (!payment) return { claimed: false, reason: "NOT_FOUND" };
  if (payment.claimed_at || payment.org_id) return { claimed: false, reason: "ALREADY_CLAIMED" };
  if (payment.status !== "success") return { claimed: false, reason: "NOT_PAID" };

  const expected = String(payment.claim_email ?? "").trim().toLowerCase();
  if (expected !== args.userEmail.trim().toLowerCase()) {
    return { claimed: false, reason: "EMAIL_MISMATCH" };
  }

  const { data: updated, error } = await admin
    .from("subscription_payments")
    .update({ org_id: orgId, claimed_at: new Date().toISOString() })
    .eq("id", payment.id)
    .is("claimed_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) return { claimed: false, reason: "ALREADY_CLAIMED" };

  await activateSubscription(admin, {
    orgId,
    planId: payment.plan_id,
    cycle: payment.cycle as Cycle,
    merchantReference: payment.merchant_reference,
  });

  await admin.from("billing_audit_log").insert({
    org_id: orgId,
    event: "subscription.claimed",
    payload: { merchant_reference: payment.merchant_reference, by: args.userId },
  });

  return { claimed: true };
}
