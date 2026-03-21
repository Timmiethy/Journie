import { AURA_COLOR, useStore } from '../lib/store';

export function resetStoreState() {
  useStore.setState({
    userId: null,
    displayName: null,
    isOnline: true,
    todayMomentsDate: null,
    todayMoments: [],
    currentAura: AURA_COLOR.good,
    calendarPopover: null,
  });
}
