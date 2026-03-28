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
    hp: 45,
    strength: 15,
    intelligence: 110,
    politics: 60,
    charisma: 85,
    speed: 10,
  },
  traits: [],
  equipment: [],
  skills: ['fireball', 'heal'], // 기존 존재하는 스킬 중 마법 계열 부여
  troopType: 'ARCHER', // 현재 UnitType에 MAGE가 없으므로 ARCHER(원거리)로 임시 대체
  troopCount: 0,
};
