import { useRef, useMemo, useState, useEffect } from 'react';
import { Container, Sprite, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { ENVIRONMENT_CONFIG } from '../constants/gameConfig';

// 4x4 그리드를 만들기 위한 배열 (1개의 크기 1000px -> 총 4000x4000 영역 커버)
const TILE_GRID = [0, 1, 2, 3];
const TILE_SIZE = 1000;

export default function CloudShadow() {
  const containerRef = useRef<PIXI.Container>(null);
  
  // 구름 효과를 내기 위한 임시 Procedural SVG
  // 패턴이 반복될 때 자연스럽도록 가장자리가 부드러운 구름을 생성합니다.
  const cloudTexture = useMemo(() => {
    const svgData = `
    <svg width="${TILE_SIZE}" height="${TILE_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="80"/>
      </filter>
      <!-- Scattered clouds for natural tiling -->
      <circle cx="300" cy="300" r="200" fill="black" filter="url(#blur)" opacity="0.6"/>
      <circle cx="700" cy="400" r="250" fill="black" filter="url(#blur)" opacity="0.8"/>
      <circle cx="450" cy="800" r="180" fill="black" filter="url(#blur)" opacity="0.7"/>
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
    if (!containerRef.current) return;
    
    // TilingSprite의 tilePosition 이동을 Container 이동으로 직접 에뮬레이션합니다.
    containerRef.current.x += ENVIRONMENT_CONFIG.CLOUD_SPEED_X * Number(delta);
    containerRef.current.y += ENVIRONMENT_CONFIG.CLOUD_SPEED_Y * Number(delta);

    // X 속도가 전진(+)인 경우, 맵을 충분히 덮은 타일 1개 분량만큼 이동하면 다시 뒤로 당겨 무한 타일링(Loop)을 구현합니다.
    if (containerRef.current.x > 0) containerRef.current.x -= TILE_SIZE;
    if (containerRef.current.y > 0) containerRef.current.y -= TILE_SIZE;
  });

  if (!isLoaded) return null;

  return (
    <Container
      ref={containerRef}
      // 컨테이너 자체를 -1000 ~ 0 사이에서 계속 순환시킴으로써, 내부에 배열된 첫 스프라이트가 항상 화면 좌상단 너머를 덮게 함
      x={-TILE_SIZE}
      y={-TILE_SIZE}
      alpha={ENVIRONMENT_CONFIG.CLOUD_IMG_OPACITY}
      zIndex={400000} // FogLayer(300000)보다 높게 설정하여 안개 위에 렌더링
      eventMode="none"  // 클릭 이벤트를 가로체지 않도록 (4000x4000 커버 때문에 필수)
    >
      {/* 4x4 (16개)의 Sprite를 바둑판 배열하여 총 4000x4000 넓이를 덮음 */}
      {TILE_GRID.map(xi =>
        TILE_GRID.map(yi => (
          <Sprite
            key={`${xi}-${yi}`}
            texture={cloudTexture}
            x={xi * TILE_SIZE}
            y={yi * TILE_SIZE}
            width={TILE_SIZE}
            height={TILE_SIZE}
            blendMode={PIXI.BLEND_MODES.MULTIPLY}
            eventMode="none"
          />
        ))
      )}
    </Container>
  );
}
