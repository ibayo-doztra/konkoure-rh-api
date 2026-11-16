import { z } from "zod";

export const uuid = z.string().uuid();

export const orgListSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
  planCode: z.string().trim().max(40).optional(),
  limit: z.number().int().min(1).max(200).default(100),
});

export const orgUpdateSchema = z.object({
  organizationId: uuid,
  planId: uuid.nullable().optional(),
  statut_abo: z.enum(["trialing", "active", "canceled", "suspended", "expired"]).optional(),
  cycle: z.enum(["mensuel", "annuel"]).optional(),
  periode_fin: z.string().datetime().nullable().optional(),
  max_employes_override: z.number().int().min(1).max(100000).nullable().optional(),
  modules_override: z.array(z.string().max(40)).nullable().optional(),
});

export const planUpsertSchema = z.object({
  id: uuid.optional(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9_-]+$/, "Code invalide (minuscules, chiffres, - et _)"),
  nom: z.string().trim().min(2).max(80),
  prix_gnf: z.number().min(0).max(1_000_000_000),
  max_employes: z.number().int().min(1).max(100000),
  credits_ia_mois: z.number().int().min(0).max(1_000_000),
  sort_order: z.number().int().min(0).max(1000),
  modules: z.array(z.string().max(40)),
  features: z.array(z.string().max(200)).default([]),
});

export const userSearchSchema = z.object({
  search: z.string().trim().max(120).optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

export const roleUpdateSchema = z.object({
  userId: uuid,
  organizationId: uuid,
  role: z.enum(["owner", "hr_admin", "manager", "employee", "recruiter", "security_agent"]),
});

export const platformAdminSchema = z.object({
  userId: uuid,
  level: z.enum(["root", "support"]).default("root"),
  active: z.boolean().default(true),
});

export const settingsUpdateSchema = z.object({
  entries: z
    .array(z.object({ key: z.string().trim().min(1).max(80), value: z.unknown() }))
    .min(1)
    .max(50),
});

export const logsQuerySchema = z.object({
  kind: z.enum(["audit", "system", "usage"]).default("audit"),
  search: z.string().trim().max(120).optional(),
  organizationId: uuid.optional(),
  level: z.string().trim().max(20).optional(),
  days: z.number().int().min(1).max(365).default(30),
  limit: z.number().int().min(1).max(500).default(100),
});

export const demoStatusSchema = z.object({
  id: uuid,
  status: z.enum(["new", "contacted", "scheduled", "done", "rejected"]),
});
