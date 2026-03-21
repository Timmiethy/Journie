import { describe, expect, it } from 'vitest';
import {
  createJournalRouteState,
  getJournalHeaderDestination,
  getJournalPrimaryDestination,
  getJournalRouteState,
  getJournalSecondaryDestination,
} from './journal-navigation';

describe('journal navigation helpers', () => {
  it('preserves route metadata when creating and reading state', () => {
    const state = createJournalRouteState('timeline', { optimisticGenerating: true });

    expect(state).toEqual({
      source: 'timeline',
      optimisticGenerating: true,
    });
    expect(getJournalRouteState(state)).toEqual({
      source: 'timeline',
      optimisticGenerating: true,
    });
  });

  it('defaults unknown state to a direct journal route', () => {
    expect(getJournalRouteState(null)).toEqual({
      source: 'direct',
      optimisticGenerating: false,
    });
  });

  it('routes draft timeline journals back to the timeline', () => {
    expect(getJournalHeaderDestination('timeline', 'draft')).toEqual({
      to: '/timeline',
      label: 'timeline',
    });
    expect(getJournalSecondaryDestination('timeline', 'draft')).toEqual({
      to: '/timeline',
      label: 'back to timeline',
    });
  });

  it('routes history entries back to the archive', () => {
    expect(getJournalHeaderDestination('history', 'confirmed')).toEqual({
      to: '/journals',
      label: 'archive',
    });
    expect(getJournalSecondaryDestination('history', 'confirmed')).toEqual({
      to: '/journals',
      label: 'archive',
    });
    expect(getJournalPrimaryDestination()).toEqual({
      to: '/home',
      label: 'back home',
    });
  });
});
