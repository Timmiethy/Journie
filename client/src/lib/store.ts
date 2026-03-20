import { create } from 'zustand';
import type { MomentWithPhotos } from '../types';
import type { User } from '@supabase/supabase-js';

interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;

  todayMoments: MomentWithPhotos[];
  setTodayMoments: (moments: MomentWithPhotos[]) => void;
  addMoment: (moment: MomentWithPhotos) => void;
  removeMoment: (id: string) => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),

  todayMoments: [],
  setTodayMoments: (moments) => set({ todayMoments: moments }),
  addMoment: (moment) =>
    set((state) => ({ todayMoments: [...state.todayMoments, moment] })),
  removeMoment: (id) =>
    set((state) => ({
      todayMoments: state.todayMoments.filter((m) => m.id !== id),
    })),
}));
