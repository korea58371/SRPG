// J:/AI/Game/SRPG/src/screens/TitleScreen.tsx
// 메인 타이틀 화면

import { useRef } from 'react';
import { useAppStore } from '../store/appStore';

export default function TitleScreen() {
  const startGame = useAppStore(s => s.startGame);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const scenarioData = JSON.parse(ev.target?.result as string);
        if (scenarioData && typeof scenarioData.seed === 'number' && scenarioData.factions) {
            startGame(scenarioData);
        } else {
            alert('올바른 시나리오 JSON 파일이 아닙니다.');
        }
      } catch (err) {
        alert("JSON 파싱 에러: " + err);
      }
    };
    reader.readAsText(file);
    // Reset value to allow loading the same file again
    e.target.value = '';
  };

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
          <button className="title-btn-primary" onClick={() => startGame()}>
            🚀 게임 시작
          </button>
          
          <input 
            type="file" 
            accept=".json" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleLoadFile} 
          />
          <button 
            className="title-btn-secondary" 
            onClick={() => fileInputRef.current?.click()}
            style={{ 
              marginTop: '10px', 
              padding: '12px', 
              background: '#0ea5e9', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            🗂️ 커스텀 시나리오 로드 (JSON)
          </button>

          <button className="title-btn-secondary" disabled>
            📖 이어하기 <span className="title-btn-soon">(준비 중)</span>
          </button>
          <button 
            onClick={() => useAppStore.getState().goTo('MAP_EDITOR')}
            style={{ 
              marginTop: '10px', 
              padding: '12px', 
              background: '#334155', 
              color: '#cbd5e1', 
              border: '1px solid #475569', 
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.2s',
            }}
            onMouseOver={e => e.currentTarget.style.background = '#475569'}
            onMouseOut={e => e.currentTarget.style.background = '#334155'}
          >
            🗺️ 시나리오 에디터 (개발 툴)
          </button>
          <button 
            onClick={() => {
              useAppStore.setState({ 
                pendingBattle: { attackerProvinceId: 'prov_0', defenderProvinceId: 'prov_1', isCheat: true } 
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
