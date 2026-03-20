import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/auth';
import OnboardingPage from './pages/onboarding';
import HomePage from './pages/home';
import MomentDetailPage from './pages/moment-detail';
import TimelinePage from './pages/timeline';
import JournalViewPage from './pages/journal-view';
import JournalHistoryPage from './pages/journal-history';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/moments/new" element={<MomentDetailPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/journal/:date" element={<JournalViewPage />} />
        <Route path="/journals" element={<JournalHistoryPage />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
