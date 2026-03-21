import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Image, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import { formatTime, todayISO, compressImage } from '../lib/utils';
import { AuraShell } from '../components/layout/AuraShell';
import type { MomentWithPhotos, Mood } from '../types';

const MOOD_EMOJI: Record<Mood, string> = {
  great: '🤩',
  good: '😊',
  neutral: '😐',
  low: '😔',
  rough: '😣',
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h <= 11) return 'morning';
  if (h >= 12 && h <= 17) return 'afternoon';
  return 'evening';
}

export function HomePage() {
  const navigate = useNavigate();
  const displayName = useStore((s) => s.displayName);
  const todayMoments = useStore((s) => s.todayMoments);
  const isOnline = useStore((s) => s.isOnline);
  const [showFlash, setShowFlash] = useState(false);
  const [selectedMoment, setSelectedMoment] = useState<MomentWithPhotos | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.moments
      .list(todayISO())
      .then((moments) => {
        useStore.getState().setTodayMoments(moments);
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : 'failed to load today\'s moments');
      });
  }, []);

  const handleFiles = useCallback(
    async (fileList: FileList | null, isCamera: boolean) => {
      if (!fileList || fileList.length === 0) return;

      if (isCamera) {
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 600);
      }

      try {
        const files = Array.from(fileList);
        const compressed = await Promise.all(files.map(compressImage));

        setTimeout(
          () => {
            navigate('/moments/new', { state: { files: compressed } });
          },
          isCamera ? 400 : 0,
        );
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'failed to prepare photos');
      }
    },
    [navigate],
  );

  const handleDeleteMoment = async (momentId: string) => {
    if (!isOnline) return;

    setDeletingId(momentId);
    try {
      await api.moments.delete(momentId);
      useStore.getState().removeMoment(momentId);
      setSelectedMoment(null);
      toast.success('moment deleted');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'failed to delete moment');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AuraShell>
      {showFlash && (
        <div className="fixed inset-0 bg-white z-50 animate-flash pointer-events-none" />
      )}

      <div className="min-h-screen flex flex-col pb-24">
        <div className="flex justify-between items-start px-6 pt-8">
          <span className="font-sans text-sm text-film-700">
            Good {getGreeting()}, {displayName ?? 'there'}
          </span>
          <button
            onClick={() => navigate('/journals')}
            className="inline-flex items-center gap-2 font-sans text-xs uppercase tracking-widest text-film-700 border border-abyss-600 px-3 py-1 hover:border-film-700 hover:text-film-900 transition-all duration-200"
          >
            <BookOpen className="h-3.5 w-3.5" />
            My Journal
          </button>
        </div>

        <div
          className="aspect-[4/3] w-full relative overflow-hidden border-y border-abyss-600 bg-black mt-6 cursor-pointer"
          onClick={() => cameraInputRef.current?.click()}
        >
          <CornerMarker position="top-left" />
          <CornerMarker position="top-right" />
          <CornerMarker position="bottom-left" />
          <CornerMarker position="bottom-right" />

          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-film-900/20 text-xl font-sans font-thin pointer-events-none select-none">
            +
          </span>

          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            ref={cameraInputRef}
            onChange={(e) => {
              handleFiles(e.target.files, true);
              e.target.value = '';
            }}
          />
        </div>

        <div className="flex items-center justify-center gap-8 py-6">
          <button
            onClick={() => libraryInputRef.current?.click()}
            className="h-10 w-10 border border-abyss-600 flex items-center justify-center hover:border-film-700 transition-colors duration-200 rounded-none"
          >
            <Image className="h-5 w-5 text-film-700" strokeWidth={1.5} />
          </button>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            ref={libraryInputRef}
            onChange={(e) => {
              handleFiles(e.target.files, false);
              e.target.value = '';
            }}
          />

          <button
            onClick={() => cameraInputRef.current?.click()}
            className="h-20 w-20 rounded-full border-[2px] border-film-900 flex items-center justify-center active:scale-90 transition-transform duration-200"
          >
            <div className="h-16 w-16 bg-film-900 rounded-full" />
          </button>

          <div className="h-10 w-10" />
        </div>

        <div className="flex-1">
          <p className="font-sans text-xs uppercase tracking-widest text-film-500 px-6 mb-3">
            today{todayMoments.length > 0 ? ` · ${todayMoments.length}` : ''}
          </p>

          {todayMoments.length === 0 ? (
            <div className="py-12 text-center">
              <p className="font-sans text-sm text-film-500">nothing yet today.</p>
              <p className="font-sans text-xs text-film-500/60 mt-1">
                tap the circle to capture a moment
              </p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto px-6 pb-4 snap-x snap-mandatory">
              {todayMoments.map((moment) => (
                <MomentCard
                  key={moment.id}
                  moment={moment}
                  onClick={() => setSelectedMoment(moment)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {todayMoments.length >= 1 && (
        <button
          onClick={() => navigate('/timeline')}
          disabled={!isOnline}
          className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-film-900 text-abyss-900 font-sans font-bold text-sm uppercase tracking-widest py-4 text-center rounded-none disabled:bg-abyss-700 disabled:text-film-500 disabled:cursor-not-allowed"
        >
          start journaling
        </button>
      )}

      {selectedMoment && (
        <MomentDetailModal
          moment={selectedMoment}
          deleting={deletingId === selectedMoment.id}
          isOnline={isOnline}
          onClose={() => setSelectedMoment(null)}
          onDelete={() => handleDeleteMoment(selectedMoment.id)}
        />
      )}
    </AuraShell>
  );
}

function CornerMarker({
  position,
}: {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}) {
  const base = 'absolute pointer-events-none';
  const arm = 'bg-film-900/40';

  const posMap: Record<string, string> = {
    'top-left': 'top-2 left-2',
    'top-right': 'top-2 right-2',
    'bottom-left': 'bottom-2 left-2',
    'bottom-right': 'bottom-2 right-2',
  };

  const isTop = position.startsWith('top');
  const isLeft = position.endsWith('left');

  return (
    <div className={`${base} ${posMap[position]}`}>
      <div
        className={`absolute ${arm}`}
        style={{
          width: 16,
          height: 1,
          top: 0,
          [isLeft ? 'left' : 'right']: 0,
        }}
      />
      <div
        className={`absolute ${arm}`}
        style={{
          width: 1,
          height: 16,
          top: isTop ? 0 : 'auto',
          bottom: isTop ? 'auto' : 0,
          [isLeft ? 'left' : 'right']: 0,
        }}
      />
    </div>
  );
}

function MomentCard({
  moment,
  onClick,
}: {
  moment: MomentWithPhotos;
  onClick: () => void;
}) {
  const thumb = moment.photos?.[0]?.photo_url;

  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-[148px] max-w-[148px] snap-start text-left border border-abyss-700 bg-abyss-900/60"
    >
      {thumb ? (
        <img
          src={thumb}
          alt=""
          className="h-28 w-full object-cover"
        />
      ) : (
        <div className="h-28 w-full bg-abyss-700" />
      )}
      <div className="px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-sans text-xs text-film-500">{formatTime(moment.captured_at)}</p>
          {moment.mood && <span className="text-sm">{MOOD_EMOJI[moment.mood]}</span>}
        </div>
      </div>
    </button>
  );
}

function MomentDetailModal({
  moment,
  deleting,
  isOnline,
  onClose,
  onDelete,
}: {
  moment: MomentWithPhotos;
  deleting: boolean;
  isOnline: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const note = moment.text_context || moment.voice_transcript;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end">
      <div className="w-full max-w-[480px] mx-auto bg-abyss-900 border-t border-abyss-700">
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div>
            <p className="font-sans text-xs uppercase tracking-widest text-film-500">moment</p>
            <p className="font-sans text-sm text-film-700 mt-1">{formatTime(moment.captured_at)}</p>
          </div>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5 text-film-700 hover:text-film-900 transition-colors" />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto px-6 pb-4">
          {moment.photos.map((photo) => (
            <img
              key={photo.id}
              src={photo.photo_url}
              alt=""
              className="h-40 w-40 object-cover flex-shrink-0"
            />
          ))}
        </div>

        <div className="px-6 pb-6 space-y-4">
          {moment.mood && (
            <p className="font-sans text-sm text-film-700">
              mood: <span className="ml-1">{MOOD_EMOJI[moment.mood]}</span>
            </p>
          )}

          {note ? (
            <p className="font-serif text-lg leading-relaxed text-film-900">{note}</p>
          ) : (
            <p className="font-sans text-sm text-film-500">no additional context for this moment.</p>
          )}

          <button
            type="button"
            onClick={onDelete}
            disabled={!isOnline || deleting}
            className="w-full inline-flex items-center justify-center gap-2 border border-aura-rough text-aura-rough font-sans text-xs uppercase tracking-widest py-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'deleting...' : 'delete moment'}
          </button>
        </div>
      </div>
    </div>
  );
}
