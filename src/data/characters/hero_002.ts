// J:/AI/Game/SRPG/src/data/characters/hero_002.ts
// 베네딕트 — 플레이어 세력 소속

import type { Character } from '../../types/characterTypes';
import { PLAYER_FACTION } from '../../constants/gameConfig';

export const BENEDICT: Character = {
  id: 'hero_002',
  name: '베네딕트',
  factionId: PLAYER_FACTION,
  state: 'Factioned',
  locationProvinceId: null,
  birthYear: 1985, lifespan: 60, lifespanBonus: 5,
  loyalty: 85,
  relationships: { 'hero_001': 50 },
  baseStats: {
    hp: 70,
    strength: 30,
    intelligence: 95,
    politics: 80,
    charisma: 70,
    speed: 8,
  },
  traits: [],
  equipment: [],
  skills: ['heal'],
  troopType: 'ARCHER',
  troopCount: 300,
};
