// OAuth start + callback for Facebook / LinkedIn / Twitter (X)
// URL pattern:
//   GET  /api/public/oauth/{provider}/start?token=<jwt>&org=<org_id>
//   GET  /api/public/oauth/{provider}/callback?code=...&state=...
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  PROVIDER_CONFIG,
  buildCookie,
  callbackUrl,
  getAdmin,
  getOrigin,
  getProviderCreds,
  parseCookies,
  pkceChallenge,
  randomString,
  type Provider,
} from "@/lib/social.server";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/public/oauth/$provider/$action")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const provider = params.provider as Provider;
        const action = params.action;
        if (!["facebook", "linkedin", "twitter"].includes(provider)) {
          return new Response("Provider inconnu", { status: 404 });
        }
        if (action === "callback") return callback(request, provider);
        return new Response("Action inconnue", { status: 404 });
      },
      POST: async ({ request, params }) => {
        const provider = params.provider as Provider;
        const action = params.action;
        if (!["facebook", "linkedin", "twitter"].includes(provider)) {
          return new Response("Provider inconnu", { status: 404 });
        }
        if (action === "start") return startPost(request, provider);
        return new Response("Action inconnue", { status: 404 });
      },
    },
  },
});

async function userFromToken(token: string) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const sb = createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Error("Session invalide");
  return { userId: data.claims.sub as string, sb };
}

// HMAC-signs the OAuth data cookie so the callback can trust organization and
// user identifiers only when they were issued by startPost.
async function signPayload(payload: string): Promise<string> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Server misconfigured");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function startPost(request: Request, provider: Provider) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return new Response("JSON requis", { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token : "";
  const orgId = typeof body.org === "string" ? body.org : "";
  if (!token || !orgId) return new Response("token et org requis", { status: 400 });

  let userId: string;
  try {
    ({ userId } = await userFromToken(token));
  } catch {
    return new Response("Session invalide", { status: 401 });
  }
  // Only organization administrators (owner / HR admin) may connect social accounts.
  const { data: adminRole } = await getAdmin()
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .in("role", ["owner", "hr_admin"])
    .limit(1);
  if (!adminRole || adminRole.length === 0) {
    return new Response("Réservé aux administrateurs de l'organisation", { status: 403 });
  }

  const cfg = PROVIDER_CONFIG[provider];
  const { clientId } = getProviderCreds(provider);
  const origin = getOrigin(request);
  const redirectUri = callbackUrl(origin, provider);
  const state = randomString(24);
  const verifier = randomString(48);

  const encoded = btoa(JSON.stringify({ userId, orgId, verifier, ts: Date.now(), state }));
  const statePayload = `${encoded}.${await signPayload(encoded)}`;

  let authUrl = `${cfg.authUrl}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(cfg.scopes.join(provider === "twitter" ? " " : provider === "facebook" ? "," : " "))}`;

  if (provider === "twitter") {
    const challenge = await pkceChallenge(verifier);
    authUrl += `&code_challenge=${challenge}&code_challenge_method=S256`;
  }

  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append(
    "Set-Cookie",
    buildCookie(`oauth_${provider}_state`, state, { maxAge: 600 }),
  );
  headers.append(
    "Set-Cookie",
    buildCookie(`oauth_${provider}_data`, statePayload, { maxAge: 600 }),
  );
  return new Response(JSON.stringify({ authUrl }), { status: 200, headers });
}


