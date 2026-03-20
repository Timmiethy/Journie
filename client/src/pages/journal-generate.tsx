import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { JournalEntry } from '../types';

const MESSAGES = [
  'Processing film...',
  'Connecting moments...',
  'Writing the script...',
  'Almost there.',
];

const CYCLE_MS = 3000;
const POLL_MS = 2000;
const TIMEOUT_MS = 60000;

export function JournalGeneratePage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();

  const [msgIdx, setMsgIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const cycleRef = useRef<ReturnType<typeof setInterval>>();
  const startTime = useRef(Date.now());

  // ─── Message cycling ───

  useEffect(() => {
    cycleRef.current = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMsgIdx((prev) => {
          // Hold on last message
          if (prev >= MESSAGES.length - 1) return prev;
          return prev + 1;
        });
        setVisible(true);
      }, 700);
    }, CYCLE_MS);

    return () => {
      if (cycleRef.current) clearInterval(cycleRef.current);
    };
  }, []);

  // ─── Polling ───

  const startPolling = useCallback(() => {
    startTime.current = Date.now();
    setError(false);

    pollRef.current = setInterval(async () => {
      if (!date) return;

      // Timeout check
      if (Date.now() - startTime.current > TIMEOUT_MS) {
        if (pollRef.current) clearInterval(pollRef.current);
        setError(true);
        return;
      }

      try {
        const journal = (await api.journal.get(date)) as JournalEntry;
        if (journal.status === 'draft' || journal.status === 'confirmed') {
          if (pollRef.current) clearInterval(pollRef.current);
          if (cycleRef.current) clearInterval(cycleRef.current);
          setDone(true);

          // Fade out, then navigate
          setVisible(false);
          setTimeout(() => {
            navigate(`/journal/${date}`, { replace: true });
          }, 500);
        }
      } catch {
        // Journal not ready yet, keep polling
      }
    }, POLL_MS);
  }, [date, navigate]);

  useEffect(() => {
    startPolling();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [startPolling]);

  // ─── Retry ───

  const handleRetry = async () => {
    if (!date) return;
    setRetrying(true);
    setError(false);
    setMsgIdx(0);
    setVisible(true);

    try {
      await api.journal.generate(date, true);
      startPolling();
    } catch {
      setError(true);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="min-h-screen bg-abyss-900 flex flex-col items-center justify-center px-6">
      {!error ? (
        <>
          <p
            className={`font-serif italic text-film-700 text-lg text-center transition-opacity duration-700 ${
              visible && !done ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {MESSAGES[msgIdx]}
          </p>

          {/* Blinking cursor */}
          <div
            className={`w-0.5 h-5 bg-film-900 mx-auto mt-4 transition-opacity duration-500 ${
              done ? 'opacity-0' : 'animate-cursor-blink'
            }`}
          />
        </>
      ) : (
        <div className="text-center">
          <p className="font-sans text-sm text-aura-rough mt-6">
            something went wrong.
          </p>
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="font-sans text-sm text-film-700 underline underline-offset-4 mt-3 hover:text-film-900 transition-colors disabled:opacity-50"
          >
            {retrying ? 'retrying...' : 'try again'}
          </button>
        </div>
      )}
    </div>
  );
}
