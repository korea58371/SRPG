import { useMemo } from 'react';
import { Container, Sprite } from '@pixi/react';
import { generateMapData } from '../utils/mapGenerator';
import { TerrainType } from '../types/gameTypes';
import { MAP_CONFIG } from '../constants/gameConfig';
import * as PIXI from 'pixi.js';

const COLORS = {
  [TerrainType.SEA]: 0x1c4587,
  [TerrainType.BEACH]: 0xe6b8af,
  [TerrainType.GRASS]: 0x38761d,
  [TerrainType.CLIFF]: 0x4a3623,
  [TerrainType.PATH]: 0xd2b48c
};

export default function TerrainMap() {
  const { map } = useMemo(() => generateMapData(MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT), []);

  return (
    <Container>
      {map.map((row, y) => 
        row.map((type, x) => (
          <Sprite
            key={`${x}-${y}`}
            texture={PIXI.Texture.WHITE}
            tint={COLORS[type]}
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
