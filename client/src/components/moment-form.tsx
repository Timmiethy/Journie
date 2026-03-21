import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Mic, Square, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { tapMotionProps } from '../lib/motion';
import { useStore, AURA_COLOR } from '../lib/store';
import { compressImage, todayISO } from '../lib/utils';
import { ActionButton, TextButton } from './ui/action-button';
import type { MomentWithPhotos, Mood } from '../types';

const MOODS: { value: Mood; label: string }[] = [
  { value: 'great', label: 'great' },
  { value: 'good', label: 'good' },
  { value: 'neutral', label: 'okay' },
  { value: 'low', label: 'low' },
  { value: 'rough', label: 'rough' },
];

interface MomentFormProps {
  initialFiles: File[];
  onClose: () => void;
  onFilesChange?: (files: File[]) => void;
  onSaved?: (moment: MomentWithPhotos) => void;
}

export function MomentForm({
  initialFiles,
  onClose,
  onFilesChange,
  onSaved,
}: MomentFormProps) {
  const [step, setStep] = useState<'review' | 'context'>('review');
  const [files, setFiles] = useState<File[]>(initialFiles);
  const [previews, setPreviews] = useState<string[]>([]);
  const [mood, setMood] = useState<Mood | null>(null);
  const [text, setText] = useState('');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const isOnline = useStore((state) => state.isOnline);

  const [recording, setRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const filesRef = useRef<File[]>(initialFiles);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addMoreRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setFiles(initialFiles);
    filesRef.current = initialFiles;
    setStep('review');
    setMood(null);
    setText('');
    setTranscript(null);
    setSaving(false);
    setUploadFailed(false);
    setRecording(false);
    setRecordDuration(0);
  }, [initialFiles]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    filesRef.current = files;

    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);

  useEffect(() => {
    if (files.length === 0) {
      onClose();
    }
  }, [files.length, onClose]);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;

    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 120)}px`;
  }, [text]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setRecording(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([blob], 'voice.webm', { type: 'audio/webm' });
        const form = new FormData();
        form.append('audio', audioFile);

        try {
          const result = await api.transcribe.audio(form);
          setTranscript(result.transcript);
          setText((current) => (current ? `${current} ${result.transcript}` : result.transcript));
        } catch (error: unknown) {
          toast.error(error instanceof Error ? error.message : "couldn't transcribe audio");
        }
      };

      recorder.start();
      setRecording(true);
      setRecordDuration(0);
      timerRef.current = setInterval(() => {
        setRecordDuration((duration) => duration + 1);
      }, 1000);
    } catch {
      toast.error('microphone access denied');
    }
  }, []);

  const handleAddMore = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return;

    try {
      const compressed = await Promise.all(Array.from(fileList).map(compressImage));
      const nextFiles = [...filesRef.current, ...compressed];
      setFiles(nextFiles);
      onFilesChange?.(nextFiles);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'failed to prepare photos');
    }
  }, [onFilesChange]);

  const handleSave = useCallback(async () => {
    if (!isOnline) return;

    setSaving(true);
    setUploadFailed(false);

    try {
      const compressed = await Promise.all(files.map(compressImage));
      const form = new FormData();

      compressed.forEach((file) => form.append('photos', file));
      if (text.trim()) form.append('text_context', text.trim());
      if (transcript) form.append('voice_transcript', transcript);
      if (mood) form.append('mood', mood);
      form.append('captured_at', new Date().toISOString());
      form.append('day_date', todayISO());

      const result = await api.moments.create(form);
      useStore.getState().addMoment(result);
      onSaved?.(result);
    } catch (error: unknown) {
      setUploadFailed(true);
      toast.error(error instanceof Error ? error.message : "couldn't save moment — try again");
    } finally {
      setSaving(false);
    }
  }, [files, isOnline, mood, onSaved, text, transcript]);

  if (files.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-4 px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4">
        <motion.button
          type="button"
          onClick={onClose}
          aria-label="Close moment form"
          {...tapMotionProps}
        >
          <X className="h-5 w-5 text-film-700 cursor-pointer hover:text-film-900 transition-colors" />
        </motion.button>
        <span className="font-sans text-xs text-film-500 mx-auto">
          {step === 'review' ? 'review' : 'context'}
        </span>
        <div className="w-5" />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {step === 'review' ? (
          <div className="px-4 pb-5 sm:px-6 sm:pb-6">
            <PhotoGrid
              previews={previews}
              uploadFailed={uploadFailed}
              onRemove={(index) => {
                const nextFiles = filesRef.current.filter((_, fileIndex) => fileIndex !== index);
                setFiles(nextFiles);
                onFilesChange?.(nextFiles);
              }}
            />

            <div className="py-2 text-center">
              <TextButton type="button" onClick={() => addMoreRef.current?.click()}>
                add more photos
              </TextButton>
            </div>

            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              data-testid="moment-add-more-input"
              ref={addMoreRef}
              onChange={(event) => {
                handleAddMore(event.target.files);
                event.target.value = '';
              }}
            />

            <ActionButton
              type="button"
              disabled={files.length === 0}
              onClick={() => setStep('context')}
              className="mt-2 w-full"
            >
              next
            </ActionButton>
          </div>
        ) : (
          <div className="pb-5 sm:pb-6">
            <p className="mb-3 px-4 font-sans text-[11px] uppercase tracking-widest text-film-500 sm:mb-4 sm:px-6">
              how does this feel?
            </p>
            <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
              {MOODS.map((currentMood) => {
                const selected = mood === currentMood.value;
                const color = AURA_COLOR[currentMood.value];

                return (
                  <motion.button
                    key={currentMood.value}
                    type="button"
                    onClick={() =>
                      setMood(mood === currentMood.value ? null : currentMood.value)
                    }
                    className="flex flex-col items-center gap-2 cursor-pointer"
                    {...tapMotionProps}
                  >
                    <div
                      className={`h-6 w-6 rounded-full transition-all duration-200 ${
                        selected
                          ? 'scale-125 shadow-glow'
                          : 'opacity-40 hover:opacity-70'
                      }`}
                      style={{
                        backgroundColor: color,
                        '--tw-shadow-color': selected ? `${color}80` : undefined,
                      } as CSSProperties}
                    />
                    <span className="font-sans text-[10px] text-film-500 uppercase tracking-wide">
                      {currentMood.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>

            <div className="mt-3 px-4 sm:mt-4 sm:px-6">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="what's happening?"
                rows={1}
                className="w-full resize-none border-b border-abyss-600 bg-transparent py-2.5 font-sans text-base text-film-900 placeholder:text-film-500 transition-colors duration-200 focus:border-film-700 focus:outline-none sm:text-lg"
              />
            </div>

            <div className="mt-3 flex items-center gap-3 px-4 sm:mt-4 sm:px-6">
              <div className="relative h-11 w-11">
                {recording && (
                  <motion.div
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-aura-rough"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                )}
                <motion.button
                  type="button"
                  onClick={recording ? stopRecording : startRecording}
                  className={`relative z-10 h-11 w-11 border rounded-full flex items-center justify-center ${
                    recording
                      ? 'bg-aura-rough/20 border-aura-rough'
                      : 'border-abyss-600 hover:border-film-700'
                  }`}
                  {...tapMotionProps}
                >
                  {recording ? (
                    <Square className="h-4 w-4 text-aura-rough" />
                  ) : (
                    <Mic className="h-5 w-5 text-film-700" strokeWidth={1.5} />
                  )}
                </motion.button>
              </div>

              {recording && (
                <span className="font-sans text-xs text-aura-rough tabular-nums">
                  {formatDuration(recordDuration)}
                </span>
              )}
            </div>

            <div className="mt-6 px-4 sm:mt-8 sm:px-6">
              <ActionButton
                type="button"
                disabled={saving || !isOnline}
                onClick={handleSave}
                className="w-full"
              >
                {saving ? 'saving...' : 'save moment'}
              </ActionButton>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

interface PhotoGridProps {
  previews: string[];
  uploadFailed: boolean;
  onRemove: (index: number) => void;
}

function PhotoGrid({
  previews,
  uploadFailed,
  onRemove,
}: PhotoGridProps) {
  if (previews.length === 0) {
    return null;
  }

  if (previews.length === 1) {
    return (
      <div className="relative">
        <img src={previews[0]} alt="" className="w-full aspect-[4/3] object-cover rounded-none" />
        {uploadFailed && <UploadRetryOverlay />}
        <RemoveButton onClick={() => onRemove(0)} ariaLabel="Remove photo 1" />
      </div>
    );
  }

  if (previews.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-1">
        {previews.map((preview, index) => (
          <div key={preview} className="relative">
            <img src={preview} alt="" className="aspect-square object-cover w-full rounded-none" />
            {uploadFailed && <UploadRetryOverlay />}
            <RemoveButton onClick={() => onRemove(index)} ariaLabel={`Remove photo ${index + 1}`} />
          </div>
        ))}
      </div>
    );
  }

  if (previews.length === 3) {
    return (
      <div className="space-y-1">
        <div className="relative">
          <img src={previews[0]} alt="" className="w-full aspect-[16/9] object-cover rounded-none" />
          {uploadFailed && <UploadRetryOverlay />}
          <RemoveButton onClick={() => onRemove(0)} ariaLabel="Remove photo 1" />
        </div>
        <div className="grid grid-cols-2 gap-1">
          {previews.slice(1).map((preview, index) => (
            <div key={preview} className="relative">
              <img src={preview} alt="" className="aspect-square object-cover w-full rounded-none" />
              {uploadFailed && <UploadRetryOverlay />}
              <RemoveButton onClick={() => onRemove(index + 1)} ariaLabel={`Remove photo ${index + 2}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-1">
      {previews.map((preview, index) => (
        <div key={`${preview}-${index}`} className="relative">
          <img src={preview} alt="" className="aspect-square object-cover w-full rounded-none" />
          {uploadFailed && <UploadRetryOverlay />}
          <RemoveButton onClick={() => onRemove(index)} ariaLabel={`Remove photo ${index + 1}`} />
        </div>
      ))}
    </div>
  );
}

function RemoveButton({
  onClick,
  ariaLabel,
}: {
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={ariaLabel}
      className="absolute top-1 right-1 h-6 w-6 bg-abyss-900/80 rounded-full flex items-center justify-center hover:bg-abyss-900 transition-colors"
      {...tapMotionProps}
    >
      <X className="h-3 w-3 text-film-900" />
    </motion.button>
  );
}

function UploadRetryOverlay() {
  return (
    <div className="absolute inset-0 bg-abyss-900/65 flex items-center justify-center px-3 text-center">
      <span className="font-sans text-[10px] uppercase tracking-wider text-film-900">
        upload failed, tap save to retry
      </span>
    </div>
  );
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
