import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireModule, requireModuleForRow } from "./entitlements.server";

// ---------------- Public holidays ----------------

export const listHolidays = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organizationId: z.string().uuid(), year: z.number().int().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("public_holidays")
      .select("id, name, date, is_movable")
      .eq("organization_id", data.organizationId)
      .order("date", { ascending: true });
    if (data.year) {
      q = q.gte("date", `${data.year}-01-01`).lte("date", `${data.year}-12-31`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertHoliday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        organizationId: z.string().uuid(),
        name: z.string().min(1).max(200),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (YYYY-MM-DD)"),
        isMovable: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      organization_id: data.organizationId,
      name: data.name,
      date: data.date,
      is_movable: data.isMovable ?? false,
    };
    const q = data.id
      ? context.supabase.from("public_holidays").update(payload).eq("id", data.id).select().single()
      : context.supabase.from("public_holidays").insert(payload).select().single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteHoliday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("public_holidays").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Leave requests ----------------

export const computeWorkingDays = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (YYYY-MM-DD)"),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (YYYY-MM-DD)"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // The caller must belong to the organization whose calendar is queried.
    const { data: membership, error: memberErr } = await context.supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", data.organizationId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (memberErr || !membership) throw new Error("Organisation introuvable.");
    await requireModule(data.organizationId, "leaves");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: days, error } = await (supabaseAdmin as any).rpc("compute_working_days", {
      p_org: data.organizationId,
      p_start: data.startDate,
      p_end: data.endDate,
    });
    if (error) throw new Error(error.message);
    return { days: Number(days ?? 0) };
  });

export const getEmployeeLeaveBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ employeeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // La fonction SQL vérifie l'autorisation (employé lui-même, manager ou admin).
    // Elle n'est plus exécutable par le rôle authenticated : appel via service role
    // en transmettant explicitement l'identité vérifiée de l'appelant.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: balance, error } = await (supabaseAdmin as any).rpc(
      "get_employee_leave_balance",
      { p_employee: data.employeeId, p_actor: context.userId },
    );
    if (error) throw new Error(error.message);
    return { balance: Number(balance ?? 0) };
  });


export const listLeaveRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
        employeeId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("leave_requests")
      .select(
        "id, employee_id, type, start_date, end_date, requested_days, status, reason, decision_comment, decided_by, decided_at, created_at, employees:employee_id(first_name,last_name,job_title)",
      )
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    if (data.employeeId) q = q.eq("employee_id", data.employeeId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        employeeId: z.string().uuid(),
        type: z.enum(["annuel", "maladie", "maternite", "sans_solde"]),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (YYYY-MM-DD)"),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (YYYY-MM-DD)"),
        reason: z.string().max(1000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: days, error: dErr } = await (supabaseAdmin as any).rpc("compute_working_days", {
      p_org: data.organizationId,
      p_start: data.startDate,
      p_end: data.endDate,
    });
    if (dErr) throw new Error(dErr.message);
    const requestedDays = Number(days ?? 0);
    if (requestedDays <= 0) {
      throw new Error("La période sélectionnée ne contient aucun jour ouvrable.");
    }

    const { data: row, error } = await context.supabase
      .from("leave_requests")
      .insert({
        organization_id: data.organizationId,
        employee_id: data.employeeId,
        type: data.type,
        start_date: data.startDate,
        end_date: data.endDate,
        requested_days: requestedDays,
        reason: data.reason ?? null,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const decideLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        comment: z.string().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireModuleForRow("leave_requests", data.id, "leaves");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any).rpc("set_leave_request_status", {
      p_request: data.id,
      p_status: data.decision,
      p_actor: context.userId,
      p_comment: data.decision === "rejected" ? (data.comment ?? null) : null,
    });
    if (error) throw new Error(error.message);
    return row;
  });

export const cancelLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireModuleForRow("leave_requests", data.id, "leaves");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any).rpc("set_leave_request_status", {
      p_request: data.id,
      p_status: "cancelled",
      p_actor: context.userId,
    });
    if (error) throw new Error(error.message);
    return row;
  });

