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
    power: 70,
    toughness: 57,
    constitution: 90,
    agility: 10,
    command: 65,
    leadership: 75,
    intelligence: 60,
    politics: 40,
    charm: 80, dexterity: 50, magic: 50,
  },
  traits: [],
  equipment: [],
  skills: ['mock-cone', 'mock-buff-atk'],
  troopType: 'CAVALRY',
  troopCount: 0,
};
