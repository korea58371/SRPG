// J:/AI/Game/SRPG/src/types/gameTypes.ts

export const TerrainType = {
  SEA: 0,
  BEACH: 1,
  GRASS: 2,
  CLIFF: 3,
  PATH: 4,
} as const;

export type TerrainType = typeof TerrainType[keyof typeof TerrainType];

export type FactionId = 'western_empire' | 'eastern_alliance' | 'neutral';
export type UnitType = 'INFANTRY' | 'SPEARMAN' | 'CAVALRY' | 'ARCHER';
export type UnitState = 'IDLE' | 'MOVING' | 'ATTACKING' | 'DEAD';

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
  attackRange: number;  // 공격 사거리 (타일 단위, 체비쇼프 거리)
  
  // 턴 행동 상태
  state: UnitState;
  hasActed: boolean;    // 이번 턴에 이미 행동했는지 (true=이동/공격 완료)
  
  // 위치
  logicalX: number;
  logicalY: number;
  
  // 렌더링 물리 좌표
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  
  // 경로 waypoint 큐
  movePath: TilePos[];
  
  isHero: boolean;
}
