// Génère un texte de post adapté à chaque réseau social à partir d'une offre d'emploi
import { corsHeaders, requireAuth } from "../_shared/auth.ts";

function stripHtml(s: string) {
  return (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const authError = await requireAuth(req);
  if (authError) return authError;
  try {
    const body = await req.json();
    const { title, location, description, requirements, public_url, providers = ["facebook", "linkedin", "twitter"] } = body;
    if (!title) {
      return new Response(JSON.stringify({ error: "title requis" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY manquant");

    const sys = "Tu es un expert en marketing RH et social media. Tu rédiges des posts d'offres d'emploi engageants, inclusifs et adaptés à chaque plateforme. Réponds toujours en français.";

    const userPrompt = `Offre :
- Titre : ${title}
- Lieu : ${location || "non précisé"}
- Description : ${stripHtml(description || "").slice(0, 2000)}
- Exigences : ${stripHtml(requirements || "").slice(0, 1000)}
- Lien candidature : ${public_url || "(à ajouter)"}

Génère un post pour chacun de ces réseaux : ${providers.join(", ")}.

Structure OBLIGATOIRE pour facebook et linkedin (utilise de vrais sauts de ligne \\n) :
[Corps du post — DOIT contenir une phrase explicite invitant à postuler via le lien ci-dessous, ex. "Postule dès maintenant via le lien ci-dessous 👇"]
\\n
\\n
${public_url || "(lien)"}
\\n
\\n
#Hashtag1 #Hashtag2 #Hashtag3

Règles :
- Le lien DOIT être seul sur sa ligne, avec UNE LIGNE VIDE au-dessus ET UNE LIGNE VIDE en dessous (zone de tap dégagée).
- Les hashtags viennent APRÈS le lien, sur la dernière ligne.
- Le corps DOIT mentionner explicitement l'existence du lien pour postuler.

Contraintes par plateforme :
- facebook : ton chaleureux, 100-200 mots (corps), 3-5 emojis pertinents, 3-5 hashtags après le lien.
- linkedin : ton professionnel, 80-150 mots (corps), 0-2 emojis, 4-6 hashtags pertinents après le lien (#Emploi #Recrutement…).
- twitter : MAX 280 caractères TOTAL (lien inclus), accroche percutante mentionnant le lien, 2-3 hashtags, lien à la fin précédé si possible d'une ligne vide.

Réponds en JSON strict : { "facebook": "...", "linkedin": "...", "twitter": "..." } (n'inclus que les clés demandées). Les valeurs DOIVENT contenir de vrais caractères de saut de ligne \\n.`;

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
