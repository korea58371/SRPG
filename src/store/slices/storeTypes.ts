import type { StateCreator } from 'zustand';
import type { Unit, TerrainType, MapObjectData, BattleType, TilePos, FactionId } from '../../types/gameTypes';
import type { MapInfo } from '../../utils/mapGenerator';
import type { BattleOutcome } from '../../types/appTypes';

export type ActionMenuType = 'ATTACK' | 'SKILL' | 'ITEM' | 'WAIT' | 'CANCEL';

export interface FloatingDamage {
  id: string;
  x: number;
  y: number;
  value: number;
  isCrit: boolean;
  isWeak?: boolean;
  isResist?: boolean;
  isHeal?: boolean;
}

export interface GameStateSlice {
  // 실제 데이터
  units: Record<string, Unit>;
  mapData: TerrainType[][] | null;
  elevMap: number[][] | null;
  mapObjects: MapObjectData[];
  cities: { x: number; y: number }[];
  battleType: BattleType;
  biome: MapInfo | null;
  
  // 세터
  setMapData: (mapData: TerrainType[][], elevMap: number[][], mapObjects: MapObjectData[]) => void;
  setCities: (cities: { x: number; y: number }[]) => void;
  setBattleType: (type: BattleType) => void;
  setBiome: (biome: MapInfo) => void;
  initUnits: (mapWidth: number, mapHeight: number, attackerFactionId: FactionId, defenderFactionId: FactionId) => void;
}

export interface TurnSystemSlice {
  activeUnitId: string | null;
  turnNumber: number;
  isCtrlPressed: boolean;
  
  setCtrlPressed: (val: boolean) => void;
  endUnitTurn: () => void;
}

export interface InteractionSlice {
  isMoveAnimating: boolean;
  moveOrigin: { lx: number, ly: number, px: number, py: number } | null;
  selectedUnitId: string | null;
  moveRangeTiles: Set<string>;
  hoveredMoveTile: TilePos | null;
  hoveredMapTile: TilePos | null;
  hoveredMapPixel: { x: number; y: number } | null;
  previewPath: TilePos[];
  confirmedDestination: TilePos | null;
  confirmedPath: TilePos[];
  
  combatLog: string[];
  floatingDamages: FloatingDamage[];
  battleResult: BattleOutcome | null;
  
  attackTargetMode: boolean;
  skillTargetMode: boolean;
  selectedSkillId: string | null;
  hoveredUnitId: string | null;

  clearBattleResult: () => void;
  setHoveredUnitId: (id: string | null) => void;
  removeFloatingDamage: (id: string) => void;
  
  enterAttackTargetMode: () => void;
  enterSkillTargetMode: (skillId: string) => void;
  cancelSkillTargetMode: () => void;
  
  selectUnit: (id: string | null) => void;
  setHoveredMoveTile: (tile: TilePos | null) => void;
  setHoveredMapTile: (tile: TilePos | null) => void;
  setHoveredMapPixel: (pixel: { x: number; y: number } | null) => void;
  confirmMove: (lx: number, ly: number) => void;
  cancelConfirmedMove: () => void;
  
  executeAction: (action: ActionMenuType) => void;
  executeAttackOnTarget: (targetId: string) => void;
  executeSkillOnTarget: (targetTile: TilePos) => void;
}

export type RootState = GameStateSlice & TurnSystemSlice & InteractionSlice;

// 제네릭 StateCreator 축약타입 (미들웨어 없이 순수 기능)
export type StoreSlice<T> = StateCreator<RootState, [], [], T>;
