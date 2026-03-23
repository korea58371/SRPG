// J:/AI/Game/SRPG/src/components/MoveRangeLayer.tsx
// 이동 가능 범위(파랑) + 이동 후 공격 가능 범위(빨강) 시각화
//
// 공격 가능 범위: moveRangeTiles 각 타일에서 맨해튼 attackRange 이내 타일 합집합
//               (이동 범위와 겹치지 않는 타일만 빨간색으로 표시)

import { useCallback } from 'react';
import { Graphics } from '@pixi/react';
import type { Graphics as PIXIGraphics } from 'pixi.js';
import * as PIXI from 'pixi.js';
import { useGameStore } from '../store/gameStore';
import { MAP_CONFIG } from '../constants/gameConfig';
import { useShallow } from 'zustand/react/shallow';

const TILE = MAP_CONFIG.TILE_SIZE;
const W = MAP_CONFIG.WIDTH;
const H = MAP_CONFIG.HEIGHT;

// 이동 범위 색상
const RANGE_COLOR   = 0x4da6ff;
const RANGE_ALPHA   = 0.35;
const HOVER_COLOR   = 0x88ccff;
const HOVER_ALPHA   = 0.55;
const CONFIRM_COLOR = 0xffe040;
const CONFIRM_ALPHA = 0.7;
// 공격 가능 범위 색상
const ATTACK_EXT_COLOR = 0xff4444;
const ATTACK_EXT_ALPHA = 0.28;
const ATTACK_EXT_LINE  = 0xff2222;

const MAP_HIT_AREA = new PIXI.Rectangle(0, 0, W * TILE, H * TILE);

// 이동 범위 타일들로부터 공격 가능 확장 범위 계산
function calcExtendedAttackTiles(
  moveRangeTiles: Set<string>,
  attackRange: number,
): Set<string> {
  const result = new Set<string>();
  for (const key of moveRangeTiles) {
    const [lx, ly] = key.split(',').map(Number);
    for (let dx = -attackRange; dx <= attackRange; dx++) {
      const remY = attackRange - Math.abs(dx);
      for (let dy = -remY; dy <= remY; dy++) {
        const tx = lx + dx;
        const ty = ly + dy;
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
        const tKey = `${tx},${ty}`;
        if (!moveRangeTiles.has(tKey)) result.add(tKey);
      }
    }
  }
  return result;
}

export default function MoveRangeLayer() {
  const selectedUnitId       = useGameStore(s => s.selectedUnitId);
  const moveRangeTiles       = useGameStore(useShallow(s => s.moveRangeTiles));
  const hoveredMoveTile      = useGameStore(s => s.hoveredMoveTile);
  const confirmedDestination = useGameStore(s => s.confirmedDestination);
  const setHoveredMoveTile   = useGameStore(s => s.setHoveredMoveTile);
  const confirmMove          = useGameStore(s => s.confirmMove);
  const units                = useGameStore(s => s.units);

  // 타일 렌더링
  const draw = useCallback((g: PIXIGraphics) => {
    g.clear();
    if (!selectedUnitId) return;

    const unit = units[selectedUnitId];
    const attackRange = unit?.attackRange ?? 1;

    // ─ 1단계: 공격 가능 확장 범위 (빨강) — 이동 확정 전에만 표시
    if (!confirmedDestination) {
      const extAttack = calcExtendedAttackTiles(moveRangeTiles, attackRange);
      g.beginFill(ATTACK_EXT_COLOR, ATTACK_EXT_ALPHA);
      g.lineStyle(1, ATTACK_EXT_LINE, 0.35);
      for (const key of extAttack) {
        const [lx, ly] = key.split(',').map(Number);
        g.drawRect(lx * TILE, ly * TILE, TILE, TILE);
      }
      g.endFill();
    }

    // ─ 2단계: 이동 가능 범위 (파랑 / 호버 / 확정)
    for (const key of moveRangeTiles) {
      const [lx, ly] = key.split(',').map(Number);
      const isConfirmed = confirmedDestination?.lx === lx && confirmedDestination?.ly === ly;
      const isHovered   = !isConfirmed && hoveredMoveTile?.lx === lx && hoveredMoveTile?.ly === ly;

      const color = isConfirmed ? CONFIRM_COLOR : isHovered ? HOVER_COLOR : RANGE_COLOR;
      const alpha = isConfirmed ? CONFIRM_ALPHA  : isHovered ? HOVER_ALPHA  : RANGE_ALPHA;

      g.beginFill(color, alpha);
      g.lineStyle(1, color, 0.5);
      g.drawRect(lx * TILE, ly * TILE, TILE, TILE);
      g.endFill();
    }
  }, [selectedUnitId, moveRangeTiles, hoveredMoveTile, confirmedDestination, units]);

  // 이벤트 좌표 → 타일 좌표 변환
  const getTileFromEvent = useCallback((e: PIXI.FederatedPointerEvent) => {
    const lx = Math.floor(e.global.x / TILE);
    const ly = Math.floor(e.global.y / TILE);
    const key = `${lx},${ly}`;
    const tiles = useGameStore.getState().moveRangeTiles;
    return tiles.has(key) ? { lx, ly } : null;
  }, []);

  const handlePointerMove = useCallback((e: PIXI.FederatedPointerEvent) => {
    if (useGameStore.getState().confirmedDestination) return;
    const tile = getTileFromEvent(e);
    setHoveredMoveTile(tile);
  }, [getTileFromEvent, setHoveredMoveTile]);

  const handlePointerLeave = useCallback(() => {
    if (useGameStore.getState().confirmedDestination) return;
    setHoveredMoveTile(null);
  }, [setHoveredMoveTile]);

  const handleClick = useCallback((e: PIXI.FederatedPointerEvent) => {
    const tile = getTileFromEvent(e);
    if (tile) confirmMove(tile.lx, tile.ly);
  }, [getTileFromEvent, confirmMove]);

  if (!selectedUnitId) return null;

  return (
    <Graphics
      draw={draw}
      eventMode="static"
      cursor="pointer"
      hitArea={MAP_HIT_AREA}
      onpointermove={handlePointerMove}
      onpointerleave={handlePointerLeave}
      onclick={handleClick}
    />
  );
}
