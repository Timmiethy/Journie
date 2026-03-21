import { screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderWithRoutes } from '../test/test-utils';
import { createJournalEntry, createMoment } from '../test/fixtures';

const signInWithPassword = vi.hoisted(() => vi.fn());
const signUp = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());
const listMoments = vi.hoisted(() => vi.fn());
const getJournal = vi.hoisted(() => vi.fn());
const listJournals = vi.hoisted(() => vi.fn());

vi.mock('../lib/api', () => ({
  api: {
    persona: {
      create: vi.fn(),
      get: vi.fn(),
    },
    moments: {
      list: listMoments,
      create: vi.fn(),
      delete: vi.fn(),
      reorder: vi.fn(),
    },
    journal: {
      generate: vi.fn(),
      get: getJournal,
      update: vi.fn(),
      list: listJournals,
    },
    transcribe: {
      audio: vi.fn(),
    },
  },
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword,
      signOut,
      signUp,
    },
  },
}));

vi.mock('../components/camera-capture', () => ({
  CameraCapture: ({ onOpenJournal }: { onOpenJournal: () => void }) => (
    <div>
      <button type="button" onClick={onOpenJournal}>
        journal
      </button>
    </div>
  ),
}));

vi.mock('../lib/route-preloaders', () => ({
  preloadJournalViewPage: vi.fn(),
  preloadTimelinePage: vi.fn(),
}));

import { AuthPage } from './auth';
import { HomePage } from './home';
import { JournalHistoryPage } from './journal-history';
import { JournalViewPage } from './journal-view';

describe('route accessibility', () => {
  beforeEach(() => {
    signInWithPassword.mockReset();
    signUp.mockReset();
    signOut.mockReset();
    listMoments.mockReset();
    getJournal.mockReset();
    listJournals.mockReset();
  });

  it('auth route has no obvious accessibility violations', async () => {
    const { container } = renderWithRoutes([{ path: '/auth', element: <AuthPage /> }], {
      initialEntries: ['/auth'],
    });

    await screen.findByRole('heading', { name: /journie/i });
    expect((await axe(container)).violations).toEqual([]);
  });

  it('home route has no obvious accessibility violations in the empty state', async () => {
    listMoments.mockResolvedValue([]);

    const { container } = renderWithRoutes([{ path: '/home', element: <HomePage /> }], {
      initialEntries: ['/home'],
    });

    await waitFor(() => {
      expect(listMoments).toHaveBeenCalled();
    });
    await screen.findByTestId('home-activity-sheet');
    expect((await axe(container)).violations).toEqual([]);
  });

  it('journal route has no obvious accessibility violations in the draft state', async () => {
    listMoments.mockResolvedValue([createMoment()]);
    getJournal.mockResolvedValue(createJournalEntry());

    const { container } = renderWithRoutes(
      [{ path: '/journal/:date', element: <JournalViewPage /> }],
      {
        initialEntries: ['/journal/2026-03-22'],
      },
    );

    await screen.findByRole('button', { name: /confirm & save/i });
    expect((await axe(container)).violations).toEqual([]);
  });

  it('archive route has no obvious accessibility violations for recent entries', async () => {
    const recentEntry = createJournalEntry({
      id: 'archive-entry',
      day_date: '2026-02-14',
      content: 'Archive preview copy.',
    });

    listJournals.mockImplementation(async (params?: { limit?: number }) => {
      if (params?.limit === 8) {
        return [recentEntry];
      }

      return [];
    });

    const { container } = renderWithRoutes([{ path: '/journals', element: <JournalHistoryPage /> }], {
      initialEntries: ['/journals'],
    });

    await screen.findByRole('button', { name: /february 14/i });
    expect((await axe(container)).violations).toEqual([]);
  });
});
