import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createJsonResponse, createTextResponse } from '../test/test-utils';

const clearUser = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());
const getAccessTokenOrThrow = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock('./auth-session', () => ({
  getAccessTokenOrThrow,
}));

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      signOut,
    },
  },
}));

vi.mock('./store', () => ({
  useStore: {
    getState: () => ({
      clearUser,
    }),
  },
}));

vi.stubGlobal('fetch', fetchMock);

import { api } from './api';

describe('api', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    getAccessTokenOrThrow.mockResolvedValue('test-token');
    signOut.mockResolvedValue(undefined);
    clearUser.mockReset();
    fetchMock.mockResolvedValue(createJsonResponse({ ok: true }));
  });

  it('injects the bearer token and JSON body for regular requests', async () => {
    await api.journal.generate('2026-03-22', true, ['a', 'b']);

    expect(getAccessTokenOrThrow).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/journal/generate',
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal),
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: '2026-03-22',
          regenerate: true,
          momentIds: ['a', 'b'],
        }),
      }),
    );
  });

  it('keeps multipart bodies untouched and omits the JSON content type', async () => {
    const form = new FormData();
    form.append('photos', new Blob(['photo'], { type: 'image/png' }), 'photo.png');

    await api.moments.create(form);

    const [, config] = fetchMock.mock.calls[0];
    expect(config).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: form,
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
    expect((config as RequestInit).headers).not.toHaveProperty('Content-Type');
  });

  it('returns undefined for empty 204 responses', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(api.moments.delete('moment-1')).resolves.toBeUndefined();
  });

  it('returns undefined for empty 200 responses', async () => {
    fetchMock.mockResolvedValueOnce(createTextResponse('', { status: 200 }));

    await expect(api.persona.get()).resolves.toBeUndefined();
  });

  it('parses api errors with the server payload', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ error: 'Nope' }, { status: 500 }));

    await expect(api.persona.get()).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Nope',
      status: 500,
    });
  });

  it('signs out and clears the store on 401', async () => {
    fetchMock.mockResolvedValueOnce(createTextResponse('', { status: 401, statusText: 'Unauthorized' }));
    window.history.replaceState(null, '', '/journal/2026-03-22');

    await expect(api.persona.get()).rejects.toThrow('Session expired');
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(clearUser).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe('/auth');
  });

  it('aborts requests that exceed the timeout budget', async () => {
    vi.useFakeTimers();

    fetchMock.mockImplementation(
      (_url, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          const abortHandler = () => {
            reject(new DOMException('Aborted', 'AbortError'));
          };

          const signal = init?.signal;
          signal?.addEventListener('abort', abortHandler, { once: true });
        }),
    );

    const handledPromise = api.persona.get().catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(30000);

    const error = await handledPromise;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Something went wrong.');
  });
});
