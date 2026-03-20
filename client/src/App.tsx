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
import { JournalGeneratePage } from './pages/journal-generate';
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
      <Routes>
        <Route path="/auth" element={<AuthPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/moments/new" element={<MomentDetailPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/journal/:date/generate" element={<JournalGeneratePage />} />
          <Route path="/journal/:date" element={<JournalViewPage />} />
          <Route path="/journals" element={<JournalHistoryPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
