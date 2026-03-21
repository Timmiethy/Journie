import { screen } from '@testing-library/react';
import { format, subDays } from 'date-fns';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRoutes } from '../test/test-utils';
import { useStore } from '../lib/store';
import type { MomentWithPhotos } from '../types';
import { todayISO } from '../lib/utils';

const listMoments = vi.hoisted(() => vi.fn());

vi.mock('../lib/api', () => ({
  api: {
    moments: {
      list: listMoments,
      delete: vi.fn(),
      reorder: vi.fn(),
    },
    journal: {
      generate: vi.fn(),
    },
  },
}));

vi.mock('../components/timeline-list', () => ({
  TimelineList: ({ items }: { items: MomentWithPhotos[] }) => (
    <div data-testid="timeline-list">{items.length}</div>
  ),
}));

import { TimelinePage } from './timeline';

function createMoment(id: string, dayDate: string): MomentWithPhotos {
  const timestamp = `${dayDate}T08:00:00.000Z`;

  return {
    id,
    user_id: 'user-1',
    day_date: dayDate,
    order_index: 0,
    text_context: null,
    voice_transcript: null,
    mood: 'good',
    captured_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    photos: [],
  };
}

describe('TimelinePage', () => {
  beforeEach(() => {
    listMoments.mockReset();
  });

  it('ignores yesterday cache and refetches the current day', async () => {
    const currentDate = todayISO();
    const staleDate = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const staleMoment = createMoment('stale', staleDate);
    const freshMoment = createMoment('fresh', currentDate);

    useStore.getState().setTodayMoments(staleDate, [staleMoment]);
    listMoments.mockResolvedValue([freshMoment]);

    renderWithRoutes([{ path: '/timeline', element: <TimelinePage /> }], {
      initialEntries: ['/timeline'],
    });

    expect(await screen.findByTestId('timeline-list')).toHaveTextContent('1');
    expect(listMoments).toHaveBeenCalledWith(currentDate);
    expect(screen.getByTestId('timeline-list')).toHaveTextContent('1');
  });
});
