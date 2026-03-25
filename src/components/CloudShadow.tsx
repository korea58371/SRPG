import { useRef, useMemo, useState, useEffect } from 'react';
import { TilingSprite, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { ENVIRONMENT_CONFIG } from '../constants/gameConfig';

export default function CloudShadow() {
  const spriteRef = useRef<PIXI.TilingSprite>(null);
  
  // 구름 효과를 내기 위한 임시 Procedural SVG
  // 패턴이 반복될 때 자연스럽도록 가장자리가 부드러운 구름을 생성합니다.
  const cloudTexture = useMemo(() => {
    const svgData = `
    <svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
      <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="80"/>
      </filter>
      <!-- 가장자리 타일링 연결부를 자연스럽게 하기 위해 위치를 중앙으로 모으고 부드럽게 퍼지게 함 -->
      <circle cx="200" cy="200" r="150" fill="black" filter="url(#blur)" opacity="0.6"/>
      <circle cx="600" cy="300" r="200" fill="black" filter="url(#blur)" opacity="0.8"/>
      <circle cx="350" cy="600" r="220" fill="black" filter="url(#blur)" opacity="0.7"/>
    </svg>`;
    const cloudUrl = `data:image/svg+xml;base64,${btoa(svgData)}`;
    return PIXI.Texture.from(cloudUrl);
  }, []);

  const [isLoaded, setIsLoaded] = useState(false);
  
  useEffect(() => {
    if (cloudTexture.baseTexture.valid) {
      setIsLoaded(true);
    } else {
      cloudTexture.baseTexture.once('loaded', () => setIsLoaded(true));
      cloudTexture.baseTexture.once('error', () => setIsLoaded(true)); // 에러 발생 시 무한로딩 방지
    }
  }, [cloudTexture]);

  useTick((delta) => {
    if (!spriteRef.current) return;
    
    // TilingSprite는 tilePosition을 이동시켜 레이어 자체는 고정된 채 패턴만 흐르게 합니다.
    spriteRef.current.tilePosition.x += ENVIRONMENT_CONFIG.CLOUD_SPEED_X * Number(delta);
    spriteRef.current.tilePosition.y += ENVIRONMENT_CONFIG.CLOUD_SPEED_Y * Number(delta);
  });

  if (!isLoaded) return null;

  return (
    <TilingSprite
      ref={spriteRef}
      texture={cloudTexture}
      tilePosition={{ x: 0, y: 0 }}
      // 맵 전체를 덮도록 충분히 넓은 영역 지정 (등각투영 변환 후에도 덮여야 함)
      width={4000}  
      height={4000} 
      // 구름 패턴 자체의 크기는 30% 로 축소 (유저 요청 반영)
      tileScale={{ x: 0.3, y: 0.3 }}
      alpha={ENVIRONMENT_CONFIG.CLOUD_IMG_OPACITY}
      x={-1000} // x, y 범위를 -1000부터 시작하게 해서 중앙 맵 전체를 덮음
      y={-1000}
      zIndex={400000} // FogLayer(300000)보다 높게 설정하여 안개 위에 렌더링
      blendMode={PIXI.BLEND_MODES.MULTIPLY} // 하위 레이어와 섞여 실제 어두운 구름 그림자 느낌
    />
  );
}
