// J:/AI/Game/SRPG/src/data/characters/hero_004.ts
// 이리나 솔렌 — 재야 인재 (등용 대상)

import type { Character } from '../../types/characterTypes';

export const IRINA: Character = {
  id: 'hero_004',
  name: '이리나 솔렌',
  factionId: null,
  state: 'FreeAgent',
  locationProvinceId: null,
  birthYear: 1990, lifespan: 65, lifespanBonus: 0,
  loyalty: 0,
  relationships: {},
  baseStats: {
    power: 25,
    toughness: 28,
    constitution: 65,
    agility: 9,
    command: 62,
    leadership: 60,
    intelligence: 100,
    politics: 75,
    charm: 80, dexterity: 50, magic: 50,
  },
  traits: [],
  equipment: [],
  skills: ['mock-pull', 'mock-heal'],
  troopType: null,
  troopCount: 0,
};
