import { getDb } from "../db/client.js";

export type AuditEvent =
  | "account_linked"
  | "account_unlinked"
  | "token_revoked"
  | "profile_discovered"
  | "guidance_approved"
  | "guidance_executed"
  | "guidance_failed";

export function auditLog(params: {
  eventType: AuditEvent;
  internalClientId?: string;
  profileId?: string;
  accountId?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}): void {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO audit_log (event_type, internal_client_id, profile_id, account_id, actor_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      params.eventType,
      params.internalClientId ?? null,
      params.profileId ?? null,
      params.accountId ?? null,
      params.actorId ?? null,
      params.metadata ? JSON.stringify(params.metadata) : null,
      now
    );
}
