import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml", "image/gif"];
const MAX_BYTES = 2 * 1024 * 1024;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

/**
 * Création d'une organisation en une seule opération serveur :
 * organisation + membre + rôle propriétaire + départements de départ.
 * Évite les règles d'accès en cascade impossibles à satisfaire côté client
 * (l'utilisateur n'est pas encore membre au moment de la première écriture).
 */
export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        name: z.string().trim().min(2).max(120),
        slug: z.string().trim().min(2).max(40),
        defaultLanguage: z.enum(["fr", "en"]).default("fr"),
        performanceModel: z.enum(["classic", "sap"]).default("sap"),
        seedDepartments: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const slug = slugify(data.slug) || slugify(data.name);
    if (!slug) throw new Error("Le nom de l'entreprise doit contenir au moins une lettre ou un chiffre.");

    // L'utilisateur possède-t-il déjà une organisation ? On la renvoie au lieu d'en créer une autre.
    const { data: existingMembership } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", context.userId)
      .limit(1)
      .maybeSingle();
    if (existingMembership?.organization_id) {
      return { organizationId: existingMembership.organization_id as string, created: false };
    }

    const { data: taken } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (taken) {
      throw new Error("Cette adresse (slug) est déjà utilisée par une autre entreprise. Choisissez-en une autre.");
    }

    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: data.name,
        slug,
        default_language: data.defaultLanguage,
        performance_model: data.performanceModel,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (orgError || !org) {
      throw new Error(orgError?.message ?? "Impossible de créer l'entreprise.");
    }

    const orgId = org.id as string;

    // Compensation manuelle : PostgREST n'offre pas de transaction multi-requêtes.
    const rollback = async (message: string): Promise<never> => {
      await supabaseAdmin.from("user_roles").delete().eq("organization_id", orgId);
      await supabaseAdmin.from("organization_members").delete().eq("organization_id", orgId);
      await supabaseAdmin.from("departments").delete().eq("organization_id", orgId);
      await supabaseAdmin.from("public_holidays").delete().eq("organization_id", orgId);
      await supabaseAdmin.from("organizations").delete().eq("id", orgId);
      throw new Error(message);
    };

    const { error: memberError } = await supabaseAdmin
      .from("organization_members")
      .insert({ organization_id: orgId, user_id: context.userId });
    if (memberError) await rollback(memberError.message);

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ organization_id: orgId, user_id: context.userId, role: "owner" });
    if (roleError) await rollback(roleError.message);

    const departments = data.seedDepartments.filter(Boolean);
    if (departments.length > 0) {
      const { error: depError } = await supabaseAdmin
        .from("departments")
        .insert(departments.map((name) => ({ organization_id: orgId, name })));
      // Les départements de départ sont un confort : on n'annule pas la création pour cela.
      if (depError) console.error("[createOrganization] seed departments failed", depError.message);
    }

    return { organizationId: orgId, created: true };
  });

export const uploadOrgLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        organizationId: z.string().uuid(),
        filename: z.string().min(1).max(200),
        contentType: z.string().min(1),
        base64: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (!ALLOWED_TYPES.includes(data.contentType)) {
      throw new Error("Type de fichier non supporté");
    }

    // Vérifier que le caller est owner/hr_admin de l'organisation cible.
    const { data: roles, error: rolesError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("organization_id", data.organizationId);

    if (rolesError) {
      throw new Error(rolesError.message);
    }

    const isAdmin = (roles ?? []).some(
      (r: { role: string }) => r.role === "owner" || r.role === "hr_admin",
    );
    if (!isAdmin) {
      throw new Error("Non autorisé à modifier le logo de cette organisation");
    }

    // Décoder le base64.
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > MAX_BYTES) {
      throw new Error("Image trop grande (max 2 Mo)");
    }

    const extFromName = data.filename.includes(".")
      ? data.filename.split(".").pop()!.toLowerCase()
      : "png";
    const path = `${data.organizationId}/logo-${Date.now()}.${extFromName}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.storage
      .from("org-logos")
      .upload(path, bytes, { upsert: true, contentType: data.contentType });

    if (upErr) {
      throw new Error(upErr.message);
    }

    const { data: pub } = supabaseAdmin.storage.from("org-logos").getPublicUrl(path);
    return { publicUrl: pub.publicUrl, path };
  });
