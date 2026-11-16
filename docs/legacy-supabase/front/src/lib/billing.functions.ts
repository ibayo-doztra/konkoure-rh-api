import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertOrgAdmin,
  getAdmin,
  startDirectSubscriptionPayment,
  startSubscriptionPayment,
  syncPaymentStatus,
} from "./billing.server";

/** Paiement Mobile Money sans redirection (le client valide sur son téléphone). */
export const createDirectPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        organizationId: z.string().uuid(),
        planCode: z.enum(["essentiel", "professionnel", "entreprise"]),
        cycle: z.enum(["mensuel", "annuel"]),
        paymentMethod: z.enum(["orange_money", "mtn_momo"]),
        payerNumber: z
          .string()
          .trim()
          .regex(/^\+?224?\s?\d{9}$|^\d{9}$/, "Numéro guinéen invalide (9 chiffres).")
          .max(20),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.organizationId);
    const admin = await getAdmin();
    const res = await startDirectSubscriptionPayment({
      admin,
      orgId: data.organizationId,
      planCode: data.planCode,
      cycle: data.cycle,
      payerNumber: data.payerNumber.replace(/[^\d]/g, "").slice(-9),
      paymentMethod: data.paymentMethod,
    });
    return res;
  });

/** Vérifie le statut réel auprès du prestataire puis l'applique en base. */
export const refreshPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ merchantReference: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("subscription_payments" as any)
      .select("merchant_reference")
      .eq("merchant_reference", data.merchantReference)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Paiement introuvable.");
    const admin = await getAdmin();
    return await syncPaymentStatus(admin, data.merchantReference);
  });

/** Crée une intention de paiement Djomy et renvoie l'URL de redirection. */
export const createDjomyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        organizationId: z.string().uuid(),
        planCode: z.enum(["essentiel", "professionnel", "entreprise"]),
        cycle: z.enum(["mensuel", "annuel"]),
        paymentMethod: z.enum(["orange_money", "mtn_momo", "card"]),
        payerNumber: z
          .string()
          .trim()
          .regex(/^\+?224?\s?\d{9}$|^\d{9}$/, "Numéro guinéen invalide (9 chiffres).")
          .max(20),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.organizationId);
    const admin = await getAdmin();
    const { redirectUrl } = await startSubscriptionPayment({
      admin,
      orgId: data.organizationId,
      planCode: data.planCode,
      cycle: data.cycle,
      payerNumber: data.payerNumber.replace(/[^\d]/g, "").slice(-9),
      paymentMethod: data.paymentMethod,
    });
    return { redirectUrl };
  });

/** Statut RÉEL d'un paiement, lu en base (jamais depuis l'URL de retour). */
export const getPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ merchantReference: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("subscription_payments" as any)
      .select("status, expected_amount, currency, cycle, created_at")
      .eq("merchant_reference", data.merchantReference)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Paiement introuvable.");
    return row as any;
  });

/** Abonnement courant de l'organisation (source de vérité en base). */
export const getSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ organizationId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: org, error } = await context.supabase
      .from("organizations" as any)
      .select("id, statut_abo, periode_fin, cycle, plan_id, created_at, plans(code, nom, prix_gnf, max_employes, credits_ia_mois, features)")
      .eq("id", data.organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!org) return null as any;
    // Phase de test : un réglage plateforme peut ouvrir tous les modules.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: flag } = await (supabaseAdmin as any)
      .from("platform_settings")
      .select("value")
      .eq("key", "modules_open_for_testing")
      .maybeSingle();
    return { ...(org as any), modules_open_for_testing: flag?.value === true } as any;
  });

/** Annulation : garde l'accès jusqu'à periode_fin, puis repli sur Gratuit (CRON). */
export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ organizationId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.organizationId);
    const admin = await getAdmin();
    const { error } = await admin
      .from("organizations")
      .update({ statut_abo: "canceled" })
      .eq("id", data.organizationId);
    if (error) throw new Error(error.message);
    await admin.from("billing_audit_log").insert({
      org_id: data.organizationId,
      event: "subscription.canceled",
      payload: { by: context.userId },
    });
    return { ok: true };
  });
