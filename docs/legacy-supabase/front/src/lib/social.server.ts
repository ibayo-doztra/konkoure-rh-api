// Server-only helpers for social OAuth + posting.
// Never import from a component.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Provider = "facebook" | "linkedin" | "twitter";

export function getAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin env vars missing");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getOrigin(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function callbackUrl(origin: string, provider: Provider): string {
  return `${origin}/api/public/oauth/${provider}/callback`;
}

// SSRF guard: only allow fetching media from our own Supabase storage host
// (the same project we sign URLs from). Blocks private/loopback/metadata hosts.
function assertSafeMediaUrl(rawUrl: string): URL {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error("URL média invalide");
  }
  if (u.protocol !== "https:") {
    throw new Error("URL média rejetée: https requis");
  }
  const host = u.hostname.toLowerCase();

  // Block loopback / link-local / cloud metadata / RFC1918 by name.
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "169.254.169.254" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new Error("URL média rejetée: hôte interne interdit");
  }
  // Block bare IPv4 in private ranges.
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    if (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 0
    ) {
      throw new Error("URL média rejetée: IP privée interdite");
    }
  }

  // Allowlist: only our Supabase storage host (and optional configured CDN).
  const allowedHosts = new Set<string>();
  const supaUrl = process.env.SUPABASE_URL;
  if (supaUrl) {
    try { allowedHosts.add(new URL(supaUrl).hostname.toLowerCase()); } catch { /* ignore */ }
  }
  const extra = process.env.SOCIAL_MEDIA_ALLOWED_HOSTS;
  if (extra) {
    for (const h of extra.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)) {
      allowedHosts.add(h);
    }
  }
  if (allowedHosts.size === 0 || !allowedHosts.has(host)) {
    throw new Error("URL média rejetée: hôte non autorisé");
  }
  return u;
}

export const PROVIDER_CONFIG = {
  facebook: {
    label: "Facebook",
    authUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: ["pages_manage_posts", "pages_read_engagement", "pages_show_list", "public_profile"],
    clientIdEnv: "FACEBOOK_APP_ID",
    clientSecretEnv: "FACEBOOK_APP_SECRET",
  },
  linkedin: {
    label: "LinkedIn",
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["openid", "profile", "w_member_social"],
    clientIdEnv: "LINKEDIN_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
  },
  twitter: {
    label: "X (Twitter)",
    authUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    clientIdEnv: "TWITTER_CLIENT_ID",
    clientSecretEnv: "TWITTER_CLIENT_SECRET",
  },
} as const;

export function getProviderCreds(provider: Provider): { clientId: string; clientSecret: string } {
  const cfg = PROVIDER_CONFIG[provider];
  const clientId = process.env[cfg.clientIdEnv];
  const clientSecret = process.env[cfg.clientSecretEnv];
  if (!clientId || !clientSecret) {
    throw new Error(
      `Configuration manquante pour ${cfg.label}. Ajoutez ${cfg.clientIdEnv} et ${cfg.clientSecretEnv} dans Lovable Cloud.`,
    );
  }
  return { clientId, clientSecret };
}

// --- Crypto helpers (PKCE / state) ---
function base64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomString(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return base64url(arr);
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64url(hash);
}

