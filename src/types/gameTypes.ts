// J:/AI/Game/SRPG/src/types/gameTypes.ts

export const TerrainType = {
  SEA: 0,
  BEACH: 1,
  GRASS: 2,
  CLIFF: 3,
  PATH: 4,
  FOREST: 5,
} as const;

export type TerrainType = typeof TerrainType[keyof typeof TerrainType];

export type FactionId = string;
export type UnitType = 'INFANTRY' | 'SPEARMAN' | 'CAVALRY' | 'ARCHER' | 'GENERAL';
export type UnitState = 'IDLE' | 'MOVING' | 'ATTACKING' | 'DEAD';

// defensive: 아군이 거점 수비, offensive: 아군이 길목에서 공격
export type BattleType = 'defensive' | 'offensive';

export interface TilePos {
  lx: number;
  ly: number;
}

export interface Unit {
  id: string;
  factionId: FactionId;
  unitType: UnitType;

  // 전투 및 생존 스탯
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  attackRange: number;

  // ─ CT(Charge Time) 이니셔티브 시스템 ─────────────────────────
  // 매 틱마다 speed만큼 증가. CT_THRESHOLD(=100) 도달 시 행동권 획득
  ct: number;

  // 위치 및 렌더링
  state: UnitState;
  logicalX: number;
  logicalY: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  movePath: TilePos[];

  isHero: boolean;

  // ─ 장수(General) 전용 능력치 (unitType === 'GENERAL' 일 때만 유효) ──
  generalStrength?: number;     // 武力: 지휘 범위 내 병종 공격 +
  generalIntelligence?: number; // 知力: 지휘 범위 내 병종 방어 +
  generalPolitics?: number;     // 政治: 지휘 범위 내 병종 HP 보너스
  generalCharisma?: number;     // 統率: 지휘 반경 (타일 수)
}
