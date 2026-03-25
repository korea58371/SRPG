import { useMemo } from 'react';
import { Sprite } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { MAP_CONFIG } from '../constants/gameConfig';
import { generateFogTexture } from '../utils/mapGenerator';

export default function FogLayer() {
  const texture = useMemo(() => {
    const canvas = generateFogTexture(MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT, MAP_CONFIG.TILE_SIZE);
    return PIXI.Texture.from(canvas);
  }, []);

  return (
    <Sprite 
      texture={texture} 
      x={-6 * MAP_CONFIG.TILE_SIZE}
      y={-6 * MAP_CONFIG.TILE_SIZE}
      zIndex={300000} // 유닛, 프롭 등 맵 위의 모든 요소들(높아도 보통 10000미만) 위에 위치
      alpha={1} 
    />
  );
}
