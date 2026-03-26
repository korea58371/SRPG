import { useMemo } from 'react';
import { Sprite } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { MAP_CONFIG } from '../constants/gameConfig';
import { generateFogTexture } from '../utils/mapGenerator';

export default function FogLayer() {
  const texture = useMemo(() => {
    const canvas = generateFogTexture(MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT, MAP_CONFIG.TILE_SIZE);
    const tex = PIXI.Texture.from(canvas);
    tex.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
    return tex;
  }, []);

  return (
    <Sprite 
      texture={texture} 
      x={-6 * MAP_CONFIG.TILE_SIZE}
      y={-6 * MAP_CONFIG.TILE_SIZE}
      zIndex={300000}
      alpha={1}
      eventMode="none"
    />
  );
}
