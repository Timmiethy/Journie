import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getSessionWithRetry } from '../lib/auth-session';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { LoadingScreen } from '../components/loading-screen';

export function PostAuthResolverPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const resolveDestination = async () => {
      const session = await getSessionWithRetry();

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
    <LoadingScreen
      eyebrow="preparing your space"
      title="One second while we place you."
      description="We are checking whether to send you home or into onboarding so the handoff feels seamless."
    />
  );
}

