// J:/AI/Game/SRPG/src/data/characters/hero_101.ts
// 레드워드 — 적 세력(faction_02) 소속 장수

import type { Character } from '../../types/characterTypes';

export const REDWARD: Character = {
  id: 'hero_101',
  name: '적장 레드워드',
  factionId: 'faction_02',
  state: 'Factioned',
  locationProvinceId: null,
  birthYear: 1975, lifespan: 50, lifespanBonus: 0,
  loyalty: 100,
  relationships: {},
  baseStats: {
    hp: 120,
    strength: 85,
    intelligence: 20,
    politics: 30,
    charisma: 50,
    speed: 10,
  },
  traits: [],
  equipment: [],
  skills: ['cleave'],
  troopType: 'SPEARMAN',
  troopCount: 400,
};
