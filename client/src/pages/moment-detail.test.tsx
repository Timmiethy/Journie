import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithRoutes } from '../test/test-utils';

vi.mock('../components/moment-form', () => ({
  MomentForm: () => <div data-testid="moment-form" />,
}));

import { MomentDetailPage } from './moment-detail';

describe('MomentDetailPage', () => {
  it('redirects stale direct entries back home without rendering the form', async () => {
    renderWithRoutes(
      [
        { path: '/moments/new', element: <MomentDetailPage /> },
        { path: '/home', element: <h1>home</h1> },
      ],
      { initialEntries: ['/moments/new'] },
    );

    expect(await screen.findByRole('heading', { name: /home/i })).toBeVisible();
    expect(screen.queryByTestId('moment-form')).not.toBeInTheDocument();
  });
});
