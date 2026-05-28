import { getDb } from '../database/connection.js';

/**
 * Basic per-executive KPI (admin/super_admin only — route enforces).
 *   leads, quotations, converted leads, conversion %.
 * Not full BI; one row per active user that owns leads or quotes.
 */
export async function salesByExecutive() {
  const sql = getDb();
  return sql`
    SELECT
      u.id,
      u.full_name,
      u.role,
      COALESCE(l.lead_count, 0)        AS leads,
      COALESCE(l.converted_count, 0)   AS converted,
      COALESCE(q.quote_count, 0)       AS quotations,
      CASE WHEN COALESCE(l.lead_count, 0) > 0
           THEN ROUND(100.0 * COALESCE(l.converted_count, 0) / l.lead_count, 1)
           ELSE 0 END                  AS conversion_pct
    FROM users u
    LEFT JOIN (
      SELECT assigned_user_id,
             count(*)::int AS lead_count,
             count(*) FILTER (WHERE is_converted)::int AS converted_count
      FROM leads GROUP BY assigned_user_id
    ) l ON l.assigned_user_id = u.id
    LEFT JOIN (
      SELECT owner_user_id, count(*)::int AS quote_count
      FROM quotations GROUP BY owner_user_id
    ) q ON q.owner_user_id = u.id
    WHERE u.is_active = true
      AND (l.lead_count IS NOT NULL OR q.quote_count IS NOT NULL)
    ORDER BY converted DESC, quotations DESC
  `;
}

/** Overall conversion rate across all leads (scoped by route to admin). */
export async function conversionRate() {
  const sql = getDb();
  const [{ total, converted }] = await sql`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE is_converted)::int AS converted
    FROM leads
  `;
  const pct = total > 0 ? Math.round((1000 * converted) / total) / 10 : 0;
  return { total, converted, conversion_pct: pct };
}