function htmlClose(message: string, ok: boolean, request?: Request): Response {
  const safe = message.replace(/</g, "&lt;");
  const origin = request ? getOrigin(request) : "";
  const targetOrigin = JSON.stringify(origin || "");
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${ok ? "Connecté" : "Erreur"}</title></head><body style="font-family:system-ui;padding:32px;text-align:center"><h1>${ok ? "✅ Connecté" : "❌ Erreur"}</h1><p>${safe}</p><p>Vous pouvez fermer cette fenêtre.</p><script>try{var t=${targetOrigin};if(t&&window.opener)window.opener.postMessage({type:'oauth_${ok ? "success" : "error"}',message:${JSON.stringify(message)}},t)}catch(e){}setTimeout(()=>{try{window.close()}catch(e){}},800)</script></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

async function callback(request: Request, provider: Provider) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    if (error) return htmlClose(`Refusé : ${error}`, false, request);
    if (!code || !state) return htmlClose("Réponse OAuth incomplète", false, request);

    const cookies = parseCookies(request.headers.get("cookie"));
    const expectedState = cookies[`oauth_${provider}_state`];
    const dataRaw = cookies[`oauth_${provider}_data`];
    if (!expectedState || expectedState !== state || !dataRaw) {
      return htmlClose("État OAuth invalide", false, request);
    }
    const [encoded, sig] = dataRaw.split(".");
    if (!encoded || !sig || sig !== (await signPayload(encoded))) {
      return htmlClose("État OAuth invalide", false, request);
    }
    const { userId, orgId, verifier, ts, state: signedState } = JSON.parse(atob(encoded)) as {
      userId: string;
      orgId: string;
      verifier: string;
      ts: number;
      state: string;
    };
    if (signedState !== state || !ts || Date.now() - ts > 10 * 60 * 1000) {
      return htmlClose("État OAuth expiré", false, request);
    }
    // The initiating user must still be an organization administrator.
    const { data: stillAdmin } = await getAdmin()
      .from("user_roles")
      .select("id")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .in("role", ["owner", "hr_admin"])
      .limit(1);
    if (!stillAdmin || stillAdmin.length === 0) return htmlClose("Accès refusé", false, request);

    const cfg = PROVIDER_CONFIG[provider];
    const { clientId, clientSecret } = getProviderCreds(provider);
    const origin = getOrigin(request);
    const redirectUri = callbackUrl(origin, provider);

    // Exchange code -> access token
    const tokenBody = new URLSearchParams();
    tokenBody.set("grant_type", "authorization_code");
    tokenBody.set("code", code);
    tokenBody.set("redirect_uri", redirectUri);
    tokenBody.set("client_id", clientId);
    if (provider !== "twitter") tokenBody.set("client_secret", clientSecret);
    if (provider === "twitter") tokenBody.set("code_verifier", verifier);

    const tokenHeaders: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };
    if (provider === "twitter") {
      tokenHeaders.Authorization =
        "Basic " + btoa(`${clientId}:${clientSecret}`);
    }

    const tokenResp = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: tokenHeaders,
      body: tokenBody.toString(),
    });
    const tokenJson = await tokenResp.json();
    if (!tokenResp.ok) {
      return htmlClose(
        `Échange de jeton refusé : ${tokenJson.error_description || tokenJson.error || tokenResp.status}`,
        false,
        request,
      );
    }

    const accessToken: string = tokenJson.access_token;
    const refreshToken: string | undefined = tokenJson.refresh_token;
    const expiresIn: number | undefined = tokenJson.expires_in;
    const tokenExpiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    // Fetch account profile
    let accountId = "";
    let accountName = "";
    const metadata: Record<string, unknown> = {};

    if (provider === "twitter") {
      const me = await fetch("https://api.twitter.com/2/users/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => r.json());
      accountId = me.data?.id ?? "";
      accountName = me.data?.username ? `@${me.data.username}` : me.data?.name ?? "Compte X";
    } else if (provider === "linkedin") {
      const me = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => r.json());
      accountId = me.sub ?? "";
      accountName = me.name ?? me.email ?? "Compte LinkedIn";
      metadata.person_urn = `urn:li:person:${accountId}`;
    } else {
      // facebook — user, then list pages
      const me = await fetch(
        `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`,
      ).then((r) => r.json());
      const pages = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(accessToken)}`,
      ).then((r) => r.json());
      const page = pages.data?.[0];
      if (page) {
        accountId = page.id;
        accountName = `${page.name} (Page)`;
        metadata.page_access_token = page.access_token;
        metadata.user_id = me.id;
      } else {
        return htmlClose(
          "Aucune Page Facebook trouvée. Créez une Page et reconnectez-vous.",
          false,
          request,
        );
      }
    }

    if (!accountId) return htmlClose("Impossible de récupérer le compte", false, request);

    const admin = getAdmin();
    const { data: upserted, error: upErr } = await admin
      .from("social_accounts")
      .upsert(
        {
          organization_id: orgId,
          provider,
          account_id: accountId,
          account_name: accountName,
          token_expires_at: tokenExpiresAt,
          scopes: cfg.scopes as unknown as string[],
          status: "active",
          connected_by: userId,
          connected_at: new Date().toISOString(),
          metadata: metadata as any,
        },
        { onConflict: "organization_id,provider,account_id" },
      )
      .select("id")
      .single();
    if (upErr || !upserted) return htmlClose("Enregistrement échoué", false, request);

    // Store OAuth tokens in the private table (not exposed via the Data API).
    const { error: tokErr } = await admin
      .schema("private" as never)
      .from("social_account_tokens" as never)
      .upsert(
        {
          account_id: upserted.id,
          access_token: accessToken,
          refresh_token: refreshToken ?? null,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "account_id" },
      );
    if (tokErr) return htmlClose(`Enregistrement des jetons échoué : ${tokErr.message}`, false, request);

    const headers = new Headers({ "Content-Type": "text/html; charset=utf-8" });
    headers.append("Set-Cookie", buildCookie(`oauth_${provider}_state`, "", { maxAge: 0 }));
    headers.append("Set-Cookie", buildCookie(`oauth_${provider}_data`, "", { maxAge: 0 }));
    const targetOrigin = JSON.stringify(getOrigin(request));
    const body = `<!doctype html><html><body style="font-family:system-ui;padding:32px;text-align:center"><h1>✅ ${cfg.label} connecté</h1><p>${accountName}</p><script>try{var t=${targetOrigin};if(t&&window.opener)window.opener.postMessage({type:'oauth_success',provider:'${provider}'},t)}catch(e){}setTimeout(()=>{try{window.close()}catch(e){location.href='/app/settings/integrations?connected=${provider}'}},600)</script></body></html>`;
    return new Response(body, { status: 200, headers });
  } catch (e: any) {
    return htmlClose(String(e?.message ?? e), false, request);
  }
}
