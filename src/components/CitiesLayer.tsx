// J:/AI/Game/SRPG/src/components/CitiesLayer.tsx
// 거점(cities) 렌더링: 검회색 사각형 + 테두리로 표시
// TerrainMap 바로 위에 렌더링 (MoveRange/Units 아래)

import { Container, Graphics } from '@pixi/react';
import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../store/gameStore';
import { MAP_CONFIG } from '../constants/gameConfig';
import * as PIXI from 'pixi.js';

const CITY_COLOR  = 0x4a4a4a; // 검회색 배경
const BORDER_COLOR = 0x888888; // 밝은 회색 테두리
const T = MAP_CONFIG.TILE_SIZE;
const INSET = 4; // 타일 안쪽 여백

export default function CitiesLayer() {
  const cities = useGameStore(useShallow(s => s.cities));

  const draw = useCallback(
    (g: PIXI.Graphics) => {
      g.clear();
      for (const city of cities) {
        const bx = city.x * T + INSET;
        const by = city.y * T + INSET;
        const size = T - INSET * 2;

        // 검회색 배경
        g.beginFill(CITY_COLOR, 0.85);
        g.lineStyle(1.5, BORDER_COLOR, 1);
        g.drawRect(bx, by, size, size);
        g.endFill();

        // 중앙 작은 심볼 (십자가 모양으로 거점 표시)
        const cx = city.x * T + T / 2;
        const cy = city.y * T + T / 2;
        const arm = size * 0.22;
        const thick = 2.5;
        g.lineStyle(0);
        g.beginFill(BORDER_COLOR, 0.9);
        g.drawRect(cx - thick, cy - arm, thick * 2, arm * 2); // 세로
        g.drawRect(cx - arm,  cy - thick, arm * 2, thick * 2); // 가로
        g.endFill();
      }
    },
    [cities],
  );

  if (!cities.length) return null;

  return (
    <Container>
      <Graphics draw={draw} />
    </Container>
  );
}
