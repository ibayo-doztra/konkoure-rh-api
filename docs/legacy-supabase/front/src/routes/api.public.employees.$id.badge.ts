// Public HTTP endpoint for the Flutter mobile app.
// Reads current NFC badge state (and history for admins) for one employee.
// Auth: Supabase user access token in `Authorization: Bearer <token>`.
// Allowed callers:
//   - owner / hr_admin in the employee's organization → full response
//   - the employee themselves (employees.user_id = auth.uid()) → uid + active + assigned_at, no history
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
} as const;

const JSON_HEADERS = { "Content-Type": "application/json", ...CORS_HEADERS };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/public/employees/$id/badge")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: async ({ request, params }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return json(500, {
            ok: false,
            error: "SERVER_MISCONFIGURED",
            message: "Backend indisponible.",
          });
        }

        const employeeId = params.id;
        if (!UUID_RE.test(employeeId)) {
          return json(400, {
            ok: false,
            error: "VALIDATION_ERROR",
            message: "Identifiant employé invalide.",
          });
        }

        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return json(401, {
            ok: false,
            error: "UNAUTHORIZED",
            message: "Jeton d'authentification manquant.",
          });
        }
        const token = authHeader.slice("Bearer ".length).trim();
        if (!token) {
          return json(401, { ok: false, error: "UNAUTHORIZED", message: "Jeton vide." });
        }

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claims?.claims?.sub) {
          return json(401, {
            ok: false,
            error: "UNAUTHORIZED",
            message: "Jeton invalide ou expiré.",
          });
        }
        const userId = claims.claims.sub as string;

        // Authorization: fetch the employee (RLS restricts to org members).
        const { data: emp, error: empErr } = await supabase
          .from("employees")
          .select("id, user_id, organization_id")
          .eq("id", employeeId)
          .maybeSingle();
        if (empErr) {
          return json(500, { ok: false, error: "INTERNAL_ERROR", message: empErr.message });
        }
        if (!emp) {
          return json(404, {
            ok: false,
            error: "EMPLOYEE_NOT_FOUND",
            message: "Employé introuvable ou accès refusé.",
          });
        }

        const isSelf = emp.user_id === userId;
        let isAdmin = false;
        if (!isSelf) {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .eq("organization_id", emp.organization_id);
          isAdmin = (roles ?? []).some(
            (r) =>
              (r as { role: string }).role === "owner" ||
              (r as { role: string }).role === "hr_admin",
          );
        }

        if (!isSelf && !isAdmin) {
          return json(403, {
            ok: false,
            error: "FORBIDDEN",
            message: "Accès refusé.",
          });
        }

        // NFC columns are not exposed to `authenticated`; read via admin.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: badge, error: badgeErr } = await supabaseAdmin
          .from("employees")
          .select("nfc_badge_uid, nfc_badge_active, nfc_badge_assigned_at")
          .eq("id", employeeId)
          .maybeSingle();
        if (badgeErr) {
          return json(500, { ok: false, error: "INTERNAL_ERROR", message: badgeErr.message });
        }

        let history: Array<{
          uid: string | null;
          event: string;
          created_at: string;
        }> = [];
        if (isAdmin) {
          const { data: hist } = await supabaseAdmin
            .from("nfc_badge_history")
            .select("uid, event, created_at")
            .eq("employee_id", employeeId)
            .order("created_at", { ascending: false })
            .limit(50);
          history = (hist ?? []).map((h: any) => ({
            uid: h.uid ?? null,
            event: h.event,
            created_at: h.created_at,
          }));
        }

        return json(200, {
          ok: true,
          uid: badge?.nfc_badge_uid ?? null,
          active: badge?.nfc_badge_active ?? true,
          assigned_at: badge?.nfc_badge_assigned_at ?? null,
          history,
        });
      },
    },
  },
});