// --- Cookie helpers ---
export function buildCookie(
  name: string,
  value: string,
  opts: { maxAge?: number; secure?: boolean; httpOnly?: boolean; path?: string } = {},
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path ?? "/"}`);
  parts.push(`SameSite=Lax`);
  if (opts.httpOnly !== false) parts.push("HttpOnly");
  if (opts.secure !== false) parts.push("Secure");
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  return parts.join("; ");
}

export function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((p) => {
      const i = p.indexOf("=");
      const k = p.slice(0, i).trim();
      const v = decodeURIComponent(p.slice(i + 1).trim());
      return [k, v];
    }),
  );
}

// --- Provider posting ---
export async function publishToProvider(args: {
  provider: Provider;
  accessToken: string;
  accountId: string;
  metadata: Record<string, unknown>;
  content: string;
  mediaUrls?: string[];
}): Promise<{ external_post_id: string; external_url: string }> {
  const { provider, accessToken, accountId, content, metadata } = args;
  const mediaUrls = args.mediaUrls ?? [];

  if (provider === "twitter") {
    // X media upload requires OAuth1 / v1.1 — skip media for now, post text only.
    const r = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: content }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.detail || j?.title || `Twitter ${r.status}`);
    const id = j.data?.id;
    return { external_post_id: id, external_url: `https://twitter.com/i/web/status/${id}` };
  }

  if (provider === "linkedin") {
    const personUrn = (metadata.person_urn as string) || `urn:li:person:${accountId}`;

    // Upload each image as a LinkedIn digital media asset
    const mediaAssets: Array<{ status: "READY"; description: { text: string }; media: string; title: { text: string } }> = [];
    for (const url of mediaUrls) {
      // SSRF guard: only allow our own Supabase storage host.
      const safeUrl = assertSafeMediaUrl(url);
      // 1. Register upload
      const reg = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
            owner: personUrn,
            serviceRelationships: [
              { relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" },
            ],
          },
        }),
      });
      const regJson = await reg.json();
      if (!reg.ok) throw new Error(regJson?.message || `LinkedIn register ${reg.status}`);
      const uploadUrl: string =
        regJson?.value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.uploadUrl;
      const asset: string = regJson?.value?.asset;
      if (!uploadUrl || !asset) throw new Error("LinkedIn: réponse d'upload invalide");

      // 2. Download the image bytes from our public bucket (validated above)
      const imgRes = await fetch(safeUrl.toString());
      if (!imgRes.ok) throw new Error(`Lecture image échouée (${imgRes.status})`);
      const bytes = await imgRes.arrayBuffer();

      // 3. PUT bytes to LinkedIn upload URL
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: bytes,
      });
      if (!put.ok) throw new Error(`LinkedIn upload ${put.status}`);

      mediaAssets.push({
        status: "READY",
        description: { text: "" },
        media: asset,
        title: { text: "" },
      });
    }

    const shareMediaCategory = mediaAssets.length === 0 ? "NONE" : mediaAssets.length === 1 ? "IMAGE" : "IMAGE";
    const r = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: personUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: content },
            shareMediaCategory,
            ...(mediaAssets.length > 0 ? { media: mediaAssets } : {}),
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.message || `LinkedIn ${r.status}`);
    const id = j.id as string;
    return { external_post_id: id, external_url: `https://www.linkedin.com/feed/update/${id}` };
  }

  // facebook
  const pageAccessToken = (metadata.page_access_token as string) || accessToken;

  if (mediaUrls.length === 1) {
    const url = mediaUrls[0];
    const r = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}/photos?access_token=${encodeURIComponent(pageAccessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, caption: content }),
      },
    );
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || `Facebook ${r.status}`);
    const id = (j.post_id as string) || (j.id as string);
    return { external_post_id: id, external_url: `https://facebook.com/${id}` };
  }

  if (mediaUrls.length > 1) {
    // Upload each photo as unpublished, then attach to a feed post
    const mediaIds: string[] = [];
    for (const url of mediaUrls) {
      const up = await fetch(
        `https://graph.facebook.com/v21.0/${accountId}/photos?access_token=${encodeURIComponent(pageAccessToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, published: false }),
        },
      );
      const upJson = await up.json();
      if (!up.ok) throw new Error(upJson?.error?.message || `Facebook upload ${up.status}`);
      mediaIds.push(upJson.id as string);
    }
    const attached = mediaIds.map((mid) => ({ media_fbid: mid }));
    const r = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}/feed?access_token=${encodeURIComponent(pageAccessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, attached_media: attached }),
      },
    );
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || `Facebook ${r.status}`);
    const id = j.id as string;
    return { external_post_id: id, external_url: `https://facebook.com/${id}` };
  }

  // No media — text only
  const r = await fetch(
    `https://graph.facebook.com/v21.0/${accountId}/feed?access_token=${encodeURIComponent(pageAccessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: content }),
    },
  );
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `Facebook ${r.status}`);
  const id = j.id as string;
  return { external_post_id: id, external_url: `https://facebook.com/${id}` };
}
