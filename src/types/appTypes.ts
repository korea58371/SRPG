// J:/AI/Game/SRPG/src/types/appTypes.ts
// 전략 레이어 타입 정의 (전투 레이어와 분리)

import type { FactionId } from './gameTypes';

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

// ─── Province (세계 지도 영토 단위) ─────────────────────────────────────────
export interface Province {
  id: string;
  name: string;
  owner: FactionId;
  isCapital: boolean;         // 본거지: 함락 시 즉시 배드엔딩
  adjacentIds: string[];      // 인접 Province ID 목록 (전쟁 가능 여부)
  food: number;               // 내정 자원: 식량
  gold: number;               // 내정 자원: 금
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
  strategyTurn: number;
  selectedProvinceId: string | null;       // 군략화면에서 선택한 Province
  pendingBattle: {
    attackerProvinceId: string;
    defenderProvinceId: string;
  } | null;
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
