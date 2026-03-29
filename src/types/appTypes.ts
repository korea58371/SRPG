// J:/AI/Game/SRPG/src/types/appTypes.ts
// 전략 레이어 타입 정의 (전투 레이어와 분리)
// GlobalHero 제거 — Character(characterTypes.ts)가 단일 진실 공급원으로 통합됨

import type { FactionId } from './gameTypes';
import type { Character } from './characterTypes';

// ─── 화면 상태 ───────────────────────────────────────────────────────────────
export type AppScreen =
  | 'TITLE'
  | 'STRATEGY_MAP'
  | 'STRATEGY_TURN'
  | 'BATTLE'
  | 'BATTLE_RESULT'
  | 'ENDING'
  | 'MAP_EDITOR';

// ─── 엔딩 종류 ───────────────────────────────────────────────────────────────
export type EndingType = 'good' | 'bad';

// ─── 전투 결과 ───────────────────────────────────────────────────────────────
export type BattleOutcome = 'player_win' | 'player_lose' | { isVictory: boolean; turn?: number; survivorCount?: number; survivingTroops?: Record<string, number> };

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
  navalAdjacentIds: string[]; // 바다를 통해 상륙 가능한 영지 목록

  // ─ 내정 수치 (Domestic) ─────────────────────────────────────────
  baseGoldProduction: number;   // 기본 금 생산량
  baseFoodProduction: number;   // 기본 식량 생산량
  baseRecruitment: number;      // 기본 모병량 (인력)
  security: number;             // 치안 (0~100)

  food: number;
  gold: number;

  // ─ 지리 및 생태 환경 (Geography & Biomes) ──────────────────────
  terrainType: string;
  temperature: number;
  moisture: number;

  // Voronoi 시드 좌표 (0~1 정규화)
  seedX: number;
  seedY: number;
}

// ─── 외교 관계 ───────────────────────────────────────────────────────────────
export type DiplomacyRel = 'ally' | 'neutral' | 'war';

// ─── 전략 페이즈 행동 ────────────────────────────────────────────────────────
export type StrategyAction = 'domestic' | 'diplomacy' | 'war' | 'end_turn';

// ─── 행동 탭 ─────────────────────────────────────────────────────────────────
export type ActionTab = 'recommend' | 'talent' | 'military' | 'domestic' | 'diplomacy';

// ─── 행동 아이템 (ActionPanel 리스트용) ────────────────────────────────────────
export interface StrategyActionItem {
  id: string;
  tab: ActionTab;
  icon: string;
  label: string;
  subLabel?: string;
  cost: number;             // AP 소모량 (0 = 무료)
  isAvailable: boolean;     // false이면 비활성(회색) 표시
  danger?: boolean;         // true이면 빨간색 강조 (선전포고 등)
  onExecute: () => void;
}

// ─── AP(행동 포인트) 시스템 ────────────────────────────────────────────────────
export const AP_PER_TURN = 5; // 턴당 기본 AP

// ─── appStore 상태 타입 ──────────────────────────────────────────────────────
export interface StrategyState {
  screen: AppScreen;
  provinces: Record<string, Province>;

  // [통합] Character 전체 풀 — GlobalHero 대체
  // state: 'Factioned' = 임관, 'FreeAgent' = 재야, 'Undiscovered' = 미발견
  characters: Record<string, Character>;

  factionResources: Record<FactionId, FactionResource>;

  strategyTurn: number;
  remainingAP: number;          // 현재 턴 남은 행동 포인트
  selectedProvinceId: string | null;
  pendingBattle: {
    attackerProvinceId: string;
    defenderProvinceId: string;
    isCheat?: boolean;
    deployingHeroIds?: string[];
  } | null;
  pendingDeployment: {
    attackerProvinceId: string;
    defenderProvinceId: string;
    isCheat?: boolean;
  } | null;
  coastlineEdges: { pts: number[], innerPts?: number[] }[] | null;
  coastlinePolygons: number[][] | null;
  diplomacyRelations: Record<string, DiplomacyRel>;
  lastBattleOutcome: BattleOutcome | null;
  endingType: EndingType | null;
  worldSeed: number;

  // Actions
  goTo: (screen: AppScreen) => void;
  startGame: (scenarioData?: { seed: number; factions: Record<string, string> }) => void;
  selectProvince: (id: string | null) => void;
  executeDomestic: (provinceId: string) => void;
  executeDiplomacy: (targetFactionId: string) => void;
  declareWar: (attackerId: string, defenderId: string) => void;
  cancelDeployment: () => void;
  confirmDeployment: (deployingHeroIds: string[]) => void;
  resolveBattle: (outcome: BattleOutcome) => void;
  endStrategyTurn: () => void;
  resetGame: () => void;
  consumeAP: (amount: number) => boolean; // AP 소모, 부족하면 false 반환

  // Character 관련 Actions
  addCharacter: (char: Character) => void;
  recruitCharacter: (charId: string, targetFactionId: FactionId, locationProvinceId: string) => void;
  updateCharacterTroop: (charId: string, troopType: Character['troopType'], troopCount: number) => void;
  moveCharacter: (charId: string, provinceId: string) => void;
  quickRecruit: (charId: string) => void;
}
