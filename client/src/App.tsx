import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { getSessionWithRetry } from './lib/auth-session';
import { useStore } from './lib/store';
import { CalendarDayPopover } from './components/calendar-day-popover';
import { LoadingScreen } from './components/loading-screen';

const AuthPage = lazy(async () => ({ default: (await import('./pages/auth')).AuthPage }));
const PostAuthResolverPage = lazy(async () => ({
  default: (await import('./pages/post-auth-resolver')).PostAuthResolverPage,
}));
const OnboardingPage = lazy(async () => ({ default: (await import('./pages/onboarding')).OnboardingPage }));
const HomePage = lazy(async () => ({ default: (await import('./pages/home')).HomePage }));
const MomentDetailPage = lazy(async () => ({ default: (await import('./pages/moment-detail')).MomentDetailPage }));
const TimelinePage = lazy(async () => ({ default: (await import('./pages/timeline')).TimelinePage }));
const JournalViewPage = lazy(async () => ({ default: (await import('./pages/journal-view')).JournalViewPage }));
const JournalHistoryPage = lazy(async () => ({
  default: (await import('./pages/journal-history')).JournalHistoryPage,
}));

function ProtectedRoute() {
  const userId = useStore((s) => s.userId);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void getSessionWithRetry().then((session) => {
      if (cancelled) {
        return;
      }

      if (session?.user) {
        useStore.getState().setUser(
          session.user.id,
          session.user.user_metadata?.display_name ?? session.user.email ?? 'User'
        );
      }
      setChecking(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (checking) {
    return (
      <LoadingScreen
        eyebrow="restoring your session"
        title="Checking your Journie session."
        description="We are restoring the right route and mood before you land, not flashing a blank screen."
      />
    );
  }

  return userId ? <Outlet /> : <Navigate to="/auth" replace />;
}

export default function App() {
  const isOnline = useStore((s) => s.isOnline);

  useEffect(() => {
    const { setOnlineStatus } = useStore.getState();

    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);

    setOnlineStatus(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#0A0A0A',
            border: '1px solid #262626',
            color: '#F5F5F5',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '13px',
            borderRadius: '0',
          },
          unstyled: false,
        }}
      />
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-aura-rough text-film-900 font-sans text-xs uppercase tracking-[0.2em] text-center py-3">
          You're offline
        </div>
      )}
      <Suspense
        fallback={
          <LoadingScreen
            eyebrow="loading the next scene"
            title="Bringing in the next page."
            description="Large routes now stream in deliberately so the app stays polished instead of blocking on a blank shell."
          />
        }
      >
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/resolver" element={<PostAuthResolverPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/moments/new" element={<MomentDetailPage />} />
            <Route path="/timeline" element={<TimelinePage />} />
            <Route path="/journal/:date" element={<JournalViewPage />} />
            <Route path="/journals" element={<JournalHistoryPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </Suspense>
      <CalendarDayPopover />
    </BrowserRouter>
  );
}

