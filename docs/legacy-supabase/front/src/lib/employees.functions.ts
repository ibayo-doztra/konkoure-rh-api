import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getEmployeeBadgeInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ employeeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    // Vérifier que l'utilisateur peut voir la fiche employé (RLS).
    const { data: emp, error: empError } = await context.supabase
      .from("employees")
      .select("id,user_id,organization_id")
      .eq("id", data.employeeId)
      .maybeSingle();

    if (empError || !emp) {
      return { authorized: false, uid: null, active: true, assignedAt: null };
    }

    const isSelf = emp.user_id === context.userId;
    let isAdmin = false;

    if (!isSelf) {
      const { data: roles } = await context.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId)
        .eq("organization_id", emp.organization_id);

      isAdmin = (roles ?? []).some(
        (r: any) => r.role === "owner" || r.role === "hr_admin",
      );
    }

    if (!isSelf && !isAdmin) {
      return { authorized: false, uid: null, active: true, assignedAt: null };
    }

    // Les colonnes NFC sont restreintes en lecture pour le rôle authentifié.
    // On les lit via le service role après avoir vérifié l'autorisation.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: badge, error: badgeError } = await supabaseAdmin
      .from("employees")
      .select("nfc_badge_uid, nfc_badge_active, nfc_badge_assigned_at")
      .eq("id", data.employeeId)
      .maybeSingle();

    if (badgeError || !badge) {
      return { authorized: true, uid: null, active: true, assignedAt: null };
    }

    return {
      authorized: true,
      uid: badge.nfc_badge_uid ?? null,
      active: badge.nfc_badge_active ?? true,
      assignedAt: badge.nfc_badge_assigned_at ?? null,
    };
  });

async function assertBadgeAdmin(
  supabase: any,
  userId: string,
  employeeId: string,
): Promise<{ organizationId: string }> {
  const { data: emp, error } = await supabase
    .from("employees")
    .select("id, organization_id")
    .eq("id", employeeId)
    .maybeSingle();
  if (error || !emp) throw new Error("Employé introuvable ou accès refusé.");

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", emp.organization_id);
  const isAdmin = (roles ?? []).some(
    (r: any) => r.role === "owner" || r.role === "hr_admin",
  );
  if (!isAdmin) {
    throw new Error(
      "Vous devez être owner ou hr_admin de l'organisation pour gérer les badges NFC.",
    );
  }
  return { organizationId: emp.organization_id };
}

export const assignEmployeeBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        employeeId: z.string().uuid(),
        uid: z.string().trim().min(1).max(128).nullable(),
        active: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertBadgeAdmin(context.supabase, context.userId, data.employeeId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any).rpc("admin_assign_employee_badge", {
      p_employee: data.employeeId,
      p_uid: data.uid,
      p_active: data.active,
      p_actor: context.userId,
    });

    if (error) throw new Error(error.message);
    const updated = Array.isArray(rows) ? rows[0] : rows;
    if (!updated) throw new Error("Mise à jour du badge échouée (aucune ligne modifiée).");

    return {
      uid: updated.out_nfc_badge_uid ?? null,
      active: updated.out_nfc_badge_active ?? true,
      assignedAt: updated.out_nfc_badge_assigned_at ?? null,
    };
  });


export const revokeEmployeeBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ employeeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertBadgeAdmin(context.supabase, context.userId, data.employeeId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any).rpc("admin_revoke_employee_badge", {
      p_employee: data.employeeId,
      p_actor: context.userId,
    });

    if (error) throw new Error(error.message);
    const updated = Array.isArray(rows) ? rows[0] : rows;
    if (!updated) throw new Error("Révocation du badge échouée (aucune ligne modifiée).");

    return {
      uid: updated.out_nfc_badge_uid ?? null,
      active: updated.out_nfc_badge_active ?? true,
      assignedAt: updated.out_nfc_badge_assigned_at ?? null,
    };
  });

async function assertSensitiveAccess(
  supabase: any,
  userId: string,
  employeeId: string,
): Promise<void> {
  const { data: emp, error } = await supabase
    .from("employees")
    .select("id, user_id, organization_id")
    .eq("id", employeeId)
    .maybeSingle();
  if (error || !emp) throw new Error("Employé introuvable ou accès refusé.");
  if (emp.user_id === userId) return;
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", emp.organization_id);
  const isAdmin = (roles ?? []).some(
    (r: any) => r.role === "owner" || r.role === "hr_admin",
  );
  if (!isAdmin) throw new Error("Non autorisé");
}

