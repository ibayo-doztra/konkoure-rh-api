import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { planUpsertSchema, uuid } from "./schemas";

export const listAdminPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertPlatformAdmin } = await import("./guard.server");
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const [plans, orgs] = await Promise.all([
      db
        .from("plans")
        .select("id, code, nom, prix_gnf, max_employes, credits_ia_mois, features, sort_order, updated_at")
        .order("sort_order"),
      db.from("organizations").select("plan_id"),
    ]);

    const usage = new Map<string, number>();
    for (const o of (orgs.data ?? []) as any[]) {
      if (o.plan_id) usage.set(o.plan_id, (usage.get(o.plan_id) ?? 0) + 1);
    }

    return ((plans.data ?? []) as any[]).map((p) => ({
      ...p,
      modules: (p.features?.modules as string[]) ?? [],
      featureList: (p.features?.features as string[]) ?? [],
      organizations: usage.get(p.id) ?? 0,
    }));
  });

export const upsertAdminPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => planUpsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertPlatformRoot } = await import("./guard.server");
    const identity = await assertPlatformRoot(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    let before: unknown = null;
    let existingFeatures: Record<string, unknown> = {};
    if (data.id) {
      const { data: row } = await db.from("plans").select("*").eq("id", data.id).maybeSingle();
      before = row;
      existingFeatures = (row?.features as Record<string, unknown>) ?? {};
    }

    const payload = {
      ...(data.id ? { id: data.id } : {}),
      code: data.code,
      nom: data.nom,
      prix_gnf: data.prix_gnf,
      max_employes: data.max_employes,
      credits_ia_mois: data.credits_ia_mois,
      sort_order: data.sort_order,
      features: { ...existingFeatures, modules: data.modules, features: data.features },
    };

    const { data: after, error } = await db
      .from("plans")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      actorUserId: identity.userId,
      actorEmail: identity.email,
      action: data.id ? "platform.plan.update" : "platform.plan.create",
      targetType: "plans",
      targetId: after?.id ?? null,
      before,
      after,
    });
    return { ok: true, id: after?.id ?? null };
  });

export const deleteAdminPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({ id: uuid.parse((input as any)?.id) }))
  .handler(async ({ data, context }) => {
    const { assertPlatformRoot } = await import("./guard.server");
    const identity = await assertPlatformRoot(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { count } = await db
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", data.id);
    if ((count ?? 0) > 0) {
      throw new Error(`Impossible : ${count} organisation(s) utilisent encore cette offre.`);
    }

    const { data: before } = await db.from("plans").select("*").eq("id", data.id).maybeSingle();
    const { error } = await db.from("plans").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      actorUserId: identity.userId,
      actorEmail: identity.email,
      action: "platform.plan.delete",
      targetType: "plans",
      targetId: data.id,
      before,
    });
    return { ok: true };
  });
