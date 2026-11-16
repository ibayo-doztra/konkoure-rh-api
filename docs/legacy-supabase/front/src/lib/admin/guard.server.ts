// Garde du back-office plateforme : toute donnée d'administration passe par ici.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PlatformAdminIdentity {
  userId: string;
  email: string | null;
  level: "root" | "support";
}

function envAdminEmails(): string[] {
  return (process.env["PLATFORM_ADMIN_EMAILS"] ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Statut d'administrateur plateforme, table d'abord puis repli sur la variable d'environnement. */
export async function resolvePlatformAdmin(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
): Promise<PlatformAdminIdentity | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: row } = await (supabaseAdmin as any)
    .from("platform_admins")
    .select("level, is_active")
    .eq("user_id", userId)
    .maybeSingle();

  let email: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    email = data?.user?.email?.toLowerCase() ?? null;
  } catch {
    email = null;
  }

  if (row?.is_active) {
    return { userId, email, level: (row.level as "root" | "support") ?? "root" };
  }

  // Filet de sécurité : ne jamais se verrouiller dehors.
  const emails = envAdminEmails();
  if (email && emails.includes(email)) {
    return { userId, email, level: "root" };
  }
  return null;
}

/** Lève une erreur si l'appelant n'est pas administrateur plateforme. */
export async function assertPlatformAdmin(context: {
  supabase: SupabaseClient<any, any, any>;
  userId: string;
}): Promise<PlatformAdminIdentity> {
  const identity = await resolvePlatformAdmin(context.supabase, context.userId);
  if (!identity) throw new Error("Accès réservé aux administrateurs de la plateforme.");
  return identity;
}

/** Variante « root » pour les actions destructrices. */
export async function assertPlatformRoot(context: {
  supabase: SupabaseClient<any, any, any>;
  userId: string;
}): Promise<PlatformAdminIdentity> {
  const identity = await assertPlatformAdmin(context);
  if (identity.level !== "root") {
    throw new Error("Action réservée à un super-administrateur (root).");
  }
  return identity;
}
