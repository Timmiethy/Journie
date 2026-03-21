import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { ActionButton, TextButton } from '../components/ui/action-button';
import { AuraShell } from '../components/layout/AuraShell';

type Mode = 'login' | 'signup';

function Logo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <svg viewBox="0 0 120 120" className="w-full h-full">
        <defs>
          <linearGradient id="bookGradientAuth" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F17A74" />
            <stop offset="100%" stopColor="#F8A740" />
          </linearGradient>
        </defs>
        <g
          fill="none"
          stroke="url(#bookGradientAuth)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="60" y1="28" x2="60" y2="92" />
          <path d="M 60 28 Q 42 12 26 28 L 26 72 Q 42 80 60 75" />
          <path d="M 26 28 Q 10 28 10 42 L 10 78 C 10 90 35 92 60 92" />
          <path d="M 60 28 Q 78 12 94 28 L 94 72 Q 78 80 60 75" />
          <path d="M 94 28 Q 110 28 110 42 L 110 78 C 110 90 85 92 60 92" />
        </g>
      </svg>
    </div>
  );
}

export function AuthPage() {
  const navigate = useNavigate();
  const setUser = useStore((s) => s.setUser);

  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: authError } =
        mode === 'signup'
          ? await supabase.auth.signUp({ email, password })
          : await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      const user = data?.user ?? data?.session?.user;
      if (!user) {
        setError('something went wrong. try again.');
        setLoading(false);
        return;
      }

      setUser(
        user.id,
        user.user_metadata?.display_name ?? user.email ?? 'User'
      );
      navigate('/auth/resolver', { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'something went wrong. try again.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuraShell>
      <div className="flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full rounded-[28px] border border-abyss-700/80 bg-abyss-900/85 px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          {/* Brand */}
          <Logo className="mx-auto mb-4 w-16 h-16" />
          <h1 className="mb-2 text-center font-sans text-[2.4rem] font-semibold tracking-[0.04em] text-film-900">
            journie
          </h1>
          <p className="font-sans text-sm text-film-700 tracking-[0.15em] uppercase text-center mb-10">
            your day, your journal, zero writing.
          </p>

          {/* Divider */}
          <div className="w-12 h-px bg-abyss-600 mx-auto mb-10" />

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email"
              required
              autoComplete="email"
              className="w-full bg-transparent border-b border-abyss-600 py-3 text-film-900 font-sans text-base placeholder:text-film-500 focus:outline-none focus:border-film-700 transition-colors duration-200"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              required
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={6}
              className="w-full bg-transparent border-b border-abyss-600 py-3 text-film-900 font-sans text-base placeholder:text-film-500 focus:outline-none focus:border-film-700 transition-colors duration-200"
            />

            <ActionButton
              type="submit"
              pending={loading}
              pendingLabel={mode === 'signup' ? 'creating account...' : 'signing in...'}
              className="w-full"
            >
              {mode === 'signup' ? 'sign up' : 'log in'}
            </ActionButton>
          </form>

          {/* Error */}
          {error && (
            <p className="font-sans text-sm text-aura-rough mt-3 text-center">
              {error}
            </p>
          )}

          {/* Toggle */}
          <div className="mt-8 text-center">
            <TextButton
              type="button"
              onClick={() => {
                setMode(mode === 'signup' ? 'login' : 'signup');
                setError(null);
              }}
            >
              {mode === 'signup'
                ? 'already have an account? log in'
                : 'new here? sign up'}
            </TextButton>
          </div>
        </div>
      </div>
    </AuraShell>
  );
}
