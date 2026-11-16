// Fonctions serveur PUBLIQUES : paiement d'un abonnement avant la création
// du compte. Aucune donnée sensible n'est renvoyée au navigateur.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  claimPayment,
  getAdmin,
  getClaimSummary,
  startAnonymousPayment,
  syncClaimStatus,
  syncPaymentStatus,
} from "./billing.server";

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?224?\s?\d{9}$|^\d{9}$/, "Numéro guinéen invalide (9 chiffres).")
  .max(20);

const planSchema = z.enum(["essentiel", "professionnel", "entreprise"]);
const cycleSchema = z.enum(["mensuel", "annuel"]);

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Envoie un code à 6 chiffres à l'adresse e-mail saisie. Le paiement ne peut
 * être lancé qu'avec ce code : un inconnu ne peut donc pas déclencher de
 * demande de paiement sur le téléphone d'une autre personne.
 */
export const requestPrepaidEmailCode = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ email: z.string().trim().toLowerCase().email("Adresse e-mail invalide.").max(255) }).parse(data),
  )
  .handler(async ({ data }) => {
    const admin: any = await getAdmin();
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("prepaid_email_codes")
      .select("id", { count: "exact", head: true })
      .eq("email", data.email)
      .gte("created_at", since);
    if ((count ?? 0) >= 5) {
      throw new Error("Trop de codes demandés. Réessayez dans une heure.");
    }
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    const code = String(bytes[0] % 1_000_000).padStart(6, "0");
    const { error } = await admin.from("prepaid_email_codes").insert({
      email: data.email,
      code_hash: await sha256Hex(`${data.email}:${code}`),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (error) throw new Error("Envoi du code impossible. Réessayez.");
    const { sendEmail } = await import("./emails.server");
    try {
      await sendEmail({
        to: data.email,
        subject: `Votre code Konkouré : ${code}`,
        html: `<p>Votre code de vérification pour le paiement Konkouré est :</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>Il expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>`,
        text: `Votre code Konkouré : ${code} (valable 10 minutes).`,
      });
    } catch {
      throw new Error("Envoi du code impossible. Réessayez.");
    }
    return { ok: true as const };
  });

async function consumeEmailCode(admin: any, email: string, code: string): Promise<string> {
  const { data: row } = await admin
    .from("prepaid_email_codes")
    .select("id, code_hash, attempts, expires_at")
    .eq("email", email)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const invalid = new Error("Code de vérification invalide ou expiré.");
  if (!row || new Date(row.expires_at).getTime() < Date.now() || row.attempts >= 5) throw invalid;
  const hash = await sha256Hex(`${email}:${code}`);
  if (hash !== row.code_hash) {
    await admin.from("prepaid_email_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
    throw invalid;
  }
  const { data: used } = await admin
    .from("prepaid_email_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("consumed_at", null)
    .select("id");
  if (!used?.length) throw invalid;
  return row.id as string;
}

/** Démarre un paiement sans compte : Mobile Money direct ou carte (redirection). */
export const startPrepaidPayment = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        planCode: planSchema,
        cycle: cycleSchema,
        paymentMethod: z.enum(["orange_money", "mtn_momo", "card"]),
        payerNumber: phoneSchema,
        email: z.string().trim().toLowerCase().email("Adresse e-mail invalide.").max(255),
        emailCode: z.string().trim().regex(/^\d{6}$/, "Code à 6 chiffres requis."),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const admin: any = await getAdmin();
    const codeId = await consumeEmailCode(admin, data.email, data.emailCode);
    try {
      return await startAnonymousPayment({
        admin,
        planCode: data.planCode,
        cycle: data.cycle,
        email: data.email,
        payerNumber: data.payerNumber.replace(/[^\d]/g, "").slice(-9),
        paymentMethod: data.paymentMethod,
      });
    } catch (err) {
      // Payment did not start: give the code back so the buyer can retry.
      await admin.from("prepaid_email_codes").update({ consumed_at: null }).eq("id", codeId);
      throw err;
    }
  });

/** Statut réel d'un paiement anticipé (revalidé auprès du prestataire). */
export const refreshPrepaidStatus = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        merchantReference: z.string().uuid(),
        claimToken: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const { data: row } = await admin
      .from("subscription_payments")
      .select("merchant_reference")
      .eq("merchant_reference", data.merchantReference)
      .eq("claim_token", data.claimToken)
      .maybeSingle();
    if (!row) throw new Error("Paiement introuvable.");
    return await syncPaymentStatus(admin, data.merchantReference);
  });

/** Résumé d'un code de rattachement (offre, cycle, statut, e-mail masqué). */
export const getPrepaidSummary = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        claimToken: z.string().uuid(),
        refresh: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    return data.refresh
      ? await syncClaimStatus(admin, data.claimToken)
      : await getClaimSummary(admin, data.claimToken);
  });

/** Rattache un paiement anticipé à l'organisation de l'utilisateur connecté. */
export const claimPrepaidPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ claimToken: z.string().uuid(), organizationId: z.string().uuid() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: roles, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    const isAdmin = (roles ?? []).some(
      (r: { role: string }) => r.role === "owner" || r.role === "hr_admin",
    );
    if (!isAdmin) throw new Error("Non autorisé : rôle administrateur requis.");

    const { data: userRes } = await context.supabase.auth.getUser();
    const email = userRes?.user?.email ?? "";
    if (!email) throw new Error("Compte sans adresse e-mail.");

    const admin = await getAdmin();
    return await claimPayment({
      admin,
      claimToken: data.claimToken,
      orgId: data.organizationId,
      userEmail: email,
      userId: context.userId,
    });
  });

/** Offres publiques (colonnes non sensibles) pour la page de paiement anticipé. */
export const listPublicPlans = createServerFn({ method: "GET" }).handler(async () => {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("plans")
    .select("id, code, nom, prix_gnf, max_employes, credits_ia_mois, sort_order")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as any[];
});
