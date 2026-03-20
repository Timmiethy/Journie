import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image } from 'lucide-react';
import { api } from '../lib/api';
import { useStore, AURA_COLOR } from '../lib/store';
import { formatTime, todayISO, compressImage } from '../lib/utils';
import { AuraShell } from '../components/layout/AuraShell';
import type { MomentWithPhotos } from '../types';

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
  const [showFlash, setShowFlash] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  // Fetch today's moments on mount
  useEffect(() => {
    api.moments
      .list(todayISO())
      .then((moments) => {
        useStore.getState().setTodayMoments(moments);
      })
      .catch(() => {
        // silently fail — empty state will show
      });
  }, []);

  const handleFiles = useCallback(
    async (fileList: FileList | null, isCamera: boolean) => {
      if (!fileList || fileList.length === 0) return;

      if (isCamera) {
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 600);
      }

      const files = Array.from(fileList);
      const compressed = await Promise.all(files.map(compressImage));

      // Small delay so flash is visible before navigation
      setTimeout(
        () => {
          navigate('/moments/new', { state: { files: compressed } });
        },
        isCamera ? 400 : 0
      );
    },
    [navigate]
  );

  return (
    <AuraShell>
      {/* Camera flash */}
      {showFlash && (
        <div className="fixed inset-0 bg-white z-50 animate-flash pointer-events-none" />
      )}

      <div className="min-h-screen flex flex-col pb-20">
        {/* Top bar */}
        <div className="flex justify-between items-start px-6 pt-8">
          <span className="font-sans text-sm text-film-700">
            Good {getGreeting()}, {displayName ?? 'there'}
          </span>
          <button
            onClick={() => navigate('/journals')}
            className="font-sans text-xs uppercase tracking-widest text-film-700 border border-abyss-600 px-3 py-1 hover:border-film-700 hover:text-film-900 transition-all duration-200"
          >
            journal
          </button>
        </div>

        {/* Viewfinder */}
        <div
          className="aspect-[4/3] w-full relative overflow-hidden border-y border-abyss-600 bg-black mt-6 cursor-pointer"
          onClick={() => cameraInputRef.current?.click()}
        >
          {/* Corner markers */}
          <CornerMarker position="top-left" />
          <CornerMarker position="top-right" />
          <CornerMarker position="bottom-left" />
          <CornerMarker position="bottom-right" />

          {/* Center crosshair */}
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-film-900/20 text-xl font-sans font-thin pointer-events-none select-none">
            +
          </span>

          {/* Hidden camera input */}
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

        {/* Capture controls */}
        <div className="flex items-center justify-center gap-8 py-6">
          {/* Library button */}
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

          {/* Capture button */}
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="h-20 w-20 rounded-full border-[2px] border-film-900 flex items-center justify-center active:scale-90 transition-transform duration-200"
          >
            <div className="h-16 w-16 bg-film-900 rounded-full" />
          </button>

          {/* Spacer */}
          <div className="h-10 w-10" />
        </div>

        {/* Today's moments */}
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
            <div className="space-y-0 px-6">
              {todayMoments.map((m) => (
                <MomentCard key={m.id} moment={m} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Start journaling CTA */}
      {todayMoments.length >= 1 && (
        <button
          onClick={() => navigate('/timeline')}
          className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-film-900 text-abyss-900 font-sans font-bold text-sm uppercase tracking-widest py-4 text-center rounded-none"
        >
          start journaling
        </button>
      )}
    </AuraShell>
  );
}

// ─── Corner Marker ───

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
      {/* Horizontal arm */}
      <div
        className={`absolute ${arm}`}
        style={{
          width: 16,
          height: 1,
          top: 0,
          [isLeft ? 'left' : 'right']: 0,
        }}
      />
      {/* Vertical arm */}
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

// ─── Moment Card ───

function MomentCard({ moment }: { moment: MomentWithPhotos }) {
  const thumb = moment.photos?.[0]?.photo_url;
  const context = moment.text_context || moment.voice_transcript;
  const photoCount = moment.photos?.length ?? 0;

  return (
    <div className="flex items-center gap-4 py-3 border-b border-abyss-700 active:opacity-70 transition-opacity duration-150 cursor-pointer">
      {thumb ? (
        <img
          src={thumb}
          alt=""
          className="h-12 w-12 rounded-none object-cover grayscale hover:grayscale-0 transition-all duration-500 flex-shrink-0"
        />
      ) : (
        <div className="h-12 w-12 rounded-none bg-abyss-700 flex-shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <p className="font-sans text-xs text-film-500 mb-0.5">
          {formatTime(moment.captured_at)}
        </p>
        <p className="font-sans text-sm text-film-700 truncate">
          {context ?? `${photoCount} photo${photoCount !== 1 ? 's' : ''}`}
        </p>
      </div>

      {moment.mood && (
        <div
          className="h-3 w-3 rounded-full flex-shrink-0 shadow-glow"
          style={{
            backgroundColor: AURA_COLOR[moment.mood],
            '--tw-shadow-color': AURA_COLOR[moment.mood],
          } as React.CSSProperties}
        />
      )}
    </div>
  );
}

