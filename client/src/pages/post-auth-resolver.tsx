import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getSessionWithRetry } from '../lib/auth-session';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { LoadingScreen } from '../components/loading-screen';
import { AuraShell } from '../components/layout/AuraShell';
import { ActionButton } from '../components/ui/action-button';

export function PostAuthResolverPage() {
  const navigate = useNavigate();
  const [retryCount, setRetryCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const retry = useCallback(() => {
    setRetryCount((count) => count + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const resolveDestination = async () => {
      setErrorMessage(null);

      try {
        const session = await getSessionWithRetry();

        if (cancelled) {
          return;
        }

        if (!session?.user) {
          navigate('/auth', { replace: true });
          return;
        }

        useStore.getState().setUser(
          session.user.id,
          session.user.user_metadata?.display_name ?? session.user.email ?? 'User',
        );

        const persona = await api.persona.get();
        if (!cancelled) {
          navigate(persona ? '/home' : '/onboarding', { replace: true });
        }
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : 'something went wrong. try again.';
        setErrorMessage(message);
        toast.error(message);
      }
    };

    void resolveDestination();

    return () => {
      cancelled = true;
    };
  }, [navigate, retryCount]);

  if (errorMessage) {
    return (
      <AuraShell>
        <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-5 sm:py-10">
          <div className="w-full rounded-[26px] border border-abyss-700/80 bg-abyss-900/80 px-5 py-7 shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:rounded-[30px] sm:px-6 sm:py-8">
            <p className="font-sans text-[10px] uppercase tracking-[0.26em] text-film-500">
              preparing your space
            </p>
            <h1 className="mt-4 font-sans text-[1.55rem] font-medium leading-tight text-film-900 sm:mt-5 sm:text-[2rem]">
              We could not finish loading your profile.
            </h1>
            <p className="mt-3 max-w-[28rem] font-sans text-sm leading-6 text-film-700">
              {errorMessage}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ActionButton onClick={retry}>
                try again
              </ActionButton>
              <ActionButton
                variant="ghost"
                onClick={() => navigate('/auth', { replace: true })}
              >
                back to auth
              </ActionButton>
            </div>
          </div>
        </div>
      </AuraShell>
    );
  }

  return (
    <LoadingScreen
      eyebrow="preparing your space"
      title="One second while we place you."
      description="We are checking whether to send you home or into onboarding so the handoff feels seamless."
    />
  );
}

