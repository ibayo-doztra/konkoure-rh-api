// AI: Synthèse narrative d'évaluation à partir auto + manager + feedbacks
import { corsHeaders, requireAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const authError = await requireAuth(req);
  if (authError) return authError;
  try {
    const { employee_name, period, self_text, manager_text, feedbacks = [], okrs = [], language = "fr" } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY manquant");

    const sys = "Tu es un expert RH. Produis une synthèse de revue de performance équilibrée, factuelle, bienveillante, sans biais.";
    const userPrompt = `Collaborateur: ${employee_name ?? "-"}\nPériode: ${period ?? "-"}\nAuto-évaluation: ${self_text ?? "-"}\nÉvaluation manager: ${manager_text ?? "-"}\nFeedbacks reçus: ${feedbacks.join(" | ") || "-"}\nOKR: ${okrs.map((o: any) => `${o.objective} (${o.progress}%)`).join(" | ") || "-"}\n\nGénère une synthèse de 3 paragraphes (Forces, Axes d'amélioration, Plan de développement) + scores. JSON: { summary: string (markdown), performance_score: 1-5, potential_score: 1-5, recommendations: string[] }`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "system", content: sys }, { role: "user", content: userPrompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (resp.status === 402) return new Response(JSON.stringify({ error: "Crédits IA épuisés" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!resp.ok) throw new Error(`AI gateway ${resp.status}`);
    const data = await resp.json();
    const content = JSON.parse(data.choices[0].message.content);
    return new Response(JSON.stringify(content), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[edge] internal error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
