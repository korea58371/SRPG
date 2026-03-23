// J:/AI/Game/SRPG/src/components/TurnEndPrompt.tsx
// 아군 유닛이 모두 행동을 마쳤을 때 턴 종료 확인 팝업
// - 모든 아군의 hasActed === true → 팝업 표시
// - 예: endPlayerTurn() 호출, 아니오: 팝업 닫기 (맵 확인 가능)

import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export default function TurnEndPrompt() {
  const [dismissed, setDismissed] = useState(false);

  const currentTurn    = useGameStore(s => s.currentTurn);
  const units          = useGameStore(s => s.units);
  const endPlayerTurn  = useGameStore(s => s.endPlayerTurn);

  // 아군 유닛 중 살아있고 아직 행동 안 한 유닛 수
  const playerUnits = Object.values(units).filter(
    u => u.factionId === 'western_empire' && u.state !== 'DEAD'
  );
  const allActed = playerUnits.length > 0 && playerUnits.every(u => u.hasActed);
  const shouldShow = currentTurn === 'player' && allActed && !dismissed;

  // 새 턴 시작(다음 player 턴)이 되면 dismissed 초기화
  useEffect(() => {
    setDismissed(false);
  }, [currentTurn]);

  if (!shouldShow) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto bg-gray-900/95 border border-yellow-500 rounded-2xl shadow-2xl backdrop-blur-sm px-8 py-6 flex flex-col items-center gap-4"
           style={{ minWidth: 280 }}>
        
        <div className="text-center">
          <p className="text-yellow-400 text-lg font-bold mb-1">⚑ 모든 아군 행동 완료</p>
          <p className="text-gray-300 text-sm">
            {playerUnits.length}기의 아군이 모두 행동을 마쳤습니다.<br/>
            적군 턴으로 넘어가시겠습니까?
          </p>
        </div>

        <div className="flex gap-3 w-full">
          <button
            className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 rounded-xl transition-all cursor-pointer text-sm"
            onClick={endPlayerTurn}
          >
            턴 종료 →
          </button>
          <button
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold py-2 rounded-xl transition-all cursor-pointer text-sm"
            onClick={() => setDismissed(true)}
          >
            계속 보기
          </button>
        </div>
      </div>
    </div>
  );
}
