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

/**
 * Per-employee HR performance (admin only). Joins CRM activity by the
 * employee's linked user_id with attendance + leave counts.
 *   month filter: 'YYYY-MM' on attendance + quotation/lead created_at.
 */
export async function employeePerformance(filters = {}) {
  const sql = getDb();
  const month = /^\d{4}-\d{2}$/.test(filters.month || '') ? filters.month : null;

  const qMonth = month ? sql`AND to_char(q.created_at, 'YYYY-MM') = ${month}` : sql``;
  const lMonth = month ? sql`AND to_char(l.created_at, 'YYYY-MM') = ${month}` : sql``;
  const aMonth = month ? sql`AND to_char(a.attendance_date, 'YYYY-MM') = ${month}` : sql``;

  return sql`
    SELECT
      e.id              AS employee_id,
      e.employee_code,
      e.full_name,
      e.role,
      e.department,
      e.employment_status,
      COALESCE(q.quote_count, 0)     AS quotations,
      COALESCE(l.lead_count, 0)      AS leads,
      COALESCE(l.converted, 0)       AS converted,
      COALESCE(cu.customer_count, 0) AS customers,
      COALESCE(rm.reminders_done, 0) AS reminders_done,
      CASE WHEN COALESCE(l.lead_count,0) > 0
           THEN ROUND(100.0 * COALESCE(l.converted,0) / l.lead_count, 1) ELSE 0 END AS conversion_pct,
      COALESCE(at.present, 0)        AS days_present,
      COALESCE(at.total_days, 0)     AS days_marked,
      CASE WHEN COALESCE(at.total_days,0) > 0
           THEN ROUND(100.0 * COALESCE(at.present,0) / at.total_days, 0) ELSE 0 END AS attendance_pct,
      COALESCE(lv.leave_count, 0)    AS leave_count
    FROM employees e
    LEFT JOIN (
      SELECT owner_user_id, count(*)::int AS quote_count
      FROM quotations q WHERE 1=1 ${qMonth} GROUP BY owner_user_id
    ) q ON q.owner_user_id = e.user_id
    LEFT JOIN (
      SELECT assigned_user_id,
             count(*)::int AS lead_count,
             count(*) FILTER (WHERE is_converted)::int AS converted
      FROM leads l WHERE 1=1 ${lMonth} GROUP BY assigned_user_id
    ) l ON l.assigned_user_id = e.user_id
    LEFT JOIN (
      SELECT assigned_user_id, count(*)::int AS customer_count
      FROM customers GROUP BY assigned_user_id
    ) cu ON cu.assigned_user_id = e.user_id
    LEFT JOIN (
      SELECT assigned_user_id, count(*)::int AS reminders_done
      FROM reminder_tasks WHERE status = 'done' GROUP BY assigned_user_id
    ) rm ON rm.assigned_user_id = e.user_id
    LEFT JOIN (
      SELECT a.employee_id,
             count(*)::int AS total_days,
             count(*) FILTER (WHERE a.status = 'present')::int AS present
      FROM attendance a WHERE 1=1 ${aMonth} GROUP BY a.employee_id
    ) at ON at.employee_id = e.id
    LEFT JOIN (
      SELECT employee_id, count(*)::int AS leave_count
      FROM leaves WHERE status = 'approved' GROUP BY employee_id
    ) lv ON lv.employee_id = e.id
    WHERE e.is_active = true
      ${filters.employee_id ? sql`AND e.id = ${Number(filters.employee_id)}` : sql``}
      ${filters.role ? sql`AND e.role = ${filters.role}` : sql``}
    ORDER BY converted DESC, quotations DESC, e.full_name ASC
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
