import { createServerFn } from "@tanstack/react-start";
import { requireModule } from "./entitlements.server";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PROVIDER_CONFIG,
  getAdmin,
  getProviderCreds,
  publishToProvider,
  type Provider,
} from "./social.server";

const providerSchema = z.enum(["facebook", "linkedin", "twitter"]);

async function getOrgIdForUser(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error || !data?.organization_id) throw new Error("Aucune organisation pour cet utilisateur");
  return data.organization_id as string;
}

export const listSocialAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const orgId = await getOrgIdForUser(supabase, userId);
    await requireModule(orgId, "integrations");
    const { data, error } = await supabase
      .from("social_accounts")
      .select("id, provider, account_id, account_name, status, connected_at, scopes")
      .eq("organization_id", orgId)
      .order("connected_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { accounts: data ?? [] };
  });

export const disconnectSocialAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("social_accounts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const checkProviderConfig = createServerFn({ method: "GET" })
  .inputValidator((input: { provider: Provider }) =>
    z.object({ provider: providerSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const cfg = PROVIDER_CONFIG[data.provider];
    return {
      configured:
        !!process.env[cfg.clientIdEnv] && !!process.env[cfg.clientSecretEnv],
      clientIdEnv: cfg.clientIdEnv,
      clientSecretEnv: cfg.clientSecretEnv,
    };
  });

export const publishJobToSocials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    jobId: string;
    items: Array<{ accountId: string; content: string }>;
    mediaUrls?: string[];
  }) =>
    z
      .object({
        jobId: z.string().uuid(),
        items: z
          .array(
            z.object({
              accountId: z.string().uuid(),
              content: z.string().min(1).max(8000),
            }),
          )
          .min(1)
          .max(20),
        mediaUrls: z.array(z.string().url()).max(4).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = await getOrgIdForUser(supabase, userId);
    await requireModule(orgId, "integrations");

    // Only owners, HR admins and recruiters may publish on the organization's accounts.
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", orgId);
    const allowed = (roles ?? []).some((r: { role: string }) =>
      ["owner", "hr_admin", "recruiter"].includes(r.role),
    );
    if (!allowed) throw new Error("Non autorisé à publier sur les réseaux sociaux.");

    // Verify job belongs to org
    const { data: job } = await supabase
      .from("jobs")
      .select("id, organization_id")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job || job.organization_id !== orgId) throw new Error("Offre introuvable");

    const accountIds = data.items.map((i) => i.accountId);
    const admin = getAdmin();
    const { data: accounts, error: accErr } = await admin
      .from("social_accounts")
      .select("*")
      .in("id", accountIds)
      .eq("organization_id", orgId);
    if (accErr) throw new Error(accErr.message);

    const results: Array<{
      accountId: string;
      provider: Provider;
      status: "published" | "failed";
      external_url?: string;
      error?: string;
    }> = [];

    const mediaUrls = data.mediaUrls ?? [];

    for (const item of data.items) {
      const acc = accounts?.find((a) => a.id === item.accountId);
      if (!acc) {
        results.push({ accountId: item.accountId, provider: "facebook", status: "failed", error: "Compte introuvable" });
        continue;
      }
      try {
        const { data: tok, error: tokErr } = await admin.rpc(
          "get_social_account_token" as never,
          { _account_id: acc.id } as never,
        );
        if (tokErr) throw new Error(tokErr.message);
        const tokRow = Array.isArray(tok) ? (tok[0] as { access_token?: string } | undefined) : undefined;
        const accessToken = tokRow?.access_token;
        if (!accessToken) throw new Error("Jeton d'accès introuvable");
        const out = await publishToProvider({
          provider: acc.provider as Provider,
          accessToken,
          accountId: acc.account_id,
          metadata: (acc.metadata as Record<string, unknown>) ?? {},
          content: item.content,
          mediaUrls,
        });
        await admin.from("social_posts").insert({
          organization_id: orgId,
          job_id: data.jobId,
          social_account_id: acc.id,
          provider: acc.provider,
          external_post_id: out.external_post_id,
          external_url: out.external_url,
          content: item.content,
          media_urls: mediaUrls,
          status: "published",
          published_at: new Date().toISOString(),
          created_by: userId,
        });
        results.push({ accountId: acc.id, provider: acc.provider as Provider, status: "published", external_url: out.external_url });
      } catch (e: any) {
        await admin.from("social_posts").insert({
          organization_id: orgId,
          job_id: data.jobId,
          social_account_id: acc.id,
          provider: acc.provider,
          content: item.content,
          media_urls: mediaUrls,
          status: "failed",
          error_message: String(e?.message ?? e),
          created_by: userId,
        });
        results.push({ accountId: acc.id, provider: acc.provider as Provider, status: "failed", error: String(e?.message ?? e) });
      }
    }

    return { results };
  });

export const listJobSocialPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { jobId: string }) =>
    z.object({ jobId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: posts, error } = await supabase
      .from("social_posts")
      .select("id, provider, status, external_url, error_message, published_at, created_at")
      .eq("job_id", data.jobId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { posts: posts ?? [] };
  });

// Helper exported for use in route — kept simple
export { providerSchema };
