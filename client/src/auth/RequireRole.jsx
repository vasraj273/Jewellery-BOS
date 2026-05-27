import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

/**
 * Route-level role gate. Renders children if the logged-in user's role is in
 * `roles`. Sends others to /dashboard (they're authenticated, just not
 * authorised for this surface).
 *
 *   <RequireRole roles={['super_admin','admin']}>
 *     <UsersPage />
 *   </RequireRole>
 */
export default function RequireRole({ roles = [], children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}
