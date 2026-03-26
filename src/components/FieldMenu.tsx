import { useState } from 'react';
import { useGameStore } from '../store/gameStore';

export default function FieldMenu() {
  const fieldMenuPos = useGameStore(s => s.fieldMenuPos);
  const closeFieldMenu = useGameStore(s => s.closeFieldMenu);
  
  const [showObjectives, setShowObjectives] = useState(false);
  const [confirmSurrender, setConfirmSurrender] = useState(false);
  
  // 외부 클릭 시 메뉴 닫기 방어막(전체 화면 투명 덮개 위임)
  if (!fieldMenuPos) return null;

  return (
    <div 
      className="absolute inset-0 z-[120]" 
      onClick={closeFieldMenu} 
      onContextMenu={(e) => { e.preventDefault(); closeFieldMenu(); }}
    >
      <div 
        className="absolute bg-neutral-900/95 border border-neutral-700 shadow-2xl rounded-lg py-2 min-w-[200px] pointer-events-auto backdrop-blur-md flex flex-col"
        // 화면 가장자리 클릭 시 메뉴가 짤리지 않도록 적절히 배치 로직 보강
        style={{ 
          left: Math.min(fieldMenuPos.x, window.innerWidth - 200), 
          top: Math.min(fieldMenuPos.y, window.innerHeight - (showObjectives || confirmSurrender ? 250 : 150)) 
        }}
        onClick={e => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {!showObjectives && !confirmSurrender ? (
          <>
            <button 
              className="w-full text-left px-5 py-3 hover:bg-neutral-800 text-neutral-200 text-sm font-bold border-b border-neutral-800 transition-colors"
              onClick={() => { 
                const s = useGameStore.getState();
                s.setUnitListModalOpen(true);
                closeFieldMenu(); 
              }}
            >
              📜 유닛 목록
            </button>
            <button 
              className="w-full text-left px-5 py-3 hover:bg-neutral-800 text-neutral-200 text-sm font-bold border-b border-neutral-800 transition-colors"
              onClick={() => setShowObjectives(true)}
            >
              🎯 승리 / 패배 조건
            </button>
            <button 
              className="w-full text-left px-5 py-3 hover:bg-red-950/80 text-red-400 text-sm font-bold transition-colors"
              onClick={() => setConfirmSurrender(true)}
            >
              🏳️ 포기하기
            </button>
          </>
        ) : showObjectives ? (
          <div className="px-5 py-3 flex flex-col gap-2">
            <h3 className="text-neutral-200 font-bold text-sm mb-1 border-b border-neutral-700 pb-1">🎯 미션 목표</h3>
            {(() => {
               const s = useGameStore.getState();
               return (
                 <>
                   <p className="text-blue-300 text-xs font-bold whitespace-pre-wrap">승리: {s.victoryCondition?.description || '없음'}</p>
                   <p className="text-red-300 text-xs font-bold whitespace-pre-wrap mt-1">패배: {s.defeatCondition?.description || '없음'}</p>
                 </>
               );
            })()}
            <button className="mt-3 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-1.5 rounded transition-colors" onClick={() => setShowObjectives(false)}>돌아가기</button>
          </div>
        ) : (
          <div className="px-5 py-3 flex flex-col gap-2 w-[220px]">
            <h3 className="text-red-500 font-bold text-sm mb-1 border-b border-red-900/50 pb-1">⚠️ 경고</h3>
            <p className="text-neutral-300 text-xs font-bold leading-relaxed">정말 전투를 포기하시겠습니까?<br />(즉시 패배 처리됩니다)</p>
            <div className="flex gap-2 mt-2">
              <button 
                className="flex-1 text-xs bg-red-900/80 hover:bg-red-700 text-white py-1.5 rounded font-bold transition-colors" 
                onClick={() => {
                  useGameStore.setState({ 
                    battleResult: { isVictory: false, turn: useGameStore.getState().turnNumber, survivorCount: 0 } 
                  });
                  closeFieldMenu();
                }}
              >
                포기
              </button>
              <button 
                className="flex-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-1.5 rounded transition-colors font-bold" 
                onClick={() => setConfirmSurrender(false)}
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
