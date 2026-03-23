// J:/AI/Game/SRPG/src/components/TerrainMap.tsx
// 지형 렌더링: App.tsx가 store에 주입한 단일 mapData를 구독하여 렌더링
// generateMapData를 직접 호출하지 않음 → 유닛 배치 지형과 동일한 맵 보장

import { Container, Sprite } from '@pixi/react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../store/gameStore';
import { TerrainType } from '../types/gameTypes';
import { MAP_CONFIG } from '../constants/gameConfig';
import * as PIXI from 'pixi.js';

const COLORS: Record<number, number> = {
  [TerrainType.SEA]:    0x1c4587, // 짙은 파란색
  [TerrainType.BEACH]:  0xe6b8af, // 연살색 모래
  [TerrainType.GRASS]:  0x8BAA68, // 올리브 세이지 초원
  [TerrainType.CLIFF]:  0x4a3623, // 짙은 갈색 절벽
  [TerrainType.PATH]:   0xEDE8D0, // 밝은 아이보리 길
  [TerrainType.FOREST]: 0x263A18, // 짙은 암녹색 숲
};

export default function TerrainMap() {
  // store의 단일 맵 데이터를 구독 (useShallow로 불필요한 리렌더 방지)
  const mapData = useGameStore(useShallow(s => s.mapData));

  if (!mapData) return null;

  return (
    <Container>
      {mapData.map((row, y) =>
        row.map((type, x) => (
          <Sprite
            key={`${x}-${y}`}
            texture={PIXI.Texture.WHITE}
            tint={COLORS[type] ?? 0x000000}
            width={MAP_CONFIG.TILE_SIZE}
            height={MAP_CONFIG.TILE_SIZE}
            x={x * MAP_CONFIG.TILE_SIZE}
            y={y * MAP_CONFIG.TILE_SIZE}
          />
        ))
      )}
    </Container>
  );
}
