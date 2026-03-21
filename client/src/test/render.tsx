import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

type RouterRenderOptions = RenderOptions & {
  initialEntries?: string[];
};

export function renderWithRouter(
  ui: ReactElement,
  { initialEntries = ['/'], ...options }: RouterRenderOptions = {},
) {
  return render(
    (
      <MemoryRouter
        initialEntries={initialEntries}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        {ui}
      </MemoryRouter>
    ),
    options,
  );
}

export function renderWithProviders(ui: ReactNode, options?: RenderOptions) {
  return render(<>{ui}</>, options);
}
