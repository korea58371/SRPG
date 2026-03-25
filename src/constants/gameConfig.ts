// J:/AI/Game/SRPG/src/constants/gameConfig.ts

import { TerrainType } from '../types/gameTypes';

// 맵 및 타일 관련 설정
export const MAP_CONFIG = {
  TILE_SIZE: 24,
  WIDTH: 60,
  HEIGHT: 60,
  NOISE_SCALE: 15,
};

// 맵 외곽을 안개(어둠)로 덮기 위한 거리/위험도 계산
export function getTileDarkness(x: number, y: number, w: number, h: number): number {
  const cx = w / 2;
  const cy = h / 2;
  // 중앙으로부터의 정규화된 절대 거리 (0 ~ 1)
  const nx = Math.abs(x - cx + 0.5) / cx;
  const ny = Math.abs(y - cy + 0.5) / cy;
  
  // 쿼터뷰(Isometric) 적용 시, 로지컬 그리드의 정사각형 둘레(Math.max)가 화면상 완벽한 중앙 대칭 정 마름모로 나타납니다.
  const dist = Math.max(nx, ny);
  
  // 거리가 0.6 이하인 중앙 뷰 영역은 이동 가능 구역(안개 0) - 가로/세로 기준 정확히 중심 60% 면적
  if (dist <= 0.6) return 0;
  
  // 0.6 부터 1.0(가장자리)까지 부드러운 그라데이션 안개
  // 단, 이동 한계 경계선을 확실히 인지할 수 있도록 0.6을 넘자마자 즉시 20%(0.2)의 불투명도를 부여합니다.
  const factor = 0.2 + ((dist - 0.6) / 0.4) * 0.8;
  return Math.min(1, factor);
}

// 안개가 시작되는 지점(darkness > 0)부터는 이동 불가 구역으로 취급
export function isPlayableTile(x: number, y: number, w: number, h: number): boolean {
  return getTileDarkness(x, y, w, h) === 0;
}

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

// 플레이어가 조종하는 기본 세력 ID
export const PLAYER_FACTION = 'faction_01';

// 군웅할거: 15개의 다중 세력 기반 메타데이터 (색상, 고유 명칭)
export const FACTIONS: Record<string, { id: string, name: string, color: number }> = {
  faction_01: { id: 'faction_01', name: '아스칼론 제국', color: 0x3b82f6 }, // 파랑
  faction_02: { id: 'faction_02', name: '신성 로마 제국', color: 0xef4444 }, // 빨강
  faction_03: { id: 'faction_03', name: '요르비키아 신국', color: 0x22c55e }, // 초록
  faction_04: { id: 'faction_04', name: '카른부르크 왕국', color: 0xeab308 }, // 노랑
  faction_05: { id: 'faction_05', name: '페니시아 연방', color: 0xa855f7 }, // 보라
  faction_06: { id: 'faction_06', name: '오리오노스 연방', color: 0x06b6d4 }, // 시안 (하늘)
  faction_07: { id: 'faction_07', name: '드래곤스파이어 공국', color: 0xf97316 }, // 주황
  faction_08: { id: 'faction_08', name: '수플론 제국', color: 0xec4899 }, // 핑크
  faction_09: { id: 'faction_09', name: '바르칸디아 왕국', color: 0x8b5cf6 }, // 청보라
  faction_10: { id: 'faction_10', name: '게스테벤 신권국', color: 0x14b8a6 }, // 청록
  faction_11: { id: 'faction_11', name: '폰티외브리 연방', color: 0x64748b }, // 슬레이트 (회파랑)
  faction_12: { id: 'faction_12', name: '디트마르센 공화국', color: 0xf43f5e }, // 로즈 (진홍)
  faction_13: { id: 'faction_13', name: '요크렌디아 왕국', color: 0x84cc16 }, // 라임 (연두)
  faction_14: { id: 'faction_14', name: '에스키스텐 연방', color: 0xd946ef }, // 푸시아 (자홍)
  faction_15: { id: 'faction_15', name: '순드가우비아 기사단', color: 0x6366f1 }, // 인디고 (남색)
};

// 지형 특수 효과: 방어력 증감(%), 타일 이동시 소비되는 페널티 수치 비율
export const TERRAIN_BONUS = {
  [TerrainType.GRASS]: { defenseMod: 0, moveCost: 1.0 },
  [TerrainType.CLIFF]: { defenseMod: 0, moveCost: 99.0 }, // 절벽: 완전 이동 불가
  [TerrainType.PATH]: { defenseMod: -0.1, moveCost: 0.5 },  // 길: 이동 2배 가속
  [TerrainType.BEACH]: { defenseMod: -0.2, moveCost: 1.5 },
  [TerrainType.SEA]: { defenseMod: -0.5, moveCost: 99.0 }, // 바다: 완전 이동 불가
  [TerrainType.FOREST]: { defenseMod: 0.2, moveCost: 2.5 },  // 숲: 방어+20%, 이동 저항 높음
};

// 병종간 극한 상성 (가위바위보): 데미지 가중치 적용 (%)
export const UNIT_MATCHUPS = {
  INFANTRY: { advantage: 'SPEARMAN', disadvantage: 'CAVALRY', bonus: 0.3 },
  SPEARMAN: { advantage: 'CAVALRY', disadvantage: 'INFANTRY', bonus: 0.5 },
  CAVALRY: { advantage: 'INFANTRY', disadvantage: 'SPEARMAN', bonus: 0.3 },
  ARCHER: { advantage: 'NONE', disadvantage: 'NONE', bonus: 0 },
};

export const BASE_STATS: Record<string, { hp: number; attack: number; defense: number; speed: number; attackRange: number }> = {
  INFANTRY: { hp: 100, attack: 15, defense: 10, speed: 3,   attackRange: 1 },
  SPEARMAN: { hp: 120, attack: 12, defense: 15, speed: 2.5, attackRange: 2 },
  CAVALRY:  { hp:  80, attack: 20, defense:  8, speed: 4,   attackRange: 1 },
  ARCHER:   { hp:  60, attack: 18, defense:  5, speed: 3,   attackRange: 3 },
  GENERAL:  { hp:  80, attack: 10, defense: 12, speed: 2.5, attackRange: 1 }, // 장수: 낙은 화력, 높은 학실
};

// ─ CT(Charge Time) 시스템 ─────────────────────────────────────────
export const CT_THRESHOLD = 100; // CT 가 이 값 이상이면 행동권 획득

// 장수(General) 초기 능력치
// strength(武力) → 화관 atk+, intelligence(知力) → def+, politics(政治) → HP+, charisma(統率) → 버프 반경
export const GENERAL_INITIAL_STATS = {
  senior: { strength: 40, intelligence: 35, politics: 30, charisma: 5 }, // 주장國
  junior: { strength: 25, intelligence: 20, politics: 25, charisma: 4 }, // 부장國
};
