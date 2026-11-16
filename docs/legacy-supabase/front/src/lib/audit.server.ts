// Journalisation centralisée : audit métier, usage et logs techniques.
// Les écritures ne doivent jamais faire échouer l'action appelante.

export interface AuditEntry {
  actorUserId?: string | null;
  actorEmail?: string | null;
  organizationId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("audit_log").insert({
      actor_user_id: entry.actorUserId ?? null,
      actor_email: entry.actorEmail ?? null,
      organization_id: entry.organizationId ?? null,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      before_data: entry.before ?? null,
      after_data: entry.after ?? null,
      ip: entry.ip ?? null,
    });
  } catch (error) {
    console.error("[audit] écriture impossible", error);
  }
}

export interface SystemLogEntry {
  channel: string;
  level?: "debug" | "info" | "warn" | "error";
  message: string;
  organizationId?: string | null;
  context?: Record<string, unknown>;
  statusCode?: number | null;
  durationMs?: number | null;
}

export async function logSystem(entry: SystemLogEntry): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("system_log").insert({
      channel: entry.channel,
      level: entry.level ?? "info",
      message: entry.message.slice(0, 2000),
      organization_id: entry.organizationId ?? null,
      context: entry.context ?? {},
      status_code: entry.statusCode ?? null,
      duration_ms: entry.durationMs ?? null,
    });
  } catch (error) {
    console.error("[system-log] écriture impossible", error);
  }
}

export interface UsageEntry {
  organizationId?: string | null;
  userId?: string | null;
  kind: string;
  path?: string | null;
  module?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logUsage(entry: UsageEntry): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("usage_events").insert({
      organization_id: entry.organizationId ?? null,
      user_id: entry.userId ?? null,
      kind: entry.kind,
      path: entry.path ?? null,
      module: entry.module ?? null,
      metadata: entry.metadata ?? {},
    });
  } catch (error) {
    console.error("[usage] écriture impossible", error);
  }
}
