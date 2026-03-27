// J:/AI/Game/SRPG/src/types/characterTypes.ts

import type { FactionId, BuffType, UnitType } from './gameTypes';

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

// 캐릭터 1차 기본 스탯 (모든 계산의 원천)
// 전장 Unit 스탯, 내정 패시브 모두 이 값에서 동적 계산됨
export interface CharacterBaseStats {
  hp: number;           // 생존력 (Unit HP 기여)
  strength: number;     // 무력  → 부대 공격력 가중, 장수 직접 전투력
  intelligence: number; // 지력  → 부대 방어/마법 가중, 스킬 효과 계수
  politics: number;     // 정치  → 내정 자원 생산 보너스 (%)
  charisma: number;     // 통솔  → 최대 편제 병력, 치안 보너스, 징병 효율
  speed: number;        // 속도  → 전장 행동 순서 (CT 시스템)
}

export interface Character {
  id: string;
  name: string;
  portraitUrl?: string;  // 포트레이트 이미지 URL (없으면 컬러 아바타 폴백)

  // ─ 신분 및 세력 ──────────────────────────────────────────────────
  state: CharacterState;
  factionId: FactionId | null; // 소속 세력. FreeAgent/Undiscovered는 null
  locationProvinceId: string | null; // 현재 배속된 영지 ID (전략 레이어)

  // ─ 생애 ───────────────────────────────────────────────────────────
  birthYear: number;
  lifespan: number;        // 기본 수명 (ex: 60)
  lifespanBonus: number;   // 특수 이벤트로 증가하는 수명 범퍼
  loyalty: number;         // 충성도 0~100

  // 인물 간 호감도. Key: 타 캐릭터 ID, Value: 호감도 수치
  relationships: Record<string, number>;

  // ─ 1차 스탯 (단일 진실 공급원) ────────────────────────────────────
  baseStats: CharacterBaseStats;

  // ─ 특성/스킬/장비 ─────────────────────────────────────────────────
  traits: CharacterTrait[];
  skills: string[];          // 스킬 ID 목록
  equipment: Equipment[];

  // ─ 부대 편제 (전략 레이어) ─────────────────────────────────────────
  troopType: UnitType | null; // 편제된 병종 (null = 단독/미편제)
  troopCount: number;         // 현재 편제 병력 수
  // maxTroopCount는 calcMaxTroopCount(char)로 동적 계산 (charisma 기반)

  // ─ 2세대 관련 ─────────────────────────────────────────────────────
  parents?: [string, string]; // [부, 모] 캐릭터 ID
}
