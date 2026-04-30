import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { useClient } from '../contexts/ClientContext';

export default function LoginPage() {
  const { login, loginError, isAuthenticated, clientId, isTransitioning } = useClient();
  const navigate = useNavigate();
  const [tokenInput, setTokenInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  useEffect(() => {
    if (isAuthenticated && clientId) {
      navigate(`/dashboard/${clientId}`, { replace: true });
    }
  }, [isAuthenticated, clientId, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = await login(tokenInput, passwordInput);
    if (id) {
      navigate(`/dashboard/${id}`, { replace: true });
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-apple-bg px-6 py-10 font-sans">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-apple-gold/[0.06] blur-3xl" />
        <div className="absolute -bottom-48 -left-32 h-[600px] w-[600px] rounded-full bg-apple-gold/[0.04] blur-3xl" />
      </div>

      <div
        className={`relative z-10 w-full max-w-md rounded-apple border border-apple-border/40 bg-white/70 p-10 text-center shadow-glass-xl backdrop-blur-[20px] transition-opacity duration-300 ${
          isTransitioning ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-apple-text">
          <Activity className="h-7 w-7 text-apple-gold" />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-apple-text">
          Market Intelligence
        </h1>
        <p className="mt-2 text-sm text-apple-muted">
          Monitorizare strategică și analiză competitivă
        </p>

        <form onSubmit={handleLogin} className="mt-8 space-y-4 text-left">
          <div>
            <label
              htmlFor="accessCode"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-apple-muted"
            >
              Cod Acces Client
            </label>
            <input
              id="accessCode"
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="w-full rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-text transition-all placeholder:text-apple-muted/60 focus:border-apple-gold focus:ring-2 focus:ring-apple-gold/20"
              placeholder="Introduceți codul de acces"
              required
            />
          </div>
          <div>
            <label
              htmlFor="clientPassword"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-apple-muted"
            >
              Parolă
            </label>
            <input
              id="clientPassword"
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-text transition-all placeholder:text-apple-muted/60 focus:border-apple-gold focus:ring-2 focus:ring-apple-gold/20"
              placeholder="Introduceți parola"
            />
          </div>
          {loginError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
              {loginError}
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-full bg-apple-text px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-apple-text/90 active:scale-[0.98]"
          >
            Intră în Dashboard
          </button>
        </form>

        <p className="mt-6 text-[11px] text-apple-muted/60">
          AZISUNT.VIP &middot; Business Intelligence Platform
        </p>
      </div>
    </div>
  );
}
