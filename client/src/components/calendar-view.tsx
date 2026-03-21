import { useMemo } from 'react';
import { LayoutGroup, m } from 'framer-motion';
import {
  endOfMonth,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
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

type WeekSegment = {
  start: number;
  end: number;
};

export function CalendarView({ currentMonth, entries }: CalendarViewProps) {
  const calendarPopover = useStore((state) => state.calendarPopover);
  const setCalendarPopover = useStore((state) => state.setCalendarPopover);
  const clearCalendarPopover = useStore((state) => state.clearCalendarPopover);

  const entryMap = useMemo(
    () => new Map(entries.map((entry) => [entry.day_date, entry])),
    [entries],
  );

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
      <div className="grid grid-cols-7 gap-0 px-6">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div
            key={day}
            className="py-2 text-center font-sans text-[10px] uppercase tracking-wide text-film-500"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="px-6 space-y-1">
        {weeks.map((week, weekIndex) => {
          const segments = getWeekSegments(week, entryMap);

          return (
            <div key={`week-${weekIndex}`} className="relative grid grid-cols-7 gap-0">
              {segments.map((segment, segmentIndex) => (
                <m.div
                  key={`segment-${segmentIndex}`}
                  layout
                  layoutId={`calendar-streak-week-${weekIndex}-${segmentIndex}`}
                  transition={spring}
                  data-streak-segment="true"
                  className="absolute bottom-2 top-2 rounded-full bg-aura-rough/15"
                  style={{
                    left: `calc(${(segment.start / 7) * 100}% + 2px)`,
                    width: `calc(${((segment.end - segment.start + 1) / 7) * 100}% - 4px)`,
                  }}
                />
              ))}

              {week.map((day) => {
                const iso = format(day, 'yyyy-MM-dd');
                const entry = entryMap.get(iso);
                const inMonth = isSameMonth(day, currentMonth);
                const today = isToday(day);
                const isSelected = calendarPopover?.date === iso;

                return (
                  <m.button
                    key={iso}
                    type="button"
                    onClick={(event) => openPopover(day, entry, event.currentTarget)}
                    aria-label={`Open ${iso}`}
                    aria-pressed={isSelected}
                    data-calendar-day={iso}
                    className="relative flex h-11 flex-col items-center justify-center"
                    {...tapMotionProps}
                  >
                    {isSelected ? (
                      <m.div
                        layoutId="calendar-active-day-pill"
                        transition={spring}
                        className="absolute inset-1 rounded-full border border-film-900/35 bg-film-900/10"
                      />
                    ) : null}
                    <span
                      className={`relative z-10 font-sans text-sm ${
                        !inMonth
                          ? 'text-abyss-600'
                          : today
                            ? 'text-film-900 font-medium'
                            : 'text-film-700'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                    {entry ? (
                      <div
                        className="h-1 w-1 rounded-full absolute bottom-1 z-10"
                        style={{ backgroundColor: '#FF8A4C' }}
                      />
                    ) : null}
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

function getWeekSegments(
  week: Date[],
  entryMap: Map<string, JournalListEntry>,
): WeekSegment[] {
  const segments: WeekSegment[] = [];
  let start = -1;

  week.forEach((day, index) => {
    const hasJournal = entryMap.has(format(day, 'yyyy-MM-dd'));
    if (hasJournal && start === -1) {
      start = index;
    }

    const atEnd = index === week.length - 1;
    if ((!hasJournal || atEnd) && start !== -1) {
      const end = hasJournal && atEnd ? index : index - 1;
      segments.push({ start, end });
      start = -1;
    }
  });

  return segments;
}
