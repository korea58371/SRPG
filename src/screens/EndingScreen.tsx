// J:/AI/Game/SRPG/src/screens/EndingScreen.tsx
// 굿/배드 엔딩 화면

import { useAppStore } from '../store/appStore';
import { FACTIONS, PLAYER_FACTION } from '../constants/gameConfig';

export default function EndingScreen() {
  // 셀렉터 개별 구독 (객체 리터럴 셀렉터 → 무한루프 방지)
  const endingType   = useAppStore(s => s.endingType);
  const strategyTurn = useAppStore(s => s.strategyTurn);
  const provinces    = useAppStore(s => s.provinces);
  const resetGame    = useAppStore(s => s.resetGame);

  const isGood = endingType === 'good';
  const playerCount = Object.values(provinces).filter(p => p.owner === PLAYER_FACTION).length;
  const totalCount  = Object.values(provinces).length;
  const playerName = FACTIONS[PLAYER_FACTION]?.name || '아군';

  return (
    <div className={`ending-root ${isGood ? 'ending-good' : 'ending-bad'}`}>
      {/* 배경 파티클 */}
      <div className="ending-bg" />

      <div className="ending-content">
        <div className="ending-emblem">{isGood ? '🌟' : '💀'}</div>

        <h1 className="ending-title">
          {isGood ? 'GOOD ENDING' : 'BAD ENDING'}
        </h1>

        <p className="ending-story">
          {isGood
            ? `${strategyTurn}턴에 걸친 난세의 대정복전 끝에, ${playerName}은(는) ${totalCount}개 영토 중\n${playerCount}개를 지배하며 대륙의 패권을 장악하였다.\n황제는 영원한 평화의 시대를 선포하였다.`
            : `사방에서 몰려드는 적들의 맹공에 ${playerName}의 본거지가 함락되었다.\n${strategyTurn}턴의 저항 끝에, 지도자는 항복 문서에 서명하였다.\n제국의 깃발은 영원히 내려앉았다.`
          }
        </p>

        {/* 통계 */}
        <div className="ending-stats">
          <div className="ending-stat">
            <span className="ending-stat-num">{strategyTurn}</span>
            <span className="ending-stat-label">전략 턴</span>
          </div>
          <div className="ending-stat">
            <span className="ending-stat-num">{playerCount}/{totalCount}</span>
            <span className="ending-stat-label">점령 영토</span>
          </div>
        </div>

        <button className="ending-btn" onClick={resetGame}>
          🔄 처음으로
        </button>
      </div>
    </div>
  );
}
