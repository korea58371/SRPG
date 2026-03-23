// J:/AI/Game/SRPG/src/constants/gameConfig.ts

import { TerrainType } from '../types/gameTypes';

// 맵 및 타일 관련 설정
export const MAP_CONFIG = {
  TILE_SIZE: 40,
  WIDTH: 50,
  HEIGHT: 30,
  NOISE_SCALE: 15,
};

// 유닛 설정
export const UNIT_CONFIG = {
  INITIAL_SPAWN_COUNT: 150,
  HERO_UNIT_COUNT: 5,
  BASE_SPEED_MIN: 1,
  BASE_SPEED_MAX: 2,
  SIZE_NORMAL: { width: 20, height: 28 },
  SIZE_HERO: { width: 28, height: 36 },
};

// 구름 / 환경 연출 설정
export const ENVIRONMENT_CONFIG = {
  CLOUD_SPEED_X: 1.2,
  CLOUD_SPEED_Y: 0.6,
  CLOUD_BOUNDS: { startX: -1500, startY: -1000, endX: 2500 },
  CLOUD_IMG_OPACITY: 0.25,
};

// ============================================
// 전투 및 시스템 데이터 속성 (기획 반영)
// ============================================

export const FACTIONS = {
  western_empire: { id: 'western_empire', name: '서양 판타지 제국', color: 0x3b82f6 }, // 파란색 계열
  eastern_alliance: { id: 'eastern_alliance', name: '동양 연합국', color: 0xef4444 },   // 붉은색 계열
  neutral: { id: 'neutral', name: '중립/몬스터', color: 0x22c55e },                // 초록색 계열
};

// 지형 특수 효과: 방어력 증감(%), 타일 이동시 소비되는 페널티 수치 비율
export const TERRAIN_BONUS = {
  [TerrainType.GRASS]: { defenseMod: 0, moveCost: 1.0 },
  [TerrainType.CLIFF]: { defenseMod: 0.3, moveCost: 3.0 }, // 방어 30% 증가, 이동비용 3배
  [TerrainType.PATH]:  { defenseMod: -0.1, moveCost: 0.5 },// 방어 -10% 하락, 이동속도 2배 버프
  [TerrainType.BEACH]: { defenseMod: -0.2, moveCost: 1.5 },
  [TerrainType.SEA]:   { defenseMod: -0.5, moveCost: 99.0 },// 사실상 진입 불가
};

// 병종간 극한 상성 (가위바위보): 데미지 가중치 적용 (%)
export const UNIT_MATCHUPS = {
  INFANTRY: { advantage: 'SPEARMAN', disadvantage: 'CAVALRY', bonus: 0.3 },
  SPEARMAN: { advantage: 'CAVALRY', disadvantage: 'INFANTRY', bonus: 0.5 },
  CAVALRY: { advantage: 'INFANTRY', disadvantage: 'SPEARMAN', bonus: 0.3 },
  ARCHER: { advantage: 'NONE', disadvantage: 'NONE', bonus: 0 },
};

export const BASE_STATS = {
  INFANTRY: { hp: 100, attack: 15, defense: 10, speed: 2 },
  SPEARMAN: { hp: 120, attack: 12, defense: 15, speed: 1.5 },
  CAVALRY:  { hp: 80,  attack: 20, defense: 8,  speed: 3 },
  ARCHER:   { hp: 60,  attack: 18, defense: 5,  speed: 2 },
};
