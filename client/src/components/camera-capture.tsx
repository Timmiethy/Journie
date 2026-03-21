import { useRef } from 'react';
import { Image } from 'lucide-react';
import { m } from 'framer-motion';
import { CAPTURE_MORPH_LAYOUT_ID, tapMotionProps } from '../lib/motion';

interface CameraCaptureProps {
  disabled?: boolean;
  onFilesSelected: (fileList: FileList | null, source: 'camera' | 'library') => void;
}

export function CameraCapture({
  disabled = false,
  onFilesSelected,
}: CameraCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <m.button
        type="button"
        layoutId={CAPTURE_MORPH_LAYOUT_ID}
        data-testid="capture-morph"
        disabled={disabled}
        onClick={() => cameraInputRef.current?.click()}
        className="relative mt-6 aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-[30px] border border-abyss-700 bg-black disabled:pointer-events-none"
        {...tapMotionProps}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,245,245,0.08),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_65%)]" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/85 to-transparent" />
        <CornerMarker position="top-left" />
        <CornerMarker position="top-right" />
        <CornerMarker position="bottom-left" />
        <CornerMarker position="bottom-right" />

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-film-900/35 bg-film-900/8">
            <span className="text-3xl font-thin text-film-900/45">+</span>
          </div>
          <div>
            <p className="font-sans text-[11px] uppercase tracking-[0.24em] text-film-500">
              capture today
            </p>
            <p className="mt-2 font-serif text-xl text-film-900">
              Save the small scene before it disappears.
            </p>
          </div>
        </div>
      </m.button>

      <div className="flex items-center justify-center gap-8 py-6">
        <m.button
          type="button"
          disabled={disabled}
          onClick={() => libraryInputRef.current?.click()}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-abyss-700 bg-abyss-900/75 hover:border-film-700 transition-colors duration-200 disabled:pointer-events-none"
          {...tapMotionProps}
        >
          <Image className="h-5 w-5 text-film-700" strokeWidth={1.5} />
        </m.button>

        <m.button
          type="button"
          disabled={disabled}
          onClick={() => cameraInputRef.current?.click()}
          className="flex h-20 w-20 items-center justify-center rounded-full border-[2px] border-film-900 bg-abyss-900/65 shadow-[0_0_0_8px_rgba(255,255,255,0.02)] disabled:pointer-events-none"
          {...tapMotionProps}
        >
          <div className="h-16 w-16 bg-film-900 rounded-full" />
        </m.button>

        <div className="h-10 w-10" />
      </div>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        ref={cameraInputRef}
        onChange={(event) => {
          onFilesSelected(event.target.files, 'camera');
          event.target.value = '';
        }}
      />

      <input
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        data-testid="home-library-input"
        ref={libraryInputRef}
        onChange={(event) => {
          onFilesSelected(event.target.files, 'library');
          event.target.value = '';
        }}
      />
    </>
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
