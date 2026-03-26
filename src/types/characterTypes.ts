// J:/AI/Game/SRPG/src/types/characterTypes.ts

import type { FactionId, BuffType } from './gameTypes';

export type CharacterState = 'Factioned' | 'FreeAgent' | 'Undiscovered' | 'Dead';

// 장수(영웅)의 특성(개성) (전장 효율, 내정 효율 등 포괄)
export interface CharacterTrait {
  id: string;
  name: string;
  description: string;
  type: 'Combat' | 'Strategy' | 'Aura';
  // 효과를 하드코딩하지 않고 데이터화 (모듈화)
  effectType: 'stat_boost' | 'resource_boost' | 'affinity_boost' | 'combat_buff';
  effectTarget?: 'self' | 'troop' | 'global';
  effectValue: number; 
  buffType?: BuffType; // combat_buff일 경우
}

// 착용 장비 / 아이템 (퇴각 보정 등)
export interface Equipment {
  id: string;
  name: string;
  type: 'Weapon' | 'Armor' | 'Accessory' | 'Mount';
  description: string;
  statBonus?: Partial<CharacterBaseStats>;
  guaranteedRetreat?: boolean; // 사망 무시하고 무조건 퇴각(부상) 가능성
}

// 캐릭터 기본 스탯 (이 스탯이 전투 시 Unit 스탯의 뼈대가 됨)
export interface CharacterBaseStats {
  hp: number;         // 체력 
  strength: number;   // 무력 (부대 물리 공격력 기반)
  intelligence: number;// 지력 (전략 특수, 부대 마법 방어력 및 마법 공격 기반)
  politics: number;   // 내정 관리에 이점 (자원 등)
  charisma: number;   // 통솔/매력 (부대 오라 반경, 등용 확률, 충성도 방어 기반)
  speed: number;      // 전투 이니셔티브 (턴제 속도)
}

// 대단위 국가/영지 시스템 확장, 향후 확장을 위해 id-name만 일단 정의
export interface City {
  id: string;
  name: string;
  ownerFactionId: FactionId | null; // null이면 중립이나 도적 점거
  developmentLevel: number; // 내정 발전도
}

export interface Character {
  id: string;
  name: string;
  
  // 신분 및 세력
  state: CharacterState;
  factionId: FactionId | null; // 소속 세력. FreeAgent와 Undiscovered는 대체로 null
  locationCityId: string | null; // 내정 페이즈 시 현재 머물고 있는 거점
  
  // 생명과 시간 (하이 판타지 수명)
  birthYear: number;
  lifespan: number;     // 기본 수명 (ex: 60)
  lifespanBonus: number;// 강해지거나 특정 이벤트로 증가하는 수명 범퍼
  
  // 내 상태 및 스탯
  baseStats: CharacterBaseStats;
  traits: CharacterTrait[]; 
  equipment: Equipment[];
  
  skills: string[]; // 스킬 ID 목록
  
  // 충성도 (0 ~ 100)
  loyalty: number; 
  
  // 인물 간 호감도 (상호작용 기반). Key는 다른 캐릭터 ID, Value는 호감도 수치.
  relationships: Record<string, number>; 
  
  // 2세대 관련
  parents?: [string, string];
}
