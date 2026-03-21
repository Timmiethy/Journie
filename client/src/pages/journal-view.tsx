import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, Pencil, RefreshCw, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { AuraShell } from '../components/layout/AuraShell';
import { useStore } from '../lib/store';
import type { JournalEntry, MomentWithPhotos } from '../types';

const POLL_MS = 2000;
const TIMEOUT_MS = 30000;

export function JournalViewPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const isOnline = useStore((s) => s.isOnline);

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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'failed to load moments');
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
      } catch (err: unknown) {
        stopPolling();
        setLoading(false);
        setLoadingFailed(true);
        if (!pollingErrorShownRef.current) {
          pollingErrorShownRef.current = true;
          toast.error(err instanceof Error ? err.message : 'Something went wrong.');
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

    Promise.all([loadJournal(), loadMoments()])
      .then(([loadedJournal]) => {
        if (cancelled) return;
        setLoading(false);
        if (loadedJournal?.status === 'generating') {
          startPolling();
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoading(false);
        toast.error(err instanceof Error ? err.message : 'failed to load journal');
      });

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [date, loadJournal, loadMoments, startPolling, stopPolling]);

  const allPhotos = useMemo(
    () => moments.flatMap((m) => m.photos.map((p) => p.photo_url)),
    [moments],
  );

  const paragraphs = useMemo(() => {
    if (!journal?.content) return [];
    return journal.content.split(/\n\n+/).filter(Boolean);
  }, [journal?.content]);

  const lastParagraph = paragraphs.length > 0 ? paragraphs[paragraphs.length - 1] : undefined;
  const bodyParagraphs = paragraphs.slice(0, -1);

  const dateLabel = date
    ? format(new Date(`${date}T12:00:00`), 'MMMM d, yyyy — EEEE')
    : '';

  const enterEditMode = async () => {
    if (!date || !journal) return;

    if (journal.status === 'confirmed') {
      setSaving(true);
      try {
        const updated = await api.journal.update(date, { status: 'draft', content: journal.content });
        setJournal(updated);
        setEditContent(updated.content);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'failed to switch journal to draft');
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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'failed to save journal');
    } finally {
      setSaving(false);
    }
  };

  const handleRedo = async () => {
    if (!date || !isOnline) return;

    setSaving(true);
    try {
      await api.journal.generate(date, true);
      setJournal((current) => current ? { ...current, status: 'generating' } : current);
      setEditing(false);
      setLoadingFailed(false);
      startPolling();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'failed to regenerate journal');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-abyss-900" />;
  }

  if (!journal) {
    return (
      <AuraShell>
        <div className="min-h-screen flex items-center justify-center px-6">
          <p className="font-sans text-sm text-film-500">journal not found.</p>
        </div>
      </AuraShell>
    );
  }

  if (journal.status === 'generating') {
    return (
      <AuraShell>
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
          {!loadingFailed ? (
            <>
              <Loader2 className="h-6 w-6 text-film-700 animate-spin mb-5" />
              <p className="font-serif italic text-film-700 text-lg">Writing your journal...</p>
            </>
          ) : (
            <>
              <p className="font-sans text-sm text-aura-rough">Something went wrong.</p>
              <button
                type="button"
                onClick={handleRedo}
                disabled={saving || !isOnline}
                className="font-sans text-sm text-film-700 underline underline-offset-4 mt-3 hover:text-film-900 transition-colors disabled:opacity-50"
              >
                {saving ? 'retrying...' : 'try again'}
              </button>
            </>
          )}
        </div>
      </AuraShell>
    );
  }

  return (
    <AuraShell>
      <div className={`min-h-screen flex flex-col ${journal.status === 'draft' ? 'pb-24' : 'pb-8'}`}>
        <div className="flex items-center justify-between px-6 pt-8 pb-6">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft className="h-5 w-5 text-film-700 hover:text-film-900 transition-colors" />
          </button>
          <span className="font-sans text-[11px] uppercase tracking-widest text-film-700 text-center">
            {dateLabel}
          </span>
          {!editing ? (
            <button
              type="button"
              onClick={enterEditMode}
              disabled={saving || !isOnline}
              className="font-sans text-xs text-film-700 hover:text-film-900 uppercase tracking-widest underline underline-offset-4 disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-1">
                <Pencil className="h-3.5 w-3.5" />
                edit
              </span>
            </button>
          ) : (
            <div className="w-10" />
          )}
        </div>

        {editing ? (
          <div className="px-6 flex-1">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[60vh] bg-transparent border-none text-film-900 font-serif text-lg leading-[1.85] resize-none focus:outline-none p-0"
            />
          </div>
        ) : (
          <div className="flex-1">
            {bodyParagraphs.map((paragraph, index) => {
              const photoIdx = bodyParagraphs.length > 0
                ? Math.floor((index / bodyParagraphs.length) * allPhotos.length)
                : 0;
              const showPhoto = index > 0 && index % 2 === 0 && allPhotos[photoIdx];

              return (
                <div key={`${index}-${paragraph.slice(0, 16)}`}>
                  {showPhoto && (
                    <img
                      src={allPhotos[photoIdx]}
                      alt=""
                      className="w-full aspect-[21/9] object-cover my-6 cursor-pointer"
                      onClick={() => setLightboxUrl(allPhotos[photoIdx])}
                    />
                  )}
                  <p className="font-serif text-lg leading-[1.85] text-film-900 mb-6 text-justify px-6">
                    <RenderMarkdown text={paragraph} />
                  </p>
                </div>
              );
            })}

            {lastParagraph && (
              <p className="font-serif text-base italic text-film-700 text-center py-8 border-t border-abyss-700 mt-4 max-w-[85%] mx-auto">
                <RenderMarkdown text={lastParagraph} />
              </p>
            )}

            {allPhotos.length > 0 && bodyParagraphs.length <= 2 && (
              <img
                src={allPhotos[0]}
                alt=""
                className="w-full aspect-[21/9] object-cover my-6 cursor-pointer"
                onClick={() => setLightboxUrl(allPhotos[0])}
              />
            )}
          </div>
        )}
      </div>

      {journal.status === 'draft' && (
        <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto flex gap-3 p-4 bg-abyss-900/90 backdrop-blur-sm">
          <button
            onClick={handleConfirm}
            disabled={saving || !isOnline}
            className="flex-1 bg-film-900 text-abyss-900 font-sans font-bold text-xs uppercase tracking-widest py-4 rounded-none disabled:opacity-50"
          >
            {saving ? 'saving...' : 'confirm & save'}
          </button>

          {editing ? (
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setEditContent(journal.content);
              }}
              className="border border-abyss-600 text-film-700 font-sans text-xs uppercase tracking-widest py-4 px-6 rounded-none hover:border-film-700 transition-colors"
            >
              cancel
            </button>
          ) : (
            <button
              onClick={handleRedo}
              disabled={saving || !isOnline}
              className="border border-abyss-600 text-film-700 font-sans text-xs uppercase tracking-widest py-4 px-6 rounded-none hover:border-film-700 transition-colors disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5" />
                regenerate
              </span>
            </button>
          )}
        </div>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black z-50 flex items-center justify-center"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-6 right-6 z-10"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-6 w-6 text-film-900" />
          </button>
          <img
            src={lightboxUrl}
            alt=""
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </AuraShell>
  );
}

function RenderMarkdown({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      parts.push(
        <span key={key++} className="font-medium italic text-film-900">{match[2]}</span>,
      );
    } else if (match[3]) {
      parts.push(
        <span key={key++} className="font-medium text-film-900">{match[3]}</span>,
      );
    } else if (match[4] || match[5]) {
      parts.push(
        <span key={key++} className="italic text-film-700">{match[4] || match[5]}</span>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}
