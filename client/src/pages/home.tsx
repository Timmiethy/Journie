import { useState, useEffect, useCallback, useRef, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { getTodayMomentsForDate, useStore } from '../lib/store';
import { formatTime, todayISO } from '../lib/utils';
import { CameraCapture } from '../components/camera-capture';
import { HorizontalScrollStrip } from '../components/ui/horizontal-scroll-strip';
import { AuraShell } from '../components/layout/AuraShell';
import { HomeActivitySheet, type HomeSheetState } from '../components/home-activity-sheet';
import { MomentForm } from '../components/moment-form';
import { modalSpring, tapMotionProps, withReducedMotion } from '../lib/motion';
import { preloadTimelinePage } from '../lib/route-preloaders';
import { usePrefersReducedMotion } from '../lib/use-prefers-reduced-motion';
import { useAccessibleOverlay } from '../lib/use-accessible-overlay';
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
  const today = todayISO();
  const todayMoments = useStore((state) => getTodayMomentsForDate(state, today));
  const isOnline = useStore((state) => state.isOnline);
  const shouldReduceMotion = usePrefersReducedMotion();
  const previousQueueCountRef = useRef(0);
  const momentFormDialogRef = useRef<HTMLDivElement>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [captureQueue, setCaptureQueue] = useState<File[]>([]);
  const [sheetState, setSheetState] = useState<HomeSheetState>('collapsed');
  const [sheetMotionProgress, setSheetMotionProgress] = useState(0);
  const [selectedMoment, setSelectedMoment] = useState<MomentWithPhotos | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const momentDetailDialogRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === 'undefined' ? 844 : window.innerHeight,
  );

  useEffect(() => {
    let cancelled = false;

    const loadTodayMoments = async () => {
      let lastError: unknown = null;

      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          const moments = await api.moments.list(today);
          if (!cancelled) {
            useStore.getState().setTodayMoments(today, moments);
          }
          return;
        } catch (error: unknown) {
          lastError = error;

          if (attempt < 3) {
            await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)));
          }
        }
      }

      if (!cancelled) {
        toast.error(lastError instanceof Error ? lastError.message : "failed to load today's moments");
      }
    };

    void loadTodayMoments();

    return () => {
      cancelled = true;
    };
  }, [today]);

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
      useStore.getState().removeMoment(today, momentId);
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
  const clampedSheetMotionProgress = clamp(sheetMotionProgress, 0, 1);
  const peekOffset = -Math.min(viewportHeight * 0.16, 132);
  const fullOffset = -Math.min(viewportHeight * 0.54, 432);
  const heroOffset = clampedSheetMotionProgress <= 0.5
    ? interpolate(0, peekOffset, clampedSheetMotionProgress / 0.5)
    : interpolate(peekOffset, fullOffset, (clampedSheetMotionProgress - 0.5) / 0.5);
  const heroScale = clampedSheetMotionProgress <= 0.5
    ? interpolate(1, 0.97, clampedSheetMotionProgress / 0.5)
    : interpolate(0.97, 0.86, (clampedSheetMotionProgress - 0.5) / 0.5);
  const heroOpacity = clampedSheetMotionProgress <= 0.5
    ? 1
    : interpolate(1, 0, (clampedSheetMotionProgress - 0.5) / 0.5);

  useEffect(() => {
    const queueCount = captureQueue.length;
    const previousQueueCount = previousQueueCountRef.current;

    if (!hasOverlayOpen && queueCount > previousQueueCount && sheetState === 'collapsed') {
      setSheetState('peek');
    }

    previousQueueCountRef.current = queueCount;
  }, [captureQueue.length, hasOverlayOpen, sheetState]);

  useEffect(() => {
    if (!hasOverlayOpen && captureQueue.length === 0 && todayMoments.length > 0) {
      void preloadTimelinePage();
    }
  }, [captureQueue.length, hasOverlayOpen, todayMoments.length]);

  useAccessibleOverlay(isFormOpen && pendingFiles.length > 0, {
    containerRef: momentFormDialogRef,
    onClose: dismissForm,
  });

  useAccessibleOverlay(Boolean(selectedMoment), {
    containerRef: momentDetailDialogRef,
    onClose: () => setSelectedMoment(null),
  });

  return (
    <AuraShell>
      <div className="relative min-h-[100svh] overflow-hidden">
        <LayoutGroup id="capture-flow">
          <motion.section
            data-testid="home-hero-stage"
            className="relative flex min-h-[100svh] flex-col justify-center"
            animate={{ y: heroOffset, scale: heroScale, opacity: heroOpacity }}
            transition={withReducedMotion(Boolean(shouldReduceMotion), {
              type: 'spring',
              stiffness: shouldReduceMotion ? 260 : 210,
              damping: shouldReduceMotion ? 34 : 30,
              mass: shouldReduceMotion ? 0.95 : 0.88,
              bounce: shouldReduceMotion ? 0 : 0.03,
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
            onMotionProgress={setSheetMotionProgress}
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
                    ref={momentFormDialogRef}
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 18 }}
                    transition={modalSpring}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Moment form"
                    tabIndex={-1}
                    className="pointer-events-auto flex min-h-[100svh] w-full max-w-[480px] flex-col"
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
          dialogRef={momentDetailDialogRef}
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function interpolate(from: number, to: number, progress: number) {
  return from + (to - from) * clamp(progress, 0, 1);
}

function MomentDetailModal({
  dialogRef,
  moment,
  deleting,
  isOnline,
  onClose,
  onDelete,
}: {
  dialogRef: RefObject<HTMLDivElement>;
  moment: MomentWithPhotos;
  deleting: boolean;
  isOnline: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const note = moment.text_context || moment.voice_transcript;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Moment details from ${formatTime(moment.captured_at)}`}
        tabIndex={-1}
        className="w-full max-w-[480px] mx-auto rounded-t-[30px] border border-white/8 bg-abyss-900/96"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div>
            <p className="font-sans text-xs uppercase tracking-widest text-film-500">moment</p>
            <p className="font-sans text-sm text-film-700 mt-1">{formatTime(moment.captured_at)}</p>
          </div>
          <motion.button type="button" aria-label="Close moment details" onClick={onClose} {...tapMotionProps}>
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
