import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithRoutes } from '../test/test-utils';
import { useStore } from '../lib/store';

vi.mock('../lib/route-preloaders', () => ({
  preloadJournalViewPage: vi.fn(),
}));

import { CalendarDayPopover } from './calendar-day-popover';

function CalendarPopoverHarness() {
  return (
    <>
      <button
        type="button"
        onClick={() =>
          useStore.getState().setCalendarPopover({
            date: '2026-03-22',
            label: 'March 22',
            hasJournal: true,
            preview: 'A calm archive preview.',
            photoUrl: null,
            anchorRect: {
              top: 120,
              left: 64,
              width: 48,
              height: 48,
            },
          })
        }
      >
        open popover
      </button>
      <CalendarDayPopover />
    </>
  );
}

describe('CalendarDayPopover', () => {
  it('closes on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup();

    renderWithRoutes([{ path: '/', element: <CalendarPopoverHarness /> }], {
      initialEntries: ['/'],
    });

    const trigger = screen.getByRole('button', { name: /open popover/i });
    await user.click(trigger);

    const dialog = await screen.findByRole('dialog', {
      name: /journal preview for march 22/i,
    });
    expect(dialog).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /close day snapshot/i })).toHaveFocus();
    });

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });
});
