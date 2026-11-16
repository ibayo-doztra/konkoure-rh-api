// Helpers d'envoi d'e-mails transactionnels (serveur uniquement).
// Utilise Resend via la passerelle de connecteurs Lovable.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

/**
 * Envoie un e-mail. Lève une erreur explicite si la configuration
 * (clé Lovable / connecteur Resend / expéditeur) est absente.
 */
export async function sendEmail(input: SendEmailInput): Promise<{ id?: string }> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const resendKey = process.env["RESEND_API_KEY"];
  const from = process.env["EMAIL_FROM"] ?? "Konkouré <onboarding@resend.dev>";

  if (!lovableKey) throw new Error("LOVABLE_API_KEY manquant");
  if (!resendKey) throw new Error("RESEND_API_KEY manquant (connecteur e-mail non configuré)");

  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Envoi e-mail échoué [${res.status}]: ${body}`);
  }
  return (await res.json().catch(() => ({}))) as { id?: string };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type DemoRequestEmailData = {
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  companySize: string;
  message?: string | null;
  receivedAt: Date;
};

/** Gabarit de l'e-mail de notification d'une demande de démonstration. */
export function renderDemoRequestEmail(d: DemoRequestEmailData) {
  const dateFr = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Conakry",
  }).format(d.receivedAt);

  const rows: Array<[string, string]> = [
    ["Nom complet", d.fullName],
    ["E-mail", d.email],
    ["Téléphone", d.phone],
    ["Entreprise", d.companyName],
    ["Taille", d.companySize],
    ["Besoin", d.message?.trim() ? d.message.trim() : "—"],
    ["Reçue le", `${dateFr} (Conakry)`],
  ];

  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#f5f6f8;font-family:Roboto,Helvetica,Arial,sans-serif;color:#1a1d21">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px">
    <h1 style="margin:0 0 4px;font-size:18px">Nouvelle demande de démo — Konkouré</h1>
    <p style="margin:0 0 20px;font-size:13px;color:#6b7280">Envoyée depuis le formulaire /demo du site.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${rows
        .map(
          ([label, value]) =>
            `<tr><td style="padding:8px 0;color:#6b7280;width:150px;vertical-align:top">${escapeHtml(
              label,
            )}</td><td style="padding:8px 0;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`,
        )
        .join("")}
    </table>
  </div>
</body></html>`;

  const text = rows.map(([label, value]) => `${label}: ${value}`).join("\n");

  return {
    subject: `Demande de démo — ${d.companyName} (${d.fullName})`,
    html,
    text,
  };
}
