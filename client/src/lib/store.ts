import { create } from 'zustand';
import type { MomentWithPhotos, Mood } from '../types';

export interface CalendarPopoverState {
  date: string;
  label: string;
  hasJournal: boolean;
  preview: string;
  photoUrl: string | null;
  anchorRect: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export const AURA_COLOR: Record<Mood, string> = {
  great: '#63DDB6',
  good: '#F2A46D',
  neutral: '#8DB8B2',
  low: '#7D94BC',
  rough: '#E56E72',
};

const DEFAULT_AURA = '#F2A46D';

function getAuraFromMoments(moments: MomentWithPhotos[]): string {
  const lastMoment = moments[moments.length - 1];
  const mood = lastMoment?.mood ?? null;
  return mood ? AURA_COLOR[mood] : DEFAULT_AURA;
}

interface AppState {
  userId: string | null;
  displayName: string | null;
  setUser: (id: string, name: string) => void;
  clearUser: () => void;
  isOnline: boolean;
  setOnlineStatus: (isOnline: boolean) => void;
  todayMomentsDate: string | null;
  todayMoments: MomentWithPhotos[];
  setTodayMoments: (date: string, moments: MomentWithPhotos[]) => void;
  addMoment: (date: string, moment: MomentWithPhotos) => void;
  removeMoment: (date: string, id: string) => void;
  currentAura: string;
  updateAura: (moments: MomentWithPhotos[]) => void;
  calendarPopover: CalendarPopoverState | null;
  setCalendarPopover: (popover: CalendarPopoverState) => void;
  clearCalendarPopover: () => void;
}

export function getTodayMomentsForDate(
  state: Pick<AppState, 'todayMomentsDate' | 'todayMoments'>,
  date: string,
) {
  return state.todayMomentsDate === date ? state.todayMoments : [];
}

export const useStore = create<AppState>((set) => ({
  userId: null,
  displayName: null,
  setUser: (id, name) => set({ userId: id, displayName: name }),
  clearUser: () =>
    set({
      userId: null,
      displayName: null,
      todayMomentsDate: null,
      todayMoments: [],
      currentAura: DEFAULT_AURA,
      calendarPopover: null,
    }),
  isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  setOnlineStatus: (isOnline) => set({ isOnline }),
  todayMomentsDate: null,
  todayMoments: [],
  setTodayMoments: (date, moments) =>
    set({
      todayMomentsDate: date,
      todayMoments: moments,
      currentAura: getAuraFromMoments(moments),
    }),
  addMoment: (date, moment) =>
    set((state) => {
      if (state.todayMomentsDate !== date) {
        return {
          todayMomentsDate: date,
          todayMoments: [moment],
          currentAura: getAuraFromMoments([moment]),
        };
      }

      const updated = [...state.todayMoments, moment];
      return {
        todayMomentsDate: date,
        todayMoments: updated,
        currentAura: getAuraFromMoments(updated),
      };
    }),
  removeMoment: (date, id) =>
    set((state) => {
      if (state.todayMomentsDate !== date) {
        return state;
      }

      const updated = state.todayMoments.filter((moment) => moment.id !== id);
      return {
        todayMomentsDate: date,
        todayMoments: updated,
        currentAura: getAuraFromMoments(updated),
      };
    }),
  currentAura: DEFAULT_AURA,
  updateAura: (moments) => set({ currentAura: getAuraFromMoments(moments) }),
  calendarPopover: null,
  setCalendarPopover: (calendarPopover) => set({ calendarPopover }),
  clearCalendarPopover: () => set({ calendarPopover: null }),
}));
