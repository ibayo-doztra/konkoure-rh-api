import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Statut de l'appelant : utilisé pour afficher ou masquer l'espace /admin. */
export const getAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolvePlatformAdmin } = await import("./guard.server");
    const identity = await resolvePlatformAdmin(context.supabase, context.userId);
    return {
      isPlatformAdmin: !!identity,
      level: identity?.level ?? null,
      email: identity?.email ?? null,
    };
  });

/** Chiffres clés de la plateforme. */
export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertPlatformAdmin } = await import("./guard.server");
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString();

    const [orgs, employees, payments, demos, audit, usage] = await Promise.all([
      db.from("organizations").select("id, statut_abo, created_at, plans(code, nom)"),
      db.from("employees").select("id", { count: "exact", head: true }),
      db.from("subscription_payments").select("expected_amount, status, created_at").gte("created_at", since30),
      db.from("demo_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
      db.from("audit_log").select("id", { count: "exact", head: true }).gte("created_at", since7),
      db.from("usage_events").select("id", { count: "exact", head: true }).gte("created_at", since7),
    ]);

    const orgRows: any[] = orgs.data ?? [];
    const byPlan = new Map<string, number>();
    for (const o of orgRows) {
      const code = o.plans?.code ?? "gratuit";
      byPlan.set(code, (byPlan.get(code) ?? 0) + 1);
    }

    const paid: any[] = payments.data ?? [];
    const revenue30 = paid
      .filter((p) => p.status === "succeeded" || p.status === "paid")
      .reduce((sum, p) => sum + Number(p.expected_amount ?? 0), 0);

    return {
      organizations: orgRows.length,
      activeOrganizations: orgRows.filter((o) => ["active", "trialing"].includes(String(o.statut_abo))).length,
      newOrganizations30: orgRows.filter((o) => o.created_at && o.created_at >= since30).length,
      employees: employees.count ?? 0,
      revenue30,
      pendingDemos: demos.count ?? 0,
      auditEvents7: audit.count ?? 0,
      usageEvents7: usage.count ?? 0,
      planDistribution: Array.from(byPlan.entries()).map(([code, count]) => ({ code, count })),
    };
  });

/** Réglages globaux + présence des secrets (jamais leur valeur). */
export const getPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertPlatformAdmin } = await import("./guard.server");
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("platform_settings")
      .select("key, value, description, updated_at")
      .order("key");
    if (error) throw new Error(error.message);

    const secretNames = [
      "DJOMY_CLIENT_ID",
      "DJOMY_CLIENT_SECRET",
      "DJOMY_BASE_URL",
      "RESEND_API_KEY",
      "LOVABLE_API_KEY",
      "TIMECLOCK_HMAC_SECRET",
      "PLATFORM_ADMIN_EMAILS",
    ];
    const secrets = secretNames.map((name) => ({
      name,
      configured: !!process.env[name],
    }));

    return { settings: data ?? [], secrets };
  });

export const updatePlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(async (input: unknown) => {
    const { settingsUpdateSchema } = await import("./schemas");
    return settingsUpdateSchema.parse(input);
  })
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin } = await import("./guard.server");
    const identity = await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: before } = await db.from("platform_settings").select("key, value");

    for (const entry of data.entries) {
      const { error } = await db
        .from("platform_settings")
        .upsert(
          { key: entry.key, value: entry.value ?? null, updated_by: identity.userId },
          { onConflict: "key" },
        );
      if (error) throw new Error(error.message);
    }

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      actorUserId: identity.userId,
      actorEmail: identity.email,
      action: "platform.settings.update",
      targetType: "platform_settings",
      before,
      after: data.entries,
    });
    return { ok: true };
  });
