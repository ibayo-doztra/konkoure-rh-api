// Fonction serveur PUBLIQUE : enregistrement d'une demande de démonstration
// envoyée depuis le site vitrine (aucun compte requis).
import { createServerFn } from "@tanstack/react-start";
import { demoRequestSchema } from "./demo-requests.schema";

const DEFAULT_NOTIFY_EMAIL = "bayo.ibrahima@doztra.com";

export const submitDemoRequest = createServerFn({ method: "POST" })
  .inputValidator((data) => demoRequestSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin
      .from("demo_requests")
      .insert({
        full_name: data.fullName,
        email: data.email,
        phone: data.phone,
        company_name: data.companyName,
        company_size: data.companySize,
        message: data.message || null,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      throw new Error("Impossible d'enregistrer votre demande. Réessayez plus tard.");
    }

    // Notification e-mail : ne doit jamais faire échouer la demande du visiteur.
    let emailStatus: "sent" | "failed" = "failed";
    let emailError: string | null = null;
    try {
      const { sendEmail, renderDemoRequestEmail } = await import("./emails.server");
      const tpl = renderDemoRequestEmail({
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        companyName: data.companyName,
        companySize: data.companySize,
        message: data.message ?? null,
        receivedAt: new Date(),
      });
      await sendEmail({
        to: process.env["DEMO_REQUEST_NOTIFY_EMAIL"] ?? DEFAULT_NOTIFY_EMAIL,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        replyTo: data.email,
      });
      emailStatus = "sent";
    } catch (err) {
      emailError = err instanceof Error ? err.message : String(err);
      console.error("[demo-request] envoi e-mail échoué:", emailError);
    }

    await supabaseAdmin
      .from("demo_requests")
      .update({
        email_status: emailStatus,
        email_sent_at: new Date().toISOString(),
        email_error: emailError?.slice(0, 1000) ?? null,
      })
      .eq("id", inserted.id);

    return { ok: true as const, emailStatus };
  });
