// J:/AI/Game/SRPG/src/components/MapObjectsLayer.tsx
import { Container, Sprite } from '@pixi/react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../store/gameStore';
import { getTreeTexture, getMountainTexture, getCityTexture } from '../utils/objectTextures';

export default function MapObjectsLayer() {
  const mapObjects = useGameStore(useShallow(s => s.mapObjects));
  const hoveredMapPixel = useGameStore(useShallow(s => s.hoveredMapPixel));

  if (!mapObjects || mapObjects.length === 0) return null;

  return (
    <>
      {mapObjects.map(obj => {
        let tex = null;
        if (obj.type === 'TREE') tex = getTreeTexture();
        if (obj.type === 'MOUNTAIN') tex = getMountainTexture();
        if (obj.type === 'HOUSE') tex = getCityTexture();

        if (!tex) return null;

        // 마우스 호버 반경 내 오브젝트를 부드럽게 반투명화 (겹침 아티팩트 최소화)
        let alpha = 1.0;
        if (hoveredMapPixel) {
          const dx = obj.px - hoveredMapPixel.x;
          // py는 타일 하단 중앙 기준이므로, 나무 자체의 높이적 중심(약 10~20px 위쪽)을 보정
          const dy = (obj.py - 20) - hoveredMapPixel.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          const maxRadius = 140; // 픽셀 기준 반경
          if (dist < maxRadius) {
            // 거리에 따른 비율 (0 ~ 1)
            const ratio = dist / maxRadius;
            // Ease-in 곡선 적용 (중앙 부근에서 0.1을 최대한 오래 유지하다가 경계에서 1.0으로 상승)
            // 중앙일수록 alpha값을 최대한 낮춰 오브젝트 간의 더블 알파 겹침 패턴이 보이지 않게 함
            const easedRatio = ratio * ratio * ratio; 
            alpha = 0.05 + 0.95 * easedRatio;
          }
        }

        return (
          // 쿼터뷰에서 가장 완벽한 깊이(Depth) 정렬 기준은 스크린 Y좌표(py)입니다.
          <Container key={obj.id} x={obj.px} y={obj.py} zIndex={obj.py} alpha={alpha}>
            {/* 쿼터뷰 역변환 적용: 똑바로 서있도록 보정 */}
            <Container rotation={-Math.PI / 4} scale={{ x: 1, y: 2 }}>
              <Sprite 
                texture={tex} 
                anchor={{ x: 0.5, y: 1.0 }} // 하단 중앙이 기준점이 되어 타일 위에 '서 있는' 형태
                scale={obj.type === 'TREE' ? { x: 0.5, y: 0.5 } : { x: 1, y: 1 }}
              />
            </Container>
          </Container>
        );
      })}
    </>
  );
}
