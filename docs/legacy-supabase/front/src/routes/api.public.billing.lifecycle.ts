// CRON quotidien : rappels J-3, renouvellement à échéance, grâce puis repli Gratuit.
import { createFileRoute } from "@tanstack/react-router";
import { startSubscriptionPayment } from "@/lib/billing.server";
import { auditBilling } from "@/lib/djomy.server";

export const Route = createFileRoute("/api/public/billing/lifecycle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-cron-token") ?? "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;

        const { data: valid } = await admin.rpc("verify_cron_token", {
          p_name: "billing",
          p_token: provided,
        });
        if (!valid) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }


        const now = new Date();
        const { data: freePlan } = await admin
          .from("plans")
          .select("id")
          .eq("code", "gratuit")
          .maybeSingle();

        const { data: orgs } = await admin
          .from("organizations")
          .select("id, name, statut_abo, periode_fin, cycle, plan_id, plans(code, prix_gnf)")
          .not("periode_fin", "is", null);

        const notify = async (orgId: string, title: string, body: string) => {
          const { data: admins } = await admin
            .from("user_roles")
            .select("user_id")
            .eq("organization_id", orgId)
            .in("role", ["owner", "hr_admin"]);
          const rows = (admins ?? []).map((a: { user_id: string }) => ({
            organization_id: orgId,
            user_id: a.user_id,
            type: "billing",
            title,
            body,
            link: "/app/settings",
          }));
          if (rows.length) await admin.from("notifications").insert(rows);
        };

        let reminders = 0;
        let renewals = 0;
        let downgrades = 0;

        for (const org of orgs ?? []) {
          const end = new Date(org.periode_fin);
          const planCode = org.plans?.code as string | undefined;
          const isPaid = Number(org.plans?.prix_gnf ?? 0) > 0;
          const daysLeft = Math.floor((end.getTime() - now.getTime()) / 86_400_000);

          // Annulé : accès jusqu'à periode_fin puis repli Gratuit.
          if (org.statut_abo === "canceled" && end <= now) {
            await admin
              .from("organizations")
              .update({ plan_id: freePlan?.id, statut_abo: "canceled", periode_fin: null })
              .eq("id", org.id);
            await auditBilling(admin, org.id, "subscription.downgraded_free", { reason: "canceled" });
            downgrades++;
            continue;
          }

          if (!isPaid || org.statut_abo === "canceled") continue;

          // Rappel J-3
          if (org.statut_abo === "active" && daysLeft === 3) {
            await notify(
              org.id,
              "Renouvellement d'abonnement dans 3 jours",
              `Votre abonnement Konkouré arrive à échéance le ${end.toLocaleDateString("fr-FR")}.`,
            );
            reminders++;
            continue;
          }

          // Échéance : tentative de renouvellement automatique
          if (org.statut_abo === "active" && end <= now) {
            try {
              await startSubscriptionPayment({
                admin,
                orgId: org.id,
                planCode: planCode!,
                cycle: org.cycle,
                auto: true,
              });
              await notify(
                org.id,
                "Renouvellement en attente de paiement",
                "Une demande de paiement a été générée pour renouveler votre abonnement.",
              );
              renewals++;
            } catch (e) {
              await admin
                .from("organizations")
                .update({ statut_abo: "past_due" })
                .eq("id", org.id);
              await auditBilling(admin, org.id, "subscription.past_due", {
                message: e instanceof Error ? e.message : "renouvellement échoué",
              });
              await notify(
                org.id,
                "Échec du renouvellement",
                "Le renouvellement automatique a échoué. Régularisez le paiement sous 3 jours.",
              );
            }
            continue;
          }

          // Grâce de 3 jours puis repli sur Gratuit (aucune donnée supprimée).
          if (org.statut_abo === "past_due" && daysLeft <= -3) {
            await admin
              .from("organizations")
              .update({ plan_id: freePlan?.id, statut_abo: "active", cycle: "mensuel", periode_fin: null })
              .eq("id", org.id);
            await auditBilling(admin, org.id, "subscription.downgraded_free", { reason: "past_due" });
            await notify(
              org.id,
              "Passage à l'offre Gratuit",
              "Faute de paiement, votre organisation revient à l'offre Gratuit. Aucune donnée n'a été supprimée.",
            );
            downgrades++;
          }
        }

        return new Response(JSON.stringify({ reminders, renewals, downgrades }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
