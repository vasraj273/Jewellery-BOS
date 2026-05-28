import { getDb } from '../database/connection.js';

/**
 * Aggregate HR calendar events for a given month (YYYY-MM). Admin only.
 * Pulls from existing data — no dedicated events table.
 *   - approved leaves (spanning days in month)
 *   - employee birthdays (month match)
 *   - joining anniversaries (month match)
 *   - pending leave approvals (request created — surfaced on created date)
 *   - due lead followups (next_followup_at in month)
 *   - task deadlines (due_date in month)
 * Returns a flat list: { date, type, title }.
 */
export async function month(monthStr) {
  const sql = getDb();
  const m = /^\d{4}-\d{2}$/.test(monthStr || '') ? monthStr : new Date().toISOString().slice(0, 7);
  const events = [];

  const leaves = await sql`
    SELECT lv.start_date, lv.end_date, e.full_name, lv.leave_type
    FROM leaves lv JOIN employees e ON e.id = lv.employee_id
    WHERE lv.status = 'approved'
      AND (to_char(lv.start_date,'YYYY-MM') = ${m} OR to_char(lv.end_date,'YYYY-MM') = ${m})
  `;
  for (const l of leaves) events.push({ date: l.start_date, type: 'leave', title: `${l.full_name} on ${l.leave_type} leave → ${l.end_date}` });

  const bdays = await sql`
    SELECT full_name, birthday FROM employees
    WHERE birthday IS NOT NULL AND to_char(birthday,'MM') = ${m.slice(5, 7)} AND is_active = true
  `;
  for (const b of bdays) events.push({ date: `${m}-${String(new Date(b.birthday).getDate()).padStart(2, '0')}`, type: 'birthday', title: `🎂 ${b.full_name}'s birthday` });

  const annis = await sql`
    SELECT full_name, joining_date FROM employees
    WHERE joining_date IS NOT NULL AND to_char(joining_date,'MM') = ${m.slice(5, 7)} AND is_active = true
  `;
  for (const a of annis) events.push({ date: `${m}-${String(new Date(a.joining_date).getDate()).padStart(2, '0')}`, type: 'anniversary', title: `🎉 ${a.full_name} work anniversary` });

  const pending = await sql`
    SELECT lv.created_at, e.full_name, lv.leave_type
    FROM leaves lv JOIN employees e ON e.id = lv.employee_id
    WHERE lv.status = 'pending' AND to_char(lv.created_at,'YYYY-MM') = ${m}
  `;
  for (const p of pending) events.push({ date: p.created_at, type: 'pending_approval', title: `⏳ ${p.full_name} requested ${p.leave_type} leave` });

  const followups = await sql`
    SELECT l.next_followup_at, l.name, l.lead_code
    FROM leads l
    WHERE l.next_followup_at IS NOT NULL AND to_char(l.next_followup_at,'YYYY-MM') = ${m}
      AND l.is_converted = false AND l.is_lost = false
  `;
  for (const f of followups) events.push({ date: f.next_followup_at, type: 'followup', title: `📞 Follow up ${f.name} (${f.lead_code})` });

  const tasks = await sql`
    SELECT t.due_date, t.title, u.full_name
    FROM tasks t LEFT JOIN users u ON u.id = t.assigned_to_user_id
    WHERE t.due_date IS NOT NULL AND to_char(t.due_date,'YYYY-MM') = ${m}
      AND t.status IN ('pending','in_progress')
  `;
  for (const t of tasks) events.push({ date: t.due_date, type: 'task', title: `✓ ${t.title}${t.full_name ? ` — ${t.full_name}` : ''}` });

  // Normalise date to YYYY-MM-DD string + sort.
  const norm = events.map((e) => ({ ...e, date: new Date(e.date).toISOString().slice(0, 10) }));
  norm.sort((a, b) => a.date.localeCompare(b.date));
  return { month: m, events: norm };
}
