// Webhook Djomy — SOURCE DE VÉRITÉ pour l'activation des abonnements.
// URL non devinable : le segment $token doit correspondre à DJOMY_WEBHOOK_PATH_TOKEN.
import { createFileRoute } from "@tanstack/react-router";
import {
  auditBilling,
  getDjomyConfig,
  normalizeDjomyStatus,
  safeEqualHex,
  settlePayment,
  verifyWebhookSignature,
} from "@/lib/djomy.server";

export const Route = createFileRoute("/api/public/billing/djomy-webhook/$token")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const expectedToken = process.env.DJOMY_WEBHOOK_PATH_TOKEN ?? "";
        if (!expectedToken || !safeEqualHex(params.token, expectedToken)) {
          return new Response("ok", { status: 200 });
        }

        const rawBody = await request.text();

        let cfg;
        try {
          cfg = getDjomyConfig();
        } catch {
          return new Response("ok", { status: 200 });
        }

        const signature = request.headers.get("x-webhook-signature");
        if (!verifyWebhookSignature(rawBody, signature, cfg.clientSecret)) {
          // Signature invalide → 200 et aucun effet.
          return new Response("ok", { status: 200 });
        }

        let event: any;
        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response("ok", { status: 200 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;

        const eventId: string | null =
          event?.eventId ?? event?.id ?? event?.data?.eventId ?? null;
        if (eventId) {
          const { error: dupError } = await admin
            .from("webhook_events")
            .insert({ event_id: String(eventId) });
          if (dupError) {
            // Déjà traité (clé unique) → idempotent, aucun effet.
            return new Response("ok", { status: 200 });
          }
        }

        const payload = event?.data ?? event;
        const merchantReference: string | null =
          payload?.merchantPaymentReference ?? payload?.merchant_payment_reference ?? null;

        if (!merchantReference) {
          await auditBilling(admin, null, "webhook.missing_reference", { eventId });
          return new Response("ok", { status: 200 });
        }

        const status = normalizeDjomyStatus(
          payload?.status ?? event?.eventType ?? event?.type ?? event?.event,
        );

        await settlePayment(admin, {
          merchantReference,
          status,
          paidAmount: payload?.paidAmount ?? payload?.amount ?? null,
          currency: payload?.currency ?? "GNF",
          transactionId: payload?.transactionId ?? payload?.id ?? null,
          method: payload?.paymentMethod ?? payload?.method ?? null,
          rawEvent: event,
        });

        return new Response("ok", { status: 200 });
      },
    },
  },
});
