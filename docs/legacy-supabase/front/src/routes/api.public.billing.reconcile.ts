// Filet de sécurité : réconcilie les paiements `pending` via GET /v1/payments/{id}/status.
// Appelé par pg_cron toutes les 15 minutes.
import { createFileRoute } from "@tanstack/react-router";
import { djomyRequest, normalizeDjomyStatus, settlePayment } from "@/lib/djomy.server";

export const Route = createFileRoute("/api/public/billing/reconcile")({
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


        const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
        const { data: pendings } = await admin
          .from("subscription_payments")
          .select("merchant_reference, djomy_transaction_id")
          .eq("status", "pending")
          .gte("created_at", since)
          .limit(50);

        let checked = 0;
        let settled = 0;

        for (const p of pendings ?? []) {
          const id = p.djomy_transaction_id;
          if (!id) continue;
          checked++;
          try {
            const { status, data } = await djomyRequest(`/v1/payments/${encodeURIComponent(id)}/status`);
            if (status >= 400) continue;
            const payload = (data as any)?.data ?? data;
            const normalized = normalizeDjomyStatus(payload?.status);
            if (normalized === "pending") continue;
            const res = await settlePayment(admin, {
              merchantReference: p.merchant_reference,
              status: normalized,
              paidAmount: payload?.paidAmount ?? payload?.amount ?? null,
              currency: payload?.currency ?? "GNF",
              transactionId: id,
              method: payload?.paymentMethod ?? null,
              rawEvent: payload,
            });
            if (res.applied) settled++;
          } catch {
            /* on continue avec les autres paiements */
          }
        }

        return new Response(JSON.stringify({ checked, settled }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
