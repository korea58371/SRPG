// J:/AI/Game/SRPG/src/store/gameStore.ts
// CT(Charge Time) 기반 이니셔티브 턴제 + 장수(General) 시스템
import { create } from 'zustand';
import type { Unit } from '../types/gameTypes';
import { MAP_CONFIG } from '../constants/gameConfig';

import type { RootState } from './slices/storeTypes';
import { createGameStateSlice } from './slices/gameStateSlice';
import { createTurnSystemSlice } from './slices/turnSystemSlice';
import { createInteractionSlice } from './slices/interactionSlice';
import { createCampaignSlice } from './slices/campaignSlice';
import { createCharacterSlice } from './slices/characterSlice';

export * from './slices/storeTypes';
// ─── 유틸리티 함수들 (스토어 밖에서 사용됨) ──────────────────────────────────
export const manhattan = (ax: number, ay: number, bx: number, by: number): number =>
  Math.abs(ax - bx) + Math.abs(ay - by);

export const chebyshevDist = (ax: number, ay: number, bx: number, by: number): number =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));

export const tileToPixel = (logical: number) =>
  logical * MAP_CONFIG.TILE_SIZE + MAP_CONFIG.TILE_SIZE / 2;

export function getGeneralBuff(
  unit: Unit,
  allUnits: Record<string, Unit>,
): { attackBonus: number; defenseBonus: number } {
  let best: Unit | null = null;
  let bestDist = Infinity;
  for (const u of Object.values(allUnits)) {
    if (u.unitType !== 'GENERAL' || u.factionId !== unit.factionId || u.state === 'DEAD') continue;
    const radius = u.generalCharisma ?? 3;
    const dist = manhattan(unit.logicalX, unit.logicalY, u.logicalX, u.logicalY);
    if (dist <= radius && dist < bestDist) { best = u; bestDist = dist; }
  }
  return {
    attackBonus:  best ? (best.generalStrength ?? 0) * 0.5 : 0,
    defenseBonus: best ? (best.generalIntelligence ?? 0) * 0.3 : 0,
  };
}

export function buildTileSets(units: Record<string, Unit>, selfId: string) {
  const friendlyTiles = new Set<string>();
  const enemyTiles = new Set<string>();
  const selfUnit = units[selfId];
  for (const u of Object.values(units)) {
    if (u.id === selfId || u.state === 'DEAD') continue;
    const key = `${u.logicalX},${u.logicalY}`;
    if (u.factionId === selfUnit?.factionId) friendlyTiles.add(key);
    else enemyTiles.add(key);
  }
  return { friendlyTiles, enemyTiles };
}

export function getAttackableTargets(
  attacker: Unit,
  allUnits: Record<string, Unit>,
  fromLx: number,
  fromLy: number,
): Unit[] {
  const enemies = Object.values(allUnits).filter(u =>
    u.factionId !== attacker.factionId && u.state !== 'DEAD'
  );
  const maxRange = attacker.attackRange + 1;
  return enemies.filter(u =>
    manhattan(fromLx, fromLy, u.logicalX, u.logicalY) <= maxRange,
  );
}

// ─── 단일 Store 병합 생성 ──────────────────────────────────────────────────
export const useGameStore = create<RootState>((...a) => ({
  ...createGameStateSlice(...a),
  ...createTurnSystemSlice(...a),
  ...createInteractionSlice(...a),
  ...createCampaignSlice(...a),
  ...createCharacterSlice(...a),
}));
