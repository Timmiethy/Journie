import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import { formatDate, formatTime, todayISO } from '../lib/utils';
import { AuraShell } from '../components/layout/AuraShell';
import type { MomentWithPhotos } from '../types';

const MOOD_EMOJI = {
  great: '🤩',
  good: '😊',
  neutral: '😐',
  low: '😔',
  rough: '😣',
} as const;

export function TimelinePage() {
  const navigate = useNavigate();
  const storeMoments = useStore((s) => s.todayMoments);
  const isOnline = useStore((s) => s.isOnline);
  const [moments, setMoments] = useState<MomentWithPhotos[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const date = todayISO();

  // Touch swipe state per card
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const swipeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (storeMoments.length > 0) {
      setMoments([...storeMoments]);
    } else {
      api.moments.list(date).then((res) => {
        useStore.getState().setTodayMoments(res);
        setMoments(res);
      }).catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : 'failed to load today\'s moments');
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Drag and drop ───

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setOverIdx(idx);
  };
  const handleDragEnd = () => {
    if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
      const updated = [...moments];
      const [moved] = updated.splice(dragIdx, 1);
      updated.splice(overIdx, 0, moved);
      setMoments(updated);
    }
    setDragIdx(null);
    setOverIdx(null);
  };

  // ─── Swipe to delete (touch) ───

  const handleTouchStart = (id: string, e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
    if (swipedId && swipedId !== id) setSwipedId(null);
  };

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const delta = e.touches[0].clientX - touchStartX.current;
      touchDeltaX.current = delta;
      if (delta < -40 && swipeRef.current) {
        swipeRef.current.style.transform = `translateX(${Math.max(delta, -100)}px)`;
      }
    },
    []
  );

  const handleTouchEnd = useCallback(
    (id: string) => {
      if (touchDeltaX.current < -60) {
        setSwipedId(id);
        if (swipeRef.current) swipeRef.current.style.transform = 'translateX(-100px)';
      } else {
        setSwipedId(null);
        if (swipeRef.current) swipeRef.current.style.transform = 'translateX(0)';
      }
    },
    []
  );

  const handleDelete = async (id: string) => {
    if (!isOnline) return;

    try {
      await api.moments.delete(id);
      const updated = moments.filter((m) => m.id !== id);
      setMoments(updated);
      useStore.getState().removeMoment(id);
      setSwipedId(null);
      toast.success('moment deleted');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'failed to delete moment');
    }
  };

  // ─── Generate ───

  const handleGenerate = async () => {
    if (!isOnline) return;

    setGenerating(true);
    try {
      const orderedIds = moments.map((m) => m.id);
      await api.moments.reorder(date, orderedIds);
      await api.journal.generate(date);
      navigate(`/journal/${date}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'failed to generate journal');
      setGenerating(false);
    }
  };

  return (
    <AuraShell>
      <div className="min-h-screen flex flex-col pb-20">
        {/* Header */}
        <div className="flex items-center px-6 pt-8 pb-6">
          <button onClick={() => navigate('/home')} className="mr-3">
            <ChevronLeft className="h-5 w-5 text-film-700 hover:text-film-900 transition-colors" />
          </button>
          <span className="font-sans text-xs uppercase tracking-widest text-film-700 mx-auto">
            your day — {formatDate(date)}
          </span>
          <div className="w-5" />
        </div>

        {/* Timeline */}
        <div className="flex-1 px-0 relative before:absolute before:left-[27px] before:top-4 before:bottom-4 before:w-px before:bg-abyss-600">
          {moments.map((m, idx) => {
            const isSwiped = swipedId === m.id;
            const thumb = m.photos?.[0]?.photo_url;
            const context = m.text_context || m.voice_transcript;

            return (
              <div key={m.id} className="relative">
                {/* Drag-over insertion indicator */}
                {overIdx === idx && dragIdx !== null && dragIdx !== idx && (
                  <div className="absolute top-0 left-6 right-6 border-t-2 border-film-900 z-10" />
                )}

                {/* Delete zone behind */}
                {isSwiped && (
                  <div className="absolute inset-y-0 right-0 bg-aura-rough/20 border-l-2 border-aura-rough flex items-center z-0">
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="font-sans text-xs text-aura-rough uppercase tracking-widest px-4 flex items-center h-full"
                    >
                      delete
                    </button>
                  </div>
                )}

                {/* Card */}
                <div
                  ref={isSwiped ? swipeRef : undefined}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  onTouchStart={(e) => {
                    swipeRef.current = e.currentTarget;
                    handleTouchStart(m.id, e);
                  }}
                  onTouchMove={(e) => handleTouchMove(e)}
                  onTouchEnd={() => handleTouchEnd(m.id)}
                  className={`flex items-start gap-4 py-4 pl-6 pr-6 relative z-[1] bg-abyss-900 transition-all duration-200 ${
                    dragIdx === idx ? 'opacity-50' : ''
                  }`}
                >
                  <div className="mt-0.5 min-w-[18px] text-center text-base">
                    {m.mood ? MOOD_EMOJI[m.mood] : '·'}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-xs text-film-500 mb-1">
                      {formatTime(m.captured_at)}
                    </p>
                    {thumb && (
                      <img
                        src={thumb}
                        alt=""
                        className={`h-14 w-14 object-cover rounded-none mb-2 ${
                          m.mood ? 'grayscale-0' : 'grayscale-[50%]'
                        }`}
                      />
                    )}
                    {context && (
                      <p className="font-sans text-sm text-film-700 line-clamp-1">{context}</p>
                    )}
                  </div>

                  {/* Drag handle */}
                  <GripVertical
                    className="h-5 w-5 text-film-500 cursor-grab active:cursor-grabbing flex-shrink-0 mt-1"
                    strokeWidth={1.5}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom CTA */}
      {moments.length > 0 && (
        <button
          onClick={handleGenerate}
          disabled={generating || !isOnline}
          className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-film-900 text-abyss-900 font-sans font-bold text-sm uppercase tracking-widest py-4 text-center rounded-none disabled:opacity-50"
        >
          {generating ? 'generating...' : 'done — generate my journal'}
        </button>
      )}
    </AuraShell>
  );
}

