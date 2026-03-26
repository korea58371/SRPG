import { useCallback } from 'react';
import { Graphics } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../store/gameStore';
import { MAP_CONFIG } from '../constants/gameConfig';

export default function DynamicGridLayer() {
  const selectedUnitId = useGameStore(s => s.selectedUnitId);
  const units          = useGameStore(useShallow(s => s.units));
  const mapData        = useGameStore(useShallow(s => s.mapData));

  const drawGrid = useCallback((g: PIXI.Graphics) => {
    g.clear();
    
    if (!selectedUnitId || !mapData) return;
    const unit = units[selectedUnitId];
    if (!unit) return;

    const cx = unit.logicalX;
    const cy = unit.logicalY;
    const baseRange = unit.speed; // 이동 가능 영역
    const maxRange = baseRange + 5; // +5칸 그라데이션 (유저 10x10 느낌 요구 반영)

    // 마름모 쿼터뷰 로지컬 좌표 공간에서의 맨해튼 거리 기반 순회
    for (let dy = -maxRange; dy <= maxRange; dy++) {
      for (let dx = -maxRange; dx <= maxRange; dx++) {
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist > maxRange) continue;

        const lx = cx + dx;
        const ly = cy + dy;
        
        // 맵 범위 이탈 방지
        if (lx < 0 || lx >= MAP_CONFIG.WIDTH || ly < 0 || ly >= MAP_CONFIG.HEIGHT) continue;

        // 알파(불투명도) 계산: 기본 이동범위 내에서는 15%, 이후 선형 감소
        let alpha = 0.15;
        if (dist > baseRange) {
          const ratio = 1 - ((dist - baseRange) / 5);
          alpha = 0.15 * Math.max(0, ratio);
        }
        if (alpha <= 0) continue;

        const px = lx * MAP_CONFIG.TILE_SIZE;
        const py = ly * MAP_CONFIG.TILE_SIZE;

        g.lineStyle(1, 0xffffff, alpha);

        // 중복 선 그리기를 최소화하기 위해 타일의 윗변, 좌측변만 기본적으로 그림
        g.moveTo(px, py);
        g.lineTo(px + MAP_CONFIG.TILE_SIZE, py);
        
        g.moveTo(px, py);
        g.lineTo(px, py + MAP_CONFIG.TILE_SIZE);

        // 가장자리(끝단) 타일인 경우 우측/하단 변을 닫아줌
        const isRightEdge  = Math.abs(dx + 1) + Math.abs(dy) > maxRange || lx === MAP_CONFIG.WIDTH - 1;
        const isBottomEdge = Math.abs(dx) + Math.abs(dy + 1) > maxRange || ly === MAP_CONFIG.HEIGHT - 1;

        if (isRightEdge) {
          g.moveTo(px + MAP_CONFIG.TILE_SIZE, py);
          g.lineTo(px + MAP_CONFIG.TILE_SIZE, py + MAP_CONFIG.TILE_SIZE);
        }
        if (isBottomEdge) {
          g.moveTo(px, py + MAP_CONFIG.TILE_SIZE);
          g.lineTo(px + MAP_CONFIG.TILE_SIZE, py + MAP_CONFIG.TILE_SIZE);
        }
      }
    }
  }, [selectedUnitId, units, mapData]);

  if (!selectedUnitId) return null;

  return <Graphics draw={drawGrid} zIndex={10} />;
}
