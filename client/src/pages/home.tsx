import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import { formatTime, todayISO } from '../lib/utils';
import { CameraCapture } from '../components/camera-capture';
import { HorizontalScrollStrip } from '../components/ui/horizontal-scroll-strip';
import { AuraShell } from '../components/layout/AuraShell';
import { HomeActivitySheet, type HomeSheetState } from '../components/home-activity-sheet';
import { MomentForm } from '../components/moment-form';
import { modalSpring, spring, tapMotionProps, withReducedMotion } from '../lib/motion';
import { preloadTimelinePage } from '../lib/route-preloaders';
import { usePrefersReducedMotion } from '../lib/use-prefers-reduced-motion';
import type { MomentWithPhotos, Mood } from '../types';

const MOOD_EMOJI: Record<Mood, string> = {
  great: '🤩',
  good: '😊',
  neutral: '😐',
  low: '😔',
  rough: '😣',
};

export function HomePage() {
  const navigate = useNavigate();
  const todayMoments = useStore((state) => state.todayMoments);
  const isOnline = useStore((state) => state.isOnline);
  const shouldReduceMotion = usePrefersReducedMotion();
  const previousQueueCountRef = useRef(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [captureQueue, setCaptureQueue] = useState<File[]>([]);
  const [sheetState, setSheetState] = useState<HomeSheetState>('collapsed');
  const [selectedMoment, setSelectedMoment] = useState<MomentWithPhotos | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === 'undefined' ? 844 : window.innerHeight,
  );

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
    if (typeof window === 'undefined') {
      return undefined;
    }

    const updateViewportHeight = () => {
      setViewportHeight(window.innerHeight);
    };

    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);

    return () => {
      window.removeEventListener('resize', updateViewportHeight);
    };
  }, []);

  useEffect(() => {
    if (!isFormOpen) {
      return undefined;
    }

    const handlePopState = () => {
      setIsFormOpen(false);
      if (captureQueue.length > 0 || todayMoments.length > 0) {
        setSheetState('peek');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [captureQueue.length, isFormOpen, todayMoments.length]);

  const clearMomentFormHistoryState = useCallback(() => {
    const historyState = (window.history.state as { modal?: string } | null) ?? {};
    if (!('modal' in historyState)) {
      return;
    }

    const { modal: _modal, ...nextState } = historyState;
    window.history.replaceState(nextState, '');
  }, []);

  const dismissForm = useCallback(() => {
    if (!isFormOpen) {
      return;
    }
    clearMomentFormHistoryState();
    setIsFormOpen(false);
    window.requestAnimationFrame(() => {
      if (captureQueue.length > 0 || todayMoments.length > 0) {
        setSheetState('peek');
      }
    });
  }, [captureQueue.length, clearMomentFormHistoryState, isFormOpen, todayMoments.length]);

  const handleSaved = useCallback((_moment: MomentWithPhotos) => {
    clearMomentFormHistoryState();
    setCaptureQueue([]);
    setPendingFiles([]);
    setIsFormOpen(false);
    void preloadTimelinePage();
    setSheetState('peek');
  }, [clearMomentFormHistoryState]);

  const openForm = useCallback((files: File[]) => {
    if (files.length === 0) {
      return;
    }

    setPendingFiles(files);
    setIsFormOpen(true);

    if ((window.history.state as { modal?: string } | null)?.modal !== 'moment-form') {
      window.history.pushState({ ...(window.history.state ?? {}), modal: 'moment-form' }, '');
    }
  }, []);

  const handleCapture = useCallback((file: File) => {
    setCaptureQueue((current) => [...current, file]);
  }, []);

  const handleLibrarySelected = useCallback((files: File[]) => {
    if (files.length === 0) {
      return;
    }

    const merged = [...captureQueue, ...files];
    setCaptureQueue(merged);
    openForm(merged);
  }, [captureQueue, openForm]);

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

  const primaryActionLabel = captureQueue.length > 0
    ? `review (${captureQueue.length})`
    : todayMoments.length > 0
      ? 'start journal'
      : null;

  const hasOverlayOpen = isFormOpen || selectedMoment !== null;
  const heroOffset = sheetState === 'collapsed'
    ? 0
    : sheetState === 'peek'
      ? -Math.min(viewportHeight * 0.16, 132)
      : -Math.min(viewportHeight * 0.54, 432);
  const heroScale = sheetState === 'full' ? 0.86 : sheetState === 'peek' ? 0.97 : 1;
  const heroOpacity = sheetState === 'full' ? 0 : 1;

  useEffect(() => {
    const queueCount = captureQueue.length;
    const previousQueueCount = previousQueueCountRef.current;

    if (!hasOverlayOpen && queueCount > previousQueueCount && sheetState === 'collapsed') {
      setSheetState('peek');
    }

    previousQueueCountRef.current = queueCount;
  }, [captureQueue.length, hasOverlayOpen, sheetState]);

  useEffect(() => {
    if (hasOverlayOpen) {
      return;
    }

    if (captureQueue.length === 0 && todayMoments.length === 0 && sheetState !== 'collapsed') {
      setSheetState('collapsed');
    }
  }, [captureQueue.length, hasOverlayOpen, sheetState, todayMoments.length]);

  useEffect(() => {
    if (!hasOverlayOpen && captureQueue.length === 0 && todayMoments.length > 0) {
      void preloadTimelinePage();
    }
  }, [captureQueue.length, hasOverlayOpen, todayMoments.length]);

  return (
    <AuraShell>
      <div className="relative min-h-[100svh] overflow-hidden">
        <LayoutGroup id="capture-flow">
          <motion.section
            data-testid="home-hero-stage"
            className="relative flex min-h-[100svh] flex-col justify-center"
            animate={{ y: heroOffset, scale: heroScale, opacity: heroOpacity }}
            transition={withReducedMotion(Boolean(shouldReduceMotion), {
              ...spring,
              bounce: shouldReduceMotion ? 0 : 0.06,
            })}
            style={{ transformOrigin: 'center top' }}
          >
            <div className="flex flex-1 flex-col justify-center pb-[calc(env(safe-area-inset-bottom)+3.5rem)] pt-[max(1.25rem,env(safe-area-inset-top))]">
              <CameraCapture
                disabled={isFormOpen}
                queueCount={captureQueue.length}
                onCapture={handleCapture}
                onLibrarySelected={handleLibrarySelected}
                onOpenJournal={() => navigate('/journals')}
              />
            </div>
          </motion.section>

          <HomeActivitySheet
            state={sheetState}
            onStateChange={setSheetState}
            queuedFiles={captureQueue}
            todayMoments={todayMoments}
            primaryActionLabel={primaryActionLabel}
            isOnline={isOnline}
            onReview={() => openForm(captureQueue)}
            onStartJournal={() => {
              void preloadTimelinePage();
              navigate('/timeline');
            }}
            onPrepareStartJournal={() => {
              void preloadTimelinePage();
            }}
            onOpenMoment={(moment) => setSelectedMoment(moment)}
            onRemoveQueued={(index) => {
              setCaptureQueue((current) => current.filter((_, currentIndex) => currentIndex !== index));
            }}
            onClearQueue={() => {
              setCaptureQueue([]);
              setPendingFiles([]);
            }}
          />

          <AnimatePresence onExitComplete={() => setPendingFiles([])}>
            {isFormOpen && pendingFiles.length > 0 ? (
              <>
                <motion.div
                  aria-hidden="true"
                  className="fixed inset-0 z-40 bg-black/78 backdrop-blur-md"
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
                    className="pointer-events-auto flex min-h-[100svh] w-full max-w-[480px] flex-col bg-abyss-900/95 backdrop-blur-2xl"
                  >
                    <MomentForm
                      initialFiles={pendingFiles}
                      onClose={dismissForm}
                      onFilesChange={(files) => {
                        setPendingFiles(files);
                        setCaptureQueue(files);
                      }}
                      onSaved={handleSaved}
                    />
                  </motion.div>
                </div>
              </>
            ) : null}
          </AnimatePresence>
        </LayoutGroup>
      </div>

      {selectedMoment ? (
        <MomentDetailModal
          moment={selectedMoment}
          deleting={deletingId === selectedMoment.id}
          isOnline={isOnline}
          onClose={() => setSelectedMoment(null)}
          onDelete={() => handleDeleteMoment(selectedMoment.id)}
        />
      ) : null}
    </AuraShell>
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
      <div className="w-full max-w-[480px] mx-auto rounded-t-[30px] border border-white/8 bg-abyss-900/96">
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div>
            <p className="font-sans text-xs uppercase tracking-widest text-film-500">moment</p>
            <p className="font-sans text-sm text-film-700 mt-1">{formatTime(moment.captured_at)}</p>
          </div>
          <motion.button type="button" onClick={onClose} {...tapMotionProps}>
            <X className="h-5 w-5 text-film-700 hover:text-film-900 transition-colors" />
          </motion.button>
        </div>

        <HorizontalScrollStrip
          ariaLabel="moment photos"
          viewportClassName="px-6 pb-4"
          contentClassName="gap-2 pr-6"
        >
          {moment.photos.map((photo) => (
            <img
              key={photo.id}
              src={photo.photo_url}
              alt=""
              className="h-40 w-40 rounded-[20px] object-cover flex-shrink-0"
            />
          ))}
        </HorizontalScrollStrip>

        <div className="px-6 pb-6 space-y-4">
          {moment.mood ? (
            <p className="font-sans text-sm text-film-700">
              mood: <span className="ml-1">{MOOD_EMOJI[moment.mood]}</span>
            </p>
          ) : null}

          {note ? (
            <p className="font-sans text-base leading-7 text-film-900">{note}</p>
          ) : (
            <p className="font-sans text-sm text-film-500">no additional context for this moment.</p>
          )}

          <motion.button
            type="button"
            onClick={onDelete}
            disabled={!isOnline || deleting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-[18px] border border-aura-rough text-aura-rough font-sans text-xs uppercase tracking-widest py-4 disabled:opacity-50 disabled:cursor-not-allowed"
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
