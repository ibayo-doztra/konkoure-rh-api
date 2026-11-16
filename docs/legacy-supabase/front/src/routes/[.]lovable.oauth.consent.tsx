import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type AuthorizationDetails = {
  client?: { name?: string; client_uri?: string; logo_uri?: string } | null;
  scope?: string | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

// The `supabase.auth.oauth` namespace is beta; wrap it locally so we don't
// depend on published types.
type OAuthApi = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: { redirect_url?: string | null; redirect_to?: string | null } | null; error: { message: string } | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: { redirect_url?: string | null; redirect_to?: string | null } | null; error: { message: string } | null }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id:
      typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/login", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get(
      "authorization_id",
    )!;
    const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="mb-2 text-xl font-semibold">Autorisation impossible</h1>
      <p className="text-sm text-muted-foreground">
        {String((error as Error)?.message ?? error)}
      </p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorization_id)
      : await oauth.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Le serveur d'autorisation n'a pas renvoyé de redirection.");
      return;
    }
    window.location.href = target;
  }

  const name = details?.client?.name ?? "Cette application";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <div className="w-full rounded-2xl border bg-card p-8 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold">
          Connecter {name} à votre compte Konkouré ?
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {name} pourra utiliser Konkouré en votre nom (lecture des employés,
          offres, candidats, et ajout de notes) via les outils MCP. Vous
          pouvez révoquer l'accès à tout moment depuis votre compte.
        </p>
        {error && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            disabled={busy}
            onClick={() => decide(false)}
          >
            Refuser
          </button>
          <button
            className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            disabled={busy}
            onClick={() => decide(true)}
          >
            Autoriser
          </button>
        </div>
      </div>
    </main>
  );
}
