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
    power: 85,
    toughness: 72,
    constitution: 120,
    agility: 10,
    command: 52,
    leadership: 50,
    intelligence: 20,
    politics: 30,
    charm: 80, dexterity: 50, magic: 50,
  },
  traits: [],
  equipment: [],
  skills: ['mock-aoe-heal'],
  troopType: 'SPEARMAN',
  troopCount: 400,
};
