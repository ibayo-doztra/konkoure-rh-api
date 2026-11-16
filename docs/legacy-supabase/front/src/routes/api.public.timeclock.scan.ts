// Public HTTP endpoint for the Flutter mobile app used by security agents.
// Auth: Supabase user access token in `Authorization: Bearer <token>`.
// The user must have role owner | hr_admin | security_agent in `organization_id`.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { assertTimeclockAuthorised, performBadgeScan } from "@/lib/timeclock.server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
} as const;

const JSON_HEADERS = { "Content-Type": "application/json", ...CORS_HEADERS };

const scanSchema = z.object({
  organization_id: z.string().uuid(),
  badge_uid: z.string().trim().min(1).max(128),
  latitude: z.number().finite().nullable().optional(),
  longitude: z.number().finite().nullable().optional(),
  device_id: z.string().trim().max(128).optional(),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export const Route = createFileRoute("/api/public/timeclock/scan")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      POST: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return json(500, { ok: false, error: "SERVER_MISCONFIGURED", message: "Backend indisponible." });
        }

        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return json(401, { ok: false, error: "UNAUTHORIZED", message: "Jeton d'authentification manquant." });
        }
        const token = authHeader.slice("Bearer ".length).trim();
        if (!token) {
          return json(401, { ok: false, error: "UNAUTHORIZED", message: "Jeton vide." });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json(400, { ok: false, error: "VALIDATION_ERROR", message: "Corps JSON invalide." });
        }
        const parsed = scanSchema.safeParse(body);
        if (!parsed.success) {
          return json(400, {
            ok: false,
            error: "VALIDATION_ERROR",
            message: parsed.error.issues.map((i) => i.message).join("; "),
          });
        }
        const input = parsed.data;

        // Supabase client scoped to the caller (RLS applies as that user).
        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claims?.claims?.sub) {
          return json(401, { ok: false, error: "UNAUTHORIZED", message: "Jeton invalide ou expiré." });
        }
        const userId = claims.claims.sub as string;

        // Note: badge UID intentionally not logged — treated as a bearer credential.


        const forbidden = await assertTimeclockAuthorised(supabase, userId, input.organization_id);
        if (forbidden) {
          return json(403, { ok: false, error: "FORBIDDEN", message: forbidden });
        }

        const result = await performBadgeScan(supabase, {
          organization_id: input.organization_id,
          badge_uid: input.badge_uid,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          source: "nfc_mobile",
        });

        if (!result.ok) {
          const statusMap: Record<string, number> = {
            BADGE_UNKNOWN_OR_INACTIVE: 404,
            FORBIDDEN: 403,
            INTERNAL_ERROR: 500,
          };
          return json(statusMap[result.error] ?? 400, result);
        }
        return json(200, result);
      },
    },
  },
});
