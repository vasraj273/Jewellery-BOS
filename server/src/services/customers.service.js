import { getDb } from '../database/connection.js';
import { generateCustomerCode } from '../utils/customerCode.js';

const ADMIN = (a) => a?.role === 'super_admin' || a?.role === 'admin';
function scopeFor(actor) {
  if (!actor) return null;
  if (ADMIN(actor)) return null;
  return Number(actor.id);
}

const BASE_SELECT = `
  SELECT c.*,
         u.full_name AS assigned_name,
         (SELECT count(*)::int FROM quotations q WHERE q.customer_mobile = c.mobile) AS quotation_count,
         (SELECT max(ev.created_at) FROM customer_events ev WHERE ev.customer_id = c.id) AS last_activity_at
  FROM customers c
  LEFT JOIN users u ON u.id = c.assigned_user_id
`;

export async function list(actor, filters = {}) {
  const sql = getDb();
  const scoped = scopeFor(actor);
  const adminAssign =
    scoped == null && filters.assigned_user_id ? Number(filters.assigned_user_id) : null;

  const ownerClause = scoped != null
    ? sql`AND c.assigned_user_id = ${scoped}`
    : (adminAssign != null ? sql`AND c.assigned_user_id = ${adminAssign}` : sql``);

  const search = (filters.search || '').trim();
  const searchClause = search
    ? sql`AND (
        c.name          ILIKE ${'%' + search + '%'} OR
        c.mobile        ILIKE ${'%' + search + '%'} OR
        c.email         ILIKE ${'%' + search + '%'} OR
        c.customer_code ILIKE ${'%' + search + '%'}
      )`
    : sql``;

  const dateFrom = filters.date_from ? sql`AND c.created_at >= ${filters.date_from}::date` : sql``;
  const dateTo   = filters.date_to   ? sql`AND c.created_at < (${filters.date_to}::date + INTERVAL '1 day')` : sql``;

  const order = filters.sort === 'oldest' ? 'c.created_at ASC' : 'c.created_at DESC';
  const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 500, 1), 1000);

  const rows = await sql`
    ${sql.unsafe(BASE_SELECT)}
    WHERE 1 = 1
    ${ownerClause}
    ${searchClause}
    ${dateFrom}
    ${dateTo}
    ORDER BY ${sql.unsafe(order)}
    LIMIT ${limit}
  `;

  // Repeat filter applied after the count subquery resolves.
  if (filters.repeat === '1') return rows.filter((r) => r.quotation_count > 1);
  if (filters.repeat === '0') return rows.filter((r) => r.quotation_count <= 1);
  return rows;
}

export async function findById(id, actor) {
  const sql = getDb();
  const scoped = scopeFor(actor);
  const rows = scoped == null
    ? await sql`${sql.unsafe(BASE_SELECT)} WHERE c.id = ${id}`
    : await sql`${sql.unsafe(BASE_SELECT)} WHERE c.id = ${id} AND c.assigned_user_id = ${scoped}`;
  return rows[0] || null;
}

export async function update(id, patch, actor) {
  const sql = getDb();
  const current = await getRaw(id);
  if (!current) { const e = new Error('Customer not found'); e.status = 404; throw e; }
  if (!ADMIN(actor) && Number(current.assigned_user_id) !== Number(actor.id)) {
    const e = new Error('Not found'); e.status = 404; throw e;
  }

  const fields = {};
  for (const k of ['name', 'mobile', 'email', 'address', 'ring_size', 'preferred_metal', 'budget_range', 'notes']) {
    if (k in patch) fields[k] = patch[k] === '' ? null : patch[k];
  }
  for (const k of ['birthday', 'anniversary']) {
    if (k in patch) fields[k] = patch[k] || null;
  }
  if (ADMIN(actor) && patch.assigned_user_id) {
    const [t] = await sql`SELECT id FROM users WHERE id = ${Number(patch.assigned_user_id)} AND is_active = true LIMIT 1`;
    if (!t) { const e = new Error('Assigned user not found or inactive'); e.status = 400; throw e; }
    fields.assigned_user_id = t.id;
  }
  if (fields.name != null && !String(fields.name).trim()) { const e = new Error('Name required'); e.status = 400; throw e; }

  if (Object.keys(fields).length === 0) return findById(id, null);
  const cols = Object.keys(fields);
  await sql`UPDATE customers SET ${sql(fields, ...cols)}, updated_at = now() WHERE id = ${id}`;
  await addEvent(id, { event_type: 'profile_updated', title: 'Profile updated' }, actor);
  return findById(id, null);
}

