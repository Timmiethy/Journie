import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useStore } from '../lib/store';

const defaultStoreState = {
  userId: null as string | null,
  displayName: null as string | null,
  isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  todayMomentsDate: null as string | null,
  todayMoments: [],
  currentAura: '#F2A46D',
  calendarPopover: null,
};

export function resetAppStore() {
  useStore.setState(defaultStoreState);
}

export function renderWithRoutes(
  routes: Array<{ path: string; element: ReactNode }>,
  options: { initialEntries?: string[] } = {},
) {
  return render(
    <MemoryRouter
      initialEntries={options.initialEntries}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        {routes.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}
      </Routes>
    </MemoryRouter>,
  );
}

export function renderRoute(
  path: string,
  element: ReactNode,
  options: { initialEntries?: string[] } = {},
) {
  return renderWithRoutes([{ path, element }], {
    initialEntries: options.initialEntries ?? [path],
  });
}

export function createJsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

export function createTextResponse(body: string, init: ResponseInit = {}) {
  return new Response(body, {
    status: init.status ?? 200,
    headers: init.headers,
  });
}
