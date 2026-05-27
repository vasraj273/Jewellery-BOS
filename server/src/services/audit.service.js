import { getDb } from '../database/connection.js';

/**
 * Append-only audit log. Fire-and-forget — never throws into the caller's
 * request flow. We swallow errors and just log them.
 *
 *   record({ actor, action, entityType, entityId, metadata, req })
 *     actor       — req.user (or null for anonymous events like failed login)
 *     action      — short dotted string (e.g. 'auth.login', 'quotation.create')
 *     entityType  — 'quotation' | 'user' | 'auth' | ...
 *     entityId    — string identifier (we cast to text for portability)
 *     metadata    — small JSON object; do NOT put PII or full payloads here
 *     req         — optional Express request, used to capture ip + UA
 */
export async function record({ actor, action, entityType = null, entityId = null, metadata = {}, req = null }) {
  try {
    const sql = getDb();
    const ip = req?.ip || req?.headers?.['x-forwarded-for'] || null;
    const ua = req?.headers?.['user-agent'] || null;
    await sql`
      INSERT INTO audit_events (actor_user_id, actor_email, action, entity_type, entity_id, metadata, ip, user_agent)
      VALUES (
        ${actor?.id ?? null},
        ${actor?.email ?? null},
        ${action},
        ${entityType},
        ${entityId == null ? null : String(entityId)},
        ${sql.json(metadata || {})},
        ${ip},
        ${ua}
      )
    `;
  } catch (err) {
    console.warn(`[audit] record failed (${action}): ${err.message}`);
  }
}

/** Latest N events, admin-facing. */
export async function listRecent(limit = 100) {
  const sql = getDb();
  return sql`
    SELECT id, actor_user_id, actor_email, action, entity_type, entity_id, metadata, ip, created_at
    FROM audit_events
    ORDER BY created_at DESC
    LIMIT ${Math.min(Math.max(+limit || 100, 1), 500)}
  `;
}
