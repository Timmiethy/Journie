import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Pencil, RefreshCw, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ApiError, api } from '../lib/api';
import { AuraShell } from '../components/layout/AuraShell';
import { JournalRenderer } from '../components/journal-renderer';
import { useStore } from '../lib/store';
import { tapMotionProps } from '../lib/motion';
import { ActionButton, TextButton } from '../components/ui/action-button';
import { LoadingScreen } from '../components/loading-screen';
import {
  getJournalHeaderDestination,
  getJournalPrimaryDestination,
  getJournalRouteState,
  getJournalSecondaryDestination,
} from '../lib/journal-navigation';
import type { JournalEntry, MomentWithPhotos } from '../types';

const POLL_MS = 2000;
const TIMEOUT_MS = 30000;

export function JournalViewPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isOnline = useStore((state) => state.isOnline);

  const [journal, setJournal] = useState<JournalEntry | null>(null);
  const [moments, setMoments] = useState<MomentWithPhotos[]>([]);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingFailed, setLoadingFailed] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const pollingErrorShownRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const startTimeRef = useRef(0);
  const routeState = getJournalRouteState(location.state);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = undefined;
    }
  }, []);

  const loadMoments = useCallback(async () => {
    if (!date) return;
    try {
      const loadedMoments = await api.moments.list(date);
      setMoments(loadedMoments);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'failed to load moments');
    }
  }, [date]);

  const loadJournal = useCallback(async () => {
    if (!date) return null;
    const loadedJournal = await api.journal.get(date);
    setJournal(loadedJournal);
    setEditContent(loadedJournal.content);
    return loadedJournal;
  }, [date]);

  const startPolling = useCallback(() => {
    if (!date) return;

    stopPolling();
    startTimeRef.current = Date.now();
    setLoadingFailed(false);
    pollingErrorShownRef.current = false;

    pollRef.current = setInterval(async () => {
      if (Date.now() - startTimeRef.current > TIMEOUT_MS) {
        stopPolling();
        setLoadingFailed(true);
        return;
      }

      try {
        const nextJournal = await api.journal.get(date);
        setJournal(nextJournal);
        setEditContent(nextJournal.content);

        if (nextJournal.status !== 'generating') {
          stopPolling();
          setLoading(false);
        }
      } catch (error: unknown) {
        stopPolling();
        setLoading(false);
        setLoadingFailed(true);
        if (!pollingErrorShownRef.current) {
          pollingErrorShownRef.current = true;
          toast.error(error instanceof Error ? error.message : 'Something went wrong.');
        }
      }
    }, POLL_MS);
  }, [date, stopPolling]);

  useEffect(() => {
    if (!date) return;

    let cancelled = false;
    setLoading(true);
    setLoadingFailed(false);
    setEditing(false);

    Promise.allSettled([loadJournal(), loadMoments()]).then((results) => {
      if (cancelled) return;

      const [journalResult, momentsResult] = results;

      if (momentsResult.status === 'rejected') {
        toast.error(
          momentsResult.reason instanceof Error
            ? momentsResult.reason.message
            : 'failed to load moments',
        );
      }

      if (journalResult.status === 'fulfilled') {
        setLoading(false);
        if (journalResult.value?.status === 'generating') {
          startPolling();
        }
        return;
      }

      if (
        routeState.optimisticGenerating &&
        journalResult.reason instanceof ApiError &&
        journalResult.reason.status === 404 &&
        date
      ) {
        const pendingJournal = createPendingJournal(date);
        setJournal(pendingJournal);
        setEditContent('');
        setLoading(false);
        startPolling();
        return;
      }

      setLoading(false);
      toast.error(
        journalResult.reason instanceof Error
          ? journalResult.reason.message
          : 'failed to load journal',
      );
    });

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [date, loadJournal, loadMoments, routeState.optimisticGenerating, startPolling, stopPolling]);

  const allPhotos = useMemo(
    () => moments.flatMap((moment) => moment.photos.map((photo) => photo.photo_url)),
    [moments],
  );

  const dateLabel = date
    ? format(new Date(`${date}T12:00:00`), 'MMMM d, yyyy - EEEE')
    : '';

  const headerDestination = getJournalHeaderDestination(routeState.source, journal?.status ?? 'confirmed');
  const primaryDestination = getJournalPrimaryDestination();
  const secondaryDestination = getJournalSecondaryDestination(
    routeState.source,
    journal?.status ?? 'confirmed',
  );
  const hasStickyBar = Boolean(
    journal && (journal.status === 'draft' || (journal.status === 'confirmed' && !editing)),
  );

  const enterEditMode = async () => {
    if (!date || !journal) return;

    if (journal.status === 'confirmed') {
      setSaving(true);
      try {
        const updated = await api.journal.update(date, {
          status: 'draft',
          content: journal.content,
        });
        setJournal(updated);
        setEditContent(updated.content);
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : 'failed to switch journal to draft');
        setSaving(false);
        return;
      } finally {
        setSaving(false);
      }
    }

    setEditing(true);
  };

  const handleConfirm = async () => {
    if (!date || !journal || !isOnline) return;

    setSaving(true);
    try {
      const content = editing ? editContent : journal.content;
      const updated = await api.journal.update(date, { status: 'confirmed', content });
      setJournal(updated);
      setEditContent(updated.content);
      setEditing(false);
      toast.success('journal saved');
      navigate('/home');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'failed to save journal');
    } finally {
      setSaving(false);
    }
  };

  const handleRedo = async () => {
    if (!date || !isOnline) return;

    setSaving(true);
    try {
      await api.journal.generate(date, true, moments.map((moment) => moment.id));
      setJournal((current) => (current ? { ...current, status: 'generating' } : current));
      setEditing(false);
      setLoadingFailed(false);
      startPolling();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'failed to regenerate journal');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <LoadingScreen
        eyebrow="assembling your journal"
        title="Lining up the day before we show it."
        description="We are pulling the photos, text, and journal state together so this page lands fully formed."
      />
    );
  }

  if (!journal) {
    return (
      <AuraShell>
        <div className="min-h-screen flex items-center justify-center px-4 sm:px-6">
          <div className="max-w-[28rem] rounded-[24px] border border-white/8 bg-abyss-900/80 px-5 py-6 text-center shadow-[0_20px_60px_rgba(0,0,0,0.28)] sm:rounded-[28px] sm:px-6 sm:py-7">
            <p className="font-sans text-[10px] uppercase tracking-[0.24em] text-film-500">
              journal missing
            </p>
            <p className="mt-3 font-sans text-xl font-medium leading-tight text-film-900 sm:text-2xl">
              There is no journal for this day yet.
            </p>
            <p className="mt-3 font-sans text-sm leading-6 text-film-700">
              Head home, capture a few moments, then generate the journal once the day has material.
            </p>
            <div className="mt-6">
              <ActionButton onClick={() => navigate('/home')}>
                back home
              </ActionButton>
            </div>
          </div>
        </div>
      </AuraShell>
    );
  }

  return (
    <AuraShell>
      <div className={`min-h-screen flex flex-col ${hasStickyBar ? 'pb-24 safe-bottom' : 'pb-8 safe-bottom'}`}>
        <div className="flex items-center justify-between gap-3 px-4 safe-top pb-4 sm:px-6 sm:pb-6">
          <TextButton
            type="button"
            onClick={() => navigate(headerDestination.to)}
            className="inline-flex items-center gap-2 whitespace-nowrap no-underline"
          >
            <ChevronLeft className="h-4 w-4" />
            {headerDestination.label}
          </TextButton>
          <span className="font-sans text-[11px] uppercase tracking-widest text-film-700 text-center">
            {dateLabel}
          </span>
          {!editing ? (
            <TextButton
              type="button"
              onClick={enterEditMode}
              disabled={saving || !isOnline}
              className="text-xs uppercase tracking-[0.18em]"
            >
              <span className="inline-flex items-center gap-1">
                <Pencil className="h-3.5 w-3.5" />
                edit
              </span>
            </TextButton>
          ) : (
            <div className="w-[92px]" />
          )}
        </div>

        {editing ? (
          <div className="flex-1 px-4 sm:px-6">
            <textarea
              value={editContent}
              onChange={(event) => setEditContent(event.target.value)}
              className="w-full min-h-[60vh] bg-transparent border-none text-film-900 font-serif text-lg leading-[1.85] resize-none focus:outline-none p-0"
            />
          </div>
        ) : (
          <div className="flex-1">
            <JournalRenderer
              status={journal.status}
              content={journal.content}
              photos={allPhotos}
              onPhotoClick={setLightboxUrl}
              dailyAchievement={journal.daily_achievement}
              bestPhotoUrl={journal.best_photo_url}
              entryType={journal.entry_type}
            />

            {journal.status === 'generating' && loadingFailed ? (
              <div className="px-4 pb-8 text-center sm:px-6">
                <p className="font-sans text-sm text-aura-rough">Something went wrong.</p>
                <motion.button
                  type="button"
                  onClick={handleRedo}
                  disabled={saving || !isOnline}
                  className="font-sans text-sm text-film-700 underline underline-offset-4 mt-3 hover:text-film-900 transition-colors disabled:opacity-50"
                  {...tapMotionProps}
                >
                  {saving ? 'retrying...' : 'try again'}
                </motion.button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {journal.status === 'draft' ? (
        <div className="fixed bottom-0 left-0 right-0 mx-auto flex max-w-[480px] gap-3 rounded-t-[24px] border border-white/8 bg-abyss-900/92 p-3.5 backdrop-blur-md sm:p-4">
          <ActionButton
            onClick={handleConfirm}
            disabled={saving || !isOnline}
            pending={saving}
            pendingLabel="saving..."
            className="flex-1"
          >
            confirm & save
          </ActionButton>

          {editing ? (
            <ActionButton
              onClick={() => {
                setEditing(false);
                setEditContent(journal.content);
              }}
              variant="secondary"
              className="px-6"
            >
              cancel
            </ActionButton>
          ) : (
            <ActionButton
              onClick={handleRedo}
              disabled={saving || !isOnline}
              variant="secondary"
              className="px-6"
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5" />
                regenerate
              </span>
            </ActionButton>
          )}
        </div>
      ) : null}

      {journal.status === 'confirmed' && !editing ? (
        <div className="fixed bottom-0 left-0 right-0 mx-auto flex max-w-[480px] gap-3 rounded-t-[24px] border border-white/8 bg-abyss-900/92 p-3.5 backdrop-blur-md sm:p-4">
          <ActionButton
            onClick={() => navigate(primaryDestination.to)}
            className="flex-1"
          >
            {primaryDestination.label}
          </ActionButton>
          {secondaryDestination ? (
            <ActionButton
              onClick={() => navigate(secondaryDestination.to)}
              variant="secondary"
              className="px-6"
            >
              {secondaryDestination.label}
            </ActionButton>
          ) : null}
        </div>
      ) : null}

      {lightboxUrl ? (
        <div
          className="fixed inset-0 bg-black z-50 flex items-center justify-center"
          onClick={() => setLightboxUrl(null)}
        >
          <motion.button
            type="button"
            className="absolute top-6 right-6 z-10"
            onClick={() => setLightboxUrl(null)}
            {...tapMotionProps}
          >
            <X className="h-6 w-6 text-film-900" />
          </motion.button>
          <img
            src={lightboxUrl}
            alt=""
            className="max-w-full max-h-full object-contain"
          />
        </div>
      ) : null}
    </AuraShell>
  );
}

function createPendingJournal(date: string): JournalEntry {
  const timestamp = new Date().toISOString();

  return {
    id: `pending-${date}`,
    user_id: '',
    day_date: date,
    content: '',
    generated_content: null,
    status: 'generating',
    entry_type: 'daily',
    daily_achievement: null,
    best_photo_url: null,
    generated_at: timestamp,
    confirmed_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}
