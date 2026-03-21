import { screen } from '@testing-library/react';
import { format, subMonths } from 'date-fns';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRoutes } from '../test/test-utils';
import type { JournalListEntry } from '../lib/api';

const journalList = vi.hoisted(() => vi.fn());

vi.mock('../lib/api', () => ({
  api: {
    journal: {
      list: journalList,
    },
  },
}));

import { JournalHistoryPage } from './journal-history';

function createJournalEntry(dayDate: string, content: string): JournalListEntry {
  const timestamp = `${dayDate}T12:00:00.000Z`;

  return {
    id: `journal-${dayDate}`,
    user_id: 'user-1',
    day_date: dayDate,
    content,
    generated_content: content,
    status: 'confirmed',
    entry_type: 'daily',
    daily_achievement: null,
    best_photo_url: null,
    generated_at: timestamp,
    confirmed_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    first_photo_url: null,
  };
}

describe('JournalHistoryPage', () => {
  beforeEach(() => {
    journalList.mockReset();
  });

  it('loads recent journals independently of the month cache', async () => {
    const recentEntry = createJournalEntry(
      format(subMonths(new Date(), 3), 'yyyy-MM-dd'),
      'Older confirmed journal preview.',
    );
    journalList.mockImplementation(async (params?: { limit?: number }) => {
      if (params?.limit === 8) {
        return [recentEntry];
      }

      return [];
    });

    renderWithRoutes([{ path: '/journals', element: <JournalHistoryPage /> }], {
      initialEntries: ['/journals'],
    });

    expect(await screen.findByRole('button', { name: new RegExp(format(new Date(`${recentEntry.day_date}T12:00:00`), 'MMMM d'), 'i') })).toBeVisible();
    expect(journalList.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        limit: 8,
        status: 'confirmed',
      }),
    );
  });
});
