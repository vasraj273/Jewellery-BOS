/**
 * Role-based access guard.
 *
 *   router.post('/users', requireAuth, requireRole('super_admin', 'admin'), handler)
 *
 * Assumes requireAuth has already attached req.user. Returns 403 if role is
 * not in the allow list.
 */
export function requireRole(...allowed) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    next();
  };
}

/** Convenience: any admin tier (super_admin or admin). */
export const requireAdmin = requireRole('super_admin', 'admin');
export const requireSuperAdmin = requireRole('super_admin');
