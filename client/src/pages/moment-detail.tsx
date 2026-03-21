import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LoadingScreen } from '../components/loading-screen';
import { MomentForm } from '../components/moment-form';

export function MomentDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const stateFiles = (location.state as { files?: File[] } | null)?.files ?? [];

  useEffect(() => {
    if (stateFiles.length === 0) {
      navigate('/home', { replace: true });
    }
  }, [navigate, stateFiles.length]);

  if (stateFiles.length === 0) {
    return (
      <LoadingScreen
        eyebrow="restoring your capture"
        title="Taking you back home."
        description="This capture route only works with live selected files, so we are closing the stale view and returning you to home."
      />
    );
  }

  return (
    <div className="min-h-screen bg-abyss-900/95 backdrop-blur-2xl flex flex-col">
      <MomentForm
        initialFiles={stateFiles}
        onClose={() => navigate('/home', { replace: true })}
        onSaved={() => navigate('/home', { replace: true })}
      />
    </div>
  );
}
