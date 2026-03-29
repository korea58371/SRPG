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
  // --- 무력 계통 (Martial) ---
  power: number;        // 힘 (개인 물리 공격력 및 타격 계수)
  agility: number;      // 민첩 (기동성, 턴 보정, 회피율)
  dexterity: number;    // 기술 (명중률, 치명타 확률, 무기 스킬 위력)
  constitution: number; // 체력 (개인 순수 HP 기반 및 지구력)
  magic: number;        // 마력 (마법 공격력, 최대 MP)
  toughness: number;    // 방어 (개인 피해 감소 및 물리적 맷집)
  
  // --- 지휘 계통 (Command) ---
  command: number;      // 지휘력 (전술 지휘: 부대 공격력, 치명타, 스킬 데미지, 진형 보너스)
  leadership: number;   // 통솔력 (조직 장악: 최대 병력수 캡, 부대 방어력/HP, 사기 유지)

  // --- 정신 및 내정 계통 (Mental & Civil) ---
  intelligence: number; // 지력 (계략, 전투 스킬 보조, 전장 속임수)
  politics: number;     // 정치 (영지 개발, 내정 보너스, 자원 펌핑)
  charm: number;        // 매력 (외교, 협상, 무장 등용 성공률, 부대 사기)
}

// UI용 통합 스탯 (다각형 레이더 차트) 등 식별에 사용하는 타입
export type CompositeStatType = 'Martial' | 'Command' | 'Leadership' | 'Scheme' | 'Politics' | 'Charm';

export interface Character {
  id: string;
  name: string;
  portraitUrl?: string;  // 포트레이트 이미지 URL (없으면 컬러 아바타 폴백)
  description?: string;  // 인물 열전 (개인 스토리 배경 설정)

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
