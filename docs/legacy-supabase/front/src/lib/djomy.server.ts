// Client Djomy + logique d'abonnement — SERVEUR UNIQUEMENT.
// Aucun secret ni appel Djomy ne doit transiter par le navigateur.
import { createHmac, timingSafeEqual } from "node:crypto";

export const DJOMY_DEFAULT_BASE_URL = "https://api.djomy.africa";

export type Cycle = "mensuel" | "annuel";

export interface DjomyConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
}

export function getDjomyConfig(): DjomyConfig {
  const clientId = process.env.DJOMY_CLIENT_ID?.trim();
  const clientSecret = process.env.DJOMY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Configuration Djomy manquante (DJOMY_CLIENT_ID / DJOMY_CLIENT_SECRET).");
  }
  // La variable peut être fournie avec ou sans le suffixe de version : on
  // normalise pour que les chemins internes (`/v1/...`) ne soient pas doublés.
  const baseUrl = (process.env.DJOMY_BASE_URL?.trim() || DJOMY_DEFAULT_BASE_URL)
    .replace(/\/+$/, "")
    .replace(/\/v\d+$/, "");
  return { clientId, clientSecret, baseUrl };
}

/** signature = HMAC_SHA256(message = clientId, key = clientSecret) en hexadécimal */
export function apiKeyHeader(cfg: DjomyConfig): string {
  const signature = createHmac("sha256", cfg.clientSecret).update(cfg.clientId).digest("hex");
  return `${cfg.clientId}:${signature}`;
}

/** Comparaison à temps constant de deux signatures hexadécimales. */
export function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Vérifie l'en-tête X-Webhook-Signature au format `v1:<hmac_sha256(rawBody, clientSecret)>`. */
export function verifyWebhookSignature(
  rawBody: string,
  header: string | null,
  clientSecret: string,
): boolean {
  if (!header) return false;
  const received = header.includes(":") ? header.split(":").slice(1).join(":") : header;
  const expected = createHmac("sha256", clientSecret).update(rawBody, "utf8").digest("hex");
  return safeEqualHex(received.trim().toLowerCase(), expected);
}

// ---------------------------------------------------------------------------
// Bearer token — mis en cache jusqu'à expiration
// ---------------------------------------------------------------------------
let tokenCache: { token: string; expiresAt: number } | null = null;

async function fetchWithBackoff(
  url: string,
  init: RequestInit,
  attempts = 3,
): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) {
        if (i === attempts - 1) return res;
        await new Promise((r) => setTimeout(r, 400 * 2 ** i));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, 400 * 2 ** i));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Djomy: requête échouée");
}

