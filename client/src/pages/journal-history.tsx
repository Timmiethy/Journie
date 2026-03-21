import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { addMonths, format, subMonths } from 'date-fns';
import { api, type JournalListEntry } from '../lib/api';
import { AuraShell } from '../components/layout/AuraShell';
import { CalendarView } from '../components/calendar-view';
import { useStore } from '../lib/store';
import { tapMotionProps } from '../lib/motion';
import { ActionButton } from '../components/ui/action-button';

export function JournalHistoryPage() {
  const navigate = useNavigate();
  const clearCalendarPopover = useStore((state) => state.clearCalendarPopover);
  const [entries, setEntries] = useState<JournalListEntry[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.journal
      .list({ limit: 30, status: 'confirmed' })
      .then((result) => {
        setEntries(result);
        setLoaded(true);
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : 'failed to load journals');
        setLoaded(true);
      });

    return () => {
      clearCalendarPopover();
    };
  }, [clearCalendarPopover]);

  return (
    <AuraShell>
      <div className="min-h-screen flex flex-col px-5 safe-top safe-bottom">
        <div className="flex items-center pb-5">
          <motion.button type="button" onClick={() => navigate('/home')} {...tapMotionProps}>
            <ChevronLeft className="h-5 w-5 text-film-700 hover:text-film-900 transition-colors" />
          </motion.button>
          <span className="font-sans text-xs uppercase tracking-widest text-film-700 mx-auto">
            archive
          </span>
          <div className="w-5" />
        </div>

        <div className="rounded-[28px] border border-abyss-700/80 bg-abyss-900/82 shadow-[0_18px_60px_rgba(0,0,0,0.3)] backdrop-blur-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-abyss-700/70">
            <motion.button
              type="button"
              onClick={() => setCurrentMonth((month) => subMonths(month, 1))}
              {...tapMotionProps}
            >
              <ChevronLeft className="h-5 w-5 text-film-700 hover:text-film-900 transition-colors" />
            </motion.button>
            <span className="font-sans text-sm uppercase tracking-[0.18em] text-film-900">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <motion.button
              type="button"
              onClick={() => setCurrentMonth((month) => addMonths(month, 1))}
              {...tapMotionProps}
            >
              <ChevronRight className="h-5 w-5 text-film-700 hover:text-film-900 transition-colors" />
            </motion.button>
          </div>

          <CalendarView currentMonth={currentMonth} entries={entries} />
        </div>

        <div className="mt-5 flex-1 rounded-[28px] border border-abyss-700/80 bg-abyss-900/82 shadow-[0_18px_60px_rgba(0,0,0,0.3)] backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-abyss-700/70 px-5 py-4">
            <p className="font-sans text-xs uppercase tracking-[0.22em] text-film-500">
              recent
            </p>
            {entries.length > 0 ? (
              <span className="font-sans text-xs text-film-500">
                {entries.length} saved
              </span>
            ) : null}
          </div>

          {loaded && entries.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="font-serif italic text-film-700 text-base">
                No journals yet. Start capturing moments!
              </p>
              <div className="mt-5">
                <ActionButton onClick={() => navigate('/home')}>
                  capture a moment
                </ActionButton>
              </div>
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
  const dateLabel = format(new Date(`${entry.day_date}T12:00:00`), 'MMMM d');
  const firstLine = entry.content?.split('\n')?.[0] ?? '';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 border-b border-abyss-700/70 px-5 py-4 text-left transition-opacity"
      {...tapMotionProps}
    >
      {entry.first_photo_url ? (
        <img
          src={entry.first_photo_url}
          alt=""
          className="h-14 w-14 flex-shrink-0 rounded-2xl object-cover"
        />
      ) : (
        <div className="h-14 w-14 flex-shrink-0 rounded-2xl bg-abyss-700" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-sans text-xs text-film-500 mb-1">{dateLabel}</p>
        <p className="font-serif text-sm text-film-700 line-clamp-2">{firstLine}</p>
      </div>
    </motion.button>
  );
}
