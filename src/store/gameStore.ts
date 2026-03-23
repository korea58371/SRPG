// J:/AI/Game/SRPG/src/store/gameStore.ts
import { create } from 'zustand';
import type { Unit, FactionId, UnitType } from '../types/gameTypes';
import { UNIT_CONFIG, BASE_STATS } from '../constants/gameConfig';

interface GameState {
  units: Record<string, Unit>;
  initUnits: (mapWidth: number, mapHeight: number) => void;
  updateUnitLogicalPosition: (id: string, lx: number, ly: number) => void;
}

const getRandomFaction = (): FactionId => {
  const f = ['western_empire', 'eastern_alliance', 'neutral'];
  return f[Math.floor(Math.random() * f.length)] as FactionId;
};

const getRandomType = (): UnitType => {
  const t = ['INFANTRY', 'SPEARMAN', 'CAVALRY', 'ARCHER'];
  return t[Math.floor(Math.random() * t.length)] as UnitType;
};

export const useGameStore = create<GameState>((set) => ({
  units: {},
  
  // 최초 유닛 생성: 논리 좌표계(Logical Grid)와 물리 렌더 좌표계 분리 원칙 적용
  initUnits: (mapWidth: number, mapHeight: number) => {
    const newUnits: Record<string, Unit> = {};
    for (let i = 0; i < UNIT_CONFIG.INITIAL_SPAWN_COUNT; i++) {
      const isHero = i < UNIT_CONFIG.HERO_UNIT_COUNT;
      const type = getRandomType();
      const faction = getRandomFaction();
      const baseStats = BASE_STATS[type];
      
      const lx = Math.floor(Math.random() * mapWidth);
      const ly = Math.floor(Math.random() * mapHeight);
      
      newUnits[`unit-${i}`] = {
        id: `unit-${i}`,
        factionId: faction,
        unitType: type,
        hp: baseStats.hp * (isHero ? 2 : 1), // 영웅은 2배 체력
        maxHp: baseStats.hp * (isHero ? 2 : 1),
        attack: baseStats.attack * (isHero ? 1.5 : 1),
        defense: baseStats.defense,
        speed: baseStats.speed,
        state: 'IDLE',
        logicalX: lx,
        logicalY: ly,
        x: lx * 40, // 40 = TILE_SIZE. 초기 렌더 위치 (물리 좌표)
        y: ly * 40,
        targetX: lx * 40,
        targetY: ly * 40,
        isHero
      };
    }
    set({ units: newUnits });
  },

  updateUnitLogicalPosition: (id: string, lx: number, ly: number) => {
    set((state) => {
      const unit = state.units[id];
      if (!unit) return state;
      return {
        units: {
          ...state.units,
          [id]: { 
            ...unit, 
            logicalX: lx, 
            logicalY: ly,
            // 목표 픽셀 좌표를 갱신해두면, React-Pixi의 Component 내 useTick이 60프레임 보간 이동을 자체 수행함
            targetX: lx * 40, 
            targetY: ly * 40,
            state: 'MOVING' 
          }
        }
      };
    });
  }
}));
