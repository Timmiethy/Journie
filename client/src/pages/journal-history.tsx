import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  addMonths,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { api, type JournalListEntry } from '../lib/api';
import { AuraShell } from '../components/layout/AuraShell';
import { CalendarView } from '../components/calendar-view';
import { useStore } from '../lib/store';
import { tapMotionProps } from '../lib/motion';
import { ActionButton, TextButton } from '../components/ui/action-button';
import { createJournalRouteState } from '../lib/journal-navigation';
import { preloadJournalViewPage } from '../lib/route-preloaders';

function getMonthKey(date: Date) {
  return format(date, 'yyyy-MM');
}

export function JournalHistoryPage() {
  const navigate = useNavigate();
  const clearCalendarPopover = useStore((state) => state.clearCalendarPopover);
  const todayMonth = startOfMonth(new Date());
  const [entriesByMonth, setEntriesByMonth] = useState<Record<string, JournalListEntry[]>>({});
  const [loadingKeys, setLoadingKeys] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState(todayMonth);
  const [isMonthTransitioning, setIsMonthTransitioning] = useState(false);
  const entriesByMonthRef = useRef<Record<string, JournalListEntry[]>>({});
  const inFlightMonthsRef = useRef<Record<string, Promise<JournalListEntry[]>>>({});

  const loadMonth = useCallback(async (month: Date) => {
    const monthKey = getMonthKey(month);
    const cachedEntries = entriesByMonthRef.current[monthKey];
    if (cachedEntries) {
      return cachedEntries;
    }

    const inFlightRequest = inFlightMonthsRef.current[monthKey];
    if (inFlightRequest) {
      return inFlightRequest;
    }

    setLoadingKeys((current) => (
      current.includes(monthKey) ? current : [...current, monthKey]
    ));

    const requestPromise = api.journal.list({
        status: 'confirmed',
        from: format(startOfMonth(month), 'yyyy-MM-dd'),
        to: format(endOfMonth(month), 'yyyy-MM-dd'),
        limit: 200,
      })
      .then((result) => {
        entriesByMonthRef.current[monthKey] = result;
        setEntriesByMonth((current) => ({
          ...current,
          [monthKey]: result,
        }));
        return result;
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : 'failed to load journals');
        return [];
      })
      .finally(() => {
        delete inFlightMonthsRef.current[monthKey];
        setLoadingKeys((current) => current.filter((key) => key !== monthKey));
      });

    inFlightMonthsRef.current[monthKey] = requestPromise;
    return requestPromise;
  }, []);

  useEffect(() => {
    const primeMonths = [todayMonth, subMonths(todayMonth, 1), subMonths(todayMonth, 2)];
    primeMonths.forEach((month) => {
      void loadMonth(month);
    });

    return () => {
      clearCalendarPopover();
    };
  }, [clearCalendarPopover, loadMonth, todayMonth]);

  useEffect(() => {
    clearCalendarPopover();
    void loadMonth(currentMonth);
  }, [clearCalendarPopover, currentMonth, loadMonth]);

  const currentEntries = useMemo(() => {
    return entriesByMonth[getMonthKey(currentMonth)] ?? [];
  }, [currentMonth, entriesByMonth]);

  const recentEntries = useMemo(() => {
    return Object.values(entriesByMonth)
      .flat()
      .sort((left, right) => right.day_date.localeCompare(left.day_date))
      .slice(0, 8);
  }, [entriesByMonth]);

  const currentMonthKey = getMonthKey(currentMonth);
  const loadingCurrentMonth = loadingKeys.includes(currentMonthKey);
  const canGoForward = currentMonth < todayMonth;
  const hasAnyEntries = recentEntries.length > 0;
  const changeMonth = useCallback(async (direction: -1 | 1) => {
    const targetMonth = direction === -1
      ? subMonths(currentMonth, 1)
      : addMonths(currentMonth, 1);

    if (direction === 1 && targetMonth > todayMonth) {
      return;
    }

    clearCalendarPopover();
    setIsMonthTransitioning(true);

    try {
      await loadMonth(targetMonth);
      setCurrentMonth(targetMonth);
    } finally {
      setIsMonthTransitioning(false);
    }
  }, [clearCalendarPopover, currentMonth, loadMonth, todayMonth]);

  return (
    <AuraShell>
      <div className="min-h-screen px-6 safe-top safe-bottom">
        <div className="flex items-center justify-between pb-4 sm:pb-5">
          <TextButton
            type="button"
            className="inline-flex items-center gap-2 no-underline"
            onClick={() => navigate('/home')}
          >
            <ChevronLeft className="h-4 w-4" />
            back home
          </TextButton>
          <span className="font-sans text-xs uppercase tracking-[0.22em] text-film-700">
            archive
          </span>
          <div className="w-[92px]" />
        </div>

        <section>
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-sans text-4xl font-medium tracking-tight text-film-900">
              {format(currentMonth, 'MMMM yyyy')}
            </h1>
            <div className="flex items-center gap-2 pt-1">
              <motion.button
                type="button"
                aria-label="Previous month"
                disabled={isMonthTransitioning}
                onClick={() => void changeMonth(-1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-film-900 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
                {...tapMotionProps}
              >
                <ChevronLeft className="h-4 w-4" />
              </motion.button>
              <motion.button
                type="button"
                aria-label="Next month"
                disabled={!canGoForward || isMonthTransitioning}
                onClick={() => void changeMonth(1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-film-900 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
                {...tapMotionProps}
              >
                <ChevronRight className="h-4 w-4" />
              </motion.button>
            </div>
          </div>

          <div className="mt-8">
            <CalendarView currentMonth={currentMonth} entries={currentEntries} />
          </div>

          {loadingCurrentMonth ? (
            <div className="mt-6">
              <p className="font-sans text-sm text-film-700">
                Loading this month&apos;s journals...
              </p>
            </div>
          ) : null}
        </section>

        <section className="mt-16">
          <h2 className="mb-6 font-sans text-xs uppercase tracking-[0.2em] text-film-700">
            recent
          </h2>

          {!hasAnyEntries && !loadingCurrentMonth ? (
            <div>
              <p className="font-sans text-sm text-film-700">
                No journals yet. Start capturing moments!
              </p>
              <div className="mt-5">
                <ActionButton onClick={() => navigate('/home')}>
                  capture a moment
                </ActionButton>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {recentEntries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  onClick={() =>
                    navigate(`/journal/${entry.day_date}`, {
                      state: createJournalRouteState('history'),
                    })
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </AuraShell>
  );
}

function EntryCard({
  entry,
  onClick,
}: {
  entry: JournalListEntry;
  onClick: () => void;
}) {
  const dateLabel = format(new Date(`${entry.day_date}T12:00:00`), 'MMMM d');
  const firstLine = entry.content?.split('\n')?.[0] ?? '';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={() => void preloadJournalViewPage()}
      onFocus={() => void preloadJournalViewPage()}
      data-testid="recent-entry-card"
      className="flex w-full items-center gap-4 rounded-2xl border border-abyss-600 bg-abyss-800/50 p-4 text-left transition-colors hover:bg-abyss-800/70"
      {...tapMotionProps}
    >
      {entry.first_photo_url ? (
        <img
          src={entry.first_photo_url}
          alt=""
          data-testid="recent-entry-thumb"
          className="h-14 w-14 flex-shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div data-testid="recent-entry-thumb" className="h-14 w-14 flex-shrink-0 rounded-xl bg-abyss-700" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-sans text-sm font-medium text-film-900">{dateLabel}</p>
        <p className="mt-1 font-sans text-xs text-film-700 line-clamp-2">
          {firstLine || 'No preview available.'}
        </p>
      </div>
    </motion.button>
  );
}
