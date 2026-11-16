// AI: Suggestions de résultats clés SMART à partir d'un objectif
import { corsHeaders, requireAuth } from "../_shared/auth.ts";

function flatten(item: unknown): string | null {
  if (typeof item === "string") return item.trim() || null;
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    const name = (o.name ?? o.text ?? o.title ?? o.key_result ?? "") as string;
    const target = o.target != null ? String(o.target) : "";
    const unit = o.unit != null ? String(o.unit) : "";
    const s = [name, [target, unit].filter(Boolean).join(" ")].filter(Boolean).join(" : ");
    return s.trim() || null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const authError = await requireAuth(req);
  if (authError) return authError;
  try {
    const { objective, quarter, language = "fr" } = await req.json();
    if (!objective || typeof objective !== "string" || objective.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Objective required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY manquant");

    const isEn = language === "en";
    const sys = isEn
      ? "You are an OKR coach. Generate SMART, measurable, ambitious-but-achievable key results. Always answer as JSON."
      : "Tu es un coach OKR. Génère des résultats clés SMART, mesurables, ambitieux mais atteignables. Réponds toujours en JSON.";
    const userPrompt = isEn
      ? `Objective: ${objective}\nQuarter: ${quarter || "-"}\n\nPropose 3 to 5 measurable key results for THIS objective, written in English, one short sentence each including a figure or a clear target. JSON format: { "key_results": ["...", "..."] }`
      : `Objectif : ${objective}\nTrimestre : ${quarter || "-"}\n\nPropose 3 à 5 résultats clés mesurables pour CET objectif, rédigés en français, une phrase courte chacun incluant un chiffre ou une cible claire. Format JSON : { "key_results": ["...", "..."] }`;

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
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");

    let raw: unknown[] = [];
    if (Array.isArray(parsed.key_results)) raw = parsed.key_results;
    else if (Array.isArray(parsed.suggestions)) {
      raw = parsed.suggestions.flatMap((s: any) => (Array.isArray(s?.key_results) ? s.key_results : []));
    } else if (Array.isArray(parsed.results)) raw = parsed.results;

    const key_results = raw.map(flatten).filter((s): s is string => !!s).slice(0, 6);

    return new Response(JSON.stringify({ key_results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[ai-suggest-okr] internal error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
