import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

/**
 * JBOS auth state holder.
 *   - Hydrates from localStorage on mount.
 *   - Exposes login(email, pw) / logout() / user / token / loading.
 *   - Sets axios default Authorization header so every request includes the JWT.
 *   - Listens for `jbos:unauthorized` (dispatched by the axios interceptor on 401)
 *     and clears state so RequireAuth bounces to /login.
 */

const STORAGE_KEY = 'jbos.auth';

const AuthCtx = createContext(null);

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.user) return null;
    return parsed;
  } catch { return null; }
}

function applyAuthHeader(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export function AuthProvider({ children }) {
  const stored = readStored();
  const [user, setUser]     = useState(stored?.user || null);
  const [token, setToken]   = useState(stored?.token || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { applyAuthHeader(token); }, [token]);

  // Global 401 handler from axios interceptor → forced logout.
  useEffect(() => {
    const onUnauth = () => {
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
      setToken(null);
    };
    window.addEventListener('jbos:unauthorized', onUnauth);
    return () => window.removeEventListener('jbos:unauthorized', onUnauth);
  }, []);

  async function login(email, password) {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const { user: u, token: t } = res.data.data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: u, token: t }));
      setUser(u);
      setToken(t);
      return u;
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try { await api.post('/auth/logout'); } catch { /* ignore — stateless */ }
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setToken(null);
  }

  const value = useMemo(() => ({ user, token, loading, login, logout }), [user, token, loading]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
