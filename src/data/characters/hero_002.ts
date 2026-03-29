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
    power: 30,
    toughness: 32,
    constitution: 70,
    agility: 8,
    command: 62,
    leadership: 70,
    intelligence: 95,
    politics: 80,
    charm: 80, dexterity: 50, magic: 50,
  },
  traits: [],
  equipment: [],
  skills: ['mock-teleport-react', 'mock-nova'],
  troopType: 'ARCHER',
  troopCount: 300,
};
