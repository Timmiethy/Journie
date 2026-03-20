import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../lib/api';
import { AuraShell } from '../components/layout/AuraShell';
import { AURA_COLOR } from '../lib/store';
import type { JournalEntry, MomentWithPhotos, Mood } from '../types';

export function JournalViewPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const reveal = searchParams.get('reveal') === '1';

  const [journal, setJournal] = useState<JournalEntry | null>(null);
  const [moments, setMoments] = useState<MomentWithPhotos[]>([]);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(!reveal);

  // Load data
  useEffect(() => {
    if (!date) return;
    Promise.all([      api.journal.get(date),
      api.moments.list(date),
    ]).then(([j, m]) => {
      setJournal(j);
      setMoments(m);
      setEditContent(j.content);
    }).catch(() => {});
  }, [date]);

  // Clear reveal param after animation
  useEffect(() => {
    if (reveal) {
      const t = setTimeout(() => {
        setRevealed(true);
        setSearchParams({}, { replace: true });
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [reveal, setSearchParams]);

  // Collect all photos from moments
  const allPhotos = useMemo(
    () => moments.flatMap((m) => m.photos.map((p) => p.photo_url)),
    [moments]
  );

  // Unique moods
  const uniqueMoods = useMemo(() => {
    const moods = new Set<Mood>();
    moments.forEach((m) => { if (m.mood) moods.add(m.mood); });
    return Array.from(moods);
  }, [moments]);

  // Parse content into paragraphs
  const paragraphs = useMemo(() => {
    if (!journal?.content) return [];
    return journal.content.split(/\n\n+/).filter(Boolean);
  }, [journal?.content]);

  const lastParagraph = paragraphs.length > 0 ? paragraphs[paragraphs.length - 1] : undefined;
  const bodyParagraphs = paragraphs.slice(0, -1);

  // Formatted date header
  const dateLabel = date
    ? format(new Date(date + 'T12:00:00'), 'EEEE, MMMM d').toLowerCase()
    : '';

  // ─── Actions ───

  const handleConfirm = async () => {
    if (!date) return;
    setSaving(true);
    try {
      await api.journal.update(date, { status: 'confirmed' });
      setJournal((j) => j ? { ...j, status: 'confirmed' as const } : j);
    } catch {} finally { setSaving(false); }
  };

  const handleRedo = async () => {
    if (!date) return;
    await api.journal.generate(date, true);
    navigate(`/journal/${date}/generate`);
  };

  const handleSaveEdit = async () => {
    if (!date) return;
    setSaving(true);
    try {
      await api.journal.update(date, { content: editContent });
      setJournal((j) => j ? { ...j, content: editContent } : j);
      setEditing(false);
    } catch {} finally { setSaving(false); }
  };

  if (!journal) {
    return <div className="min-h-screen bg-abyss-900" />;
  }

  const isDraft = journal.status === 'draft';

  return (
    <AuraShell>
      <div className={`min-h-screen flex flex-col ${isDraft ? 'pb-24' : 'pb-8'}`}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-8 pb-6">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft className="h-5 w-5 text-film-700 hover:text-film-900 transition-colors" />
          </button>
          <span className="font-sans text-xs uppercase tracking-widest text-film-700">
            {dateLabel}
          </span>
          {isDraft && !editing ? (
            <button
              onClick={() => setEditing(true)}
              className="font-sans text-xs text-film-700 hover:text-film-900 uppercase tracking-widest underline underline-offset-4 cursor-pointer"
            >
              edit
            </button>
          ) : (
            <div className="w-8" />
          )}
        </div>

        {/* Mood dots */}
        {uniqueMoods.length > 0 && (
          <div className="flex items-center justify-center gap-3 pb-6">
            {uniqueMoods.map((m) => (
              <div
                key={m}
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: AURA_COLOR[m] }}
              />
            ))}
          </div>
        )}

        {/* Content */}
        {editing ? (
          <div className="px-6 flex-1">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[60vh] bg-transparent border-none text-film-900 font-serif text-lg leading-[1.85] resize-none focus:outline-none p-0"
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-1 bg-film-900 text-abyss-900 font-sans font-bold text-xs uppercase tracking-widest py-4 rounded-none disabled:opacity-50"
              >
                {saving ? 'saving...' : 'save changes'}
              </button>
              <button
                onClick={() => { setEditing(false); setEditContent(journal.content); }}
                className="border border-abyss-600 text-film-700 font-sans text-xs uppercase tracking-widest py-4 px-6 rounded-none hover:border-film-700 transition-colors"
              >
                cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1">
            {bodyParagraphs.map((p, i) => {
              // Inject a photo between some paragraphs
              const photoIdx = Math.floor((i / bodyParagraphs.length) * allPhotos.length);
              const showPhoto = i > 0 && i % 2 === 0 && allPhotos[photoIdx];

              return (
                <div key={i}>
                  {showPhoto && (
                    <img
                      src={allPhotos[photoIdx]}
                      alt=""
                      className="w-full aspect-[21/9] object-cover grayscale-[30%] my-6 cursor-pointer"
                      onClick={() => setLightboxUrl(allPhotos[photoIdx])}
                    />
                  )}
                  <p
                    className="font-serif text-lg leading-[1.85] text-film-900 mb-6 text-justify px-6"
                    style={{
                      opacity: revealed ? 1 : 0,
                      animation: !revealed
                        ? `line-reveal 0.5s ease-out ${i * 200}ms forwards`
                        : undefined,
                    }}
                  >
                    <RenderMarkdown text={p} />
                  </p>
                </div>
              );
            })}

            {/* Closing reflection */}
            {lastParagraph && (
              <p
                className="font-serif text-base italic text-film-700 text-center py-8 border-t border-abyss-700 mt-4 max-w-[85%] mx-auto"
                style={{
                  opacity: revealed ? 1 : 0,
                  animation: !revealed
                    ? `line-reveal 0.5s ease-out ${bodyParagraphs.length * 200}ms forwards`
                    : undefined,
                }}
              >
                <RenderMarkdown text={lastParagraph} />
              </p>
            )}

            {/* Show remaining photos at the bottom */}
            {allPhotos.length > 0 && bodyParagraphs.length <= 2 && (
              <img
                src={allPhotos[0]}
                alt=""
                className="w-full aspect-[21/9] object-cover grayscale-[30%] my-6 cursor-pointer"
                onClick={() => setLightboxUrl(allPhotos[0])}
              />
            )}
          </div>
        )}
      </div>

      {/* Draft bottom actions */}
      {isDraft && !editing && (
        <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto flex gap-3 p-4 bg-abyss-900/90 backdrop-blur-sm">
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 bg-film-900 text-abyss-900 font-sans font-bold text-xs uppercase tracking-widest py-4 rounded-none disabled:opacity-50"
          >
            {saving ? 'saving...' : 'looks good, save it'}
          </button>
          <button
            onClick={handleRedo}
            className="border border-abyss-600 text-film-700 font-sans text-xs uppercase tracking-widest py-4 px-6 rounded-none hover:border-film-700 transition-colors"
          >
            redo
          </button>
        </div>
      )}

      {/* Lightbox */}
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

// ─── Minimal inline markdown ───

function RenderMarkdown({ text }: { text: string }) {
  // Process bold and italic inline
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
      // bold italic ***text***
      parts.push(
        <span key={key++} className="font-medium italic text-film-900">{match[2]}</span>
      );
    } else if (match[3]) {
      // bold **text**
      parts.push(
        <span key={key++} className="font-medium text-film-900">{match[3]}</span>
      );
    } else if (match[4] || match[5]) {
      // italic *text* or _text_
      parts.push(
        <span key={key++} className="italic text-film-700">{match[4] || match[5]}</span>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}


