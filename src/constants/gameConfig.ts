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
  INITIAL_SPAWN_COUNT: 40,       // 전체 병력 (PLAYER_COUNT + 적군)
  PLAYER_UNIT_COUNT: 10,        // 아군 (서양 제국)
  HERO_UNIT_COUNT: 3,           // 지휘관 (hisize+처리)
  BASE_SPEED_MIN: 2,
  BASE_SPEED_MAX: 3,
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
  [TerrainType.GRASS]: { defenseMod: 0,    moveCost: 1.0 },
  [TerrainType.CLIFF]: { defenseMod: 0,    moveCost: 99.0 }, // 절벽: 완전 이동 불가 (추후 병종별 확장 가능)
  [TerrainType.PATH]:  { defenseMod: -0.1, moveCost: 0.5 },  // 길: 이동 2배 가속
  [TerrainType.BEACH]: { defenseMod: -0.2, moveCost: 1.5 },
  [TerrainType.SEA]:   { defenseMod: -0.5, moveCost: 99.0 }, // 바다: 완전 이동 불가
};

// 병종간 극한 상성 (가위바위보): 데미지 가중치 적용 (%)
export const UNIT_MATCHUPS = {
  INFANTRY: { advantage: 'SPEARMAN', disadvantage: 'CAVALRY', bonus: 0.3 },
  SPEARMAN: { advantage: 'CAVALRY', disadvantage: 'INFANTRY', bonus: 0.5 },
  CAVALRY: { advantage: 'INFANTRY', disadvantage: 'SPEARMAN', bonus: 0.3 },
  ARCHER: { advantage: 'NONE', disadvantage: 'NONE', bonus: 0 },
};

export const BASE_STATS: Record<string, { hp: number; attack: number; defense: number; speed: number; attackRange: number }> = {
  INFANTRY: { hp: 100, attack: 15, defense: 10, speed: 2,   attackRange: 1 },
  SPEARMAN: { hp: 120, attack: 12, defense: 15, speed: 1.5, attackRange: 2 }, // 스피어: 사셀 2
  CAVALRY:  { hp: 80,  attack: 20, defense: 8,  speed: 3,   attackRange: 1 },
  ARCHER:   { hp: 60,  attack: 18, defense: 5,  speed: 2,   attackRange: 3 }, // 궁병: 사셠 3
};
