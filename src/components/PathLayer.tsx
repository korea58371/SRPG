// J:/AI/Game/SRPG/src/components/PathLayer.tsx
// BFS 경로를 PixiJS Graphics로 시각화
// - 호버 중: previewPath 표시 (흰색 반투명 점선+화살표)
// - 확정 후: confirmedPath 표시 (노란색 실선+화살표)

import { useCallback } from 'react';
import { Graphics } from '@pixi/react';
import type { Graphics as PIXIGraphics } from 'pixi.js';
import { useGameStore } from '../store/gameStore';
import { MAP_CONFIG } from '../constants/gameConfig';
import type { TilePos } from '../types/gameTypes';

const TILE = MAP_CONFIG.TILE_SIZE;
const tc = (logical: number) => logical * TILE + TILE / 2; // 타일 중앙 픽셀

function drawArrowhead(g: PIXIGraphics, from: TilePos, to: TilePos) {
  const fromX = tc(from.lx), fromY = tc(from.ly);
  const toX   = tc(to.lx),   toY   = tc(to.ly);

  const angle = Math.atan2(toY - fromY, toX - fromX);
  const size = 8;

  g.beginFill(g.line.color as number, g.line.alpha ?? 1);
  g.moveTo(toX, toY);
  g.lineTo(
    toX - size * Math.cos(angle - Math.PI / 6),
    toY - size * Math.sin(angle - Math.PI / 6)
  );
  g.lineTo(
    toX - size * Math.cos(angle + Math.PI / 6),
    toY - size * Math.sin(angle + Math.PI / 6)
  );
  g.closePath();
  g.endFill();
}

function drawPath(g: PIXIGraphics, path: TilePos[], color: number, alpha: number) {
  if (path.length < 2) return;

  g.lineStyle(3, color, alpha);

  const first = path[0];
  g.moveTo(tc(first.lx), tc(first.ly));

  for (let i = 1; i < path.length; i++) {
    g.lineTo(tc(path[i].lx), tc(path[i].ly));
  }

  // 화살표 머리
  drawArrowhead(g, path[path.length - 2], path[path.length - 1]);
}

export default function PathLayer() {
  const previewPath     = useGameStore(s => s.previewPath);
  const confirmedPath   = useGameStore(s => s.confirmedPath);
  const isConfirmed     = useGameStore(s => !!s.confirmedDestination);

  const draw = useCallback((g: PIXIGraphics) => {
    g.clear();

    if (isConfirmed && confirmedPath.length >= 2) {
      // 확정 경로: 노란색 실선
      drawPath(g, confirmedPath, 0xffe040, 0.95);
    } else if (!isConfirmed && previewPath.length >= 2) {
      // 호버 경로: 흰색 반투명
      drawPath(g, previewPath, 0xffffff, 0.65);
    }
  }, [previewPath, confirmedPath, isConfirmed]);

  return <Graphics draw={draw} />;
}
