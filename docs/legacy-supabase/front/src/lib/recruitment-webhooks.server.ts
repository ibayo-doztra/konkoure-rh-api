import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export function getPlatformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function isPlatformAdmin(supabase: any, userId: string): Promise<boolean> {
  const emails = getPlatformAdminEmails();
  if (emails.length === 0) return false;
  const { data } = await supabase.auth.getUser();
  const email = data?.user?.email?.toLowerCase();
  if (!email) return false;
  return emails.includes(email);
}

export const orgIdSchema = z.object({ organizationId: z.string().uuid() });

export const updateSchema = z.object({
  organizationId: z.string().uuid(),
  test_webhook_url: z.string().trim().max(2048).url().or(z.literal("")).nullable().optional(),
  prod_webhook_url: z.string().trim().max(2048).url().or(z.literal("")).nullable().optional(),
  active_env: z.enum(["off", "test", "prod"]),
});

export const pingSchema = z.object({
  organizationId: z.string().uuid(),
  env: z.enum(["test", "prod"]),
  url: z.string().trim().max(2048).url().optional(),
});

export const candidateRefSchema = z.string().trim().min(1).max(1024);



// Guinean mobile format enforced by the public application form: "622 00 00 00".
const phoneSchema = z.string().trim().regex(/^\d{3} \d{2} \d{2} \d{2}$/, "format téléphone invalide");

export const scoreSchema = z.object({
  organizationId: z.string().uuid(),
  jobId: z.string().uuid(),
  candidate: z.object({
    id: z.string().uuid(),
    full_name: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(200),
    phone: phoneSchema,
    cv_url: candidateRefSchema.nullable().optional(),
    cover_letter_url: candidateRefSchema.nullable().optional(),
    documents: z.record(z.string(), candidateRefSchema).optional().default({}),
  }),
});

// Accepts the current n8n "Respond to webhook" payload as well as the legacy
// shape, and normalises both into a single scoring result.
const bulletList = z.array(z.string().trim().max(1000)).max(30).optional().default([]);

export const n8nResponseSchema = z
  .object({
    // current format
    match_score: z.coerce.number().min(0).max(100).optional(),
    summary_opinion: z.string().trim().max(5000).optional(),
    weaknesses_or_missing: bulletList,
    is_valid_cv: z.coerce.boolean().optional(),
    fraud_alert: z.coerce.boolean().optional(),
    candidate_name: z.string().trim().max(200).optional(),
    cv_url: z.string().trim().max(4096).optional(),
    // legacy format
    score: z.coerce.number().min(0).max(100).optional(),
    justification: z.string().trim().max(5000).optional(),
    strengths: bulletList,
    weaknesses: bulletList,
  })
  .transform((v) => ({
    score: v.match_score ?? v.score,
    justification: (v.summary_opinion ?? v.justification ?? "").trim(),
    strengths: v.strengths,
    weaknesses: v.weaknesses_or_missing.length ? v.weaknesses_or_missing : v.weaknesses,
    is_valid_cv: v.is_valid_cv ?? null,
    fraud_alert: v.fraud_alert ?? null,
    candidate_name: v.candidate_name ?? null,
    cv_url: v.cv_url ?? null,
  }))
  .refine((v) => typeof v.score === "number" && v.justification.length > 0, {
    message: "score et justification requis",
  });

export type ScoringResult = {
  score: number;
  justification: string;
  strengths: string[];
  weaknesses: string[];
  is_valid_cv: boolean | null;
  fraud_alert: boolean | null;
  candidate_name: string | null;
};

export const recordSchema = z.object({
  organizationId: z.string().uuid(),
  jobId: z.string().uuid(),
  candidate: z.object({
    id: z.string().uuid(),
    full_name: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(200),
    phone: phoneSchema,
    cv_url: z.string().trim().max(1024).nullable().optional(),
    cover_letter_url: z.string().trim().max(1024).nullable().optional(),
    documents: z.record(z.string(), z.string().trim().max(1024)).optional().default({}),
  }),
});

export const publicUploadSchema = z.object({
  organizationId: z.string().uuid(),
  jobId: z.string().uuid(),
  candidateId: z.string().uuid(),
  documentKey: z.string().trim().regex(/^[a-z0-9_-]{1,64}$/i),
  extension: z.enum(["pdf", "doc", "docx", "jpg", "jpeg", "png"]),
  email: z.string().trim().email().max(200),
  phone: phoneSchema,
});

