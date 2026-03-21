import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { formatTime } from '../lib/utils';
import { spring, withReducedMotion } from '../lib/motion';
import { usePrefersReducedMotion } from '../lib/use-prefers-reduced-motion';
import { ActionButton, TextButton } from './ui/action-button';
import { HorizontalScrollStrip } from './ui/horizontal-scroll-strip';
import type { MomentWithPhotos } from '../types';

const COLLAPSED_HEIGHT = 28;
const OPEN_DISTANCE = 72;
const OPEN_VELOCITY = 650;

export type HomeSheetState = 'collapsed' | 'peek' | 'full';

interface HomeActivitySheetProps {
  state: HomeSheetState;
  onStateChange: (state: HomeSheetState) => void;
  queuedFiles: File[];
  todayMoments: MomentWithPhotos[];
  primaryActionLabel: string | null;
  isOnline: boolean;
  onReview: () => void;
  onStartJournal: () => void;
  onPrepareStartJournal: () => void;
  onOpenMoment: (moment: MomentWithPhotos) => void;
  onRemoveQueued: (index: number) => void;
  onClearQueue: () => void;
}

export function HomeActivitySheet({
  state,
  onStateChange,
  queuedFiles,
  todayMoments,
  primaryActionLabel,
  isOnline,
  onReview,
  onStartJournal,
  onPrepareStartJournal,
  onOpenMoment,
  onRemoveQueued,
  onClearQueue,
}: HomeActivitySheetProps) {
  const shouldReduceMotion = usePrefersReducedMotion();
  const queuePreviewUrls = useObjectUrls(queuedFiles);
  const hasQueue = queuePreviewUrls.length > 0;
  const [peekHeight, setPeekHeight] = useState(288);
  const [fullHeight, setFullHeight] = useState(640);
  const gestureRef = useRef<{ startY: number; lastY: number; startTime: number } | null>(null);
  const suppressToggleClickRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const updateMetrics = () => {
      const viewportHeight = window.innerHeight;
      const nextPeekHeight = Math.round(
        Math.min(Math.max(viewportHeight * 0.38, 252), viewportHeight * 0.4),
      );
      const nextFullHeight = Math.round(Math.min(Math.max(viewportHeight * 0.93, 620), viewportHeight - 12));
      setPeekHeight(nextPeekHeight);
      setFullHeight(nextFullHeight);
    };

    updateMetrics();
    window.addEventListener('resize', updateMetrics);

    return () => {
      window.removeEventListener('resize', updateMetrics);
    };
  }, []);

  const height = state === 'collapsed'
    ? COLLAPSED_HEIGHT
    : state === 'peek'
      ? peekHeight
      : fullHeight;
  const sheetSurfaceClassName = state === 'full'
    ? 'flex h-full flex-col overflow-hidden rounded-t-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(7,8,11,0.98)_0%,rgba(5,6,8,0.97)_22%,rgba(4,4,5,0.99)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_-24px_60px_rgba(0,0,0,0.5)] backdrop-blur-[40px]'
    : 'flex h-full flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_16%,rgba(5,5,5,0.24)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_80px_rgba(0,0,0,0.38)] backdrop-blur-2xl';

  const handleStateToggle = () => {
    if (suppressToggleClickRef.current) {
      suppressToggleClickRef.current = false;
      return;
    }

    if (state === 'collapsed') {
      onStateChange('peek');
      return;
    }

    if (state === 'peek') {
      onStateChange('full');
      return;
    }

    onStateChange('peek');
  };

  const handleGesture = (offsetY: number, velocityY: number) => {
    if (Math.abs(offsetY) > 6) {
      suppressToggleClickRef.current = true;
      window.setTimeout(() => {
        suppressToggleClickRef.current = false;
      }, 250);
    }

    const wantsOpen = offsetY <= -OPEN_DISTANCE || velocityY <= -OPEN_VELOCITY;
    const wantsClose = offsetY >= OPEN_DISTANCE || velocityY >= OPEN_VELOCITY;

    if (state === 'collapsed' && wantsOpen) {
      onStateChange('peek');
      return;
    }

    if (state === 'peek') {
      if (wantsOpen) {
        onStateChange('full');
        return;
      }

      if (wantsClose) {
        onStateChange('collapsed');
        return;
      }
    }

    if (state === 'full' && wantsClose) {
      onStateChange('peek');
      return;
    }

    onStateChange(state);
  };

  const beginGesture = (clientY: number) => {
    gestureRef.current = {
      startY: clientY,
      lastY: clientY,
      startTime: performance.now(),
    };
  };

  const updateGesture = (clientY: number) => {
    if (!gestureRef.current) {
      return;
    }

    gestureRef.current.lastY = clientY;
  };

  const finalizeGesture = () => {
    if (!gestureRef.current) {
      return;
    }

    const elapsedSeconds = Math.max((performance.now() - gestureRef.current.startTime) / 1000, 0.001);
    const offsetY = gestureRef.current.lastY - gestureRef.current.startY;
    const velocityY = offsetY / elapsedSeconds;
    gestureRef.current = null;
    handleGesture(offsetY, velocityY);
  };

  const handleMouseDown = (event: ReactMouseEvent<HTMLButtonElement>) => {
    beginGesture(event.clientY);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateGesture(moveEvent.clientY);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      updateGesture(upEvent.clientY);
      finalizeGesture();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLButtonElement>) => {
    const startTouch = event.touches[0];
    if (!startTouch) {
      return;
    }

    beginGesture(startTouch.clientY);

    const handleTouchMove = (moveEvent: TouchEvent) => {
      const moveTouch = moveEvent.touches[0];
      if (!moveTouch) {
        return;
      }

      updateGesture(moveTouch.clientY);
    };

    const handleTouchEnd = (endEvent: TouchEvent) => {
      const endTouch = endEvent.changedTouches[0];
      if (endTouch) {
        updateGesture(endTouch.clientY);
      }

      finalizeGesture();
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
  };

  return (
    <m.section
      data-testid="home-activity-sheet"
      data-sheet-state={state}
      className="fixed bottom-0 left-0 right-0 z-30 mx-auto w-full max-w-[480px] px-4 sm:px-6"
      animate={{ height }}
      transition={withReducedMotion(Boolean(shouldReduceMotion), {
        ...spring,
        bounce: shouldReduceMotion ? 0 : 0.08,
      })}
    >
      <div className={sheetSurfaceClassName}>
        <m.button
          type="button"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onClick={handleStateToggle}
          data-testid="home-activity-handle"
          data-sheet-state={state}
          aria-expanded={state !== 'collapsed'}
          aria-label={
            state === 'collapsed'
              ? 'Open activity drawer'
              : state === 'peek'
                ? 'Expand activity drawer'
                : 'Collapse activity drawer'
          }
          className="flex h-8 w-full items-center justify-center"
        >
          <span className="h-1 w-12 rounded-full bg-white/24" />
        </m.button>

        <div className="flex-1 overflow-hidden px-4 pb-4 pt-1 sm:px-5 sm:pb-5">
          <AnimatePresence mode="wait" initial={false}>
            {state === 'collapsed' ? (
              <m.div
                key="collapsed-sheet-state"
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                transition={withReducedMotion(Boolean(shouldReduceMotion), spring)}
                className="h-full"
              />
            ) : state === 'peek' ? (
              <m.div
                key="peek-sheet-state"
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                transition={withReducedMotion(Boolean(shouldReduceMotion), spring)}
                className="flex h-full flex-col justify-between"
              >
                <PeekSheetContent
                  todayMoments={todayMoments}
                  primaryActionLabel={primaryActionLabel}
                  isOnline={isOnline}
                  hasQueue={hasQueue}
                  onReview={onReview}
                  onStartJournal={onStartJournal}
                  onPrepareStartJournal={onPrepareStartJournal}
                  onOpenMoment={onOpenMoment}
                />
              </m.div>
            ) : (
              <m.div
                key="full-sheet-state"
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                transition={withReducedMotion(Boolean(shouldReduceMotion), spring)}
                className="flex h-full flex-col"
              >
                <FullSheetContent
                  queuePreviewUrls={queuePreviewUrls}
                  todayMoments={todayMoments}
                  primaryActionLabel={primaryActionLabel}
                  isOnline={isOnline}
                  hasQueue={hasQueue}
                  onReview={onReview}
                  onStartJournal={onStartJournal}
                  onPrepareStartJournal={onPrepareStartJournal}
                  onOpenMoment={onOpenMoment}
                  onRemoveQueued={onRemoveQueued}
                  onClearQueue={onClearQueue}
                />
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </m.section>
  );
}

function PeekSheetContent({
  todayMoments,
  primaryActionLabel,
  isOnline,
  hasQueue,
  onReview,
  onStartJournal,
  onPrepareStartJournal,
  onOpenMoment,
}: {
  todayMoments: MomentWithPhotos[];
  primaryActionLabel: string | null;
  isOnline: boolean;
  hasQueue: boolean;
  onReview: () => void;
  onStartJournal: () => void;
  onPrepareStartJournal: () => void;
  onOpenMoment: (moment: MomentWithPhotos) => void;
}) {
  return (
    <>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-film-500">
            today
          </p>
          <span className="font-sans text-xs text-film-500">
            {todayMoments.length}
          </span>
        </div>

        {todayMoments.length > 0 ? (
          <HorizontalScrollStrip
            ariaLabel="today moments"
            viewportClassName="pb-1"
            contentClassName="gap-3 pr-3"
          >
            {todayMoments.map((moment) => (
              <button
                key={moment.id}
                type="button"
                onClick={() => onOpenMoment(moment)}
                data-testid="today-moment-card"
                className="max-w-[124px] min-w-[124px] flex-shrink-0 overflow-hidden rounded-[18px] border border-white/8 bg-white/[0.03] text-left shadow-[0_14px_38px_rgba(0,0,0,0.22)]"
              >
                {moment.photos?.[0]?.photo_url ? (
                  <img
                    src={moment.photos[0].photo_url}
                    alt=""
                    className="h-20 w-full object-cover"
                  />
                ) : (
                  <div className="h-20 w-full bg-abyss-700" />
                )}
                <div className="px-3 py-2.5">
                  <p className="font-sans text-xs text-film-700">
                    {formatTime(moment.captured_at)}
                  </p>
                </div>
              </button>
            ))}
          </HorizontalScrollStrip>
        ) : (
          <div
            data-testid="home-activity-empty-peek"
            className="flex h-[5.5rem] items-center justify-center rounded-[20px] border border-white/6 bg-white/[0.02]"
          >
            <p className="font-sans text-sm text-film-500">Nothing here yet.</p>
          </div>
        )}
      </div>

      <div className="safe-bottom pt-5">
        {primaryActionLabel ? (
          <ActionButton
            type="button"
            variant="dock"
            disabled={!isOnline}
            onClick={hasQueue ? onReview : onStartJournal}
            onMouseEnter={() => {
              if (!hasQueue) {
                onPrepareStartJournal();
              }
            }}
            onFocus={() => {
              if (!hasQueue) {
                onPrepareStartJournal();
              }
            }}
            className="min-h-[54px] w-full text-[11px] font-semibold tracking-[0.2em]"
            data-testid={hasQueue ? 'camera-review-button' : 'home-start-journal-button'}
          >
            {primaryActionLabel}
          </ActionButton>
        ) : (
          <div className="h-[54px]" aria-hidden="true" />
        )}
      </div>
    </>
  );
}

function FullSheetContent({
  queuePreviewUrls,
  todayMoments,
  primaryActionLabel,
  isOnline,
  hasQueue,
  onReview,
  onStartJournal,
  onPrepareStartJournal,
  onOpenMoment,
  onRemoveQueued,
  onClearQueue,
}: {
  queuePreviewUrls: string[];
  todayMoments: MomentWithPhotos[];
  primaryActionLabel: string | null;
  isOnline: boolean;
  hasQueue: boolean;
  onReview: () => void;
  onStartJournal: () => void;
  onPrepareStartJournal: () => void;
  onOpenMoment: (moment: MomentWithPhotos) => void;
  onRemoveQueued: (index: number) => void;
  onClearQueue: () => void;
}) {
  const hasTodayMoments = todayMoments.length > 0;

  return (
    <>
      <div
        data-testid="home-activity-full-scroll"
        className="flex-1 overflow-y-auto scrollbar-hide"
      >
        <div className="space-y-6 pb-4">
          {queuePreviewUrls.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-film-500">
                  queued
                </p>
                <TextButton
                  type="button"
                  className="text-xs uppercase tracking-[0.16em] no-underline"
                  onClick={onClearQueue}
                >
                  clear
                </TextButton>
              </div>

              <HorizontalScrollStrip
                ariaLabel="queued captures"
                viewportClassName="pb-1"
                contentClassName="gap-3 pr-3"
              >
                {queuePreviewUrls.map((url, index) => (
                  <div key={`${url}-${index}`} className="relative flex-shrink-0">
                    <img
                      src={url}
                      alt=""
                      data-testid="camera-queue-thumb"
                      className="h-[4.75rem] w-[4.75rem] rounded-[18px] object-cover sm:h-20 sm:w-20"
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveQueued(index)}
                      className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-abyss-900/92 text-film-900"
                      aria-label={`Remove queued photo ${index + 1}`}
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={1.9} />
                    </button>
                  </div>
                ))}
              </HorizontalScrollStrip>
            </section>
          ) : null}

          {hasTodayMoments ? (
            <section className="space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-film-500">
                  today
                </p>
                <span className="font-sans text-xs text-film-500">
                  {todayMoments.length}
                </span>
              </div>

              <div
                data-testid="home-activity-full-grid"
                className="grid grid-cols-2 gap-3 sm:grid-cols-3"
              >
                {todayMoments.map((moment) => {
                  const note = moment.text_context || moment.voice_transcript;

                  return (
                    <button
                      key={moment.id}
                      type="button"
                      onClick={() => onOpenMoment(moment)}
                      data-testid="today-moment-card"
                      className="overflow-hidden rounded-[22px] border border-white/8 bg-white/[0.035] text-left shadow-[0_20px_48px_rgba(0,0,0,0.24)] transition-colors hover:border-white/14"
                    >
                      {moment.photos?.[0]?.photo_url ? (
                        <img
                          src={moment.photos[0].photo_url}
                          alt=""
                          className="aspect-[4/5] w-full object-cover"
                        />
                      ) : (
                        <div className="aspect-[4/5] w-full bg-abyss-700" />
                      )}
                      <div className="space-y-1.5 px-3 py-3">
                        <p className="font-sans text-[11px] uppercase tracking-[0.18em] text-film-500">
                          {formatTime(moment.captured_at)}
                        </p>
                        {note ? (
                          <p className="line-clamp-2 font-sans text-sm leading-6 text-film-800">
                            {note}
                          </p>
                        ) : (
                          <p className="font-sans text-sm text-film-600">Captured moment</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {!hasTodayMoments && queuePreviewUrls.length === 0 ? (
            <div
              data-testid="home-gallery-empty"
              className="flex min-h-[10rem] items-center justify-center rounded-[24px] border border-white/6 bg-white/[0.02]"
            >
              <p className="font-sans text-sm text-film-500">Nothing here yet.</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="safe-bottom pt-5">
        {primaryActionLabel ? (
          <ActionButton
            type="button"
            variant="dock"
            disabled={!isOnline}
            onClick={hasQueue ? onReview : onStartJournal}
            onMouseEnter={() => {
              if (!hasQueue) {
                onPrepareStartJournal();
              }
            }}
            onFocus={() => {
              if (!hasQueue) {
                onPrepareStartJournal();
              }
            }}
            className="min-h-[56px] w-full text-[11px] font-semibold tracking-[0.2em]"
            data-testid={hasQueue ? 'camera-review-button' : 'home-start-journal-button'}
          >
            {primaryActionLabel}
          </ActionButton>
        ) : (
          <div className="h-14" aria-hidden="true" />
        )}
      </div>
    </>
  );
}

function useObjectUrls(files: File[]) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const nextUrls = files.map((file) => URL.createObjectURL(file));
    setUrls(nextUrls);

    return () => {
      nextUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  return urls;
}
