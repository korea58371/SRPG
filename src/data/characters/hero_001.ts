// J:/AI/Game/SRPG/src/data/characters/hero_001.ts
// 아르토리우스 — 주인공 / 플레이어 세력 소속
// 이 파일만 수정하면 되며, appStore는 건드리지 않아도 됨

import type { Character } from '../../types/characterTypes';
import { PLAYER_FACTION } from '../../constants/gameConfig';

export const ARTORIOUS: Character = {
  id: 'hero_001',
  name: '아르토리우스',
  factionId: PLAYER_FACTION,
  state: 'Factioned',
  locationProvinceId: null, // startGame()에서 수도 ID로 자동 설정
  birthYear: 1980, lifespan: 80, lifespanBonus: 0,
  loyalty: 100,
  relationships: { 'hero_002': 50 },
  baseStats: {
    power: 80,
    toughness: 65,
    constitution: 100,
    agility: 12,
    command: 60,
    leadership: 90,
    intelligence: 40,
    politics: 50,
    charm: 80, dexterity: 50, magic: 50,
  },
  traits: [],
  equipment: [],
  skills: ['mock-cross', 'mock-regen'],
  troopType: 'INFANTRY',
  troopCount: 500,
};
