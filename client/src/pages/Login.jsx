import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Login failed');
    }
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-serif text-3xl tracking-[6px] text-gold uppercase">JBOS</div>
          <div className="text-[10px] tracking-[3px] uppercase text-gold-light/70 mt-2">
            Jewellery Operating System
          </div>
        </div>

        <form onSubmit={submit} className="card border-l-4 border-l-gold space-y-4">
          <h1 className="font-serif text-xl text-ink tracking-wider mb-2">Sign In</h1>

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="px-3 py-2 border border-red-300 bg-red-50 text-red-700 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <p className="text-[10px] text-ink-muted text-center tracking-wider uppercase pt-2 border-t border-gold-light/40">
            Internal access only · No public signup
          </p>
        </form>
      </div>
    </div>
  );
}
