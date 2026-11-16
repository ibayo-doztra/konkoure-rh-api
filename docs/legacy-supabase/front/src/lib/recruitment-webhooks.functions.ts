import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  orgIdSchema,
  updateSchema,
  pingSchema,
  recordSchema,
  publicUploadSchema,
  isPlatformAdmin,
  validateWebhookUrl,
  runCandidateScoring,
} from "./recruitment-webhooks.server";

/**
 * Returns true when a candidate with the same email (case-insensitive) or the
 * same phone already applied to this job. Used to avoid spending AI credits on
 * duplicate applications: the n8n scoring workflow must never be called then.
 */
async function hasAlreadyApplied(
  admin: any,
  jobId: string,
  email: string,
  phone: string,
): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  const escaped = normalizedEmail.replace(/[\\%_]/g, (c) => `\\${c}`);
  const [byEmail, byPhone] = await Promise.all([
    admin.from("candidates").select("id").eq("job_id", jobId).ilike("email", escaped).limit(1),
    admin.from("candidates").select("id").eq("job_id", jobId).eq("phone", phone.trim()).limit(1),
  ]);
  if (byEmail.error || byPhone.error) {
    // Fail closed: never call the paid scoring workflow if we cannot verify.
    throw new Error("duplicate_check_failed");
  }
  return (byEmail.data?.length ?? 0) > 0 || (byPhone.data?.length ?? 0) > 0;
}

