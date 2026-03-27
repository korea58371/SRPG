// J:/AI/Game/SRPG/src/store/slices/campaignSlice.ts
// [수정] domainCities, updateCityDevelopment 제거 (CampaignSlice에서 City 참조 완전 제거)

import type { StoreSlice, CampaignSlice, PhaseType } from './storeTypes';
import type { FactionId } from '../../types/gameTypes';

export const createCampaignSlice: StoreSlice<CampaignSlice> = (set) => ({
  year: 1,
  month: 1,
  currentPhase: 'STRATEGY',
  playerFactionId: null,

  advanceTime: (months = 1) =>
    set((state) => {
      let newMonth = state.month + months;
      let newYear = state.year;
      while (newMonth > 12) { newMonth -= 12; newYear += 1; }
      return { year: newYear, month: newMonth };
    }),

  setPhase: (phase: PhaseType) => set({ currentPhase: phase }),
  setPlayerFaction: (factionId: FactionId) => set({ playerFactionId: factionId }),
});