export const duplicateCheckSchema = z.object({
  organizationId: z.string().uuid(),
  jobId: z.string().uuid(),
  email: z.string().trim().email().max(200),
  phone: phoneSchema,
});

export function validateWebhookUrl(url: string): { ok: true; url: string } | { ok: false; error: string } {
  // Reject non-printable, whitespace or credentials-in-string sniffing before parsing.
  if (/[\s<>"'`\\]/.test(url)) return { ok: false, error: "URL invalide" };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: "URL invalide" };
  }
  if (parsed.protocol !== "https:") return { ok: false, error: "L'URL doit utiliser https://" };

  // No credentials in URL
  if (parsed.username || parsed.password) {
    return { ok: false, error: "Identifiants dans l'URL interdits" };
  }

  // Restrict to https default port
  if (parsed.port && parsed.port !== "443") {
    return { ok: false, error: "Port non autorisé (443 uniquement)" };
  }

  const host = parsed.hostname.toLowerCase();

  // Block loopback / link-local / cloud metadata / internal TLDs
  if (
    host === "" ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "169.254.169.254" ||
    host === "metadata.google.internal" ||
    host === "metadata" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost") ||
    host.endsWith(".localdomain") ||
    host.endsWith(".intranet") ||
    host.endsWith(".corp") ||
    host.endsWith(".home") ||
    host.endsWith(".lan")
  ) {
    return { ok: false, error: "Hôte interne interdit" };
  }

  // Reject any percent-encoded, punycode-embedded IPs, or non-ASCII host tricks.
  if (/%|xn--0|xn--1/i.test(host)) {
    return { ok: false, error: "Nom d'hôte invalide" };
  }
  if (!/^[a-z0-9.\-]+$/.test(host)) {
    return { ok: false, error: "Nom d'hôte invalide" };
  }

  // Block bare IPv4 in private / reserved ranges (RFC1918, CGNAT, benchmark, TEST-NET, multicast, class E)
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    const parts = [a, b, Number(m[3]), Number(m[4])];
    if (parts.some((n) => n < 0 || n > 255)) {
      return { ok: false, error: "IP invalide" };
    }
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64.0.0/10
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51) ||
      (a === 203 && b === 0) ||
      a >= 224
    ) {
      return { ok: false, error: "IP privée ou réservée interdite" };
    }
    // Even public IPv4 literals are disallowed — require a DNS hostname.
    return { ok: false, error: "IP littérale non autorisée, utilisez un nom de domaine" };
  }

  // Block any IPv6 literal (bracketed or bare with colons)
  if (host.startsWith("[") || host.includes(":")) {
    return { ok: false, error: "Adresses IPv6 non autorisées, utilisez un nom de domaine" };
  }

  // Require a fully-qualified DNS hostname
  if (!host.includes(".") || host.startsWith(".") || host.endsWith(".") || host.includes("..")) {
    return { ok: false, error: "Nom d'hôte invalide" };
  }

  return { ok: true, url: parsed.toString() };
}

export type ScoreInput = z.infer<typeof scoreSchema>;

