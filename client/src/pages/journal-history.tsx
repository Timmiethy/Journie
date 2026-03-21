import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
} from 'date-fns';
import { api, type JournalListEntry } from '../lib/api';
import { AuraShell } from '../components/layout/AuraShell';

export function JournalHistoryPage() {
  const navigate = useNavigate();

  const [entries, setEntries] = useState<JournalListEntry[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.journal
      .list({ limit: 30, status: 'confirmed' })
      .then((res) => {
        setEntries(res);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : 'failed to load journals');
        setLoaded(true);
      });
  }, []);

  // Dates that have journals
  const journalDates = useMemo(
    () => new Set(entries.map((e) => e.day_date)),
    [entries]
  );

  // Calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  const handleDayClick = (day: Date) => {
    const iso = format(day, 'yyyy-MM-dd');
    if (journalDates.has(iso)) {
      navigate(`/journal/${iso}`);
    }
  };

  return (
    <AuraShell>
      <div className="min-h-screen flex flex-col">
        {/* Top bar */}
        <div className="flex items-center px-6 pt-8 pb-6">
          <button onClick={() => navigate('/home')}>
            <ChevronLeft className="h-5 w-5 text-film-700 hover:text-film-900 transition-colors" />
          </button>
          <span className="font-sans text-xs uppercase tracking-widest text-film-700 mx-auto">
            archive
          </span>
          <div className="w-5" />
        </div>

        {/* Calendar */}
        <div>
          {/* Month header */}
          <div className="flex items-center justify-between px-6 py-4">
            <button onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
              <ChevronLeft className="h-5 w-5 text-film-700 hover:text-film-900 transition-colors" />
            </button>
            <span className="font-sans text-sm text-film-900 uppercase tracking-widest">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <button onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
              <ChevronRight className="h-5 w-5 text-film-700 hover:text-film-900 transition-colors" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 gap-0 px-6">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div
                key={d}
                className="font-sans text-[10px] text-film-500 uppercase tracking-wide text-center py-2"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0 px-6">
            {calendarDays.map((day) => {
              const inMonth = isSameMonth(day, currentMonth);
              const today = isToday(day);
              const iso = format(day, 'yyyy-MM-dd');
              const hasJournal = journalDates.has(iso);

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={`h-10 flex flex-col items-center justify-center relative ${
                    hasJournal ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <span
                    className={`font-sans text-sm ${
                      !inMonth
                        ? 'text-abyss-600'
                        : today
                          ? 'text-film-900 font-medium'
                          : 'text-film-700'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  {hasJournal && (
                    <div
                      className="h-1 w-1 rounded-full absolute bottom-1"
                      style={{ backgroundColor: '#FF8A4C' }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent entries */}
        <div className="flex-1 mt-4">
          <p className="font-sans text-xs uppercase tracking-widest text-film-500 px-6 py-4">
            recent
          </p>

          {loaded && entries.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-serif italic text-film-700 text-base">No journals yet. Start capturing moments!</p>
            </div>
          ) : (
            entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onClick={() => navigate(`/journal/${entry.day_date}`)}
              />
            ))
          )}
        </div>
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
  const dateLabel = format(new Date(entry.day_date + 'T12:00:00'), 'MMMM d');
  const firstLine = entry.content?.split('\n')?.[0] ?? '';

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-4 px-6 py-4 border-b border-abyss-700 cursor-pointer active:opacity-70 transition-opacity w-full text-left"
    >
      {entry.first_photo_url ? (
        <img
          src={entry.first_photo_url}
          alt=""
          className="h-14 w-14 object-cover flex-shrink-0"
        />
      ) : (
        <div className="h-14 w-14 bg-abyss-700 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-sans text-xs text-film-500 mb-1">{dateLabel}</p>
        <p className="font-serif text-sm text-film-700 line-clamp-2">{firstLine}</p>
      </div>
    </button>
  );
}
