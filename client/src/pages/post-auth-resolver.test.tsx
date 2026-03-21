import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRoutes } from '../test/test-utils';

const getSessionWithRetry = vi.hoisted(() => vi.fn());
const personaGet = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock('../lib/auth-session', () => ({
  getSessionWithRetry,
}));

vi.mock('../lib/api', () => ({
  api: {
    persona: {
      get: personaGet,
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: toastError,
  },
}));

import { PostAuthResolverPage } from './post-auth-resolver';

describe('PostAuthResolverPage', () => {
  beforeEach(() => {
    getSessionWithRetry.mockReset();
    personaGet.mockReset();
    toastError.mockReset();
  });

  it('keeps the authenticated session and retries after transient persona fetch failures', async () => {
    getSessionWithRetry.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        user_metadata: { display_name: 'Journie Tester' },
      },
    });
    personaGet
      .mockRejectedValueOnce(new Error('Temporary upstream issue'))
      .mockResolvedValueOnce({ id: 'persona-1' });

    renderWithRoutes(
      [
        { path: '/auth/resolver', element: <PostAuthResolverPage /> },
        { path: '/auth', element: <h1>auth</h1> },
        { path: '/home', element: <h1>home</h1> },
        { path: '/onboarding', element: <h1>onboarding</h1> },
      ],
      { initialEntries: ['/auth/resolver'] },
    );

    expect(await screen.findByRole('button', { name: /try again/i })).toBeVisible();
    expect(screen.queryByRole('heading', { name: /auth/i })).not.toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith('Temporary upstream issue');

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByRole('heading', { name: /home/i })).toBeVisible();
  });
});
