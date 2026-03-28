import type { StateCreator } from 'zustand';
import type { Unit, TerrainType, MapObjectData, BattleType, TilePos, FactionId, LevelObjective } from '../../types/gameTypes';
import type { MapInfo } from '../../utils/mapGenerator';
import type { BattleOutcome } from '../../types/appTypes';
import type { DialogueSlice } from '../../types/dialogueTypes';

export type { DialogueSlice };

// [통합] CharacterSlice 제거 — characters는 appStore.characters로 이관됨

export type ActionMenuType = 'ATTACK' | 'SKILL' | 'ITEM' | 'WAIT' | 'CANCEL';

export interface FloatingDamage {
  id: string;
  x: number;
  y: number;
  value: number | string;
  isCrit: boolean;
  isWeak?: boolean;
  isResist?: boolean;
  isHeal?: boolean;
  fontColor?: string;
}

export interface GameStateSlice {
  units: Record<string, Unit>;
  mapData: TerrainType[][] | null;
  elevMap: number[][] | null;
  mapObjects: MapObjectData[];
  cities: { x: number; y: number }[];
  battleType: BattleType;
  biome: MapInfo | null;

  victoryCondition: LevelObjective | null;
  defeatCondition: LevelObjective | null;

  setMapData: (mapData: TerrainType[][], elevMap: number[][], mapObjects: MapObjectData[]) => void;
  setCities: (cities: { x: number; y: number }[]) => void;
  setBattleType: (type: BattleType) => void;
  setBiome: (biome: MapInfo) => void;
  initUnits: (mapWidth: number, mapHeight: number, attackerFactionId: FactionId, defenderFactionId: FactionId) => void;
}

export type PhaseType = 'STRATEGY' | 'BATTLE' | 'EVENT';

export interface CampaignSlice {
  year: number;
  month: number;
  currentPhase: PhaseType;
  playerFactionId: FactionId | null;

  advanceTime: (months?: number) => void;
  setPhase: (phase: PhaseType) => void;
  setPlayerFaction: (factionId: FactionId) => void;
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
  fieldMenuPos: { x: number; y: number } | null;
  unitListModalOpen: boolean;
  heroListModalOpen: boolean;
  isCameraLocked: boolean;

  openFieldMenu: (pos: { x: number; y: number }) => void;
  closeFieldMenu: () => void;
  setUnitListModalOpen: (isOpen: boolean) => void;
  setHeroListModalOpen: (isOpen: boolean) => void;
  setIsCameraLocked: (locked: boolean) => void;

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

// [수정] CharacterSlice 제거 — RootState에서 CharacterSlice 분리
// [추가] DialogueSlice — 이벤트 대화 시스템 상태
export type RootState = GameStateSlice & TurnSystemSlice & InteractionSlice & CampaignSlice & DialogueSlice;

export type StoreSlice<T> = StateCreator<RootState, [], [], T>;
