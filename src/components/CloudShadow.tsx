import { useRef, useMemo } from 'react';
import { Sprite, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { ENVIRONMENT_CONFIG } from '../constants/gameConfig';

export default function CloudShadow() {
  const spriteRef = useRef<PIXI.Sprite>(null);
  
  // 구름 효과를 내기 위한 임시 Procedural SVG (실제 cloud.png 교체 가능)
  const cloudTexture = useMemo(() => {
    const svgData = `
    <svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
      <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="60"/>
      </filter>
      <circle cx="300" cy="300" r="200" fill="black" filter="url(#blur)" opacity="0.8"/>
      <circle cx="500" cy="450" r="250" fill="black" filter="url(#blur)" opacity="0.8"/>
      <circle cx="400" cy="650" r="180" fill="black" filter="url(#blur)" opacity="0.8"/>
    </svg>`;
    const cloudUrl = `data:image/svg+xml;base64,${btoa(svgData)}`;
    return PIXI.Texture.from(cloudUrl);
  }, []);

  // requestAnimationFrame 역할을 하는 PixiJS 고속 게임 루프 렌더러
  useTick((delta) => {
    if (!spriteRef.current) return;
    
    // 대각선으로 흘러가는 구름 애니메이션 적용
    spriteRef.current.x += ENVIRONMENT_CONFIG.CLOUD_SPEED_X * Number(delta);
    spriteRef.current.y += ENVIRONMENT_CONFIG.CLOUD_SPEED_Y * Number(delta);
    
    // 루프 처리: 맵 밖으로 나가면 원위치로 초기화
    if (spriteRef.current.x > ENVIRONMENT_CONFIG.CLOUD_BOUNDS.endX) {
      spriteRef.current.x = ENVIRONMENT_CONFIG.CLOUD_BOUNDS.startX;
      spriteRef.current.y = ENVIRONMENT_CONFIG.CLOUD_BOUNDS.startY;
    }
  });

  return (
    <Sprite
      ref={spriteRef}
      texture={cloudTexture}
      width={4000}  // 맵 전체를 덮는 매우 큰 사이즈
      height={3000}
      alpha={ENVIRONMENT_CONFIG.CLOUD_IMG_OPACITY}  // 반투명한 그림자 레이어
      x={ENVIRONMENT_CONFIG.CLOUD_BOUNDS.startX}
      y={ENVIRONMENT_CONFIG.CLOUD_BOUNDS.startY}
      blendMode={PIXI.BLEND_MODES.MULTIPLY} // 하위 레이어와 섞여 실제 어두운 구름 그림자 느낌
    />
  );
}
