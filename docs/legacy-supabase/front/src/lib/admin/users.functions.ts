import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { platformAdminSchema, roleUpdateSchema, userSearchSchema, uuid } from "./schemas";

export const searchAdminUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => userSearchSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin } = await import("./guard.server");
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: authData, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw new Error(error.message);

    const term = (data.search ?? "").toLowerCase();
    const users = ((authData?.users ?? []) as any[])
      .filter((u) => !term || (u.email ?? "").toLowerCase().includes(term))
      .slice(0, data.limit);

    const ids = users.map((u) => u.id);
    const [roles, profiles, orgs] = await Promise.all([
      ids.length ? db.from("user_roles").select("user_id, role, organization_id").in("user_id", ids) : { data: [] },
      ids.length ? db.from("profiles").select("id, full_name").in("id", ids) : { data: [] },
      db.from("organizations").select("id, name"),
    ]);

    const orgName = new Map<string, string>();
    for (const o of (orgs.data ?? []) as any[]) orgName.set(o.id, o.name);
    const nameById = new Map<string, string>();
    for (const p of (profiles.data ?? []) as any[]) nameById.set(p.id, p.full_name ?? "");

    const rolesByUser = new Map<string, any[]>();
    for (const r of (roles.data ?? []) as any[]) {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push({
        role: r.role,
        organizationId: r.organization_id,
        organizationName: orgName.get(r.organization_id) ?? "—",
      });
      rolesByUser.set(r.user_id, list);
    }

    const { data: admins } = await db.from("platform_admins").select("user_id, level, is_active");
    const adminByUser = new Map<string, any>();
    for (const a of (admins ?? []) as any[]) adminByUser.set(a.user_id, a);

    return users.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      fullName: nameById.get(u.id) ?? null,
      createdAt: u.created_at ?? null,
      lastSignInAt: u.last_sign_in_at ?? null,
      banned: !!u.banned_until,
      roles: rolesByUser.get(u.id) ?? [],
      platformAdmin: adminByUser.get(u.id) ?? null,
    }));
  });

export const setAdminUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => roleUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin } = await import("./guard.server");
    const identity = await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: before } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .eq("organization_id", data.organizationId);

    await db.from("user_roles").delete().eq("user_id", data.userId).eq("organization_id", data.organizationId);
    const { error } = await db
      .from("user_roles")
      .insert({ user_id: data.userId, organization_id: data.organizationId, role: data.role });
    if (error) throw new Error(error.message);

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      actorUserId: identity.userId,
      actorEmail: identity.email,
      organizationId: data.organizationId,
      action: "platform.user.role.update",
      targetType: "user_roles",
      targetId: data.userId,
      before,
      after: { role: data.role },
    });
    return { ok: true };
  });

export const sendAdminPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({ userId: uuid.parse((input as any)?.userId) }))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin } = await import("./guard.server");
    const identity = await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: userRes, error: userErr } = await db.auth.admin.getUserById(data.userId);
    if (userErr) throw new Error(userErr.message);
    const email = userRes?.user?.email;
    if (!email) throw new Error("Ce compte n'a pas d'adresse e-mail.");

    const { error } = await db.auth.resetPasswordForEmail(email);
    if (error) throw new Error(error.message);

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      actorUserId: identity.userId,
      actorEmail: identity.email,
      action: "platform.user.password_reset",
      targetType: "auth.users",
      targetId: data.userId,
    });
    return { ok: true };
  });

export const setAdminUserBanned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({
    userId: uuid.parse((input as any)?.userId),
    banned: Boolean((input as any)?.banned),
  }))
  .handler(async ({ data, context }) => {
    const { assertPlatformRoot } = await import("./guard.server");
    const identity = await assertPlatformRoot(context);
    if (data.userId === identity.userId) throw new Error("Vous ne pouvez pas désactiver votre propre compte.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db.auth.admin.updateUserById(data.userId, {
      ban_duration: data.banned ? "876000h" : "none",
    });
    if (error) throw new Error(error.message);

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      actorUserId: identity.userId,
      actorEmail: identity.email,
      action: data.banned ? "platform.user.disable" : "platform.user.enable",
      targetType: "auth.users",
      targetId: data.userId,
    });
    return { ok: true };
  });

export const setPlatformAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => platformAdminSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertPlatformRoot } = await import("./guard.server");
    const identity = await assertPlatformRoot(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    if (!data.active) {
      const { count } = await db
        .from("platform_admins")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("level", "root");
      const { data: target } = await db
        .from("platform_admins")
        .select("level, is_active")
        .eq("user_id", data.userId)
        .maybeSingle();
      if (target?.is_active && target.level === "root" && (count ?? 0) <= 1) {
        throw new Error("Impossible de retirer le dernier super-administrateur actif.");
      }
    }

    const { error } = await db.from("platform_admins").upsert(
      {
        user_id: data.userId,
        level: data.level,
        is_active: data.active,
        created_by: identity.userId,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      actorUserId: identity.userId,
      actorEmail: identity.email,
      action: data.active ? "platform.admin.grant" : "platform.admin.revoke",
      targetType: "platform_admins",
      targetId: data.userId,
      after: { level: data.level, active: data.active },
    });
    return { ok: true };
  });
