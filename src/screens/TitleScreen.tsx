// J:/AI/Game/SRPG/src/screens/TitleScreen.tsx
// 메인 타이틀 화면

import { useAppStore } from '../store/appStore';

export default function TitleScreen() {
  const startGame = useAppStore(s => s.startGame);

  return (
    <div className="title-screen">
      {/* 배경 그라디언트 */}
      <div className="title-bg" />

      {/* 타이틀 */}
      <div className="title-content">
        <div className="title-emblem">⚔️</div>
        <h1 className="title-main">Fantasy SRPG</h1>
        <p className="title-sub">전략 턴제 대전략 게임</p>

        <div className="title-buttons">
          <button className="title-btn-primary" onClick={startGame}>
            🚀 게임 시작
          </button>
          <button className="title-btn-secondary" disabled>
            📖 이어하기 <span className="title-btn-soon">(준비 중)</span>
          </button>
          <button 
            onClick={() => {
              useAppStore.setState({ 
                pendingBattle: { attackerProvinceId: 'prov_0', defenderProvinceId: 'prov_1' } 
              });
              useAppStore.getState().goTo('BATTLE');
            }}
            style={{ marginTop: '10px', padding: '10px', background: 'red', color: 'white', zIndex: 9999, fontWeight: 'bold' }}
          >
            🚨 DEBUG: 바로 전투 진입
          </button>
        </div>

        <p className="title-version">v0.1.0 — Phase 1 Build</p>
      </div>

      {/* 배경 파티클 효과 (CSS only) */}
      <div className="title-particles">
        {Array.from({ length: 20 }).map((_, i) => (
          <span key={i} className="particle" style={{ '--i': i } as React.CSSProperties} />
        ))}
      </div>
    </div>
  );
}
