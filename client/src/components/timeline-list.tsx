import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatTime } from '../lib/utils';
import { spring, tapMotionProps } from '../lib/motion';
import type { MomentWithPhotos } from '../types';

const STACK_WINDOW = 5;
const CARD_HEIGHT = 176;
const SLOT_HEIGHT = 112;
const STACK_OFFSET = 18;

const MOOD_EMOJI = {
  great: '🤩',
  good: '😊',
  neutral: '😐',
  low: '😔',
  rough: '😣',
} as const;

interface TimelineListProps {
  items: MomentWithPhotos[];
  deletingId?: string | null;
  onChange: (items: MomentWithPhotos[]) => void;
  onDelete: (id: string) => void;
}

interface DragVisualState {
  id: string;
  targetIndex: number;
  offsetY: number;
  velocityX: number;
  velocityY: number;
}

interface DragState {
  id: string;
  startX: number;
  startY: number;
  startIndex: number;
  lastDeltaX: number;
  lastDeltaY: number;
  lastTimestamp: number;
  baseItems: MomentWithPhotos[];
}

export function TimelineList({
  items,
  deletingId = null,
  onChange,
  onDelete,
}: TimelineListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const activeListenersRef = useRef<{
    move: ((e: PointerEvent) => void) | null;
    up: (() => void) | null;
  }>({ move: null, up: null });
  const [scrollTop, setScrollTop] = useState(0);
  const [dragVisual, setDragVisual] = useState<DragVisualState | null>(null);

  useEffect(() => {
    return () => {
      if (activeListenersRef.current.move) {
        window.removeEventListener('pointermove', activeListenersRef.current.move);
      }
      if (activeListenersRef.current.up) {
        window.removeEventListener('pointerup', activeListenersRef.current.up);
      }
    };
  }, []);

  const visibleStart = useMemo(() => {
    if (items.length <= STACK_WINDOW) {
      return 0;
    }

    const rawIndex = Math.floor(scrollTop / SLOT_HEIGHT);
    return clamp(rawIndex, 0, items.length - STACK_WINDOW);
  }, [items.length, scrollTop]);

  const totalHeight = Math.max(
    CARD_HEIGHT,
    (items.length - 1) * SLOT_HEIGHT + CARD_HEIGHT,
  );

  const handlePointerMove = useCallback((event: PointerEvent) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    const deltaY = event.clientY - dragState.startY;
    const deltaX = event.clientX - dragState.startX;
    const nextIndex = clamp(
      dragState.startIndex + Math.round(deltaY / SLOT_HEIGHT),
      0,
      dragState.baseItems.length - 1,
    );
    const now = performance.now();
    const elapsed = Math.max(now - dragState.lastTimestamp, 16);
    const velocityX = (deltaX - dragState.lastDeltaX) / elapsed;
    const velocityY = (deltaY - dragState.lastDeltaY) / elapsed;
    const nextItems = arrayMove(dragState.baseItems, dragState.startIndex, nextIndex);
    const slotOffset = (nextIndex - dragState.startIndex) * SLOT_HEIGHT;

    dragState.lastDeltaX = deltaX;
    dragState.lastDeltaY = deltaY;
    dragState.lastTimestamp = now;

    onChange(nextItems);
    setDragVisual({
      id: dragState.id,
      targetIndex: nextIndex,
      offsetY: deltaY - slotOffset,
      velocityX,
      velocityY,
    });
  }, [onChange]);

  const handlePointerUp = useCallback(() => {
    dragStateRef.current = null;
    setDragVisual(null);
    if (activeListenersRef.current.move) {
      window.removeEventListener('pointermove', activeListenersRef.current.move);
    }
    if (activeListenersRef.current.up) {
      window.removeEventListener('pointerup', activeListenersRef.current.up);
    }
    activeListenersRef.current = { move: null, up: null };
  }, []);

  const beginDrag = useCallback((event: React.PointerEvent, id: string) => {
    event.preventDefault();

    const startIndex = items.findIndex((item) => item.id === id);
    if (startIndex === -1) {
      return;
    }

    dragStateRef.current = {
      id,
      startX: event.clientX,
      startY: event.clientY,
      startIndex,
      lastDeltaX: 0,
      lastDeltaY: 0,
      lastTimestamp: performance.now(),
      baseItems: items,
    };

    setDragVisual({
      id,
      targetIndex: startIndex,
      offsetY: 0,
      velocityX: 0,
      velocityY: 0,
    });

    activeListenersRef.current = { move: handlePointerMove, up: handlePointerUp };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [handlePointerMove, handlePointerUp, items]);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto px-6 pb-36"
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div
        className="relative"
        style={{ height: totalHeight, perspective: '1200px' }}
      >
        {items.map((item, index) => {
          const depth = index - visibleStart;
          const isVisible = depth >= 0 && depth < STACK_WINDOW;
          const isDragging = dragVisual?.id === item.id;
          const relativeOffset = isVisible ? depth * STACK_OFFSET : 0;
          const itemOffsetY = isDragging ? dragVisual.offsetY : 0;
          const velocityX = isDragging ? dragVisual.velocityX : 0;
          const velocityY = isDragging ? dragVisual.velocityY : 0;
          const rotateX = isDragging ? clamp(-velocityY * 140, -8, 8) : depth * 0.8;
          const rotateY = isDragging ? clamp(velocityX * 140, -8, 8) : 0;

          return (
            <motion.div
              key={item.id}
              className="absolute left-0 right-0 will-change-transform"
              data-timeline-card="true"
              data-timeline-index={index}
              data-hidden={!isVisible}
              data-window-hidden={!isVisible}
              animate={{
                y: index * SLOT_HEIGHT + relativeOffset + itemOffsetY,
                scale: isVisible ? 1 - depth * 0.03 : 1,
                opacity: isVisible ? 1 - depth * 0.12 : 0,
                rotateX: isVisible || isDragging ? rotateX : 0,
                rotateY: isVisible || isDragging ? rotateY : 0,
              }}
              transition={isDragging ? { duration: 0 } : spring}
              style={{
                zIndex: isDragging ? 50 : isVisible ? STACK_WINDOW - depth : 0,
                pointerEvents: isVisible || isDragging ? 'auto' : 'none',
                transformStyle: 'preserve-3d',
              }}
            >
              <TimelineCard
                item={item}
                deleting={deletingId === item.id}
                onDelete={() => onDelete(item.id)}
                onPointerDown={(event) => beginDrag(event, item.id)}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineCard({
  item,
  deleting,
  onDelete,
  onPointerDown,
}: {
  item: MomentWithPhotos;
  deleting: boolean;
  onDelete: () => void;
  onPointerDown: (event: React.PointerEvent) => void;
}) {
  const thumb = item.photos?.[0]?.photo_url;
  const context = item.text_context || item.voice_transcript;

  return (
    <div className="rounded-[24px] border border-abyss-700/80 bg-abyss-900/96 px-4 py-4 shadow-[0_24px_48px_rgba(0,0,0,0.22)]">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 min-w-[18px] text-center text-base">
          {item.mood ? MOOD_EMOJI[item.mood] : '·'}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-sans text-xs text-film-500 mb-1">
            {formatTime(item.captured_at)}
          </p>
          {thumb && (
            <img
              src={thumb}
              alt=""
              className={`mb-3 h-16 w-16 rounded-2xl object-cover ${
                item.mood ? 'grayscale-0' : 'grayscale-[50%]'
              }`}
            />
          )}
          {context && (
            <p className="font-sans text-sm leading-6 text-film-700 line-clamp-2">{context}</p>
          )}
        </div>

        <div className="flex flex-col items-center gap-3 pt-1">
          <motion.button
            type="button"
            aria-label="Reorder moment"
            className="cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={onPointerDown}
            {...tapMotionProps}
          >
            <GripVertical
              className="h-5 w-5 text-film-500"
              strokeWidth={1.5}
            />
          </motion.button>

          <motion.button
            type="button"
            aria-label="Delete moment"
            disabled={deleting}
            onClick={onDelete}
            className="text-film-500 hover:text-aura-rough disabled:opacity-50"
            {...tapMotionProps}
          >
            <Trash2 className="h-4 w-4" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function arrayMove<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
