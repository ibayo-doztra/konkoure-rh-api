import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { demoStatusSchema, logsQuerySchema } from "./schemas";

export const listAdminLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => logsQuerySchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin } = await import("./guard.server");
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    const table = data.kind === "audit" ? "audit_log" : data.kind === "system" ? "system_log" : "usage_events";

    let query = db.from(table).select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(data.limit);
    if (data.organizationId) query = query.eq("organization_id", data.organizationId);
    if (data.kind === "system" && data.level) query = query.eq("level", data.level);
    if (data.search) {
      const col = data.kind === "audit" ? "action" : data.kind === "system" ? "message" : "kind";
      query = query.ilike(col, `%${data.search}%`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getAdminUsageStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({
    days: Math.min(365, Math.max(1, Number((input as any)?.days ?? 30))),
  }))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin } = await import("./guard.server");
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    const [usage, orgs] = await Promise.all([
      db.from("usage_events").select("organization_id, module, kind, created_at").gte("created_at", since).limit(20000),
      db.from("organizations").select("id, name"),
    ]);

    const orgName = new Map<string, string>();
    for (const o of (orgs.data ?? []) as any[]) orgName.set(o.id, o.name);

    const byDay = new Map<string, number>();
    const byModule = new Map<string, number>();
    const byOrg = new Map<string, number>();
    for (const e of (usage.data ?? []) as any[]) {
      const day = String(e.created_at).slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
      if (e.module) byModule.set(e.module, (byModule.get(e.module) ?? 0) + 1);
      if (e.organization_id) byOrg.set(e.organization_id, (byOrg.get(e.organization_id) ?? 0) + 1);
    }

    return {
      total: (usage.data ?? []).length,
      byDay: Array.from(byDay.entries())
        .map(([day, count]) => ({ day, count }))
        .sort((a, b) => a.day.localeCompare(b.day)),
      byModule: Array.from(byModule.entries())
        .map(([module, count]) => ({ module, count }))
        .sort((a, b) => b.count - a.count),
      byOrganization: Array.from(byOrg.entries())
        .map(([id, count]) => ({ id, name: orgName.get(id) ?? "—", count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15),
    };
  });

export const listAdminDemoRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertPlatformAdmin } = await import("./guard.server");
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("demo_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updateAdminDemoRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => demoStatusSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin } = await import("./guard.server");
    const identity = await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("demo_requests")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      actorUserId: identity.userId,
      actorEmail: identity.email,
      action: "platform.demo_request.status",
      targetType: "demo_requests",
      targetId: data.id,
      after: { status: data.status },
    });
    return { ok: true };
  });

export const listAdminPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertPlatformAdmin } = await import("./guard.server");
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const [payments, orgs, plans] = await Promise.all([
      db
        .from("subscription_payments")
        .select("id, org_id, plan_id, cycle, expected_amount, currency, status, method, djomy_transaction_id, claim_email, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      db.from("organizations").select("id, name"),
      db.from("plans").select("id, nom"),
    ]);

    const orgName = new Map<string, string>();
    for (const o of (orgs.data ?? []) as any[]) orgName.set(o.id, o.name);
    const planName = new Map<string, string>();
    for (const p of (plans.data ?? []) as any[]) planName.set(p.id, p.nom);

    return ((payments.data ?? []) as any[]).map((p) => ({
      ...p,
      organization_name: p.org_id ? (orgName.get(p.org_id) ?? "—") : "—",
      plan_name: planName.get(p.plan_id) ?? "—",
    }));
  });