// Internal helper — not exposed as a public server function. Invoked from
// recordPublicApplication after a job has been validated, so the scoring
// endpoint cannot be probed by anonymous callers.
export async function runCandidateScoring(
  data: ScoreInput,
  opts: { requirePublished?: boolean } = {},
) {
  const requirePublished = opts.requirePublished !== false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: cfg } = await supabaseAdmin
    .from("recruitment_webhook_configs")
    .select("test_webhook_url, prod_webhook_url, active_env")
    .eq("organization_id", data.organizationId)
    .maybeSingle();

  const activeEnv = (cfg?.active_env as "off" | "test" | "prod" | undefined) ?? "off";
  if (activeEnv === "off") return { ok: false as const, reason: "disabled" as const };

  const url = activeEnv === "test" ? cfg?.test_webhook_url : cfg?.prod_webhook_url;
  if (!url) return { ok: false as const, reason: "disabled" as const };

  const validation = validateWebhookUrl(url);
  if (!validation.ok) {
    return { ok: false as const, reason: "unreachable" as const, detail: validation.error };
  }

  const [{ data: job }, { data: org }] = await Promise.all([
    supabaseAdmin
      .from("jobs")
      .select("id, organization_id, title, slug, location, deadline, department_id, status, description, requirements, contract_type")
      .eq("id", data.jobId)
      .maybeSingle(),
    supabaseAdmin
      .from("organizations")
      .select("id, name, slug, logo_url")
      .eq("id", data.organizationId)
      .maybeSingle(),
  ]);

  if (
    !job ||
    job.organization_id !== data.organizationId ||
    (requirePublished && job.status !== "published")
  ) {
    return { ok: false as const, reason: "unreachable" as const, detail: "Job/organisation invalide" };
  }

  const allowedPrefix = `${data.organizationId}/${data.jobId}/${data.candidate.id}/`;

  // Convert any storage paths to time-limited signed URLs so n8n / the AI agent can fetch the files.
  // Only sign paths that belong to this candidate's own folder to prevent abuse.
  async function signIfPath(ref?: string | null): Promise<string | null | undefined> {
    if (!ref) return ref ?? null;
    if (/^https?:\/\//i.test(ref)) return ref;
    if (!ref.startsWith(allowedPrefix)) return null;
    const { data: signed } = await supabaseAdmin.storage
      .from("applications")
      .createSignedUrl(ref, 60 * 60);
    return signed?.signedUrl ?? null;
  }
  const signedCv = await signIfPath(data.candidate.cv_url ?? null);
  const signedCover = await signIfPath(data.candidate.cover_letter_url ?? null);
  const signedDocs: Record<string, string> = {};
  for (const [k, v] of Object.entries(data.candidate.documents ?? {})) {
    const s = await signIfPath(v);
    if (s) signedDocs[k] = s;
  }

  const payload = {
    event: "candidate.scoring_request",
    env: activeEnv,
    sent_at: new Date().toISOString(),
    organization: org ?? { id: data.organizationId },
    job: {
      id: job.id,
      title: job.title,
      slug: job.slug,
      location: job.location,
      deadline: job.deadline,
      department_id: job.department_id,
      description: job.description,
      requirements: job.requirements,
      contract_type: (job as any).contract_type ?? null,
      contract_type_label: (() => { const ct = (job as any).contract_type; return ct === "stage" ? "Stage" : ct === "cdd" ? "CDD" : ct === "cdi" ? "CDI" : ct ?? null; })(),
    },
    candidate: {
      ...data.candidate,
      cv_url: signedCv,
      cover_letter_url: signedCover,
      documents: signedDocs,
    },
  };

  const controller = new AbortController();
  // The n8n AI analysis typically takes 40–60 s: wait up to 3 minutes.
  const timeout = setTimeout(() => controller.abort(), 180_000);
  try {
    const res = await fetch(validation.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      redirect: "manual",
      signal: controller.signal,
    });
    if (res.status >= 300 && res.status < 400) {
      return { ok: false as const, reason: "unreachable" as const, detail: "Redirections interdites" };
    }

    if (!res.ok) {
      return { ok: false as const, reason: "unreachable" as const, detail: `HTTP ${res.status}` };
    }
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false as const, reason: "unreachable" as const, detail: "Réponse non-JSON" };
    }
    const candidatePayload = Array.isArray(json) ? json[0] : json;
    const parsed = n8nResponseSchema.safeParse(candidatePayload);
    if (!parsed.success) {
      return { ok: false as const, reason: "unreachable" as const, detail: "Format de scoring invalide" };
    }
    const result: ScoringResult = {
      score: Math.round(parsed.data.score ?? 0),
      justification: parsed.data.justification,
      strengths: parsed.data.strengths,
      weaknesses: parsed.data.weaknesses,
      is_valid_cv: parsed.data.is_valid_cv,
      fraud_alert: parsed.data.fraud_alert,
      candidate_name: parsed.data.candidate_name,
    };
    return { ok: true as const, ...result };
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return { ok: false as const, reason: "timeout" as const, detail: "timeout" };
    }
    return { ok: false as const, reason: "unreachable" as const, detail: e?.message ?? "fetch failed" };
  } finally {
    clearTimeout(timeout);
  }
}
