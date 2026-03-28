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
    hp: 65,
    strength: 25,
    intelligence: 100,
    politics: 75,
    charisma: 60,
    speed: 9,
  },
  traits: [],
  equipment: [],
  skills: ['heal'],
  troopType: null,
  troopCount: 0,
};
