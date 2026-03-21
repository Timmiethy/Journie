import { describe, expect, it } from 'vitest';
import { getTodayMomentsForDate, useStore } from './store';
import type { MomentWithPhotos } from '../types';

function createMoment(id: string, mood: MomentWithPhotos['mood'] = 'good'): MomentWithPhotos {
  const timestamp = '2026-03-22T08:00:00.000Z';

  return {
    id,
    user_id: 'user-1',
    day_date: '2026-03-22',
    order_index: 0,
    text_context: null,
    voice_transcript: null,
    mood,
    captured_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    photos: [],
  };
}

describe('useStore today moments guard', () => {
  it('hides cached moments when the date does not match', () => {
    const moment = createMoment('moment-1');
    useStore.getState().setTodayMoments('2026-03-21', [moment]);

    expect(getTodayMomentsForDate(useStore.getState(), '2026-03-21')).toEqual([moment]);
    expect(getTodayMomentsForDate(useStore.getState(), '2026-03-22')).toEqual([]);
    expect(useStore.getState().todayMomentsDate).toBe('2026-03-21');
  });

  it('replaces the stale cache when a new day writes in fresh moments', () => {
    const staleMoment = createMoment('stale', 'rough');
    const freshMoment = createMoment('fresh', 'great');

    useStore.getState().setTodayMoments('2026-03-21', [staleMoment]);
    useStore.getState().addMoment('2026-03-22', freshMoment);

    expect(useStore.getState().todayMomentsDate).toBe('2026-03-22');
    expect(useStore.getState().todayMoments).toEqual([freshMoment]);
    expect(useStore.getState().currentAura).toBe('#63DDB6');
  });

  it('ignores removals for a different day', () => {
    const moment = createMoment('moment-1');

    useStore.getState().setTodayMoments('2026-03-22', [moment]);
    useStore.getState().removeMoment('2026-03-21', 'moment-1');

    expect(useStore.getState().todayMoments).toEqual([moment]);
    expect(useStore.getState().todayMomentsDate).toBe('2026-03-22');
  });
});
