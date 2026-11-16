// AI: Génère description d'offre d'emploi inclusive (FR/EN) à partir d'un prompt libre ou de champs structurés
import { corsHeaders, requireAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const authError = await requireAuth(req);
  if (authError) return authError;
  try {
    const body = await req.json();
    const { prompt, title, department, location, language = "fr", seniority = "mid", contract_type, requirements } = body;
    if (!prompt && !title) {
      return new Response(JSON.stringify({ error: "prompt ou title requis" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY manquant");

    const contractLabel = contract_type === "stage" ? "Stage" : contract_type === "cdd" ? "CDD" : contract_type === "cdi" ? "CDI" : null;

    const sys = language === "en"
      ? "You are an inclusive HR copywriter for African companies. Produce job descriptions that are gender-neutral, bias-free, and adapted to local realities."
      : "Tu es un rédacteur RH inclusif pour entreprises africaines. Produis des descriptions de postes neutres, sans biais, adaptées aux réalités locales.";

    const docsSchema = `suggested_documents (array d'objets { key: string slug snake_case, label: string, required: boolean } - 2 à 5 documents pertinents pour ce poste, ex: cv, cover_letter, diploma, work_certificate, portfolio, id_document)`;
    const userPrompt = prompt
      ? `Demande: ${prompt}${contractLabel ? `\nType de contrat: ${contractLabel}` : ""}\n\nGénère une offre d'emploi structurée et adaptée au type de contrat. Réponds en JSON: { title, location, description (markdown 3-5 paragraphes), requirements (string[] - 5 items), perks (string[]), inclusive_score (0-100), inclusive_warnings (string[]), ${docsSchema} }`
      : `Poste: ${title}\nDépartement: ${department ?? "-"}\nLieu: ${location ?? "-"}\nSéniorité: ${seniority}${contractLabel ? `\nType de contrat: ${contractLabel}` : ""}${requirements ? `\nExigences spécifiques à intégrer:\n${requirements}` : ""}\n\nGénère une offre d'emploi structurée et adaptée au type de contrat (durée, attentes, modalités). Réponds en JSON: { title, location, description, requirements (string[]), perks (string[]), inclusive_score, inclusive_warnings (string[]), ${docsSchema} }`;

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