export const createPublicApplicationUpload = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => publicUploadSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: job } = await supabaseAdmin
      .from("jobs")
      .select("id, organization_id, status")
      .eq("id", data.jobId)
      .maybeSingle();

    if (!job || job.organization_id !== data.organizationId || job.status !== "published") {
      return { ok: false as const, reason: "invalid_job" as const };
    }

    const { orgHasModule } = await import("./entitlements.server");
    if (!(await orgHasModule(data.organizationId, "recruitment"))) {
      return { ok: false as const, reason: "invalid_job" as const };
    }

    // Stop duplicates before any file is uploaded (saves bandwidth and AI credits).
    if (await hasAlreadyApplied(supabaseAdmin, data.jobId, data.email, data.phone)) {
      return { ok: false as const, reason: "already_applied" as const };
    }

    const path = `${data.organizationId}/${data.jobId}/${data.candidateId}/${data.documentKey}.${data.extension}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("applications")
      .createSignedUploadUrl(path);

    if (error || !signed?.token) {
      console.error("[createPublicApplicationUpload] signed upload failed", {
        code: error?.name,
        organizationId: data.organizationId,
        jobId: data.jobId,
      });
      return { ok: false as const, reason: "upload_unavailable" as const };
    }

    return { ok: true as const, path, token: signed.token };
  });

export const getPlatformAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const isAdmin = await isPlatformAdmin(context.supabase, context.userId);
    if (!isAdmin) {
      // Non-admins only learn the active mode of an organization they belong to.
      const { data: member } = await context.supabase
        .from("organization_members")
        .select("id")
        .eq("organization_id", data.organizationId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!member) return { isPlatformAdmin: false as const, active_env: "off" as const };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("recruitment_webhook_configs")
      .select("active_env, test_webhook_url, prod_webhook_url, updated_at, updated_by")
      .eq("organization_id", data.organizationId)
      .maybeSingle();

    const active_env = (row?.active_env as "off" | "test" | "prod") ?? "off";

    if (!isAdmin) {
      return { isPlatformAdmin: false as const, active_env };
    }
    return {
      isPlatformAdmin: true as const,
      active_env,
      test_webhook_url: row?.test_webhook_url ?? "",
      prod_webhook_url: row?.prod_webhook_url ?? "",
      updated_at: row?.updated_at ?? null,
      updated_by: row?.updated_by ?? null,
    };
  });

export const updateRecruitmentWebhookConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const isAdmin = await isPlatformAdmin(supabase, userId);
    if (!isAdmin) throw new Error("Forbidden: platform admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      organization_id: data.organizationId,
      test_webhook_url: data.test_webhook_url || null,
      prod_webhook_url: data.prod_webhook_url || null,
      active_env: data.active_env,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin
      .from("recruitment_webhook_configs")
      .upsert(payload, { onConflict: "organization_id" });
    if (error) {
      console.error("[updateRecruitmentWebhookConfig] update failed", {
        code: error.code,
        organizationId: data.organizationId,
      });
      throw new Error("update_failed");
    }
    return { ok: true };
  });

export const pingRecruitmentWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => pingSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const isAdmin = await isPlatformAdmin(supabase, userId);
    if (!isAdmin) throw new Error("Forbidden: platform admin only");

    // Only ping a destination saved server-side; never a caller-supplied URL.
    let url = "";
    {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row } = await supabaseAdmin
        .from("recruitment_webhook_configs")
        .select("test_webhook_url, prod_webhook_url")
        .eq("organization_id", data.organizationId)
        .maybeSingle();
      url = (data.env === "test" ? row?.test_webhook_url : row?.prod_webhook_url) ?? "";
    }

    if (!url) {
      return { ok: false, status: 0, body: "Aucune URL enregistrée. Enregistrez d'abord la configuration." };
    }

    const validation = validateWebhookUrl(url);
    if (!validation.ok) {
      return { ok: false, status: 0, body: validation.error };
    }
    url = validation.url;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ping: true, source: "konkoure", env: data.env, at: new Date().toISOString() }),
        redirect: "manual",
        signal: controller.signal,
      });
      // Reject redirects — a webhook must respond directly, not bounce through
      // another host (defence against SSRF via redirect to private IPs).
      if (res.status >= 300 && res.status < 400) {
        return { ok: false, status: res.status, body: "Redirections interdites pour un webhook" };
      }
      const text = await res.text().catch(() => "");
      return { ok: res.ok, status: res.status, body: text.slice(0, 500) };
    } catch (e: any) {
      const detail = e?.name === "AbortError" ? "timeout" : "fetch failed";
      return { ok: false, status: 0, body: detail };
    } finally {
      clearTimeout(timeout);
    }
  });

export const recordPublicApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => recordSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verify the job is published and belongs to the org.
    const { data: job } = await supabaseAdmin
      .from("jobs")
      .select("id, organization_id, status, title")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job || job.organization_id !== data.organizationId || job.status !== "published") {
      return { ok: false as const, reason: "invalid_job" as const };
    }

    const { orgHasModule } = await import("./entitlements.server");
    if (!(await orgHasModule(data.organizationId, "recruitment"))) {
      return { ok: false as const, reason: "invalid_job" as const };
    }

    // Validate every storage path is under this candidate's own folder.
    const allowedPrefix = `${data.organizationId}/${data.jobId}/${data.candidate.id}/`;
    const refs = [
      data.candidate.cv_url,
      data.candidate.cover_letter_url,
      ...Object.values(data.candidate.documents ?? {}),
    ].filter((v): v is string => !!v);
    for (const ref of refs) {
      if (!/^https?:\/\//i.test(ref) && !ref.startsWith(allowedPrefix)) {
        return { ok: false as const, reason: "invalid_path" as const };
      }
    }

    // Ensure no candidate row already exists for this id (prevents replay/abuse of the scoring webhook).
    const { data: existing } = await supabaseAdmin
      .from("candidates")
      .select("id")
      .eq("id", data.candidate.id)
      .maybeSingle();
    if (existing) return { ok: false as const, reason: "duplicate" as const };

    // Never call the AI scoring workflow for someone who already applied to this job.
    if (await hasAlreadyApplied(supabaseAdmin, data.jobId, data.candidate.email, data.candidate.phone)) {
      return { ok: false as const, reason: "already_applied" as const };
    }

    // Run AI scoring server-side. The scoring endpoint is never exposed publicly —
    // it is only invoked here, after the job has been validated.
    const scoring = await runCandidateScoring({
      organizationId: data.organizationId,
      jobId: data.jobId,
      candidate: {
        id: data.candidate.id,
        full_name: data.candidate.full_name,
        email: data.candidate.email,
        phone: data.candidate.phone,
        cv_url: data.candidate.cv_url ?? null,
        cover_letter_url: data.candidate.cover_letter_url ?? null,
        documents: data.candidate.documents ?? {},
      },
    });
    if (!scoring.ok) {
      return { ok: false as const, reason: scoring.reason };
    }

    const { error } = await supabaseAdmin.from("candidates").insert({
      id: data.candidate.id,
      organization_id: data.organizationId,
      job_id: data.jobId,
      full_name: data.candidate.full_name,
      email: data.candidate.email,
      phone: data.candidate.phone,
      cv_url: data.candidate.cv_url ?? null,
      cover_letter_url: data.candidate.cover_letter_url ?? null,
      documents: data.candidate.documents ?? {},
      ai_score: scoring.score,
      ai_justification: scoring.justification,
      ai_strengths: scoring.strengths,
      ai_weaknesses: scoring.weaknesses,
      ai_is_valid_cv: scoring.is_valid_cv,
      ai_fraud_alert: scoring.fraud_alert,
      ai_candidate_name: scoring.candidate_name,
      ai_scored_at: new Date().toISOString(),
    });
    if (error) {
      if ((error as any).code === "23505") return { ok: false as const, reason: "duplicate" as const };
      console.error("[recordPublicApplication] insert candidate failed:", error);
      return { ok: false as const, reason: "insert_failed" as const };
    }

    const { error: activityError } = await supabaseAdmin.from("candidate_activities").insert({
      organization_id: data.organizationId,
      candidate_id: data.candidate.id,
      type: "created",
      payload: { description: "Candidature reçue via le site carrière" },
      created_at: new Date().toISOString(),
    });
    if (activityError) {
      console.error("[recordPublicApplication] activity insert failed", {
        code: activityError.code,
        candidateId: data.candidate.id,
        organizationId: data.organizationId,
      });
    }

    return { ok: true as const, reason: null };
  });