export async function listEvents(id, actor) {
  const cust = await findById(id, actor);
  if (!cust) { const e = new Error('Customer not found'); e.status = 404; throw e; }
  const sql = getDb();
  return sql`
    SELECT e.*, u.full_name AS actor_name
    FROM customer_events e
    LEFT JOIN users u ON u.id = e.actor_user_id
    WHERE e.customer_id = ${id}
    ORDER BY e.created_at DESC
  `;
}

export async function addEvent(id, { event_type = 'note', title, notes }, actor) {
  const sql = getDb();
  const [row] = await sql`
    INSERT INTO customer_events (customer_id, event_type, title, notes, actor_user_id)
    VALUES (${id}, ${event_type}, ${title || 'Note'}, ${notes || null}, ${actor?.id ? Number(actor.id) : null})
    RETURNING *
  `;
  return row;
}

/**
 * Idempotent customer creation from a lead. Dedupe identity = mobile.
 *   - If a customer with the lead's mobile exists, reuse it.
 *   - Otherwise create one assigned to the lead's owner.
 * Always links lead.converted_customer_id ↔ customer.source_lead_id.
 * Returns { customer, created }.
 */
export async function ensureFromLead(lead, actor) {
  const sql = getDb();
  const mobile = (lead.mobile || '').trim();
  if (!mobile) return { customer: null, created: false };

  let [existing] = await sql`SELECT * FROM customers WHERE mobile = ${mobile} LIMIT 1`;
  let created = false;

  if (!existing) {
    const code = await generateCustomerCode();
    const row = {
      customer_code:    code,
      name:             lead.name || 'Customer',
      mobile,
      email:            lead.email || null,
      assigned_user_id: lead.assigned_user_id ?? (actor?.id ? Number(actor.id) : null),
      source_lead_id:   lead.id
    };
    await sql`INSERT INTO customers ${sql(row)}`;
    [existing] = await sql`SELECT * FROM customers WHERE mobile = ${mobile} LIMIT 1`;
    created = true;
    await addEvent(existing.id, {
      event_type: 'lead_converted',
      title: `Lead ${lead.lead_code} converted`,
      notes: lead.occasion ? `Occasion: ${lead.occasion}` : null
    }, actor);
  }

  // Link both directions (no-op if already linked).
  await sql`UPDATE leads SET converted_customer_id = ${existing.id}, updated_at = now() WHERE id = ${lead.id} AND (converted_customer_id IS NULL OR converted_customer_id = ${existing.id})`;
  if (!existing.source_lead_id) {
    await sql`UPDATE customers SET source_lead_id = ${lead.id} WHERE id = ${existing.id}`;
  }

  return { customer: existing, created };
}

/** Record a quotation against the matching customer timeline (by mobile). */
export async function recordQuotationEvent(quotation, actor) {
  if (!quotation?.customer_mobile) return;
  const sql = getDb();
  const [c] = await sql`SELECT id FROM customers WHERE mobile = ${quotation.customer_mobile} LIMIT 1`;
  if (!c) return;
  await addEvent(c.id, {
    event_type: 'quotation_sent',
    title: `Quotation ${quotation.quote_id}`,
    notes: `Total ₹${Number(quotation.final_price || 0).toLocaleString('en-IN')}`
  }, actor);
}

export async function stats(actor) {
  const sql = getDb();
  const scoped = scopeFor(actor);
  const ownerClause = scoped != null ? sql`WHERE assigned_user_id = ${scoped}` : sql``;

  const [[{ total }], repeats] = await Promise.all([
    sql`SELECT count(*)::int AS total FROM customers ${ownerClause}`,
    sql`
      SELECT count(*)::int AS repeat_count FROM (
        SELECT c.id
        FROM customers c
        ${scoped != null ? sql`WHERE c.assigned_user_id = ${scoped}` : sql``}
      ) c
      WHERE (SELECT count(*) FROM quotations q WHERE q.customer_mobile = (SELECT mobile FROM customers WHERE id = c.id)) > 1
    `
  ]);
  return { total, repeat: repeats[0]?.repeat_count || 0 };
}

async function getRaw(id) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM customers WHERE id = ${id} LIMIT 1`;
  return rows[0] || null;
}