export const getEmployeeSensitive = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ employeeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSensitiveAccess(context.supabase, context.userId, data.employeeId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("employees")
      .select("base_salary, profile_details")
      .eq("id", data.employeeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      baseSalary: (row?.base_salary as number | null) ?? null,
      profileDetails: (row?.profile_details as any) ?? null,
    };

  });

export const updateEmployeeProfileDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        employeeId: z.string().uuid(),
        details: z.any().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSensitiveAccess(context.supabase, context.userId, data.employeeId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("employees")
      .update({ profile_details: (data.details ?? {}) as never })
      .eq("id", data.employeeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        organizationId: z.string().uuid(),
        first_name: z.string().trim().min(1).max(80),
        last_name: z.string().trim().min(1).max(80),
        email: z.string().trim().email().max(255),
        phone: z.string().trim().min(6).max(30),
        job_title: z.string().trim().min(1).max(120),
        department_id: z.string().uuid(),
        manager_id: z.string().uuid().nullable(),
        status: z.enum(["active", "on_leave", "terminated"]),
        hire_date: z.string().min(1).max(20),
        profile_details: z
          .object({
            gender: z.enum(["male", "female"]).optional(),
            birthday: z.string().max(20).optional(),
          })
          .default({}),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("organization_id", data.organizationId);
    const isAdmin = (roles ?? []).some(
      (r: any) => r.role === "owner" || r.role === "hr_admin",
    );
    if (!isAdmin) {
      throw new Error("Seuls les owners ou hr_admin peuvent créer des employés.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: dept } = await supabaseAdmin
      .from("departments")
      .select("id")
      .eq("organization_id", data.organizationId)
      .eq("id", data.department_id)
      .maybeSingle();
    if (!dept) throw new Error("Le département sélectionné n'appartient pas à votre organisation.");

    if (data.manager_id) {
      const { data: mgr } = await supabaseAdmin
        .from("employees")
        .select("id")
        .eq("organization_id", data.organizationId)
        .eq("id", data.manager_id)
        .maybeSingle();
      if (!mgr) throw new Error("Le manager sélectionné n'appartient pas à votre organisation.");
    }

    const { organizationId, ...row } = data;
    const { error } = await supabaseAdmin.from("employees").insert({
      ...row,
      organization_id: organizationId,
      profile_details: (row.profile_details ?? {}) as never,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const importEmployees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        organizationId: z.string().uuid(),
        rows: z
          .array(
            z.object({
              first_name: z.string().trim().min(1).max(80),
              last_name: z.string().trim().min(1).max(80),
              email: z.string().trim().email(),
              phone: z.string().trim().min(6).max(30),
              job_title: z.string().trim().min(1).max(120),
              department_id: z.string().uuid(),
              status: z.enum(["active", "on_leave", "terminated"]),
              hire_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            }),
          )
          .min(1)
          .max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("organization_id", data.organizationId);
    const isAdmin = (roles ?? []).some(
      (r: any) => r.role === "owner" || r.role === "hr_admin",
    );
    if (!isAdmin) {
      throw new Error("Seuls les owners ou hr_admin peuvent importer des employés.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Les départements doivent appartenir à l'organisation.
    const deptIds = Array.from(new Set(data.rows.map((r) => r.department_id)));
    const { data: depts } = await supabaseAdmin
      .from("departments")
      .select("id")
      .eq("organization_id", data.organizationId)
      .in("id", deptIds);
    const allowed = new Set((depts ?? []).map((d) => d.id));
    if (deptIds.some((id) => !allowed.has(id))) {
      throw new Error("Un département du fichier n'appartient pas à votre organisation.");
    }

    let inserted = 0;
    for (let i = 0; i < data.rows.length; i += 50) {
      const batch = data.rows.slice(i, i + 50).map((r) => ({
        ...r,
        organization_id: data.organizationId,
        profile_details: {} as never,
      }));
      const { error } = await supabaseAdmin.from("employees").insert(batch);
      if (error) {
        return { inserted, error: error.message, failedAt: i + 1 };
      }
      inserted += batch.length;
    }
    return { inserted, error: null as string | null, failedAt: null as number | null };
  });


