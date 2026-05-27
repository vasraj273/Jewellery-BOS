import { getDb } from '../database/connection.js';
import { hashPassword, sanitize } from './auth.service.js';

const VALID_ROLES = ['super_admin', 'admin', 'sales_executive'];

export async function listAll() {
  const sql = getDb();
  const rows = await sql`
    SELECT id, full_name, email, role, is_active, last_login_at, created_at, updated_at
    FROM users
    ORDER BY is_active DESC, created_at DESC
  `;
  return rows;
}

export async function findById(id) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
  return rows[0] ? sanitize(rows[0]) : null;
}

export async function create({ full_name, email, password, role }) {
  const sql = getDb();
  validate({ full_name, email, password, role });

  const exists = await sql`SELECT 1 FROM users WHERE lower(email) = lower(${email}) LIMIT 1`;
  if (exists.length) {
    const err = new Error('Email already in use');
    err.status = 409; throw err;
  }

  const hash = await hashPassword(password);
  const [row] = await sql`
    INSERT INTO users (full_name, email, password_hash, role, is_active)
    VALUES (${full_name}, ${email}, ${hash}, ${role}, true)
    RETURNING id, full_name, email, role, is_active, last_login_at, created_at, updated_at
  `;
  return row;
}

export async function update(id, patch, actor) {
  const sql = getDb();
  const target = await getRaw(id);
  if (!target) {
    const err = new Error('User not found');
    err.status = 404; throw err;
  }

  // Safety: prevent removing the last active super_admin.
  if ((patch.role && patch.role !== 'super_admin') || patch.is_active === false) {
    if (target.role === 'super_admin') {
      const [{ count }] = await sql`
        SELECT count(*)::int AS count FROM users
        WHERE role = 'super_admin' AND is_active = true AND id <> ${id}
      `;
      if (count === 0) {
        const err = new Error('Cannot demote or disable the last active super_admin');
        err.status = 400; throw err;
      }
    }
  }
  // Safety: an actor cannot demote / disable themselves.
  if (actor && actor.id === target.id) {
    if (patch.role && patch.role !== actor.role) {
      const err = new Error('You cannot change your own role');
      err.status = 400; throw err;
    }
    if (patch.is_active === false) {
      const err = new Error('You cannot deactivate yourself');
      err.status = 400; throw err;
    }
  }

  const fields = {};
  if (typeof patch.full_name === 'string') fields.full_name = patch.full_name.trim();
  if (typeof patch.role === 'string') {
    if (!VALID_ROLES.includes(patch.role)) {
      const err = new Error(`role must be one of ${VALID_ROLES.join(', ')}`);
      err.status = 400; throw err;
    }
    fields.role = patch.role;
  }
  if (typeof patch.is_active === 'boolean') fields.is_active = patch.is_active;

  if (Object.keys(fields).length === 0) return sanitize(target);

  const cols = Object.keys(fields);
  const [row] = await sql`
    UPDATE users SET ${sql(fields, ...cols)}, updated_at = now()
    WHERE id = ${id}
    RETURNING id, full_name, email, role, is_active, last_login_at, created_at, updated_at
  `;
  return row;
}

export async function resetPassword(id, password) {
  if (!password || password.length < 8) {
    const err = new Error('Password must be at least 8 characters');
    err.status = 400; throw err;
  }
  const sql = getDb();
  const target = await getRaw(id);
  if (!target) {
    const err = new Error('User not found');
    err.status = 404; throw err;
  }
  const hash = await hashPassword(password);
  await sql`UPDATE users SET password_hash = ${hash}, updated_at = now() WHERE id = ${id}`;
}

/** Soft delete — flip is_active to false. */
export async function softDelete(id, actor) {
  return update(id, { is_active: false }, actor);
}

async function getRaw(id) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
  return rows[0] || null;
}

function validate({ full_name, email, password, role }) {
  const errors = [];
  if (!full_name || !full_name.trim()) errors.push('full_name is required');
  if (!email || !/.+@.+\..+/.test(email)) errors.push('valid email is required');
  if (!password || password.length < 8) errors.push('password must be at least 8 characters');
  if (!VALID_ROLES.includes(role)) errors.push(`role must be one of ${VALID_ROLES.join(', ')}`);
  if (errors.length) {
    const err = new Error(errors.join('; '));
    err.status = 400; throw err;
  }
}