export async function getDjomyToken(cfg: DjomyConfig): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) return tokenCache.token;

  const res = await fetchWithBackoff(`${cfg.baseUrl}/v1/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKeyHeader(cfg) },
    body: "{}",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[djomy] auth failed", { url: `${cfg.baseUrl}/v1/auth`, status: res.status, detail: detail.slice(0, 300) });
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "Le service de paiement a refusé l'authentification. Vérifiez les identifiants Djomy (environnement sandbox/live).",
      );
    }
    throw new Error(`Djomy: authentification refusée (${res.status})`);
  }
  const payload = (await res.json()) as Record<string, any>;
  const data = payload?.data ?? payload;
  const token: string | undefined = data?.accessToken ?? data?.token ?? data?.access_token;
  if (!token) throw new Error("Djomy: token absent de la réponse d'authentification");
  const expiresInSec = Number(data?.expiresIn ?? data?.expires_in ?? 3300);
  tokenCache = { token, expiresAt: now + Math.max(60, expiresInSec) * 1000 };
  return token;
}

export async function djomyRequest<T = any>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
): Promise<{ status: number; data: T }> {
  const cfg = getDjomyConfig();
  const token = await getDjomyToken(cfg);
  const res = await fetchWithBackoff(`${cfg.baseUrl}${path}`, {
    method: init.method,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKeyHeader(cfg),
      Authorization: `Bearer ${token}`,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data: data as T };
}

// ---------------------------------------------------------------------------
// Logique métier abonnement (service_role)
// ---------------------------------------------------------------------------
export function computeAmount(prixMensuel: number, cycle: Cycle): number {
  // Annuel = 2 mois offerts → 10 mois payés.
  return cycle === "annuel" ? Math.round(prixMensuel * 10) : Math.round(prixMensuel);
}

export function addPeriod(from: Date, cycle: Cycle): Date {
  const d = new Date(from.getTime());
  d.setMonth(d.getMonth() + (cycle === "annuel" ? 12 : 1));
  return d;
}

export async function auditBilling(
  admin: any,
  orgId: string | null,
  event: string,
  payload: Record<string, unknown>,
) {
  try {
    await admin.from("billing_audit_log").insert({ org_id: orgId, event, payload });
  } catch {
    /* l'audit ne doit jamais casser le flux */
  }
}

export interface SettleResult {
  applied: boolean;
  reason?: string;
}

/**
 * Applique un résultat de paiement (source de vérité serveur uniquement).
 * `status` doit provenir d'un webhook signé ou de GET /v1/payments/{id}/status.
 */
export async function settlePayment(
  admin: any,
  args: {
    merchantReference: string;
    status: "success" | "failed" | "cancelled" | "pending";
    paidAmount?: number | null;
    currency?: string | null;
    transactionId?: string | null;
    method?: string | null;
    rawEvent?: unknown;
  },
): Promise<SettleResult> {
  const { data: payment } = await admin
    .from("subscription_payments")
    .select("*")
    .eq("merchant_reference", args.merchantReference)
    .maybeSingle();

  if (!payment) return { applied: false, reason: "PAYMENT_NOT_FOUND" };
  if (payment.status === "success") return { applied: false, reason: "ALREADY_SETTLED" };

  if (args.status === "pending") return { applied: false, reason: "STILL_PENDING" };

  if (args.status !== "success") {
    await admin
      .from("subscription_payments")
      .update({
        status: args.status,
        djomy_transaction_id: args.transactionId ?? payment.djomy_transaction_id,
        method: args.method ?? payment.method,
        raw_event: (args.rawEvent as any) ?? null,
      })
      .eq("id", payment.id);
    await auditBilling(admin, payment.org_id, `payment.${args.status}`, {
      merchant_reference: args.merchantReference,
    });
    return { applied: true };
  }

  // Rapprochement montant / devise — refus si écart.
  const expected = Number(payment.expected_amount);
  const paid = args.paidAmount == null ? expected : Number(args.paidAmount);
  const currency = (args.currency ?? payment.currency ?? "GNF").toUpperCase();
  if (!Number.isFinite(paid) || Math.round(paid) !== Math.round(expected) || currency !== "GNF") {
    await admin
      .from("subscription_payments")
      .update({ status: "mismatch", raw_event: (args.rawEvent as any) ?? null })
      .eq("id", payment.id);
    await auditBilling(admin, payment.org_id, "payment.amount_mismatch", {
      merchant_reference: args.merchantReference,
      expected,
      paid,
      currency,
    });
    return { applied: false, reason: "AMOUNT_MISMATCH" };
  }

  await admin
    .from("subscription_payments")
    .update({
      status: "success",
      djomy_transaction_id: args.transactionId ?? payment.djomy_transaction_id,
      method: args.method ?? payment.method,
      raw_event: (args.rawEvent as any) ?? null,
    })
    .eq("id", payment.id);

  // Paiement anticipé (avant création du compte) : pas encore d'organisation.
  // L'abonnement sera activé au rattachement (claimPayment).
  if (!payment.org_id) return { applied: true };

  await activateSubscription(admin, {
    orgId: payment.org_id,
    planId: payment.plan_id,
    cycle: payment.cycle as Cycle,
    merchantReference: args.merchantReference,
  });

  return { applied: true };
}

/** Applique une offre payée à une organisation (offre, cycle, période). */
export async function activateSubscription(
  admin: any,
  args: { orgId: string; planId: string; cycle: Cycle; merchantReference: string },
): Promise<{ periodeFin: string }> {
  const { data: org } = await admin
    .from("organizations")
    .select("id, periode_fin")
    .eq("id", args.orgId)
    .maybeSingle();

  const now = new Date();
  const current = org?.periode_fin ? new Date(org.periode_fin) : now;
  const base = current > now ? current : now;
  const nextEnd = addPeriod(base, args.cycle);

  await admin
    .from("organizations")
    .update({
      plan_id: args.planId,
      statut_abo: "active",
      cycle: args.cycle,
      periode_fin: nextEnd.toISOString(),
    })
    .eq("id", args.orgId);

  await auditBilling(admin, args.orgId, "subscription.activated", {
    merchant_reference: args.merchantReference,
    plan_id: args.planId,
    cycle: args.cycle,
    periode_fin: nextEnd.toISOString(),
  });

  return { periodeFin: nextEnd.toISOString() };
}

/** Normalise le statut renvoyé par Djomy. */
export function normalizeDjomyStatus(raw: unknown): "success" | "failed" | "cancelled" | "pending" {
  const s = String(raw ?? "").toUpperCase();
  if (["SUCCESS", "SUCCEEDED", "COMPLETED", "PAID", "PAYMENT.SUCCESS"].includes(s)) return "success";
  if (["CANCELLED", "CANCELED", "PAYMENT.CANCELLED"].includes(s)) return "cancelled";
  if (["FAILED", "ERROR", "EXPIRED", "PAYMENT.FAILED"].includes(s)) return "failed";
  return "pending";
}

export type PaymentMethod = "orange_money" | "mtn_momo" | "card";

const DJOMY_METHOD: Record<PaymentMethod, string> = {
  orange_money: "ORANGE_MONEY",
  mtn_momo: "MTN_MOMO",
  card: "CARD",
};

/** Codes attendus par l'API de collecte directe. */
const DJOMY_DIRECT_METHOD: Record<Exclude<PaymentMethod, "card">, string> = {
  orange_money: "OM",
  mtn_momo: "MOMO",
};


/** Crée un paiement Djomy (gateway) et renvoie l'URL de redirection. */
export async function createGatewayPayment(args: {
  amount: number;
  merchantReference: string;
  payerNumber?: string | null;
  paymentMethod?: PaymentMethod | null;
  returnUrl: string;
  cancelUrl: string;
  metadata: Record<string, unknown>;
  description: string;
}): Promise<{ redirectUrl: string; transactionId: string | null }> {
  const { status, data } = await djomyRequest("/v1/payments/gateway", {
    method: "POST",
    body: {
      amount: args.amount,
      currency: "GNF",
      countryCode: "GN",
      payerNumber: args.payerNumber || undefined,
      paymentMethod: args.paymentMethod ? DJOMY_METHOD[args.paymentMethod] : undefined,
      merchantPaymentReference: args.merchantReference,
      description: args.description,
      returnUrl: args.returnUrl,
      cancelUrl: args.cancelUrl,
      metadata: args.metadata,
    },
  });

  if (status >= 400) {
    const message =
      (data as any)?.message ?? (data as any)?.error ?? `Djomy: création du paiement refusée (${status})`;
    throw new Error(String(message));
  }

  const payload = (data as any)?.data ?? data;
  const redirectUrl: string | undefined =
    payload?.paymentUrl ?? payload?.redirectUrl ?? payload?.url ?? payload?.checkoutUrl;
  if (!redirectUrl) throw new Error("Djomy: URL de paiement absente de la réponse");

  return {
    redirectUrl,
    transactionId: payload?.transactionId ?? payload?.id ?? null,
  };
}

/**
 * Collecte directe Mobile Money (push USSD/OTP) — aucune redirection.
 * Renvoie l'identifiant de transaction ; le résultat arrive via le webhook
 * signé ou la vérification de statut côté serveur.
 */
export async function createDirectCharge(args: {
  amount: number;
  merchantReference: string;
  payerNumber: string;
  paymentMethod: Exclude<PaymentMethod, "card">;
  metadata: Record<string, unknown>;
  description: string;
}): Promise<{ transactionId: string | null; status: "success" | "failed" | "cancelled" | "pending" }> {
  // Le payeur doit être au format international (+224XXXXXXXXX).
  const digits = args.payerNumber.replace(/\D/g, "").replace(/^0+/, "");
  const local = digits.startsWith("224") ? digits.slice(3) : digits;
  const payerIdentifier = `+224${local.slice(-9)}`;

  const body = {
    amount: args.amount,
    countryCode: "GN",
    payerIdentifier,
    paymentMethod: DJOMY_DIRECT_METHOD[args.paymentMethod],
    merchantPaymentReference: args.merchantReference,
    description: args.description,
    metadata: args.metadata,
  };

  const { status, data } = await djomyRequest("/v1/payments", { method: "POST", body });
  if (status >= 400) {
    const errors = (data as any)?.errors;
    const message =
      (Array.isArray(errors) && errors.length ? errors.join(" ") : null) ??
      (data as any)?.message ??
      `Djomy: paiement refusé (${status})`;
    console.error("[djomy] direct charge failed", { status, data });
    throw new Error(String(message));
  }

  const payload = (data as any)?.data ?? data;
  return {
    transactionId: payload?.transactionId ?? payload?.id ?? null,
    status: normalizeDjomyStatus(payload?.status ?? "PENDING"),
  };
}


/** Statut distant d'une transaction Djomy (vérification serveur). */
export async function fetchRemoteStatus(transactionId: string): Promise<{
  status: "success" | "failed" | "cancelled" | "pending";
  payload: any;
}> {
  const { status, data } = await djomyRequest(
    `/v1/payments/${encodeURIComponent(transactionId)}/status`,
  );
  if (status >= 400) return { status: "pending", payload: null };
  const payload = (data as any)?.data ?? data;
  return { status: normalizeDjomyStatus(payload?.status), payload };
}
