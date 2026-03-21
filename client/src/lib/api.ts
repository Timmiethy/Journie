import type { JournalEntry, Persona, MomentWithPhotos } from '../types';
import { supabase } from './supabase';
import { useStore } from './store';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const REQUEST_TIMEOUT_MS = 30000;
const AUTH_SESSION_RETRIES = 5;
const AUTH_SESSION_RETRY_MS = 100;

type JournalUpdate = {
  content?: string;
  status?: JournalEntry['status'];
};

type JournalListParams = {
  limit?: number;
  offset?: number;
  status?: JournalEntry['status'];
};

type GenerateJournalResponse = {
  journal_id?: string;
  status: string;
};

export type JournalListEntry = JournalEntry & {
  first_photo_url?: string | null;
};

type TranscriptionResponse = {
  transcript: string;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function getAuthHeader(): Promise<Record<string, string>> {
  for (let attempt = 0; attempt < AUTH_SESSION_RETRIES; attempt += 1) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }

    if (attempt < AUTH_SESSION_RETRIES - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, AUTH_SESSION_RETRY_MS));
    }
  }

  throw new Error('Not authenticated');
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isMultipart = false,
): Promise<T> {
  const headers = await getAuthHeader();
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const config: RequestInit = { method, headers, signal: controller.signal };

  if (body !== undefined) {
    if (isMultipart) {
      config.body = body as FormData;
    } else {
      headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(body);
    }
  }

  let res: Response;

  try {
    res = await fetch(`${BASE_URL}${path}`, config);
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Something went wrong.');
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (res.status === 401) {
    await supabase.auth.signOut();
    useStore.getState().clearUser();
    window.location.href = '/auth';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(err.error ?? `Request failed: ${res.status}`, res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export const api = {
  persona: {
    create: (data: unknown) => request<Persona>('POST', '/persona', data),
    get: () => request<Persona | null>('GET', '/persona'),
  },

  moments: {
    list: (date: string) => request<MomentWithPhotos[]>('GET', `/moments?date=${date}`),
    create: (form: FormData) => request<MomentWithPhotos>('POST', '/moments', form, true),
    delete: (id: string) => request<void>('DELETE', `/moments/${id}`),
    reorder: (date: string, order: string[]) => request<void>('PATCH', '/moments/reorder', { date, order }),
  },

  transcribe: {
    audio: (form: FormData) => request<TranscriptionResponse>('POST', '/transcribe', form, true),
  },

  journal: {
    generate: (date: string, regenerate = false) =>
      request<GenerateJournalResponse>('POST', '/journal/generate', { date, regenerate }),
    get: (date: string) => request<JournalEntry>('GET', `/journal/${date}`),
    update: (date: string, body: JournalUpdate) => request<JournalEntry>('PATCH', `/journal/${date}`, body),
    list: (params?: JournalListParams) => {
      const qs = new URLSearchParams();
      if (params?.limit !== undefined) {
        qs.set('limit', String(params.limit));
      }
      if (params?.offset !== undefined) {
        qs.set('offset', String(params.offset));
      }
      if (params?.status) {
        qs.set('status', params.status);
      }
      return request<JournalListEntry[]>('GET', `/journals${qs.size ? `?${qs.toString()}` : ''}`);
    },
  },
};
