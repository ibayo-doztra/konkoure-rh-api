import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { orgListSchema, orgUpdateSchema, uuid } from "./schemas";

export const listAdminOrganizations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgListSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin } = await import("./guard.server");
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    let query = db
      .from("organizations")
      .select(
        "id, name, slug, created_at, statut_abo, cycle, periode_fin, max_employes_override, modules_override, plan_id, plans(code, nom, prix_gnf, max_employes)",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.search) query = query.ilike("name", `%${data.search}%`);
    if (data.status) query = query.eq("statut_abo", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const list: any[] = rows ?? [];
    const ids = list.map((o) => o.id);
    const counts = new Map<string, number>();
    if (ids.length) {
      const { data: emps } = await db
        .from("employees")
        .select("organization_id")
        .in("organization_id", ids)
        .neq("status", "terminated");
      for (const e of (emps ?? []) as any[]) {
        counts.set(e.organization_id, (counts.get(e.organization_id) ?? 0) + 1);
      }
    }

    const filtered = data.planCode
      ? list.filter((o) => (o.plans?.code ?? "gratuit") === data.planCode)
      : list;

    return filtered.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      created_at: o.created_at,
      statut_abo: o.statut_abo,
      cycle: o.cycle,
      periode_fin: o.periode_fin,
      plan_id: o.plan_id,
      plan_code: o.plans?.code ?? "gratuit",
      plan_nom: o.plans?.nom ?? "Gratuit",
      max_employes: o.max_employes_override ?? o.plans?.max_employes ?? null,
      max_employes_override: o.max_employes_override,
      modules_override: o.modules_override,
      employees: counts.get(o.id) ?? 0,
    }));
  });

export const getAdminOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({ organizationId: uuid.parse((input as any)?.organizationId) }))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin } = await import("./guard.server");
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const [org, members, employees, payments] = await Promise.all([
      db
        .from("organizations")
        .select(
          "id, name, slug, created_at, statut_abo, cycle, periode_fin, plan_id, max_employes_override, modules_override, plans(code, nom, prix_gnf, max_employes, features)",
        )
        .eq("id", data.organizationId)
        .maybeSingle(),
      db.from("user_roles").select("user_id, role").eq("organization_id", data.organizationId),
      db
        .from("employees")
        .select("id, first_name, last_name, status")
        .eq("organization_id", data.organizationId)
        .limit(500),
      db
        .from("subscription_payments")
        .select("id, expected_amount, currency, status, method, cycle, created_at")
        .eq("org_id", data.organizationId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (!org.data) throw new Error("Organisation introuvable");

    const emps: any[] = employees.data ?? [];
    return {
      organization: org.data,
      members: members.data ?? [],
      employees: {
        total: emps.length,
        active: emps.filter((e) => e.status === "active").length,
      },
      payments: payments.data ?? [],
    };
  });

export const updateAdminOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin } = await import("./guard.server");
    const identity = await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: before } = await db
      .from("organizations")
      .select("plan_id, statut_abo, cycle, periode_fin, max_employes_override, modules_override")
      .eq("id", data.organizationId)
      .maybeSingle();
    if (!before) throw new Error("Organisation introuvable");

    const patch: Record<string, unknown> = {};
    if (data.planId !== undefined) patch["plan_id"] = data.planId;
    if (data.statut_abo !== undefined) patch["statut_abo"] = data.statut_abo;
    if (data.cycle !== undefined) patch["cycle"] = data.cycle;
    if (data.periode_fin !== undefined) patch["periode_fin"] = data.periode_fin;
    if (data.max_employes_override !== undefined) patch["max_employes_override"] = data.max_employes_override;
    if (data.modules_override !== undefined) patch["modules_override"] = data.modules_override;

    if (Object.keys(patch).length === 0) return { ok: true };

    const { data: after, error } = await db
      .from("organizations")
      .update(patch)
      .eq("id", data.organizationId)
      .select("plan_id, statut_abo, cycle, periode_fin, max_employes_override, modules_override")
      .maybeSingle();
    if (error) throw new Error(error.message);

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      actorUserId: identity.userId,
      actorEmail: identity.email,
      organizationId: data.organizationId,
      action: "platform.organization.update",
      targetType: "organizations",
      targetId: data.organizationId,
      before,
      after,
    });
    return { ok: true };
  });
