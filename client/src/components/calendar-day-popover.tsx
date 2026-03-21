import { useEffect, useMemo, useRef } from 'react';
import { m } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { spring, tapMotionProps, withReducedMotion } from '../lib/motion';
import { useStore } from '../lib/store';
import { usePrefersReducedMotion } from '../lib/use-prefers-reduced-motion';
import { ActionButton } from './ui/action-button';

export function CalendarDayPopover() {
  const navigate = useNavigate();
  const shouldReduceMotion = usePrefersReducedMotion();
  const calendarPopover = useStore((state) => state.calendarPopover);
  const clearCalendarPopover = useStore((state) => state.clearCalendarPopover);
  const popoverRef = useRef<HTMLDivElement>(null);

  const position = useMemo(() => {
    if (!calendarPopover) {
      return null;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(320, viewportWidth - 24);
    const left = Math.min(
      Math.max(calendarPopover.anchorRect.left + calendarPopover.anchorRect.width / 2 - width / 2, 12),
      viewportWidth - width - 12,
    );

    const placeBelow = calendarPopover.anchorRect.top < viewportHeight / 2;
    const top = placeBelow
      ? calendarPopover.anchorRect.top + calendarPopover.anchorRect.height + 12
      : calendarPopover.anchorRect.top - 12;

    return {
      width,
      left,
      top,
      translateUp: !placeBelow,
    };
  }, [calendarPopover]);

  useEffect(() => {
    if (!calendarPopover) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      if (popoverRef.current?.contains(target)) {
        return;
      }

      if (target.closest('[data-calendar-day]')) {
        return;
      }

      clearCalendarPopover();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearCalendarPopover();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [calendarPopover, clearCalendarPopover]);

  if (!calendarPopover || !position) {
    return null;
  }

  return (
    <m.div
      ref={popoverRef}
      key={calendarPopover.date}
      data-calendar-popover="true"
      className="fixed z-[100] overflow-hidden rounded-[24px] border border-film-900/12 bg-[#101010] shadow-[0_28px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/5 backdrop-blur-md"
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
      transition={withReducedMotion(Boolean(shouldReduceMotion), spring)}
      style={{
        width: position.width,
        left: position.left,
        top: position.top,
        transform: position.translateUp ? 'translateY(-100%)' : undefined,
      }}
    >
      <div className="flex items-center justify-between border-b border-abyss-700/80 px-4 py-3">
        <div>
          <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-film-500">day</p>
          <p className="font-sans text-sm text-film-900 mt-1">{calendarPopover.label}</p>
        </div>
        <m.button type="button" onClick={clearCalendarPopover} {...tapMotionProps}>
          <X className="h-4 w-4 text-film-700" />
        </m.button>
      </div>

      {calendarPopover.photoUrl ? (
        <img
          src={calendarPopover.photoUrl}
          alt=""
          className="h-28 w-full object-cover"
        />
      ) : (
        <div className="h-20 w-full bg-abyss-800/90" />
      )}

      <div className="px-4 py-4 space-y-4">
        <p className="font-serif text-sm leading-relaxed text-film-900">
          {calendarPopover.preview}
        </p>

        {calendarPopover.hasJournal ? (
          <ActionButton
            onClick={() => {
              navigate(`/journal/${calendarPopover.date}`);
              window.requestAnimationFrame(() => {
                clearCalendarPopover();
              });
            }}
            className="w-full"
          >
            open journal
          </ActionButton>
        ) : (
          <div className="font-sans text-xs uppercase tracking-widest text-film-700">
            no journal yet
          </div>
        )}
      </div>
    </m.div>
  );
}
