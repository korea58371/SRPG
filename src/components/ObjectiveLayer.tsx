import { Container, Graphics, Text, useTick } from '@pixi/react';
import { useGameStore, tileToPixel } from '../store/gameStore';
import { MAP_CONFIG } from '../constants/gameConfig';
import { useRef } from 'react';
import * as PIXI from 'pixi.js';

export default function ObjectiveLayer() {
  const v = useGameStore(s => s.victoryCondition);
  const gRef = useRef<PIXI.Graphics>(null);
  
  useTick(() => {
    if (gRef.current) {
      gRef.current.alpha = (Math.sin(Date.now() / 200) + 1) / 2 * 0.5 + 0.3;
    }
  });

  if (v?.type !== 'REACH_LOCATION' || !v.targetTile) return null;

  const px = tileToPixel(v.targetTile.lx);
  const py = tileToPixel(v.targetTile.ly);

  // Z-색별 판정은 대상 타일의 Y값을 따름
  return (
    <Container x={px} y={py} zIndex={Math.max(1, py)}>
      <Graphics
        ref={gRef}
        draw={g => {
          g.clear();
          g.beginFill(0xffff00, 0.6); // 빛나는 노란색 바닥
          // 타일 중앙점(px, py) 기준으로 정 중앙에 정방형을 그려야 쿼터뷰에서 정확히 1타일에 핏하게 맞습니다.
          g.drawRect(-MAP_CONFIG.TILE_SIZE / 2, -MAP_CONFIG.TILE_SIZE / 2, MAP_CONFIG.TILE_SIZE, MAP_CONFIG.TILE_SIZE);
          g.endFill();
        }}
      />
      {/* 쿼터뷰 역보정으로 아이콘을 수직으로 세움 (오프셋 0으로 유닛과 동일본 정렬) */}
      <Container rotation={-Math.PI / 4} scale={{ x: 0.5, y: 1.0 }}>
        <Text
          text="🏁"
          style={new PIXI.TextStyle({ fontSize: 24 })}
          anchor={{ x: 0.5, y: 1.0 }}
          y={-6}
        />
      </Container>
    </Container>
  );
}
