// J:/AI/Game/SRPG/src/components/FloatingDamageLayer.tsx
// 전투 데미지 플로팅 텍스트 (DOM 기반, CSS 애니메이션)
// 월드 좌표(tileToPixel) → 아이소메트릭 화면 좌표 변환 후 표시

import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import type { FloatingDamage } from '../store/gameStore';

const DURATION_MS = 1400;

interface Camera { x: number; y: number; scale: number }

// 월드 좌표 → 화면 픽셀 좌표 변환
// 부모 Container: x=camera.x, y=camera.y, scale=camera.scale
// 내부 Container: scale=(1, 0.5), rotation=45° (Math.PI/4)
function worldToScreen(wx: number, wy: number, camera: Camera): { sx: number; sy: number } {
  const cos45 = Math.SQRT1_2; // 1 / √2
  const sin45 = Math.SQRT1_2;
  // rotation(45°) 적용
  const rx = wx * cos45 - wy * sin45;
  const ry = wx * sin45 + wy * cos45;
  // scale(1, 0.5) 적용
  const scx = rx;
  const scy = ry * 0.5;
  // camera 적용
  return {
    sx: scx * camera.scale + camera.x,
    sy: scy * camera.scale + camera.y,
  };
}

function FloatingDamageItem({ dmg, camera }: { dmg: FloatingDamage; camera: Camera }) {
  const remove = useGameStore(s => s.removeFloatingDamage);

  useEffect(() => {
    const timer = setTimeout(() => remove(dmg.id), DURATION_MS);
    return () => clearTimeout(timer);
  }, [dmg.id, remove]);

  const { sx, sy } = worldToScreen(dmg.x, dmg.y, camera);

  return (
    <div
      key={dmg.id}
      className="absolute pointer-events-none select-none font-extrabold"
      style={{
        left: sx,
        top: sy,
        transform: 'translate(-50%, -50%)',
        fontSize: dmg.isCrit ? '22px' : '16px',
        color: dmg.isHeal ? '#22c55e' : dmg.isWeak ? '#fca5a5' : dmg.isResist ? '#9ca3af' : dmg.isCrit ? '#ffe040' : '#ffffff',
        textShadow: dmg.isCrit
          ? '0 0 8px #ff8800, 0 2px 4px rgba(0,0,0,0.9)'
          : '0 2px 4px rgba(0,0,0,0.9)',
        animation: `floatDamage ${DURATION_MS}ms ease-out forwards`,
        zIndex: 100,
      }}
    >
      <div className="flex flex-col items-center justify-center">
        <span>{dmg.isHeal ? `+${dmg.value}` : dmg.isCrit ? `💥${dmg.value}!` : dmg.value}</span>
        {dmg.isWeak && <span className="block text-[11px] font-black text-red-300 -mt-1 drop-shadow-md">WEAK</span>}
        {dmg.isResist && <span className="block text-[11px] font-bold text-gray-400 -mt-1 drop-shadow-md">RESIST</span>}
      </div>
    </div>
  );
}

interface FloatingDamageLayerProps { camera: Camera }

export default function FloatingDamageLayer({ camera }: FloatingDamageLayerProps) {
  const damages = useGameStore(s => s.floatingDamages);

  return (
    <>
      {/* CSS keyframe 정의 */}
      <style>{`
        @keyframes floatDamage {
          0%   { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
          15%  { transform: translate(-50%, -60%) scale(1.0); }
          80%  { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -110%) scale(0.9); }
        }
      `}</style>
      {damages.map(dmg => (
        <FloatingDamageItem key={dmg.id} dmg={dmg} camera={camera} />
      ))}
    </>
  );
}
