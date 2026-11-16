import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PublicOrganization = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
};

/**
 * Retourne les informations publiques minimales d'une organisation
 * (uniquement si elle publie au moins une offre d'emploi).
 * Exécuté côté serveur : la fonction SQL sous-jacente n'est pas exposée
 * aux rôles anon / authenticated.
 */
export const getPublicOrganization = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({ slug: z.string().trim().min(1).max(120) }).parse(data),
  )
  .handler(async ({ data }): Promise<PublicOrganization | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("get_public_organization", {
      p_slug: data.slug,
    });
    if (error) return null;
    const o = (rows ?? [])[0];
    if (!o) return null;
    return { id: o.id, name: o.name, slug: o.slug, logo_url: o.logo_url };
  });
