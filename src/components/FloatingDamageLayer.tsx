// J:/AI/Game/SRPG/src/components/FloatingDamageLayer.tsx
// 전투 데미지 플로팅 텍스트 (DOM 기반, CSS 애니메이션)
// - 1.4초 동안 위로 60px 상승 + 페이드아웃
// - 크리티컬: 노란색, 크게 표시
// - 일반: 흰색

import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import type { FloatingDamage } from '../store/gameStore';

const DURATION_MS = 1400;

function FloatingDamageItem({ dmg }: { dmg: FloatingDamage }) {
  const remove = useGameStore(s => s.removeFloatingDamage);

  useEffect(() => {
    const timer = setTimeout(() => remove(dmg.id), DURATION_MS);
    return () => clearTimeout(timer);
  }, [dmg.id, remove]);

  return (
    <div
      key={dmg.id}
      className="absolute pointer-events-none select-none font-extrabold"
      style={{
        left: dmg.x,
        top: dmg.y,
        transform: 'translate(-50%, -50%)',
        fontSize: dmg.isCrit ? '22px' : '16px',
        color: dmg.isCrit ? '#ffe040' : '#ffffff',
        textShadow: dmg.isCrit
          ? '0 0 8px #ff8800, 0 2px 4px rgba(0,0,0,0.9)'
          : '0 2px 4px rgba(0,0,0,0.9)',
        animation: `floatDamage ${DURATION_MS}ms ease-out forwards`,
        zIndex: 100,
      }}
    >
      {dmg.isCrit ? `💥${dmg.value}!` : dmg.value}
    </div>
  );
}

export default function FloatingDamageLayer() {
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
        <FloatingDamageItem key={dmg.id} dmg={dmg} />
      ))}
    </>
  );
}
