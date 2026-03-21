import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { BookOpen, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import { formatTime, todayISO } from '../lib/utils';
import { CameraCapture } from '../components/camera-capture';
import { AuraShell } from '../components/layout/AuraShell';
import { MomentForm } from '../components/moment-form';
import { modalSpring, tapMotionProps } from '../lib/motion';
import type { MomentWithPhotos, Mood } from '../types';

const MOOD_EMOJI: Record<Mood, string> = {
  great: '🤩',
  good: '😊',
  neutral: '😐',
  low: '😔',
  rough: '😣',
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour <= 11) return 'morning';
  if (hour >= 12 && hour <= 17) return 'afternoon';
  return 'evening';
}

export function HomePage() {
  const navigate = useNavigate();
  const displayName = useStore((state) => state.displayName);
  const todayMoments = useStore((state) => state.todayMoments);
  const isOnline = useStore((state) => state.isOnline);
  const [showFlash, setShowFlash] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [selectedMoment, setSelectedMoment] = useState<MomentWithPhotos | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    api.moments
      .list(todayISO())
      .then((moments) => {
        useStore.getState().setTodayMoments(moments);
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "failed to load today's moments");
      });
  }, []);

  useEffect(() => {
    if (!isFormOpen) return undefined;

    const handlePopState = () => {
      setIsFormOpen(false);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isFormOpen]);

  const clearMomentFormHistoryState = useCallback(() => {
    const historyState = (window.history.state as { modal?: string } | null) ?? {};
    if (!('modal' in historyState)) {
      return;
    }

    const { modal: _modal, ...nextState } = historyState;
    window.history.replaceState(nextState, '');
  }, []);

  const dismissForm = useCallback(() => {
    if (!isFormOpen) return;

    if ((window.history.state as { modal?: string } | null)?.modal === 'moment-form') {
      window.history.back();
      return;
    }

    setIsFormOpen(false);
  }, [isFormOpen]);

  const handleSaved = useCallback(() => {
    clearMomentFormHistoryState();
    setIsFormOpen(false);
  }, [clearMomentFormHistoryState]);

  const openForm = useCallback((files: File[]) => {
    setPendingFiles(files);
    setIsFormOpen(true);
    window.history.pushState({ ...(window.history.state ?? {}), modal: 'moment-form' }, '');
  }, []);

  const handleFiles = useCallback(
    (fileList: FileList | null, source: 'camera' | 'library') => {
      if (!fileList || fileList.length === 0) return;

      if (source === 'camera') {
        setShowFlash(true);
        window.setTimeout(() => setShowFlash(false), 220);
      }

      openForm(Array.from(fileList));
    },
    [openForm],
  );

  const handleDeleteMoment = async (momentId: string) => {
    if (!isOnline) return;

    setDeletingId(momentId);
    try {
      await api.moments.delete(momentId);
      useStore.getState().removeMoment(momentId);
      setSelectedMoment(null);
      toast.success('moment deleted');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'failed to delete moment');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AuraShell>
      {showFlash && (
        <div className="fixed inset-0 bg-white z-50 animate-flash pointer-events-none" />
      )}

      <div className="min-h-screen flex flex-col pb-28 safe-bottom">
        <div className="flex justify-between items-start px-6 safe-top">
          <span className="max-w-[58%] truncate font-sans text-sm text-film-700">
            Good {getGreeting()}, {displayName ?? 'there'}
          </span>
          <motion.button
            type="button"
            onClick={() => navigate('/journals')}
            className="inline-flex items-center gap-2 font-sans text-xs uppercase tracking-widest text-film-700 border border-abyss-600 px-3 py-1 hover:border-film-700 hover:text-film-900 transition-all duration-200"
            {...tapMotionProps}
          >
            <BookOpen className="h-3.5 w-3.5" />
            My Journal
          </motion.button>
        </div>

        <LayoutGroup id="capture-flow">
          <CameraCapture
            disabled={isFormOpen}
            onFilesSelected={handleFiles}
          />

          <AnimatePresence onExitComplete={() => setPendingFiles([])}>
            {isFormOpen && pendingFiles.length > 0 && (
              <>
                <motion.div
                  aria-hidden="true"
                  className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={dismissForm}
                />
                <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
                  <motion.div
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 18 }}
                    transition={modalSpring}
                    className="pointer-events-auto w-full max-w-[480px] min-h-screen bg-abyss-900/95 backdrop-blur-2xl flex flex-col"
                  >
                    <MomentForm
                      initialFiles={pendingFiles}
                      onClose={dismissForm}
                      onSaved={handleSaved}
                    />
                  </motion.div>
                </div>
              </>
            )}
          </AnimatePresence>
        </LayoutGroup>

        <div className="flex-1">
          <p className="font-sans text-xs uppercase tracking-widest text-film-500 px-6 mb-3">
            today{todayMoments.length > 0 ? ` · ${todayMoments.length}` : ''}
          </p>

          {todayMoments.length === 0 ? (
            <div className="mx-6 rounded-[24px] border border-abyss-700/70 bg-abyss-900/70 px-5 py-6 text-center shadow-[0_18px_48px_rgba(0,0,0,0.24)]">
              <p className="font-sans text-[11px] uppercase tracking-[0.22em] text-film-500">
                first moment
              </p>
              <p className="mt-3 font-serif text-xl text-film-900">
                Nothing captured yet. Start with one detail worth keeping.
              </p>
              <p className="mt-2 font-sans text-sm text-film-700">
                Tap the circle or import from your library. The review screen opens immediately.
              </p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto px-6 pb-4 snap-x snap-mandatory">
              {todayMoments.map((moment) => (
                <MomentCard
                  key={moment.id}
                  moment={moment}
                  onClick={() => setSelectedMoment(moment)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {todayMoments.length >= 1 && !isFormOpen && pendingFiles.length === 0 && (
        <motion.button
          type="button"
          onClick={() => navigate('/timeline')}
          disabled={!isOnline}
          className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto rounded-t-[24px] border border-film-900 bg-film-900 px-6 py-4 text-center font-sans text-sm font-bold uppercase tracking-[0.2em] text-abyss-900 shadow-[0_-12px_40px_rgba(0,0,0,0.28)] disabled:cursor-not-allowed disabled:border-abyss-700 disabled:bg-abyss-700 disabled:text-film-500"
          {...tapMotionProps}
        >
          start journaling
        </motion.button>
      )}

      {selectedMoment && (
        <MomentDetailModal
          moment={selectedMoment}
          deleting={deletingId === selectedMoment.id}
          isOnline={isOnline}
          onClose={() => setSelectedMoment(null)}
          onDelete={() => handleDeleteMoment(selectedMoment.id)}
        />
      )}
    </AuraShell>
  );
}

function MomentCard({
  moment,
  onClick,
}: {
  moment: MomentWithPhotos;
  onClick: () => void;
}) {
  const thumb = moment.photos?.[0]?.photo_url;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="min-w-[148px] max-w-[148px] snap-start text-left border border-abyss-700 bg-abyss-900/60"
      {...tapMotionProps}
    >
      {thumb ? (
        <img
          src={thumb}
          alt=""
          className="h-28 w-full object-cover"
        />
      ) : (
        <div className="h-28 w-full bg-abyss-700" />
      )}
      <div className="px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-sans text-xs text-film-500">{formatTime(moment.captured_at)}</p>
          {moment.mood && <span className="text-sm">{MOOD_EMOJI[moment.mood]}</span>}
        </div>
      </div>
    </motion.button>
  );
}

function MomentDetailModal({
  moment,
  deleting,
  isOnline,
  onClose,
  onDelete,
}: {
  moment: MomentWithPhotos;
  deleting: boolean;
  isOnline: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const note = moment.text_context || moment.voice_transcript;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end">
      <div className="w-full max-w-[480px] mx-auto bg-abyss-900 border-t border-abyss-700">
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div>
            <p className="font-sans text-xs uppercase tracking-widest text-film-500">moment</p>
            <p className="font-sans text-sm text-film-700 mt-1">{formatTime(moment.captured_at)}</p>
          </div>
          <motion.button type="button" onClick={onClose} {...tapMotionProps}>
            <X className="h-5 w-5 text-film-700 hover:text-film-900 transition-colors" />
          </motion.button>
        </div>

        <div className="flex gap-2 overflow-x-auto px-6 pb-4">
          {moment.photos.map((photo) => (
            <img
              key={photo.id}
              src={photo.photo_url}
              alt=""
              className="h-40 w-40 object-cover flex-shrink-0"
            />
          ))}
        </div>

        <div className="px-6 pb-6 space-y-4">
          {moment.mood && (
            <p className="font-sans text-sm text-film-700">
              mood: <span className="ml-1">{MOOD_EMOJI[moment.mood]}</span>
            </p>
          )}

          {note ? (
            <p className="font-serif text-lg leading-relaxed text-film-900">{note}</p>
          ) : (
            <p className="font-sans text-sm text-film-500">no additional context for this moment.</p>
          )}

          <motion.button
            type="button"
            onClick={onDelete}
            disabled={!isOnline || deleting}
            className="w-full inline-flex items-center justify-center gap-2 border border-aura-rough text-aura-rough font-sans text-xs uppercase tracking-widest py-4 disabled:opacity-50 disabled:cursor-not-allowed"
            {...tapMotionProps}
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'deleting...' : 'delete moment'}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
