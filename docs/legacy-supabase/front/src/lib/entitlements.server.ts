// Garde serveur : refuse une opération quand l'offre de l'organisation
// n'inclut pas le module concerné. Complète la règle appliquée en base.
import type { ModuleKey } from "./entitlements";
import {
  FREE_AFTER_TRIAL_MODULES,
  freeModules,
  MODULE_LABELS,
  PLAN_LABELS,
  requiredPlanFor,
} from "./entitlements";

const ACTIVE = new Set(["active", "trialing"]);

/**
 * Offre effective : le plan payé reste actif tant que la période en cours
 * n'est pas échue, même après une annulation.
 */
function isPlanEffective(statut: string, periodeFin: string | null): boolean {
  if (ACTIVE.has(statut)) return true;
  if (statut !== "canceled" || !periodeFin) return false;
  return new Date(periodeFin).getTime() > Date.now();
}

export async function orgHasModule(orgId: string, module: ModuleKey): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Phase de test : réglage plateforme qui ouvre tous les modules.
  const { data: flag } = await (supabaseAdmin as any)
    .from("platform_settings")
    .select("value")
    .eq("key", "modules_open_for_testing")
    .maybeSingle();
  if (flag?.value === true) return true;

  const { data, error } = await (supabaseAdmin as any)
    .from("organizations")
    .select("statut_abo, periode_fin, created_at, plans(code, features)")
    .eq("id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return false;

  const planCode = data.plans?.code ?? "gratuit";
  const paidEffective =
    planCode !== "gratuit" && isPlanEffective(String(data.statut_abo), data.periode_fin ?? null);

  // Offre payante effective : modules de l'offre. Sinon : règle de l'essai 30 jours.
  const modules: string[] = paidEffective
    ? ((data.plans?.features?.modules as string[]) ?? FREE_AFTER_TRIAL_MODULES)
    : freeModules(data.created_at ?? null);
  return modules.includes(module);
}

/** Lève une erreur explicite si le module n'est pas inclus dans l'offre. */
export async function requireModule(orgId: string, module: ModuleKey): Promise<void> {
  if (await orgHasModule(orgId, module)) return;
  const plan = PLAN_LABELS[requiredPlanFor(module)] ?? "supérieure";
  throw new Error(
    `Le module ${MODULE_LABELS[module]} n'est pas inclus dans votre offre. Passez à l'offre ${plan} pour l'activer.`,
  );
}

/** Variante pratique quand on ne connaît qu'une ligne rattachée à l'organisation. */
export async function requireModuleForRow(
  table: string,
  rowId: string,
  module: ModuleKey,
): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from(table)
    .select("organization_id")
    .eq("id", rowId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Enregistrement introuvable.");
  await requireModule(data.organization_id, module);
  return data.organization_id as string;
}
