// J:/AI/Game/SRPG/src/components/MoveRangeLayer.tsx
// 이동 가능 범위 시각화 + 단일 Graphics 이벤트 감지
//
// 핵심 구조:
//  - 배경 Graphics: 이동 타일 렌더링 + hitArea=전체맵 + 마우스 이벤트
//  - 이벤트에서 e.global 좌표로 타일 위치 역계산 → 투명 hit area 문제 없음

import { useCallback } from 'react';
import { Graphics } from '@pixi/react';
import type { Graphics as PIXIGraphics } from 'pixi.js';
import * as PIXI from 'pixi.js';
import { useGameStore } from '../store/gameStore';
import { MAP_CONFIG } from '../constants/gameConfig';
import { useShallow } from 'zustand/react/shallow';

const TILE = MAP_CONFIG.TILE_SIZE;
const RANGE_COLOR   = 0x4da6ff;
const RANGE_ALPHA   = 0.35;
const HOVER_COLOR   = 0x88ccff;
const HOVER_ALPHA   = 0.55;
const CONFIRM_COLOR = 0xffe040;
const CONFIRM_ALPHA = 0.7;

// 전체 맵을 커버하는 히트 영역 (마우스 이벤트 전체 감지)
const MAP_HIT_AREA = new PIXI.Rectangle(
  0, 0,
  MAP_CONFIG.WIDTH * TILE,
  MAP_CONFIG.HEIGHT * TILE,
);

export default function MoveRangeLayer() {
  const selectedUnitId       = useGameStore(s => s.selectedUnitId);
  const moveRangeTiles       = useGameStore(useShallow(s => s.moveRangeTiles));
  const hoveredMoveTile      = useGameStore(s => s.hoveredMoveTile);
  const confirmedDestination = useGameStore(s => s.confirmedDestination);
  const setHoveredMoveTile   = useGameStore(s => s.setHoveredMoveTile);
  const confirmMove          = useGameStore(s => s.confirmMove);

  // 타일 렌더링
  const draw = useCallback((g: PIXIGraphics) => {
    g.clear();
    if (!selectedUnitId) return;

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
  }, [selectedUnitId, moveRangeTiles, hoveredMoveTile, confirmedDestination]);

  // 이벤트 좌표 → 타일 좌표 변환
  const getTileFromEvent = useCallback((e: PIXI.FederatedPointerEvent): { lx: number; ly: number } | null => {
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
