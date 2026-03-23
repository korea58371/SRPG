// J:/AI/Game/SRPG/src/components/AttackRangeLayer.tsx
// 이동 확정 후 공격 범위 타일 표시 + 타겟 클릭 선택
//
// 거리 계산: 맨해튼(|dx|+|dy|) → 십자형/다이아몬드 형태 (SRPG 표준)
// attackTargetMode가 true일 때 적군 타일 클릭 → executeAttackOnTarget 호출

import { useCallback } from 'react';
import { Graphics } from '@pixi/react';
import type { Graphics as PIXIGraphics } from 'pixi.js';
import * as PIXI from 'pixi.js';
import { useGameStore } from '../store/gameStore';
import { MAP_CONFIG } from '../constants/gameConfig';

const TILE = MAP_CONFIG.TILE_SIZE;

// 전체 맵 히트 영역 (이벤트 감지용)
const MAP_HIT = new PIXI.Rectangle(0, 0, MAP_CONFIG.WIDTH * TILE, MAP_CONFIG.HEIGHT * TILE);

export default function AttackRangeLayer() {
  const confirmedDest      = useGameStore(s => s.confirmedDestination);
  const selectedUnitId     = useGameStore(s => s.selectedUnitId);
  const units              = useGameStore(s => s.units);
  const attackTargetMode   = useGameStore(s => s.attackTargetMode);
  const executeAttackOnTarget = useGameStore(s => s.executeAttackOnTarget);

  // 공격 범위 타일 렌더링
  const draw = useCallback((g: PIXIGraphics) => {
    g.clear();
    if (!confirmedDest || !selectedUnitId) return;

    const attacker = units[selectedUnitId];
    if (!attacker) return;

    const { lx: cx, ly: cy } = confirmedDest;
    const range = attacker.attackRange;

    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        // 맨해튼 거리 필터 (십자/다이아몬드)
        if (Math.abs(dx) + Math.abs(dy) > range) continue;
        if (dx === 0 && dy === 0) continue;

        const tx = cx + dx;
        const ty = cy + dy;
        if (tx < 0 || ty < 0 || tx >= MAP_CONFIG.WIDTH || ty >= MAP_CONFIG.HEIGHT) continue;

        const hasEnemy = Object.values(units).some(
          u => u.factionId !== attacker.factionId && u.state !== 'DEAD'
             && u.logicalX === tx && u.logicalY === ty,
        );

        if (hasEnemy) {
          if (attackTargetMode) {
            // 타겟 선택 모드: 더 진하게 + 깜빡임 효과 색상
            g.beginFill(0xff2222, 0.75);
            g.lineStyle(2, 0xff6666, 1.0);
          } else {
            g.beginFill(0xff2222, 0.50);
            g.lineStyle(2, 0xff0000, 0.8);
          }
        } else {
          g.beginFill(0xff8800, attackTargetMode ? 0.12 : 0.18);
          g.lineStyle(1, 0xff6600, 0.35);
        }
        g.drawRect(tx * TILE, ty * TILE, TILE, TILE);
        g.endFill();
      }
    }
  }, [confirmedDest, selectedUnitId, units, attackTargetMode]);

  // 타겟 선택 모드에서 클릭 → 적군 확인 후 공격 실행
  const handleClick = useCallback((e: PIXI.FederatedPointerEvent) => {
    if (!attackTargetMode || !selectedUnitId || !confirmedDest) return;
    const attacker = useGameStore.getState().units[selectedUnitId];
    if (!attacker) return;

    const lx = Math.floor(e.global.x / TILE);
    const ly = Math.floor(e.global.y / TILE);

    // 맨해튼 거리 내 + 적군 있는 타일인지 확인
    const dist = Math.abs(lx - confirmedDest.lx) + Math.abs(ly - confirmedDest.ly);
    if (dist > attacker.attackRange) return;

    const targetUnit = Object.values(useGameStore.getState().units).find(
      u => u.factionId !== attacker.factionId && u.state !== 'DEAD'
         && u.logicalX === lx && u.logicalY === ly,
    );
    if (!targetUnit) return;

    executeAttackOnTarget(targetUnit.id);
  }, [attackTargetMode, selectedUnitId, confirmedDest, executeAttackOnTarget]);

  if (!confirmedDest || !selectedUnitId) return null;

  return (
    <Graphics
      draw={draw}
      eventMode={attackTargetMode ? 'static' : 'none'}
      cursor={attackTargetMode ? 'crosshair' : 'default'}
      hitArea={attackTargetMode ? MAP_HIT : undefined}
      onclick={attackTargetMode ? handleClick : undefined}
    />
  );
}
