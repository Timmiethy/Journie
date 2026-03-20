import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, Mic, Square } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useStore, AURA_COLOR } from '../lib/store';
import { compressImage, todayISO } from '../lib/utils';
import type { Mood } from '../types';

const MOODS: { value: Mood; label: string }[] = [
  { value: 'great', label: 'great' },
  { value: 'good', label: 'good' },
  { value: 'neutral', label: 'okay' },
  { value: 'low', label: 'low' },
  { value: 'rough', label: 'rough' },
];

export function MomentDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const stateFiles = (location.state as { files?: File[] } | null)?.files ?? [];

  const [step, setStep] = useState<'review' | 'context'>('review');
  const [files, setFiles] = useState<File[]>(stateFiles);
  const [previews, setPreviews] = useState<string[]>([]);
  const [mood, setMood] = useState<Mood | null>(null);
  const [text, setText] = useState('');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Voice recording state
  const [recording, setRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addMoreRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Generate previews
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [text]);

  // Redirect if no files
  useEffect(() => {
    if (stateFiles.length === 0) navigate('/home', { replace: true });
  }, [stateFiles.length, navigate]);

  const removeFile = (idx: number) => {
    setFiles((f) => f.filter((_, i) => i !== idx));
  };

  const handleAddMore = async (fileList: FileList | null) => {
    if (!fileList) return;
    const compressed = await Promise.all(Array.from(fileList).map(compressImage));
    setFiles((f) => [...f, ...compressed]);
  };

  // ─── Voice recording ───

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([blob], 'voice.webm', { type: 'audio/webm' });
        const form = new FormData();
        form.append('audio', audioFile);

        try {
          const result = await api.transcribe.audio(form);
          const transcriptText = result.transcript;
          setTranscript(transcriptText);
          setText((prev) => (prev ? `${prev} ${transcriptText}` : transcriptText));
        } catch {
          toast.error("couldn't transcribe audio");
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordDuration(0);
      timerRef.current = setInterval(() => setRecordDuration((d) => d + 1), 1000);
    } catch {
      toast.error('microphone access denied');
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // ─── Save ───

  const handleSave = async () => {
    setSaving(true);
    try {
      const compressed = await Promise.all(files.map(compressImage));
      const form = new FormData();
      compressed.forEach((f) => form.append('photos', f));
      if (text.trim()) form.append('text_context', text.trim());
      if (transcript) form.append('voice_transcript', transcript);
      if (mood) form.append('mood', mood);
      form.append('captured_at', new Date().toISOString());
      form.append('day_date', todayISO());

      const result = await api.moments.create(form);
      useStore.getState().addMoment(result);
      navigate('/home', { replace: true });
    } catch {
      toast.error("couldn't save moment — try again");
    } finally {
      setSaving(false);
    }
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ─── Photo grid ───

  function renderPhotoGrid() {
    const count = previews.length;
    if (count === 0) return null;

    if (count === 1) {
      return (
        <div className="relative">
          <img src={previews[0]} alt="" className="w-full aspect-[4/3] object-cover rounded-none" />
          <RemoveBtn onClick={() => removeFile(0)} />
        </div>
      );
    }

    if (count === 2) {
      return (
        <div className="grid grid-cols-2 gap-1">
          {previews.map((p, i) => (
            <div key={i} className="relative">
              <img src={p} alt="" className="aspect-square object-cover w-full rounded-none" />
              <RemoveBtn onClick={() => removeFile(i)} />
            </div>
          ))}
        </div>
      );
    }

    if (count === 3) {
      return (
        <div className="space-y-1">
          <div className="relative">
            <img src={previews[0]} alt="" className="w-full aspect-[16/9] object-cover rounded-none" />
            <RemoveBtn onClick={() => removeFile(0)} />
          </div>
          <div className="grid grid-cols-2 gap-1">
            {previews.slice(1).map((p, i) => (
              <div key={i + 1} className="relative">
                <img src={p} alt="" className="aspect-square object-cover w-full rounded-none" />
                <RemoveBtn onClick={() => removeFile(i + 1)} />
              </div>
            ))}
          </div>
        </div>
      );
    }

    // 4+
    return (
      <div className="grid grid-cols-2 gap-1">
        {previews.map((p, i) => (
          <div key={i} className="relative">
            <img src={p} alt="" className="aspect-square object-cover w-full rounded-none" />
            <RemoveBtn onClick={() => removeFile(i)} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-abyss-900/95 backdrop-blur-2xl flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-6 pt-6 pb-4">
        <button onClick={() => navigate('/home', { replace: true })}>
          <X className="h-5 w-5 text-film-700 cursor-pointer hover:text-film-900 transition-colors" />
        </button>
        <span className="font-sans text-xs text-film-500 mx-auto">
          {step === 'review' ? 'review' : 'context'}
        </span>
        <div className="w-5" />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {step === 'review' ? (
          /* ─── Step 4a: Photo Review ─── */
          <div className="px-6 pb-6">
            {renderPhotoGrid()}

            <button
              onClick={() => addMoreRef.current?.click()}
              className="font-sans text-sm text-film-700 underline underline-offset-4 text-center py-4 hover:text-film-900 transition-colors w-full"
            >
              add more photos
            </button>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              ref={addMoreRef}
              onChange={(e) => {
                handleAddMore(e.target.files);
                e.target.value = '';
              }}
            />

            <button
              disabled={files.length === 0}
              onClick={() => setStep('context')}
              className="w-full bg-film-900 text-abyss-900 font-sans font-bold text-sm uppercase tracking-widest py-4 rounded-none hover:bg-film-700 active:scale-[0.98] transition-all duration-200 disabled:bg-abyss-700 disabled:text-film-500 disabled:cursor-not-allowed mt-2"
            >
              next
            </button>
          </div>
        ) : (
          /* ─── Step 4b: Context & Mood ─── */
          <div className="pb-6">
            {/* Mood selector */}
            <p className="font-sans text-xs uppercase tracking-widest text-film-500 mb-4 px-6">
              how does this feel?
            </p>
            <div className="flex items-center justify-between px-8 py-4">
              {MOODS.map((m) => {
                const selected = mood === m.value;
                const color = AURA_COLOR[m.value];
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMood(mood === m.value ? null : m.value)}
                    className="flex flex-col items-center gap-2 cursor-pointer"
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
                      } as React.CSSProperties}
                    />
                    <span className="font-sans text-[10px] text-film-500 uppercase tracking-wide">
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Text input */}
            <div className="px-6 mt-4">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="what's happening?"
                rows={1}
                className="w-full bg-transparent border-b border-abyss-600 py-3 text-film-900 font-serif text-xl placeholder:text-film-500 focus:outline-none focus:border-film-700 transition-colors duration-200 resize-none"
              />
            </div>

            {/* Voice recorder */}
            <div className="flex items-center gap-3 px-6 mt-4">
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                className={`h-11 w-11 border rounded-full flex items-center justify-center transition-all duration-200 ${
                  recording
                    ? 'bg-aura-rough/20 border-aura-rough'
                    : 'border-abyss-600 hover:border-film-700'
                }`}
              >
                {recording ? (
                  <Square className="h-4 w-4 text-aura-rough" />
                ) : (
                  <Mic className="h-5 w-5 text-film-700" strokeWidth={1.5} />
                )}
              </button>
              {recording && (
                <span className="font-sans text-xs text-aura-rough tabular-nums">
                  {formatDuration(recordDuration)}
                </span>
              )}
            </div>

            {/* Save button */}
            <div className="px-6 mt-8">
              <button
                disabled={saving}
                onClick={handleSave}
                className="w-full bg-film-900 text-abyss-900 font-sans font-bold text-sm uppercase tracking-widest py-4 rounded-none hover:bg-film-700 active:scale-[0.98] transition-all duration-200 disabled:bg-abyss-700 disabled:text-film-500 disabled:cursor-not-allowed"
              >
                {saving ? 'saving...' : 'save moment'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Remove button overlay ───

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="absolute top-1 right-1 h-6 w-6 bg-abyss-900/80 rounded-full flex items-center justify-center hover:bg-abyss-900 transition-colors"
    >
      <X className="h-3 w-3 text-film-900" />
    </button>
  );
}



