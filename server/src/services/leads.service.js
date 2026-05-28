import { getDb } from '../database/connection.js';
import { generateLeadCode } from '../utils/leadCode.js';
import * as customers from './customers.service.js';
import * as audit from './audit.service.js';

const PRIORITIES = ['low', 'medium', 'high'];

const SORT_MAP = {
  newest: 'l.created_at DESC',
  oldest: 'l.created_at ASC'
};

/**
 * RBAC scope. super_admin/admin see all; sales_executive sees only leads
 * assigned to them. actor=null short-circuits (internal callers).
 */
function scopeFor(actor) {
  if (!actor) return null;
  if (actor.role === 'super_admin' || actor.role === 'admin') return null;
  return Number(actor.id);
}

function isAdmin(actor) {
  return actor?.role === 'super_admin' || actor?.role === 'admin';
}

// Common SELECT with joined labels + assignee name.
const LEAD_SELECT = `
  SELECT l.*,
         s.label AS source_label,
         st.label AS status_label,
         st.is_terminal AS status_terminal,
         u.full_name AS assigned_name
  FROM leads l
  LEFT JOIN lead_sources s   ON s.id  = l.source_id
  LEFT JOIN lead_statuses st ON st.id = l.status_id
  LEFT JOIN users u          ON u.id  = l.assigned_user_id
`;

