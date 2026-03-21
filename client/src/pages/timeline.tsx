import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import { formatDate, todayISO } from '../lib/utils';
import { AuraShell } from '../components/layout/AuraShell';
import { TimelineList } from '../components/timeline-list';
import { tapMotionProps } from '../lib/motion';
import { motion } from 'framer-motion';
import { ActionButton } from '../components/ui/action-button';
import { createJournalRouteState } from '../lib/journal-navigation';
import { preloadJournalViewPage } from '../lib/route-preloaders';
import type { MomentWithPhotos } from '../types';

export function TimelinePage() {
  const navigate = useNavigate();
  const storeMoments = useStore((state) => state.todayMoments);
  const isOnline = useStore((state) => state.isOnline);
  const [moments, setMoments] = useState<MomentWithPhotos[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const date = todayISO();

  useEffect(() => {
    if (storeMoments.length > 0) {
      setMoments([...storeMoments]);
      return;
    }

    api.moments
      .list(date)
      .then((result) => {
        useStore.getState().setTodayMoments(result);
        setMoments(result);
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "failed to load today's moments");
      });
  }, [date, storeMoments]);

  const handleDelete = async (id: string) => {
    if (!isOnline) return;

    setDeletingId(id);

    try {
      await api.moments.delete(id);
      const updated = moments.filter((moment) => moment.id !== id);
      setMoments(updated);
      useStore.getState().removeMoment(id);
      toast.success('moment deleted');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'failed to delete moment');
    } finally {
      setDeletingId(null);
    }
  };

  const handleGenerate = async () => {
    if (!isOnline || generating) return;

    setGenerating(true);

    const orderedIds = moments.map((moment) => moment.id);
    useStore.getState().setTodayMoments(moments);

    void api.moments.reorder(date, orderedIds).catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'failed to save timeline order');
    });

    const generationPromise = api.journal.generate(date, false, orderedIds);
    void preloadJournalViewPage();
    navigate(`/journal/${date}`, {
      state: createJournalRouteState('timeline', { optimisticGenerating: true }),
    });

    void generationPromise.catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'failed to generate journal');
    });
  };

  return (
    <AuraShell>
      <div className="min-h-screen flex flex-col pb-24 safe-bottom">
        <div className="flex items-center px-6 safe-top pb-6">
          <motion.button
            type="button"
            onClick={() => navigate('/home')}
            className="mr-3"
            {...tapMotionProps}
          >
            <ChevronLeft className="h-5 w-5 text-film-700 hover:text-film-900 transition-colors" />
          </motion.button>
          <span className="font-sans text-xs uppercase tracking-widest text-film-700 mx-auto">
            your day — {formatDate(date)}
          </span>
          <div className="w-5" />
        </div>

        <div className="px-6 pb-4">
          <div className="rounded-[24px] border border-abyss-700/75 bg-abyss-900/72 px-4 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.26)]">
            <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-film-500">
              sequence
            </p>
            <p className="mt-2 font-sans text-base leading-6 text-film-900">
              Drag moments until the order feels like the day you want to remember.
            </p>
          </div>
        </div>

        <div
          className={`relative flex-1 ${
            moments.length > 0
              ? 'before:absolute before:left-[27px] before:top-4 before:bottom-20 before:w-px before:bg-abyss-600/60'
              : ''
          }`}
        >
          {moments.length > 0 ? (
            <TimelineList
              items={moments}
              deletingId={deletingId}
              onChange={setMoments}
              onDelete={handleDelete}
            />
          ) : (
            <div className="px-6 pt-6">
              <div className="rounded-[26px] border border-white/8 bg-abyss-900/72 px-5 py-6 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
                <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-film-500">
                  no moments yet
                </p>
                <p className="mt-3 font-sans text-lg font-medium leading-tight text-film-900">
                  There is nothing to sequence until you capture something first.
                </p>
                <p className="mt-3 font-sans text-sm leading-6 text-film-700">
                  Head back home, capture a few moments, then return once the day has real material to shape.
                </p>
                <div className="mt-5">
                  <ActionButton onClick={() => navigate('/home')}>
                    back home
                  </ActionButton>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {moments.length > 0 && (
        <ActionButton
          onClick={handleGenerate}
          onMouseEnter={() => void preloadJournalViewPage()}
          onFocus={() => void preloadJournalViewPage()}
          disabled={!isOnline}
          pending={generating}
          pendingLabel="opening journal..."
          className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-[480px] rounded-t-[24px] border-film-900 py-4 shadow-[0_-12px_40px_rgba(0,0,0,0.28)]"
        >
          done — generate my journal
        </ActionButton>
      )}
    </AuraShell>
  );
}
