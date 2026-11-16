// Public HTTP endpoint for the Flutter mobile app.
// Revokes the NFC badge attached to an employee.
// Auth: Supabase user access token in `Authorization: Bearer <token>`.
// The user must have role owner | hr_admin in the employee's organization.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
} as const;

const JSON_HEADERS = { "Content-Type": "application/json", ...CORS_HEADERS };

const bodySchema = z.object({
  employee_id: z.string().uuid(),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export const Route = createFileRoute("/api/public/employees/revoke-badge")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      POST: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return json(500, {
            ok: false,
            error: "SERVER_MISCONFIGURED",
            message: "Backend indisponible.",
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

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json(400, {
            ok: false,
            error: "VALIDATION_ERROR",
            message: "Corps JSON invalide.",
          });
        }
        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) {
          return json(400, {
            ok: false,
            error: "VALIDATION_ERROR",
            message: parsed.error.issues.map((i) => i.message).join("; "),
          });
        }
        const { employee_id } = parsed.data;

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

        // Authorization check (owner | hr_admin on the employee's org).
        const { data: emp, error: empErr } = await supabase
          .from("employees")
          .select("id, organization_id")
          .eq("id", employee_id)
          .maybeSingle();
        if (empErr) {
          return json(500, { ok: false, error: "INTERNAL_ERROR", message: "Erreur interne." });
        }
        if (!emp) {
          return json(404, {
            ok: false,
            error: "EMPLOYEE_NOT_FOUND",
            message: "Employé introuvable ou accès refusé.",
          });
        }
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("organization_id", emp.organization_id);
        const isAdmin = (roles ?? []).some(
          (r) =>
            (r as { role: string }).role === "owner" ||
            (r as { role: string }).role === "hr_admin",
        );
        if (!isAdmin) {
          return json(403, {
            ok: false,
            error: "FORBIDDEN",
            message: "Vous devez être owner ou hr_admin pour gérer les badges NFC.",
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: rows, error } = await (supabaseAdmin as any).rpc(
          "admin_revoke_employee_badge",
          {
            p_employee: employee_id,
            p_actor: userId,
          },
        );

        if (error) {
          return json(500, {
            ok: false,
            error: "INTERNAL_ERROR",
            message: "Révocation du badge impossible.",
          });
        }

        const updated = Array.isArray(rows) ? rows[0] : rows;
        if (!updated) {
          return json(500, {
            ok: false,
            error: "INTERNAL_ERROR",
            message: "Révocation du badge échouée (aucune ligne modifiée).",
          });
        }

        return json(200, {
          ok: true,
          uid: updated.out_nfc_badge_uid ?? null,
          active: updated.out_nfc_badge_active ?? true,
          assigned_at: updated.out_nfc_badge_assigned_at ?? null,
        });
      },
    },
  },
});
