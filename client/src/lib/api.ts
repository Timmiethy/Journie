import type { JournalEntry, Persona, MomentWithPhotos } from '../types';
import { supabase } from './supabase';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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

type TranscriptionResponse = {
  transcript: string;
};

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return { Authorization: `Bearer ${session.access_token}` };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isMultipart = false,
): Promise<T> {
  const headers = await getAuthHeader();
  const config: RequestInit = { method, headers };

  if (body !== undefined) {
    if (isMultipart) {
      config.body = body as FormData;
    } else {
      headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(body);
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, config);

  if (res.status === 401) {
    await supabase.auth.signOut();
    window.location.href = '/auth';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `Request failed: ${res.status}`);
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
      return request<JournalEntry[]>('GET', `/journals${qs.size ? `?${qs.toString()}` : ''}`);
    },
  },
};
