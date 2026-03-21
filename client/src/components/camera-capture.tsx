import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Camera, ImagePlus, RefreshCw, VideoOff } from 'lucide-react';
import { m } from 'framer-motion';
import { CAPTURE_MORPH_LAYOUT_ID, tapMotionProps } from '../lib/motion';
import { preloadJournalHistoryPage } from '../lib/route-preloaders';
import { ActionButton } from './ui/action-button';

type CameraStatus = 'loading' | 'ready' | 'denied' | 'unsupported' | 'error';

interface CameraCaptureProps {
  disabled?: boolean;
  queueCount: number;
  onCapture: (file: File) => void;
  onLibrarySelected: (files: File[]) => void;
  onOpenJournal: () => void;
}

export function CameraCapture({
  disabled = false,
  queueCount,
  onCapture,
  onLibrarySelected,
  onOpenJournal,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('loading');
  const [statusMessage, setStatusMessage] = useState('Requesting camera access...');
  const [showFlash, setShowFlash] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (disabled) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('unsupported');
      setStatusMessage('This browser does not expose a live camera. You can still import from your library.');
      return;
    }

    setCameraStatus('loading');
    setStatusMessage('Requesting camera access...');

    try {
      stopStream();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1440 },
          height: { ideal: 1440 },
          aspectRatio: { ideal: 1 },
        },
      });

      const video = videoRef.current;
      if (!video) {
        stopStream();
        return;
      }

      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      setCameraStatus('ready');
      setStatusMessage('Camera ready');
    } catch (error) {
      const isPermissionError =
        error instanceof DOMException &&
        (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError');

      setCameraStatus(isPermissionError ? 'denied' : 'error');
      setStatusMessage(
        isPermissionError
          ? 'Camera access was denied. You can retry or import from your library.'
          : 'The live camera could not start. You can retry or import from your library.',
      );
      stopStream();
    }
  }, [disabled, stopStream]);

  useEffect(() => {
    void startCamera();

    return () => {
      stopStream();
    };
  }, [startCamera, stopStream]);

  const captureFrame = useCallback(async () => {
    if (disabled || !videoRef.current) {
      return;
    }

    const video = videoRef.current;
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;

    if (!sourceWidth || !sourceHeight) {
      setStatusMessage('The camera is still warming up. Try again in a second.');
      return;
    }

    const cropSize = Math.min(sourceWidth, sourceHeight);
    const cropX = Math.round((sourceWidth - cropSize) / 2);
    const cropY = Math.round((sourceHeight - cropSize) / 2);
    const outputSize = Math.min(cropSize, 1280);
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;

    const context = canvas.getContext('2d');
    if (!context) {
      setStatusMessage('The browser could not capture this frame.');
      return;
    }

    context.drawImage(
      video,
      cropX,
      cropY,
      cropSize,
      cropSize,
      0,
      0,
      outputSize,
      outputSize,
    );

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.92);
    });

    if (!blob) {
      setStatusMessage('The capture did not finish correctly. Try again.');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    onCapture(new File([blob], `journie-capture-${timestamp}.jpg`, { type: 'image/jpeg' }));
    setShowFlash(true);
    window.setTimeout(() => setShowFlash(false), 180);
  }, [disabled, onCapture]);

  return (
    <>
      <div className="px-4 sm:px-6">
        <m.div
          layoutId={CAPTURE_MORPH_LAYOUT_ID}
          data-testid="capture-morph"
          className="relative overflow-hidden rounded-[28px] border border-white/8 bg-abyss-900/80 shadow-[0_24px_60px_rgba(0,0,0,0.28)] sm:rounded-[32px]"
        >
          <div className="relative aspect-square w-full overflow-hidden">
            {showFlash ? (
              <div className="pointer-events-none absolute inset-0 z-30 bg-white/70" />
            ) : null}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              data-testid="camera-video"
              className={`h-full w-full object-cover transition-opacity duration-300 ${
                cameraStatus === 'ready' ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {cameraStatus === 'ready' ? (
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_34%),linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.28)_100%)]" />
            ) : (
              <div
                data-testid="camera-fallback"
                className="absolute inset-0 flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top,rgba(242,164,109,0.14),transparent_34%),linear-gradient(180deg,rgba(141,184,178,0.08),rgba(5,5,5,0.94))] px-8 text-center"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
                  {cameraStatus === 'loading' ? (
                    <RefreshCw className="h-7 w-7 animate-spin text-film-700" strokeWidth={1.4} />
                  ) : (
                    <VideoOff className="h-7 w-7 text-film-700" strokeWidth={1.4} />
                  )}
                </div>
                <p className="mt-6 font-sans text-[11px] uppercase tracking-[0.26em] text-film-500">
                  live capture
                </p>
                <p className="mt-3 max-w-[18rem] font-sans text-xl font-medium leading-tight text-film-900 sm:text-2xl">
                  {cameraStatus === 'loading'
                    ? 'Bringing the camera online.'
                    : 'The live camera is not available right now.'}
                </p>
                <p className="mt-3 max-w-[20rem] font-sans text-sm leading-6 text-film-700">
                  {statusMessage}
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  {cameraStatus !== 'loading' ? (
                    <ActionButton
                      type="button"
                      variant="glass"
                      size="sm"
                      onClick={() => void startCamera()}
                      data-testid="camera-permission-retry"
                    >
                      retry camera
                    </ActionButton>
                  ) : null}
                  <ActionButton
                    type="button"
                    variant="glass"
                    size="sm"
                    onClick={() => libraryInputRef.current?.click()}
                  >
                    import photos
                  </ActionButton>
                </div>
              </div>
            )}

            {queueCount > 0 ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-end px-4 py-4 sm:px-5 sm:py-5">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 font-sans text-[10px] uppercase tracking-[0.22em] text-film-500 backdrop-blur-sm">
                  {queueCount === 1 ? '1 queued' : `${queueCount} queued`}
                </span>
              </div>
            ) : null}
          </div>
        </m.div>
      </div>

      <div className="px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="flex items-center justify-center gap-6 sm:gap-7">
          <ActionButton
            type="button"
            variant="glass"
            size="icon"
            disabled={disabled}
            onClick={() => libraryInputRef.current?.click()}
            aria-label="Import photos"
            data-testid="camera-import-button"
          >
            <ImagePlus className="h-5 w-5" strokeWidth={1.6} />
          </ActionButton>

          <m.button
            type="button"
            disabled={disabled || cameraStatus !== 'ready'}
            onClick={() => void captureFrame()}
            aria-label="Capture photo"
            className="relative flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-full border border-white/10 bg-abyss-900/80 shadow-[0_0_0_10px_rgba(255,255,255,0.04)] disabled:cursor-not-allowed disabled:opacity-50 sm:h-24 sm:w-24"
            {...tapMotionProps}
          >
            <div className="absolute inset-3 rounded-full border border-white/25" />
            <div className="flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full bg-film-900 text-abyss-900 sm:h-14 sm:w-14">
              <Camera className="h-6 w-6" strokeWidth={1.7} />
            </div>
          </m.button>

          <ActionButton
            type="button"
            variant="glass"
            size="icon"
            disabled={disabled}
            onClick={onOpenJournal}
            onMouseEnter={() => void preloadJournalHistoryPage()}
            onFocus={() => void preloadJournalHistoryPage()}
            aria-label="Journal"
            data-testid="camera-journal-button"
          >
            <BookOpen className="h-5 w-5" strokeWidth={1.6} />
          </ActionButton>
        </div>
      </div>

      <input
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        data-testid="home-library-input"
        ref={libraryInputRef}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          onLibrarySelected(files);
          event.target.value = '';
        }}
      />
    </>
  );
}
