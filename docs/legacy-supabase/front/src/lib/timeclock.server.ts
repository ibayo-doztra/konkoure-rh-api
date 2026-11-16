// Server-side helpers for the append-only timeclock model.
// Each scan creates ONE row in `time_logs` with `type` ARRIVEE|DEPART.
// The client never picks the type: the backend decides based on the
// employee's last punch via public.record_punch().
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type BadgeScanInput = {
  organization_id: string;
  badge_uid: string;
  latitude?: number | null;
  longitude?: number | null;
  source?: string;
};

export type BadgeScanError =
  | "FORBIDDEN"
  | "BADGE_UNKNOWN_OR_INACTIVE"
  | "INTERNAL_ERROR";

export type PunchType = "ARRIVEE" | "DEPART";

export type BadgeScanResult =
  | {
      ok: true;
      type: PunchType;
      timestamp: string;
      deduped: boolean;
      employee: {
        id: string;
        first_name: string;
        last_name: string;
        photo_url: string | null;
      };
    }
  | {
      ok: false;
      error: BadgeScanError;
      message: string;
    };

/**
 * Executes a badge scan. `supabase` must be a client scoped to a user with
 * one of the roles owner | hr_admin | security_agent in `organization_id`
 * (authorisation is checked by the caller via assertTimeclockAuthorised).
 */
export async function performBadgeScan(
  supabase: SupabaseClient<Database>,
  input: BadgeScanInput,
): Promise<BadgeScanResult> {
  const {
    organization_id,
    badge_uid,
    latitude = null,
    longitude = null,
    source = "nfc_mobile",
  } = input;

  // 1. Resolve badge → active employee.
  // Les colonnes NFC ne sont pas exposées au rôle `authenticated` (aucun GRANT
  // SELECT sur public.employees). L'autorisation du caller est déjà vérifiée
  // en amont via assertTimeclockAuthorised, donc on peut lire via le client
  // admin pour retrouver l'employé rattaché au badge.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: emp } = await supabaseAdmin
    .from("employees")
    .select("id, first_name, last_name, photo_url, status, nfc_badge_active")
    .eq("organization_id", organization_id)
    .eq("nfc_badge_uid", badge_uid)
    .maybeSingle();

  if (!emp || !emp.nfc_badge_active || emp.status !== "active") {
    return {
      ok: false,
      error: "BADGE_UNKNOWN_OR_INACTIVE",
      message:
        "Badge inconnu ou désactivé. Vérifiez qu'il est bien attribué à un employé actif.",
    };
  }

  // 2. Atomic decision + insert (dedupe + row-level lock server-side)
  const { data: punch, error } = await supabase.rpc("record_punch", {
    p_org: organization_id,
    p_employee: emp.id,
    p_lat: latitude ?? (null as unknown as number),
    p_lng: longitude ?? (null as unknown as number),
    p_source: source,
  });

  if (error || !punch || punch.length === 0) {
    return {
      ok: false,
      error: "INTERNAL_ERROR",
      message: "Enregistrement du pointage impossible.",
    };
  }

  const row = punch[0] as { type: PunchType; ts: string; deduped: boolean };
  return {
    ok: true,
    type: row.type,
    timestamp: row.ts,
    deduped: row.deduped,
    employee: {
      id: emp.id,
      first_name: emp.first_name,
      last_name: emp.last_name,
      photo_url: emp.photo_url,
    },
  };
}

const ALLOWED_ROLES = ["owner", "hr_admin", "security_agent"] as const;

/**
 * Ensures `userId` has one of the timeclock roles in `organization_id`.
 * Returns null when authorised, or an error message otherwise.
 */
export async function assertTimeclockAuthorised(
  supabase: SupabaseClient<Database>,
  userId: string,
  organizationId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId);
  if (error) return "Vérification des droits impossible.";
  const ok = (data ?? []).some((r) =>
    (ALLOWED_ROLES as readonly string[]).includes((r as { role: string }).role),
  );
  return ok
    ? null
    : "Vous n'êtes pas autorisé à effectuer des pointages pour cette organisation.";
}
