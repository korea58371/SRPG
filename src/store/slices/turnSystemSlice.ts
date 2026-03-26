import type { StoreSlice, TurnSystemSlice } from './storeTypes';

import type { Unit } from '../../types/gameTypes';
import { CT_THRESHOLD, PLAYER_FACTION, MAP_CONFIG } from '../../constants/gameConfig';
import { buildTileSets } from '../gameStore';
import { calcMoveRange } from '../../utils/moveRange';
import { _runSingleEnemyAI } from '../../engine/aiEngine';

export function getTurnOrder(units: Record<string, Unit>): string[] {
  const alive = Object.values(units).filter(u => u.state !== 'DEAD');
  if (alive.length === 0) return [];

  // 현재 라운드 미행동 유닛
  const currentRound = alive.filter(u => u.ct > 0).sort((a, b) => {
    if (b.ct !== a.ct) return b.ct - a.ct;
    if (b.speed !== a.speed) return b.speed - a.speed;
    if (a.factionId === PLAYER_FACTION && b.factionId !== PLAYER_FACTION) return -1;
    if (b.factionId === PLAYER_FACTION && a.factionId !== PLAYER_FACTION) return 1;
    return a.id.localeCompare(b.id);
  });

  // 다음 라운드 이후 행동 유닛 전체 (스피드 내림차순 정렬)
  const baseOrder = alive.sort((a, b) => {
    if (b.speed !== a.speed) return b.speed - a.speed;
    if (a.factionId === PLAYER_FACTION && b.factionId !== PLAYER_FACTION) return -1;
    if (b.factionId === PLAYER_FACTION && a.factionId !== PLAYER_FACTION) return 1;
    return a.id.localeCompare(b.id);
  });

  const nextRound = alive.filter(u => u.ct <= 0).sort((a, b) => {
    if (b.speed !== a.speed) return b.speed - a.speed;
    if (a.factionId === PLAYER_FACTION && b.factionId !== PLAYER_FACTION) return -1;
    if (b.factionId === PLAYER_FACTION && a.factionId !== PLAYER_FACTION) return 1;
    return a.id.localeCompare(b.id);
  });

  let order = [...currentRound, ...nextRound].map(u => u.id);
  
  // 만약 큐가 짧을 경우 그 다음 라운드의 순서를 채워넣어 10개 이상 보장
  while (order.length <= 15) {
    order.push(...baseOrder.map(u => u.id));
  }

  return order;
}

function _calcNextActive(units: Record<string, Unit>): { updatedUnits: Record<string, Unit>; activeId: string } {
  const alive = Object.values(units).filter(u => u.state !== 'DEAD');
  if (alive.length === 0) return { updatedUnits: units, activeId: '' };

  let finalUnits = { ...units };
  const allActed = alive.every(u => u.ct <= 0);

  if (allActed) {
    for (const u of alive) {
      finalUnits[u.id] = { ...finalUnits[u.id], ct: u.speed };
    }
  }

  const order = getTurnOrder(finalUnits);
  return { updatedUnits: finalUnits, activeId: order[0] ?? '' };
}

export const createTurnSystemSlice: StoreSlice<TurnSystemSlice> = (set, get) => ({
  activeUnitId: null,
  turnNumber: 0,
  isCtrlPressed: false,

  setCtrlPressed: (val) => set({ isCtrlPressed: val }),

  endUnitTurn: () => {
    const s = get();
    if (!s.activeUnitId) {
      // 첫 게임 시작 시 _advanceTurn 강제 진행
      _advanceTurn(set, get);
      return;
    }
    
    const u = s.units[s.activeUnitId];
    if (u && u.state !== 'DEAD') {
      const usedCt = CT_THRESHOLD;
      set(s2 => ({
        units: { ...s2.units, [s2.activeUnitId!]: { ...u, ct: u.ct - usedCt } }
      }));
    }

    const isMatchOver = 
      Object.values(get().units).every(unit => unit.state === 'DEAD' || unit.factionId === PLAYER_FACTION) ||
      Object.values(get().units).every(unit => unit.state === 'DEAD' || unit.factionId !== PLAYER_FACTION);
    
    if (isMatchOver) {
      const playerWon = Object.values(get().units).some(u => u.factionId === PLAYER_FACTION && u.state !== 'DEAD');
      setTimeout(() => set({ battleResult: { isVictory: playerWon, turn: get().turnNumber, survivorCount: 0 } }), 1000);
      return;
    }

    _advanceTurn(set, get);
  }
});

function _advanceTurn(set: any, get: any) {
  set((s: any) => ({ turnNumber: s.turnNumber + 1 }));
  const s = get();
  const { updatedUnits, activeId } = _calcNextActive(s.units);

  const activeUnit = updatedUnits[activeId];
  if (!activeUnit) return;
  
  updatedUnits[activeId] = { ...activeUnit };

  set({ units: updatedUnits, activeUnitId: activeId });

  if (activeUnit.factionId === PLAYER_FACTION) {
    if (!s.mapData) return;
    const { friendlyTiles, enemyTiles } = buildTileSets(updatedUnits, activeId);
    const range = calcMoveRange(
      activeUnit.logicalX, activeUnit.logicalY, activeUnit.moveSteps,
      s.mapData, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT, friendlyTiles, enemyTiles,
    );
    set({ selectedUnitId: activeId, moveRangeTiles: range });
  } else {
    // Enemy AI deferral
    const aiDelay = get().isCtrlPressed ? 0 : 400;
    setTimeout(() => _runSingleEnemyAI(activeId), aiDelay);
  }
}
