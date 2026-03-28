// J:/AI/Game/SRPG/src/data/characters/hero_003.ts
// 가브리엘 바르트 — 재야 인재 (등용 대상)

import type { Character } from '../../types/characterTypes';

export const GABRIEL: Character = {
  id: 'hero_003',
  name: '가브리엘 바르트',
  factionId: null,
  state: 'FreeAgent',
  locationProvinceId: null,
  birthYear: 1978, lifespan: 70, lifespanBonus: 0,
  loyalty: 0,
  relationships: {},
  baseStats: {
    hp: 90,
    strength: 70,
    intelligence: 60,
    politics: 40,
    charisma: 75,
    speed: 10,
  },
  traits: [],
  equipment: [],
  skills: ['cleave'],
  troopType: 'CAVALRY',
  troopCount: 0,
};
