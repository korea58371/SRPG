// J:/AI/Game/SRPG/src/types/appTypes.ts
// 전략 레이어 타입 정의 (전투 레이어와 분리)

import type { FactionId, HeroPassiveEffect } from './gameTypes';

// ─── 화면 상태 ───────────────────────────────────────────────────────────────
export type AppScreen =
  | 'TITLE'
  | 'STRATEGY_MAP'
  | 'STRATEGY_TURN'
  | 'BATTLE'
  | 'BATTLE_RESULT'
  | 'ENDING';

// ─── 엔딩 종류 ───────────────────────────────────────────────────────────────
export type EndingType = 'good' | 'bad';

// ─── 전투 결과 ───────────────────────────────────────────────────────────────
export type BattleOutcome = 'player_win' | 'player_lose';

// ─── 전략 레이어 장수 (Global Hero) ─────────────────────────────────────────
export interface GlobalHero {
  id: string;
  name: string;
  factionId: FactionId;
  locationProvinceId: string;        // 현재 주둔 중인 영지 ID
  raceEffects: HeroPassiveEffect;    // 종족 기반 패시브
  classEffects: HeroPassiveEffect;   // 직업 기반 패시브
}

// ─── 팩션 전역 자원 ────────────────────────────────────────────────────────
export interface FactionResource {
  gold: number;
  food: number;
  manpower: number; // 모집된 인력 풀
}

// ─── Province (세계 지도 영토 단위) ─────────────────────────────────────────
export interface Province {
  id: string;
  name: string;
  owner: FactionId;
  isCapital: boolean;         // 본거지: 함락 시 즉시 배드엔딩
  adjacentIds: string[];      // 인접 Province ID 목록 (전쟁 가능 여부)
  isCoastal: boolean;         // 해안가 닿아있는지 여부
  navalAdjacentIds: string[]; // 바다를 통해 상륙 가능한 영지 목록 (항구 출항 시)
  
  // ─ 내정 수치 (Domestic) ──────────────────────────────────
  baseGoldProduction: number;   // 기본 금 생산량
  baseFoodProduction: number;   // 기본 식량 생산량
  baseRecruitment: number;      // 기본 모병량 (인력)
  security: number;             // 치안 (0~100)
  
  food: number;                 // (보유 식량 - 점진적으로 팩션 전역으로 이전될 수 있음)
  gold: number;                 // (보유 금)

  // ─ 지리 및 생태 환경 (Geography & Biomes) ───────────────
  terrainType: string;          // 대표 지형 타입 (사막, 툰드라, 평야 등)
  temperature: number;          // 평균 기온 (0.0 극지방 ~ 1.0 적도)
  moisture: number;             // 평균 습도 (0.0 건조 ~ 1.0 습윤)

  // Voronoi 시드 좌표 (0~1 정규화)
  seedX: number;
  seedY: number;
}

// ─── 외교 관계 ───────────────────────────────────────────────────────────────
export type DiplomacyRel = 'ally' | 'neutral' | 'war';

// ─── 전략 페이즈 행동 ────────────────────────────────────────────────────────
export type StrategyAction = 'domestic' | 'diplomacy' | 'war' | 'end_turn';

// ─── appStore 상태 타입 ──────────────────────────────────────────────────────
export interface StrategyState {
  screen: AppScreen;
  provinces: Record<string, Province>;
  globalHeroes: Record<string, GlobalHero>;     // 전 세계의 장수들
  factionResources: Record<FactionId, FactionResource>; // 각 팩션별 전역 자원

  strategyTurn: number;
  selectedProvinceId: string | null;       // 군략화면에서 선택한 Province
  pendingBattle: {
    attackerProvinceId: string;
    defenderProvinceId: string;
  } | null;
  coastlineEdges: { pts: number[], innerPts?: number[] }[] | null;
  coastlinePolygons: number[][] | null;
  diplomacyRelations: Record<string, DiplomacyRel>;
  lastBattleOutcome: BattleOutcome | null;
  endingType: EndingType | null;
  worldSeed: number; // 맵 생성 시드 (allCells 재현용)

  // Actions
  goTo: (screen: AppScreen) => void;
  startGame: () => void;
  selectProvince: (id: string | null) => void;
  executeDomestic: (provinceId: string) => void;
  executeDiplomacy: (targetFactionId: string) => void;
  declareWar: (attackerId: string, defenderId: string) => void;
  resolveBattle: (outcome: BattleOutcome) => void;
  endStrategyTurn: () => void;
  resetGame: () => void;
}
