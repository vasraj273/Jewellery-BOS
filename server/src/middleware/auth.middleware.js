import { verifyToken, findById, sanitize } from '../services/auth.service.js';

/**
 * Authenticates a request via `Authorization: Bearer <jwt>`.
 *   - 401 if header missing/invalid
 *   - attaches `req.user` (sanitized DB row) for downstream handlers
 *
 * M1: every authenticated user has full access. RBAC arrives in M2.
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ success: false, error: 'Missing bearer token' });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch (e) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    const user = await findById(payload.sub);
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, error: 'User no longer active' });
    }

    req.user = sanitize(user);
    next();
  } catch (e) {
    next(e);
  }
}
