import type { StoreSlice, CampaignSlice, PhaseType } from './storeTypes';
import type { FactionId } from '../../types/gameTypes';

export const createCampaignSlice: StoreSlice<CampaignSlice> = (set) => ({
  year: 1, // 초기 년도 (판타지 세계관 기준)
  month: 1, 
  currentPhase: 'STRATEGY',
  playerFactionId: null,
  domainCities: {}, // 하드코딩 지양: 초기화는 외부 JSON 혹은 DB에서 로드하는 방식을 취한다.

  advanceTime: (months = 1) =>
    set((state) => {
      let newMonth = state.month + months;
      let newYear = state.year;
      while (newMonth > 12) {
        newMonth -= 12;
        newYear += 1;
      }
      return { year: newYear, month: newMonth };
    }),

  setPhase: (phase: PhaseType) => set({ currentPhase: phase }),

  setPlayerFaction: (factionId: FactionId) => set({ playerFactionId: factionId }),

  updateCityDevelopment: (cityId: string, amount: number) =>
    set((state) => {
      const city = state.domainCities[cityId];
      if (!city) return {};
      return {
        domainCities: {
          ...state.domainCities,
          [cityId]: {
            ...city,
            developmentLevel: city.developmentLevel + amount,
          },
        },
      };
    }),
});
