// J:/AI/Game/SRPG/src/components/BattleAbandonModal.tsx
// 전투 포기 확인 모달 — 전장 화면에서 뒤로가기 또는 군략화면 버튼 클릭 시 표시

import { useCallback } from 'react';

interface BattleAbandonModalProps {
  onConfirm: () => void;
  onCancel:  () => void;
}

export default function BattleAbandonModal({ onConfirm, onCancel }: BattleAbandonModalProps) {
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  }, [onCancel]);

  return (
    <div
      className="absolute inset-0 z-[300] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
      onClick={handleBackdropClick}
    >
      {/* 패널 */}
      <div
        className="relative flex flex-col items-center gap-6 px-12 py-10 rounded-2xl shadow-2xl"
        style={{
          background: 'linear-gradient(160deg, #1a1c2e 0%, #0e0f1a 100%)',
          border: '1px solid rgba(255,90,90,0.35)',
          boxShadow: '0 0 60px rgba(200,40,40,0.25), 0 24px 60px rgba(0,0,0,0.7)',
          minWidth: 340,
        }}
      >
        {/* 상단 아이콘 */}
        <div
          className="flex items-center justify-center w-16 h-16 rounded-full text-4xl"
          style={{
            background: 'radial-gradient(circle, rgba(220,50,50,0.25) 0%, transparent 70%)',
            border: '2px solid rgba(220,50,50,0.4)',
          }}
        >
          🏳️
        </div>

        {/* 제목 */}
        <div className="flex flex-col items-center gap-1 text-center">
          <h2
            className="font-black text-2xl tracking-widest"
            style={{ color: '#f87171', textShadow: '0 0 20px rgba(248,113,113,0.5)' }}
          >
            전투 포기
          </h2>
          <p className="text-sm" style={{ color: 'rgba(200,200,220,0.75)' }}>
            전투를 포기하면 <span style={{ color: '#fbbf24' }}>패배</span>로 처리됩니다.
            <br />
            정말 군략화면으로 돌아가시겠습니까?
          </p>
        </div>

        {/* 구분선 */}
        <div className="w-full" style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />

        {/* 버튼 */}
        <div className="flex gap-4 w-full">
          {/* 취소 — 계속 전투 */}
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#e2e8f0',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.14)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)';
            }}
          >
            계속 전투
          </button>

          {/* 확인 — 포기 */}
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl font-black text-sm transition-all cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
              border: '1px solid rgba(239,68,68,0.5)',
              color: '#fecaca',
              boxShadow: '0 4px 20px rgba(200,40,40,0.3)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'linear-gradient(135deg, #991b1b 0%, #b91c1c 100%)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)';
            }}
          >
            🏳 포기하고 나가기
          </button>
        </div>
      </div>
    </div>
  );
}