export async function list(actor, filters = {}) {
  const sql = getDb();
  const scopedOwner = scopeFor(actor);

  const adminAssignFilter =
    scopedOwner == null && filters.assigned_user_id != null && filters.assigned_user_id !== ''
      ? Number(filters.assigned_user_id)
      : null;

  const ownerClause = scopedOwner != null
    ? sql`AND l.assigned_user_id = ${scopedOwner}`
    : (adminAssignFilter != null ? sql`AND l.assigned_user_id = ${adminAssignFilter}` : sql``);

  const statusClause = filters.status_id
    ? sql`AND l.status_id = ${Number(filters.status_id)}`
    : sql``;
  const sourceClause = filters.source_id
    ? sql`AND l.source_id = ${Number(filters.source_id)}`
    : sql``;
  const priorityClause = filters.priority
    ? sql`AND l.priority = ${filters.priority}`
    : sql``;

  const dateFromClause = filters.date_from ? sql`AND l.created_at >= ${filters.date_from}::date` : sql``;
  const dateToClause   = filters.date_to   ? sql`AND l.created_at < (${filters.date_to}::date + INTERVAL '1 day')` : sql``;

  const search = (filters.search || '').trim();
  const searchClause = search
    ? sql`AND (
        l.name      ILIKE ${'%' + search + '%'} OR
        l.mobile    ILIKE ${'%' + search + '%'} OR
        l.email     ILIKE ${'%' + search + '%'} OR
        l.lead_code ILIKE ${'%' + search + '%'}
      )`
    : sql``;

  const orderBy = SORT_MAP[filters.sort] || SORT_MAP.newest;
  const limit   = Math.min(Math.max(parseInt(filters.limit, 10) || 500, 1), 1000);
  const offset  = Math.max(parseInt(filters.offset, 10) || 0, 0);

  return sql`
    ${sql.unsafe(LEAD_SELECT)}
    WHERE 1 = 1
    ${ownerClause}
    ${statusClause}
    ${sourceClause}
    ${priorityClause}
    ${dateFromClause}
    ${dateToClause}
    ${searchClause}
    ORDER BY ${sql.unsafe(orderBy)}
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function findById(id, actor) {
  const sql = getDb();
  const scopedOwner = scopeFor(actor);
  const rows = scopedOwner == null
    ? await sql`${sql.unsafe(LEAD_SELECT)} WHERE l.id = ${id}`
    : await sql`${sql.unsafe(LEAD_SELECT)} WHERE l.id = ${id} AND l.assigned_user_id = ${scopedOwner}`;
  return rows[0] || null;
}

export async function create(input, actor) {
  if (!input?.name?.trim() || !input?.mobile?.trim()) {
    const err = new Error('Name and mobile are required'); err.status = 400; throw err;
  }
  const sql = getDb();

  // Ownership: sales_exec always self. Admin may assign to anyone active.
  let assignedId = Number(actor.id);
  if (isAdmin(actor) && input.assigned_user_id) {
    const [target] = await sql`SELECT id FROM users WHERE id = ${Number(input.assigned_user_id)} AND is_active = true LIMIT 1`;
    if (!target) { const err = new Error('Assigned user not found or inactive'); err.status = 400; throw err; }
    assignedId = target.id;
  }

  const priority = PRIORITIES.includes(input.priority) ? input.priority : 'medium';
  const leadCode = await generateLeadCode();

  const row = {
    lead_code:          leadCode,
    name:               input.name.trim(),
    mobile:             input.mobile.trim(),
    email:              input.email?.trim() || null,
    occasion:           input.occasion?.trim() || null,
    budget:             input.budget != null && input.budget !== '' ? Number(input.budget) : null,
    notes:              input.notes?.trim() || null,
    source_id:          input.source_id ? Number(input.source_id) : null,
    status_id:          input.status_id ? Number(input.status_id) : null,
    priority,
    assigned_user_id:   assignedId,
    created_by_user_id: Number(actor.id),
    next_followup_at:   input.next_followup_at || null
  };

  await sql`INSERT INTO leads ${sql(row)}`;
  const [created] = await sql`SELECT id FROM leads WHERE lead_code = ${leadCode} LIMIT 1`;
  return findById(created.id, null);
}

export async function update(id, patch, actor) {
  const sql = getDb();
  const current = await getRaw(id);
  if (!current) { const err = new Error('Lead not found'); err.status = 404; throw err; }

  // Scope: sales_exec can only touch own leads.
  if (!isAdmin(actor) && Number(current.assigned_user_id) !== Number(actor.id)) {
    const err = new Error('Not found'); err.status = 404; throw err;
  }

  const fields = {};
  const reassigned = { changed: false, from: current.assigned_user_id, to: current.assigned_user_id };

  if (typeof patch.name === 'string')     fields.name = patch.name.trim();
  if (typeof patch.mobile === 'string')   fields.mobile = patch.mobile.trim();
  if ('email' in patch)                   fields.email = patch.email?.trim() || null;
  if ('occasion' in patch)                fields.occasion = patch.occasion?.trim() || null;
  if ('budget' in patch)                  fields.budget = patch.budget === '' || patch.budget == null ? null : Number(patch.budget);
  if ('notes' in patch)                   fields.notes = patch.notes?.trim() || null;
  if (patch.source_id !== undefined)      fields.source_id = patch.source_id ? Number(patch.source_id) : null;
  if (patch.priority && PRIORITIES.includes(patch.priority)) fields.priority = patch.priority;
  if ('next_followup_at' in patch)        fields.next_followup_at = patch.next_followup_at || null;

  // Status change — also maintain is_converted / is_lost flags from terminal.
  if (patch.status_id !== undefined && patch.status_id !== null && patch.status_id !== '') {
    const sid = Number(patch.status_id);
    fields.status_id = sid;
    const [st] = await sql`SELECT is_terminal FROM lead_statuses WHERE id = ${sid} LIMIT 1`;
    fields.is_converted = st?.is_terminal === 'converted';
    fields.is_lost      = st?.is_terminal === 'lost';
  }

  // Reassignment — admin only.
  if (patch.assigned_user_id !== undefined && patch.assigned_user_id !== null && patch.assigned_user_id !== '') {
    const newAssignee = Number(patch.assigned_user_id);
    if (newAssignee !== Number(current.assigned_user_id)) {
      if (!isAdmin(actor)) {
        const err = new Error('You cannot reassign leads'); err.status = 403; throw err;
      }
      const [target] = await sql`SELECT id FROM users WHERE id = ${newAssignee} AND is_active = true LIMIT 1`;
      if (!target) { const err = new Error('Assigned user not found or inactive'); err.status = 400; throw err; }
      fields.assigned_user_id = newAssignee;
      reassigned.changed = true;
      reassigned.to = newAssignee;
    }
  }

  // Detect a transition into the 'converted' terminal status this update.
  const becameConverted = fields.is_converted === true && !current.is_converted;

  if (Object.keys(fields).length === 0) return { lead: await findById(id, null), reassigned, converted: false };

  const cols = Object.keys(fields);
  await sql`UPDATE leads SET ${sql(fields, ...cols)}, updated_at = now() WHERE id = ${id}`;

  let converted = false;
  if (becameConverted) {
    const fresh = await getRaw(id);
    const { created } = await customers.ensureFromLead(fresh, actor);
    converted = true;
    audit.record({
      actor, action: 'lead.converted',
      entityType: 'lead', entityId: id,
      metadata: { customer_created: created, mobile: fresh.mobile },
      req: null
    });
  }

  return { lead: await findById(id, null), reassigned, converted };
}

export async function listFollowups(leadId, actor) {
  // Ensure the actor can see the lead before exposing its timeline.
  const lead = await findById(leadId, actor);
  if (!lead) { const err = new Error('Lead not found'); err.status = 404; throw err; }
  const sql = getDb();
  return sql`
    SELECT f.*, u.full_name AS created_by_name
    FROM lead_followups f
    LEFT JOIN users u ON u.id = f.created_by_user_id
    WHERE f.lead_id = ${leadId}
    ORDER BY f.created_at DESC
  `;
}

export async function addFollowup(leadId, input, actor) {
  const lead = await findById(leadId, actor);
  if (!lead) { const err = new Error('Lead not found'); err.status = 404; throw err; }
  if (!input?.notes?.trim()) { const err = new Error('Followup notes required'); err.status = 400; throw err; }

  const sql = getDb();
  const [row] = await sql`
    INSERT INTO lead_followups (lead_id, followup_date, notes, created_by_user_id)
    VALUES (${leadId}, ${input.followup_date || sql`now()`}, ${input.notes.trim()}, ${Number(actor.id)})
    RETURNING *
  `;
  // Optionally roll the lead's next_followup_at forward if provided.
  if (input.next_followup_at) {
    await sql`UPDATE leads SET next_followup_at = ${input.next_followup_at}, updated_at = now() WHERE id = ${leadId}`;
  }
  return row;
}

/** Link a freshly-created quotation back to its source lead. */
export async function attachQuotation(leadId, quotationId, actor) {
  const lead = await findById(leadId, actor);
  if (!lead) return null;
  const sql = getDb();
  await sql`
    UPDATE leads SET converted_quotation_id = ${quotationId}, updated_at = now()
    WHERE id = ${leadId}
  `;
  return true;
}

/** Dashboard widget counts, scoped to the actor. */
export async function stats(actor) {
  const sql = getDb();
  const scopedOwner = scopeFor(actor);
  const ownerClause = scopedOwner != null ? sql`WHERE assigned_user_id = ${scopedOwner}` : sql``;
  const ownerAnd    = scopedOwner != null ? sql`AND assigned_user_id = ${scopedOwner}` : sql``;

  const [[{ total }], [{ converted }], [{ lost }], [{ due }]] = await Promise.all([
    sql`SELECT count(*)::int AS total FROM leads ${ownerClause}`,
    sql`SELECT count(*)::int AS converted FROM leads WHERE is_converted = true ${ownerAnd}`,
    sql`SELECT count(*)::int AS lost FROM leads WHERE is_lost = true ${ownerAnd}`,
    sql`SELECT count(*)::int AS due FROM leads
        WHERE next_followup_at IS NOT NULL
          AND next_followup_at <= now()
          AND is_converted = false AND is_lost = false
          ${ownerAnd}`
  ]);

  return { total, converted, lost, due_followups: due };
}

async function getRaw(id) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM leads WHERE id = ${id} LIMIT 1`;
  return rows[0] || null;
}
