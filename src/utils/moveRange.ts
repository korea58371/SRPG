// J:/AI/Game/SRPG/src/utils/moveRange.ts
// 턴제 SRPG 이동 범위 계산 + 경로 역추적
//
// 이동 규칙:
// 1. 적군 유닛 타일: 경로 자체 차단 (통과/정착 불가)
// 2. 아군 유닛 타일: 통과 가능, 정착 불가
// 3. ZoC: 적군 인접 타일 도달 시 이동 정지 (해당 타일은 목적지 가능)

import type { TerrainType, TilePos } from '../types/gameTypes';
import { TERRAIN_BONUS } from '../constants/gameConfig';

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * BFS로 이동 가능한 모든 그리드 좌표를 반환
 */
export function calcMoveRange(
  startX: number,
  startY: number,
  moveRange: number,
  mapData: TerrainType[][],
  mapW: number,
  mapH: number,
  friendlyTiles: Set<string>,
  enemyTiles: Set<string>,
): Set<string> {
  const reachable = new Set<string>();
  const queue: [number, number, number][] = [[startX, startY, moveRange]];
  const visited = new Map<string, number>();

  const isZoC = (x: number, y: number): boolean =>
    DIRS.some(([dx, dy]) => enemyTiles.has(`${x + dx},${y + dy}`));

  while (queue.length > 0) {
    const [cx, cy, remaining] = queue.shift()!;
    const key = `${cx},${cy}`;

    if ((visited.get(key) ?? -1) >= remaining) continue;
    visited.set(key, remaining);

    const isStart = cx === startX && cy === startY;

    if (!isStart && !friendlyTiles.has(key) && !enemyTiles.has(key)) {
      reachable.add(key);
    }

    if (!isStart && isZoC(cx, cy)) continue;

    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= mapW || ny >= mapH) continue;
      const nKey = `${nx},${ny}`;
      if (enemyTiles.has(nKey)) continue;
      const terrain = mapData[ny]?.[nx];
      if (terrain === undefined) continue;
      const bonus = TERRAIN_BONUS[terrain];
      if (bonus.moveCost >= 10) continue;
      const nextRemaining = remaining - bonus.moveCost;
      if (nextRemaining < 0) continue;
      queue.push([nx, ny, nextRemaining]);
    }
  }

  return reachable;
}

/**
 * BFS + 부모 역추적으로 start → target 최적 경로를 반환
 * reachable 집합에 target이 없으면 빈 배열 반환
 */
export function findMovePath(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  moveRange: number,
  mapData: TerrainType[][],
  mapW: number,
  mapH: number,
  _friendlyTiles: Set<string>,
  enemyTiles: Set<string>,
): TilePos[] {
  const targetKey = `${targetX},${targetY}`;
  const parent = new Map<string, string>(); // key -> parent key
  const costMap = new Map<string, number>(); // key -> remaining movement
  const startKey = `${startX},${startY}`;

  parent.set(startKey, '');
  costMap.set(startKey, moveRange);

  const queue: [number, number, number][] = [[startX, startY, moveRange]];

  const isZoC = (x: number, y: number): boolean =>
    DIRS.some(([dx, dy]) => enemyTiles.has(`${x + dx},${y + dy}`));

  while (queue.length > 0) {
    const [cx, cy, remaining] = queue.shift()!;
    const key = `${cx},${cy}`;

    // 이미 더 좋은 경로로 방문됐으면 스킵
    if ((costMap.get(key) ?? -1) > remaining) continue;

    if (key === targetKey) break;

    const isStart = cx === startX && cy === startY;
    if (!isStart && isZoC(cx, cy)) continue;

    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= mapW || ny >= mapH) continue;
      const nKey = `${nx},${ny}`;
      if (enemyTiles.has(nKey)) continue;
      const terrain = mapData[ny]?.[nx];
      if (terrain === undefined) continue;
      const bonus = TERRAIN_BONUS[terrain];
      if (bonus.moveCost >= 10) continue;
      const nextRemaining = remaining - bonus.moveCost;
      if (nextRemaining < 0) continue;

      if (!costMap.has(nKey) || (costMap.get(nKey) ?? -1) < nextRemaining) {
        costMap.set(nKey, nextRemaining);
        parent.set(nKey, key);
        queue.push([nx, ny, nextRemaining]);
      }
    }
  }

  // 경로 역추적
  if (!parent.has(targetKey)) return [];

  const path: TilePos[] = [];
  let current = targetKey;
  while (current !== '') {
    const [lx, ly] = current.split(',').map(Number);
    path.unshift({ lx, ly });
    current = parent.get(current) ?? '';
  }

  return path;
}
