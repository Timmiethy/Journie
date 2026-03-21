import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { AuraShell } from '../components/layout/AuraShell';

export function PostAuthResolverPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const resolveDestination = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        if (!cancelled) {
          navigate('/auth', { replace: true });
        }
        return;
      }

      useStore.getState().setUser(
        session.user.id,
        session.user.user_metadata?.display_name ?? session.user.email ?? 'User',
      );

      try {
        const persona = await api.persona.get();
        if (!cancelled) {
          navigate(persona ? '/home' : '/onboarding', { replace: true });
        }
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : 'something went wrong. try again.';
        toast.error(message);
        navigate('/auth', { replace: true });
      }
    };

    void resolveDestination();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <AuraShell>
      <div className="flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full rounded-[28px] border border-abyss-700/80 bg-abyss-900/85 px-6 py-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <p className="font-sans text-[11px] uppercase tracking-[0.24em] text-film-500">
            preparing your space
          </p>
          <h1 className="mt-4 font-serif text-3xl text-film-900">
            one second while we load your journie.
          </h1>
          <div className="mt-8 h-1.5 overflow-hidden rounded-full bg-abyss-800">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-film-900/75" />
          </div>
        </div>
      </div>
    </AuraShell>
  );
}
