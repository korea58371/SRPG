import { useCallback } from 'react';
import { Graphics } from '@pixi/react';
import type { Graphics as PIXIGraphics } from 'pixi.js';
import { useGameStore } from '../store/gameStore';
import { MAP_CONFIG } from '../constants/gameConfig';
import { getAoETiles, getManhattanDist, MOCK_SKILLS } from '../utils/skillTargeting';

const TILE = MAP_CONFIG.TILE_SIZE;

export default function SkillRangeLayer() {
  const skillTargetMode = useGameStore(s => s.skillTargetMode);
  const selectedSkillId = useGameStore(s => s.selectedSkillId);
  const hoveredMapTile = useGameStore(s => s.hoveredMapTile);
  const selectedUnitId = useGameStore(s => s.selectedUnitId);
  const confirmedDest  = useGameStore(s => s.confirmedDestination);
  const units = useGameStore(s => s.units);

  const draw = useCallback((g: PIXIGraphics) => {
    g.clear();
    if (!skillTargetMode || !selectedSkillId || !selectedUnitId) return;
    
    const caster = units[selectedUnitId];
    if (!caster) return;

    // 실제로는 캐스터의 스킬 배열이나 전역 스킬 DB에서 가져옴
    const skill = MOCK_SKILLS[selectedSkillId] || MOCK_SKILLS['mock-cross'];
    // 타겟팅 모드에서는 유닛의 원본 위치가 아닌, 방금 이동을 확정한 '도착 예정지'를 원점으로 계산해야 함
    const casterPos = confirmedDest ? { lx: confirmedDest.lx, ly: confirmedDest.ly } : { lx: caster.logicalX, ly: caster.logicalY };

    // 1. 사거리(Range) 시각화 (시전 가능 영역)
    g.beginFill(0xffee00, 0.1);
    g.lineStyle(1, 0xffee00, 0.3);
    for (let dy = -skill.range; dy <= skill.range; dy++) {
      for (let dx = -skill.range; dx <= skill.range; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > skill.range) continue;
        const tx = casterPos.lx + dx;
        const ty = casterPos.ly + dy;
        if (tx < 0 || ty < 0 || tx >= MAP_CONFIG.WIDTH || ty >= MAP_CONFIG.HEIGHT) continue;
        g.drawRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
    g.endFill();

    // 2. 마우스 호버된 지점을 타겟으로 했을 때의 AoE(레드존) 시각화
    if (hoveredMapTile) {
      const dist = getManhattanDist(casterPos.lx, casterPos.ly, hoveredMapTile.lx, hoveredMapTile.ly);
      // 사거리 이내일 경우 적용
      if (dist <= skill.range) {
        const aoeTiles = getAoETiles(casterPos, hoveredMapTile, skill.aoeShape, skill.aoeRadius, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT);
        
        g.beginFill(0xff2222, 0.6);
        g.lineStyle(2, 0xff0000, 0.9);
        for (const tile of aoeTiles) {
          g.drawRect(tile.lx * TILE, tile.ly * TILE, TILE, TILE);
        }
        g.endFill();
      }
    }
  }, [skillTargetMode, selectedSkillId, selectedUnitId, hoveredMapTile, confirmedDest, units]);

  if (!skillTargetMode) return null;

  return <Graphics draw={draw} eventMode="none" />;
}
