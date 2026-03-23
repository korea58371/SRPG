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

export interface Point {
  x: number;
  y: number;
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
  
  // 현재 상태 및 위치 (Zustand 관리 영역: 로직상 좌표)
  state: UnitState;
  logicalX: number;  // Tile Grid x index
  logicalY: number;  // Tile Grid y index
  
  // 렌더링 목적의 물리 좌표
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  
  isHero: boolean;
}
