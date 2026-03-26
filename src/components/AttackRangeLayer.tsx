// 이동 확정 후 공격 범위 타일 시각적 표시 (이벤트 처리 없음 - 클릭은 UnitsLayer에서 처리)
// 거리 계산: 맨해튼(|dx|+|dy|) → 십자형/다이아몬드 형태 (SRPG 표준)

import { useCallback } from 'react';
import { Graphics } from '@pixi/react';
import type { Graphics as PIXIGraphics } from 'pixi.js';
import { useGameStore } from '../store/gameStore';
import { MAP_CONFIG } from '../constants/gameConfig';

const TILE = MAP_CONFIG.TILE_SIZE;

export default function AttackRangeLayer() {
  const confirmedDest      = useGameStore(s => s.confirmedDestination);
  const selectedUnitId     = useGameStore(s => s.selectedUnitId);
  const units              = useGameStore(s => s.units);
  const attackTargetMode   = useGameStore(s => s.attackTargetMode);

  // 공격 범위 타일 렌더링
  const draw = useCallback((g: PIXIGraphics) => {
    g.clear();
    if (!confirmedDest || !selectedUnitId) return;

    const attacker = units[selectedUnitId];
    if (!attacker) return;

    const { lx: cx, ly: cy } = confirmedDest;
    // [중요] getAttackableTargets 판정과 동일하게 attackRange+1 사용
    // → "빨간 타일 안에 있는 적 = 실제 공격 가능한 적" 보장
    const range = attacker.attackRange + 1;

    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        // 맨해튼 거리 필터 (getAttackableTargets와 동일 기준)
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
          g.beginFill(0xff4444, 0.28);
          g.lineStyle(1, 0xff2222, 0.35);
        }
        g.drawRect(tx * TILE, ty * TILE, TILE, TILE);
        g.endFill();
      }
    }
  }, [confirmedDest, selectedUnitId, units, attackTargetMode]);


  // AttackRangeLayer는 시각적 범위 표시 전용.
  // 클릭 처리는 UnitsLayer에서 스프라이트 hitbox 기반으로만 수행.
  if (!confirmedDest || !selectedUnitId) return null;

  return (
    <Graphics
      draw={draw}
      eventMode="none"
    />
  );
}
