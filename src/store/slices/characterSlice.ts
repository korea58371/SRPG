import type { StoreSlice, CharacterSlice } from './storeTypes';
import type { Character } from '../../types/characterTypes';

const DUMMY_HEROES: Record<string, Character> = {
  'hero_001': {
    id: 'hero_001',
    name: '아르토리우스',
    factionId: 'faction_01',
    state: 'Factioned',
    locationCityId: 'prov_1',
    birthYear: 1980,
    lifespan: 80,
    lifespanBonus: 0,
    loyalty: 100,
    relationships: { 'hero_002': 50 },
    baseStats: { hp: 100, strength: 80, intelligence: 40, politics: 50, charisma: 90, speed: 12 },
    traits: [],
    equipment: [],
    skills: ['slash']
  },
  'hero_002': {
    id: 'hero_002',
    name: '베네딕트',
    factionId: 'faction_01',
    state: 'Factioned',
    locationCityId: 'prov_1',
    birthYear: 1985,
    lifespan: 60,
    lifespanBonus: 5,
    loyalty: 85,
    relationships: { 'hero_001': 50 },
    baseStats: { hp: 70, strength: 30, intelligence: 95, politics: 80, charisma: 70, speed: 8 },
    traits: [],
    equipment: [],
    skills: ['heal']
  },
  'hero_003': {
    id: 'hero_003',
    name: '적장 A',
    factionId: 'faction_02',
    state: 'Factioned',
    locationCityId: 'prov_5',
    birthYear: 1975,
    lifespan: 50,
    lifespanBonus: 0,
    loyalty: 50,
    relationships: {},
    baseStats: { hp: 120, strength: 85, intelligence: 20, politics: 30, charisma: 50, speed: 10 },
    traits: [],
    equipment: [],
    skills: ['cleave']
  }
};

export const createCharacterSlice: StoreSlice<CharacterSlice> = (set) => ({
  characters: DUMMY_HEROES, // 영웅/캐릭터 초기 데이터

  addCharacter: (char: Character) =>
    set((state) => ({
      characters: {
        ...state.characters,
        [char.id]: char,
      },
    })),

  updateCharacterState: (id: string, newState: Character['state']) =>
    set((state) => {
      const char = state.characters[id];
      if (!char) return {};
      return {
        characters: {
          ...state.characters,
          [id]: { ...char, state: newState },
        },
      };
    }),

  updateAffinity: (idA: string, idB: string, amount: number) =>
    set((state) => {
      const charA = state.characters[idA];
      const charB = state.characters[idB];
      if (!charA || !charB) return {};

      return {
        characters: {
          ...state.characters,
          [idA]: {
            ...charA,
            relationships: {
              ...charA.relationships,
              [idB]: (charA.relationships[idB] || 0) + amount,
            },
          },
          [idB]: {
            ...charB,
            relationships: {
              ...charB.relationships,
              [idA]: (charB.relationships[idA] || 0) + amount,
            },
          },
        },
      };
    }),

  killCharacter: (id: string) =>
    set((state) => {
      const char = state.characters[id];
      if (!char) return {};
      return {
        characters: {
          ...state.characters,
          [id]: { ...char, state: 'Dead' },
        },
      };
    }),
});
