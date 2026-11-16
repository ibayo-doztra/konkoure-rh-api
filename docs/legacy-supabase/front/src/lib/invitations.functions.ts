import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FALLBACK_ORIGIN = "https://konkoure.lovable.app";

function inviteRedirectUrl(): string {
  const origin = getRequestHeader("origin") ?? getRequestHeader("referer") ?? "";
  try {
    if (origin) return `${new URL(origin).origin}/invitation`;
  } catch {
    /* ignore */
  }
  return `${FALLBACK_ORIGIN}/invitation`;
}

/**
 * Détecte l'erreur « email déjà enregistré » renvoyée par le service
 * d'authentification (HTTP 422). Seule cette erreur justifie le chemin
 * « compte existant » ; toute autre erreur doit remonter telle quelle.
 */
function isAccountAlreadyExistsError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: number }).status;
  const message = ((error as { message?: string }).message ?? "").toLowerCase();
  return status === 422 || message.includes("already been registered") || message.includes("already registered");
}


async function assertOrgAdmin(supabase: any, userId: string, organizationId: string) {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId);
  const isAdmin = (roles ?? []).some((r: any) => r.role === "owner" || r.role === "hr_admin");
  if (!isAdmin) {
    throw new Error("Seuls les owners ou hr_admin peuvent inviter un employé.");
  }
}

/**
 * Recherche un compte existant UNIQUEMENT parmi les membres de l'organisation
 * concernée. On ne rattache jamais automatiquement un compte appartenant à une
 * autre organisation (isolation multi-tenant).
 */
async function findOrgUserByEmail(
  admin: any,
  email: string,
  organizationId: string,
): Promise<string | null> {
  const needle = email.trim().toLowerCase();

  const { data: members } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId);

  for (const m of members ?? []) {
    const uid = (m as any).user_id as string | null;
    if (!uid) continue;
    const { data: u } = await admin.auth.admin.getUserById(uid);
    if (((u?.user as any)?.email ?? "").toLowerCase() === needle) return uid;
  }
  return null;
}

export const getEmployeeAccountStates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ organizationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.organizationId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: emps } = await supabaseAdmin
      .from("employees")
      .select("id, user_id")
      .eq("organization_id", data.organizationId);

    const states: Record<string, "none" | "invited" | "active"> = {};
    const linked = (emps ?? []).filter((e: any) => e.user_id);
    const byId = new Map<string, "invited" | "active">();

    for (const uid of Array.from(new Set(linked.map((e: any) => e.user_id as string)))) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
      const user = u?.user as any;
      const mustChange = user?.user_metadata?.must_change_password === true;
      byId.set(uid, !user || mustChange || !user.last_sign_in_at ? "invited" : "active");
    }

    for (const e of emps ?? []) {
      const uid = (e as any).user_id as string | null;
      states[(e as any).id as string] = uid ? (byId.get(uid) ?? "invited") : "none";
    }

    return { states };
  });

export const inviteEmployeeUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ employeeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: emp, error: empError } = await context.supabase
      .from("employees")
      .select("id, email, organization_id, user_id, first_name, last_name")
      .eq("id", data.employeeId)
      .maybeSingle();
    if (empError || !emp) throw new Error("Employé introuvable ou accès refusé.");

    await assertOrgAdmin(context.supabase, context.userId, emp.organization_id);

    const email = (emp.email ?? "").trim();
    if (!email) {
      throw new Error("Cet employé n'a pas d'adresse email : renseignez-la avant de l'inviter.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const redirectTo = inviteRedirectUrl();

    let userId: string | null = (emp.user_id as string | null) ?? null;
    let resent = false;

    if (!userId) {
      const { data: invited, error: inviteError } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(
          email,
          {
            redirectTo,
            data: {
              must_change_password: true,
              full_name: `${emp.first_name} ${emp.last_name}`.trim(),
              employee_id: emp.id,
              organization_id: emp.organization_id,
            },
          },
        );
      if (invited?.user) {
        userId = invited.user.id;
      } else if (isAccountAlreadyExistsError(inviteError)) {
        // Compte déjà existant : on ne renvoie un lien que si ce compte appartient
        // déjà à cette organisation. Sinon on refuse (aucun rattachement forcé).
        userId = await findOrgUserByEmail(supabaseAdmin, email, emp.organization_id);
        if (!userId) {
          throw new Error(
            "Cette adresse email est déjà associée à un compte existant sur la plateforme. Pour des raisons de sécurité, ce compte ne peut pas être rattaché automatiquement à votre organisation : demandez à la personne d'utiliser une autre adresse, ou contactez le support.",
          );
        }
        resent = true;
      } else {
        // Toute autre erreur (quota d'envoi, indisponibilité du service email, etc.)
        // doit remonter telle quelle : sinon l'admin croit à tort que l'email est
        // déjà pris et ne comprend jamais pourquoi les invitations ne partent pas.
        throw new Error(
          inviteError?.message ||
            "L'envoi de l'invitation a échoué pour une raison inconnue. Réessayez dans quelques instants.",
        );
      }
    } else {
      resent = true;
    }

    if (resent && userId) {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          must_change_password: true,
          employee_id: emp.id,
          organization_id: emp.organization_id,
        },
      });
      const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (resetError) throw new Error(resetError.message);
    }

    if (!userId) throw new Error("Création du compte impossible.");

    // Rattachement du compte à l'employé + accès à l'organisation.
    const { error: linkError } = await supabaseAdmin
      .from("employees")
      .update({ user_id: userId })
      .eq("id", emp.id);
    if (linkError) throw new Error(linkError.message);

    const { data: member } = await supabaseAdmin
      .from("organization_members")
      .select("id")
      .eq("organization_id", emp.organization_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member) {
      await supabaseAdmin
        .from("organization_members")
        .insert({ organization_id: emp.organization_id, user_id: userId });
    }

    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("organization_id", emp.organization_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!role) {
      await supabaseAdmin
        .from("user_roles")
        .insert({ organization_id: emp.organization_id, user_id: userId, role: "employee" });
    }

    return { ok: true, resent, email };
  });
