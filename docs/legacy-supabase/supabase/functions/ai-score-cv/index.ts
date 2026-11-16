// AI: Score sémantique d'un CV par rapport à une offre
import { corsHeaders, requireAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const authError = await requireAuth(req);
  if (authError) return authError;
  try {
    const { job_title, job_description, job_requirements, cv_text, candidate_name } = await req.json();
    if (!cv_text || !job_title) return new Response(JSON.stringify({ error: "cv_text et job_title requis" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY manquant");

    const sys = "Tu es un recruteur senior spécialisé dans le marché africain. Analyse l'adéquation candidat/poste sans biais (genre, origine, âge). Réponds en JSON strict.";
    const userPrompt = `OFFRE\nTitre: ${job_title}\nDescription: ${job_description ?? ""}\nExigences: ${job_requirements ?? ""}\n\nCANDIDAT: ${candidate_name ?? "Anonyme"}\nCV:\n${cv_text.slice(0, 8000)}\n\nRetourne JSON: { score: 0-100, strengths: string[], gaps: string[], justification: string (2 phrases), recommended_stage: "new"|"screening"|"interview"|"reject" }`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
