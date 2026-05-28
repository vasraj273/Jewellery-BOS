import { getDb } from '../database/connection.js';

const CATEGORIES = ['meeting', 'exhibition', 'audit', 'holiday', 'promotion', 'training', 'general'];

/**
 * Aggregate HR calendar events for a given month (YYYY-MM). Admin only.
 *
 * Two sources are merged:
 *   AUTO (derived from existing tables — read-only on the calendar):
 *     - approved leaves (spanning days in month)
 *     - employee birthdays (month match)
 *     - joining anniversaries (month match)
 *     - pending leave approvals (surfaced on request-created date)
 *     - due lead followups (next_followup_at in month)
 *     - task deadlines (due_date in month)
 *   MANUAL (calendar_events table — admin create/edit/delete).
 *
 * Each auto source is isolated so a single failing query cannot blank the whole
 * calendar. Returns { month, events:[{ date, type, title, id?, category?, editable }] }.
 */
export async function month(monthStr) {
  const sql = getDb();
  const m = /^\d{4}-\d{2}$/.test(monthStr || '') ? monthStr : new Date().toISOString().slice(0, 7);
  const events = [];

  const safe = async (fn) => { try { return await fn(); } catch { return []; } };

  const leaves = await safe(() => sql`
    SELECT lv.start_date, lv.end_date, e.full_name, lv.leave_type
    FROM leaves lv JOIN employees e ON e.id = lv.employee_id
    WHERE lv.status = 'approved'
      AND (to_char(lv.start_date,'YYYY-MM') = ${m} OR to_char(lv.end_date,'YYYY-MM') = ${m})
  `);
  for (const l of leaves) events.push({ date: l.start_date, type: 'leave', title: `${l.full_name} on ${l.leave_type} leave → ${l.end_date}`, editable: false });

  const bdays = await safe(() => sql`
    SELECT full_name, birthday FROM employees
    WHERE birthday IS NOT NULL AND to_char(birthday,'MM') = ${m.slice(5, 7)} AND is_active = true
  `);
  for (const b of bdays) events.push({ date: `${m}-${String(new Date(b.birthday).getDate()).padStart(2, '0')}`, type: 'birthday', title: `🎂 ${b.full_name}'s birthday`, editable: false });

  const annis = await safe(() => sql`
    SELECT full_name, joining_date FROM employees
    WHERE joining_date IS NOT NULL AND to_char(joining_date,'MM') = ${m.slice(5, 7)} AND is_active = true
  `);
  for (const a of annis) events.push({ date: `${m}-${String(new Date(a.joining_date).getDate()).padStart(2, '0')}`, type: 'anniversary', title: `🎉 ${a.full_name} work anniversary`, editable: false });

  const pending = await safe(() => sql`
    SELECT lv.created_at, e.full_name, lv.leave_type
    FROM leaves lv JOIN employees e ON e.id = lv.employee_id
    WHERE lv.status = 'pending' AND to_char(lv.created_at,'YYYY-MM') = ${m}
  `);
  for (const p of pending) events.push({ date: p.created_at, type: 'pending_approval', title: `⏳ ${p.full_name} requested ${p.leave_type} leave`, editable: false });

  const followups = await safe(() => sql`
    SELECT l.next_followup_at, l.name, l.lead_code
    FROM leads l
    WHERE l.next_followup_at IS NOT NULL AND to_char(l.next_followup_at,'YYYY-MM') = ${m}
      AND l.is_converted = false AND l.is_lost = false
  `);
  for (const f of followups) events.push({ date: f.next_followup_at, type: 'followup', title: `📞 Follow up ${f.name} (${f.lead_code})`, editable: false });

  const tasks = await safe(() => sql`
    SELECT t.due_date, t.title, u.full_name
    FROM tasks t LEFT JOIN users u ON u.id = t.assigned_to_user_id
    WHERE t.due_date IS NOT NULL AND to_char(t.due_date,'YYYY-MM') = ${m}
      AND t.status IN ('pending','in_progress')
  `);
  for (const t of tasks) events.push({ date: t.due_date, type: 'task', title: `✓ ${t.title}${t.full_name ? ` — ${t.full_name}` : ''}`, editable: false });

  const manual = await safe(() => sql`
    SELECT id, title, description, event_date, category
    FROM calendar_events
    WHERE is_active = true AND to_char(event_date,'YYYY-MM') = ${m}
  `);
  for (const e of manual) events.push({ id: e.id, date: e.event_date, type: 'manual', category: e.category, title: e.title, description: e.description, editable: true });

  // Normalise date to YYYY-MM-DD string + sort.
  const norm = events.map((e) => ({ ...e, date: new Date(e.date).toISOString().slice(0, 10) }));
  norm.sort((a, b) => a.date.localeCompare(b.date));
  return { month: m, events: norm };
}

function normaliseInput(input) {
  const title = (input?.title || '').trim();
  const event_date = (input?.event_date || '').trim();
  if (!title) { const e = new Error('Title required'); e.status = 400; throw e; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date)) { const e = new Error('Valid event_date (YYYY-MM-DD) required'); e.status = 400; throw e; }
  const category = CATEGORIES.includes(input.category) ? input.category : 'general';
  return { title, event_date, category, description: input.description?.trim() || null };
}

export async function createEvent(input, actor) {
  const sql = getDb();
  const { title, event_date, category, description } = normaliseInput(input);
  const dup = await sql`
    SELECT id FROM calendar_events
    WHERE is_active = true AND lower(title) = lower(${title}) AND event_date = ${event_date}::date
    LIMIT 1
  `;
  if (dup.length) { const e = new Error('An event with this title already exists on this date'); e.status = 409; throw e; }
  const [row] = await sql`
    INSERT INTO calendar_events (title, description, event_date, category, created_by_user_id)
    VALUES (${title}, ${description}, ${event_date}::date, ${category}, ${Number(actor.id)})
    RETURNING *
  `;
  return row;
}

export async function updateEvent(id, input) {
  const sql = getDb();
  const [cur] = await sql`SELECT * FROM calendar_events WHERE id = ${id} AND is_active = true LIMIT 1`;
  if (!cur) { const e = new Error('Event not found'); e.status = 404; throw e; }
  const { title, event_date, category, description } = normaliseInput(input);
  const dup = await sql`
    SELECT id FROM calendar_events
    WHERE is_active = true AND lower(title) = lower(${title}) AND event_date = ${event_date}::date AND id <> ${id}
    LIMIT 1
  `;
  if (dup.length) { const e = new Error('An event with this title already exists on this date'); e.status = 409; throw e; }
  const [row] = await sql`
    UPDATE calendar_events
    SET title = ${title}, description = ${description}, event_date = ${event_date}::date,
        category = ${category}, updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return row;
}

export async function deleteEvent(id) {
  const sql = getDb();
  const [row] = await sql`UPDATE calendar_events SET is_active = false, updated_at = now() WHERE id = ${id} RETURNING id`;
  if (!row) { const e = new Error('Event not found'); e.status = 404; throw e; }
  return { id: row.id };
}
