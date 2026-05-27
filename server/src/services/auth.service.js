import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../database/connection.js';

const BCRYPT_ROUNDS = 10;
const TOKEN_EXPIRES = process.env.JWT_EXPIRES_IN || '24h';

function requireSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 chars long');
  }
  return s;
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function issueToken(user) {
  const payload = { sub: String(user.id), email: user.email, role: user.role };
  return jwt.sign(payload, requireSecret(), { expiresIn: TOKEN_EXPIRES });
}

export function verifyToken(token) {
  return jwt.verify(token, requireSecret());
}

export async function findByEmail(email) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM users WHERE lower(email) = lower(${email}) LIMIT 1`;
  return rows[0] || null;
}

export async function findById(id) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
  return rows[0] || null;
}

/**
 * Auth attempt. Throws { status, message } on failure to keep the caller path tidy.
 * Resolves to { user, token } on success.
 */
export async function login({ email, password }) {
  if (!email || !password) {
    const err = new Error('Email and password required');
    err.status = 400; throw err;
  }
  const user = await findByEmail(email);
  if (!user || !user.is_active) {
    const err = new Error('Invalid credentials');
    err.status = 401; throw err;
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    const err = new Error('Invalid credentials');
    err.status = 401; throw err;
  }
  const sql = getDb();
  await sql`UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = ${user.id}`;
  const token = issueToken(user);
  return { user: sanitize(user), token };
}

export function sanitize(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}
