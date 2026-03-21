import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { supabase } from './lib/supabase';
import { useStore } from './lib/store';

import { AuthPage }            from './pages/auth';
import { OnboardingPage }      from './pages/onboarding';
import { HomePage }            from './pages/home';
import { MomentDetailPage }    from './pages/moment-detail';
import { TimelinePage }        from './pages/timeline';
import { JournalViewPage }     from './pages/journal-view';
import { JournalHistoryPage }  from './pages/journal-history';

function ProtectedRoute() {
  const userId = useStore((s) => s.userId);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        useStore.getState().setUser(
          session.user.id,
          session.user.user_metadata?.display_name ?? session.user.email ?? 'User'
        );
      }
      setChecking(false);
    });
  }, []);

  if (checking) {
    return <div className="min-h-screen bg-abyss-900" />;
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
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#0A0A0A',
            border: '1px solid #262626',
            color: '#F5F5F5',
            fontFamily: 'Satoshi, system-ui, sans-serif',
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
      <Routes>
        <Route path="/auth" element={<AuthPage />} />

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
    </BrowserRouter>
  );
}
