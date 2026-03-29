// J:/AI/Game/SRPG/src/data/characters/celia.ts
// 셀리아 — 고대 엘프 메이지 (재야 인재, 주인공과 이벤트 연동)

import type { Character } from '../../types/characterTypes';

export const CELIA: Character = {
  id: 'celia',
  name: '셀리아',
  factionId: null, // 초기에는 재야
  state: 'FreeAgent',
  locationProvinceId: null, // appStore.startGame()에서 할당됨
  birthYear: 1500, // 고대 엘프
  lifespan: 1000, 
  lifespanBonus: 0,
  loyalty: 0,
  relationships: {},
  baseStats: {
    power: 15,
    toughness: 18,
    constitution: 45,
    agility: 10,
    command: 62,
    leadership: 85,
    intelligence: 110,
    politics: 60,
    charm: 80, dexterity: 50, magic: 50,
  },
  traits: [],
  equipment: [],
  skills: ['mock-cone', 'mock-debuff-def'], // 마법 계열 스킬 부여
  troopType: 'ARCHER', // 현재 UnitType에 MAGE가 없으므로 ARCHER(원거리)로 임시 대체
  troopCount: 0,
};
