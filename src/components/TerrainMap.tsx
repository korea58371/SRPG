// J:/AI/Game/SRPG/src/components/TerrainMap.tsx
// 지형 렌더링: 통짜 부드러운 텍스처(캔버스)를 생성하여 단일 Sprite로 렌더링

import { useEffect, useState } from 'react';
import { Container, Sprite } from '@pixi/react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../store/gameStore';
import { MAP_CONFIG } from '../constants/gameConfig';
import * as PIXI from 'pixi.js';
import { generateMapTexture } from '../utils/mapGenerator';

export default function TerrainMap() {
  const mapData = useGameStore(useShallow(s => s.mapData));
  const [texture, setTexture] = useState<PIXI.Texture | null>(null);

  useEffect(() => {
    if (!mapData) return;
    
    // mapData를 이용해 단색 기반 캔버스 텍스처를 구워냄
    const canvas = generateMapTexture(MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT, MAP_CONFIG.TILE_SIZE, mapData);
    const newTex = PIXI.Texture.from(canvas);
    newTex.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
    setTexture(newTex);
    
    return () => {
      newTex.destroy(true);
    };
  }, [mapData]);

  if (!texture) return null;

  return (
    <Container>
      {/* 1500개의 타일 대신, 단 1개의 거대한 통짜 스프라이트 렌더링 (퍼포먼스 극비 확보 + 시각적 부드러움) */}
      <Sprite 
        texture={texture} 
        x={0} 
        y={0} 
      />
    </Container>
  );
}
