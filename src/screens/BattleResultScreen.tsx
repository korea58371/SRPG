// J:/AI/Game/SRPG/src/screens/BattleResultScreen.tsx
// 전투 결과 화면 — 승/패 표시 후 군략화면으로 복귀

import { useAppStore } from '../store/appStore';
import { useGameStore } from '../store/gameStore';
import { FACTIONS, PLAYER_FACTION } from '../constants/gameConfig';

export default function BattleResultScreen() {
  // 셀렉터 개별 구독 (객체 리터럴 셀렉터 → 무한루프 방지)
  const lastBattleOutcome = useAppStore(s => s.lastBattleOutcome);
  const goTo              = useAppStore(s => s.goTo);
  const provinces         = useAppStore(s => s.provinces);
  const clearBattleResult = useGameStore(s => s.clearBattleResult);

  const isWin = lastBattleOutcome === 'player_win';

  const handleContinue = () => {
    clearBattleResult();
    goTo('STRATEGY_MAP');
  };

  return (
    <div className="result-root">
      <div className={`result-card ${isWin ? 'result-win' : 'result-lose'}`}>
        <div className="result-emblem">{isWin ? '🏆' : '💀'}</div>
        <h2 className="result-title">{isWin ? '전투 승리!' : '전투 패배'}</h2>
        <p className="result-sub">
          {isWin
            ? '영토를 획득했습니다. 제국의 영광이 빛납니다!'
            : '아군이 물러섰습니다. 다음 기회를 노리십시오.'}
        </p>

        {/* 영토 현황 */}
        <div className="result-stats">
          <div className="result-stat-item">
            <span className="result-stat-label">
              <span style={{ color: '#' + (FACTIONS[PLAYER_FACTION]?.color?.toString(16).padStart(6, '0') || 'ffffff') }}>
                🔵 {FACTIONS[PLAYER_FACTION]?.name}
              </span>
            </span>
            <span className="result-stat-value">
              {Object.values(provinces).filter(p => p.owner === PLAYER_FACTION).length}성
            </span>
          </div>
          <div className="result-stat-item">
            <span className="result-stat-label">🔴 타 세력 합계</span>
            <span className="result-stat-value">
              {Object.values(provinces).filter(p => p.owner !== PLAYER_FACTION).length}성
            </span>
          </div>
        </div>

        <button className="result-btn" onClick={handleContinue}>
          군략화면으로 →
        </button>
      </div>
    </div>
  );
}
