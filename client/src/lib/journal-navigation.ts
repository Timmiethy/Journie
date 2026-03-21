import type { JournalEntry } from '../types';

export type JournalRouteSource = 'timeline' | 'history' | 'home' | 'direct';

export interface JournalRouteState {
  optimisticGenerating?: boolean;
  source?: JournalRouteSource;
}

export interface JournalDestination {
  to: string;
  label: string;
}

export function createJournalRouteState(
  source: JournalRouteSource,
  state: Omit<JournalRouteState, 'source'> = {},
): JournalRouteState {
  return {
    ...state,
    source,
  };
}

export function getJournalRouteState(state: unknown): Required<JournalRouteState> {
  const routeState = (state as JournalRouteState | null) ?? null;

  return {
    optimisticGenerating: Boolean(routeState?.optimisticGenerating),
    source: routeState?.source ?? 'direct',
  };
}

export function getJournalHeaderDestination(
  source: JournalRouteSource,
  status: JournalEntry['status'],
): JournalDestination {
  if (status === 'draft' && source === 'timeline') {
    return { to: '/timeline', label: 'timeline' };
  }

  if (source === 'history') {
    return { to: '/journals', label: 'archive' };
  }

  return { to: '/home', label: 'home' };
}

export function getJournalPrimaryDestination(): JournalDestination {
  return { to: '/home', label: 'back home' };
}

export function getJournalSecondaryDestination(
  source: JournalRouteSource,
  status: JournalEntry['status'],
): JournalDestination | null {
  if (status === 'draft' && source === 'timeline') {
    return { to: '/timeline', label: 'back to timeline' };
  }

  if (source === 'history') {
    return { to: '/journals', label: 'archive' };
  }

  return null;
}
