import { useEffect, useMemo } from 'react';
import { LayoutGroup, m } from 'framer-motion';
import {
  endOfMonth,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { useStore, type CalendarPopoverState } from '../lib/store';
import { spring, tapMotionProps } from '../lib/motion';
import type { JournalListEntry } from '../lib/api';

type CalendarViewProps = {
  currentMonth: Date;
  entries: JournalListEntry[];
};

export function CalendarView({ currentMonth, entries }: CalendarViewProps) {
  const calendarPopover = useStore((state) => state.calendarPopover);
  const setCalendarPopover = useStore((state) => state.setCalendarPopover);
  const clearCalendarPopover = useStore((state) => state.clearCalendarPopover);

  const entryMap = useMemo(
    () => new Map(entries.map((entry) => [entry.day_date, entry])),
    [entries],
  );

  useEffect(() => {
    if (!calendarPopover) {
      return;
    }

    const entry = entryMap.get(calendarPopover.date);
    const nextPreview = entry?.content?.split('\n')?.[0] ?? 'No journal for this day yet.';
    const nextPhotoUrl = entry?.first_photo_url ?? null;
    const hasJournal = Boolean(entry);

    if (
      calendarPopover.hasJournal === hasJournal &&
      calendarPopover.preview === nextPreview &&
      calendarPopover.photoUrl === nextPhotoUrl
    ) {
      return;
    }

    setCalendarPopover({
      ...calendarPopover,
      hasJournal,
      preview: nextPreview,
      photoUrl: nextPhotoUrl,
    });
  }, [calendarPopover, entryMap, setCalendarPopover]);

  const weeks = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

    const result: Date[][] = [];
    for (let index = 0; index < days.length; index += 7) {
      result.push(days.slice(index, index + 7));
    }
    return result;
  }, [currentMonth]);

  const openPopover = (
    day: Date,
    entry: JournalListEntry | undefined,
    target: HTMLButtonElement,
  ) => {
    const rect = target.getBoundingClientRect();
    const iso = format(day, 'yyyy-MM-dd');
    if (calendarPopover?.date === iso) {
      clearCalendarPopover();
      return;
    }

    const preview = entry?.content?.split('\n')?.[0] ?? 'No journal for this day yet.';

    const popover: CalendarPopoverState = {
      date: iso,
      label: format(day, 'EEEE, MMMM d'),
      hasJournal: Boolean(entry),
      preview,
      photoUrl: entry?.first_photo_url ?? null,
      anchorRect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
    };

    setCalendarPopover(popover);
  };

  return (
    <LayoutGroup id="calendar-history">
      <div className="grid grid-cols-7 gap-0">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div
            key={day}
            className="pb-4 text-center font-sans text-[10px] uppercase tracking-[0.2em] text-film-700"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="space-y-1">
        {weeks.map((week, weekIndex) => {
          return (
            <div key={`week-${weekIndex}`} className="relative grid grid-cols-7 gap-0">
              {week.map((day) => {
                const iso = format(day, 'yyyy-MM-dd');
                const entry = entryMap.get(iso);
                const inMonth = isSameMonth(day, currentMonth);
                const isSelected = calendarPopover?.date === iso;

                return (
                  <m.button
                    key={iso}
                    type="button"
                    onClick={(event) => openPopover(day, entry, event.currentTarget)}
                    aria-label={`Open ${iso}`}
                    aria-pressed={isSelected}
                    data-calendar-day={iso}
                    className="relative flex h-12 items-center justify-center"
                    {...tapMotionProps}
                  >
                    <span className="relative flex h-10 w-10 items-center justify-center">
                      {isSelected ? (
                        <m.span
                          layoutId="calendar-active-day-pill"
                          transition={spring}
                          data-calendar-selected-circle="true"
                          className="absolute inset-0 rounded-full bg-film-900"
                        />
                      ) : null}
                      <span
                        className={`relative z-10 font-sans text-lg ${
                          !inMonth
                            ? 'text-abyss-600'
                            : isSelected
                              ? 'text-abyss-900'
                              : 'text-film-900'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                      {entry ? (
                        <span
                          data-calendar-entry-dot="true"
                          className="absolute bottom-1 h-1 w-1 rounded-full bg-aura-neutral"
                        />
                      ) : null}
                    </span>
                  </m.button>
                );
              })}
            </div>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
