// J:/AI/Game/SRPG/src/App.tsx
// 단일 맵 소스 생성 후 store 주입
// 레이어 순서: TerrainMap → MoveRangeLayer → PathLayer → UnitsLayer → CloudShadow
// DOM: TurnHUD + ActionMenu + CombatLog

import { Stage } from '@pixi/react';
import { useEffect, useCallback } from 'react';
import TerrainMap from './components/TerrainMap';
import UnitsLayer from './components/UnitsLayer';
import MoveRangeLayer from './components/MoveRangeLayer';
import PathLayer from './components/PathLayer';
import AttackRangeLayer from './components/AttackRangeLayer';
import CloudShadow from './components/CloudShadow';
import ActionMenu from './components/ActionMenu';
import FloatingDamageLayer from './components/FloatingDamageLayer';
import { useGameStore } from './store/gameStore';
import { generateMapData } from './utils/mapGenerator';
import { MAP_CONFIG } from './constants/gameConfig';
import './index.css';

// ─── 전투 로그 ───────────────────────────────────────────────────────────────
function CombatLog() {
  const log = useGameStore(s => s.combatLog);
  if (!log.length) return null;
  return (
    <div className="absolute top-16 right-4 pointer-events-none">
      <div className="bg-black/70 border border-gray-700 rounded-lg p-2 text-[10px] text-gray-300 max-w-[200px]">
        <p className="text-gray-500 font-bold mb-1">전투 기록</p>
        {log.map((entry, i) => (
          <p key={i} className={`${i === 0 ? 'text-yellow-300' : 'text-gray-400'}`}>{entry}</p>
        ))}
      </div>
    </div>
  );
}

// ─── HUD ─────────────────────────────────────────────────────────────────────
function TurnHUD() {
  const currentTurn    = useGameStore(s => s.currentTurn);
  const turnNumber     = useGameStore(s => s.turnNumber);
  const selectedUnitId = useGameStore(s => s.selectedUnitId);
  const confirmedDest  = useGameStore(s => s.confirmedDestination);
  const units          = useGameStore(s => s.units);
  const selectUnit     = useGameStore(s => s.selectUnit);
  const endPlayerTurn  = useGameStore(s => s.endPlayerTurn);

  const handleDeselect = useCallback(() => selectUnit(null), [selectUnit]);
  const isPlayerTurn = currentTurn === 'player';

  // 아군 생존/행동 현황
  const playerUnits = Object.values(units).filter(u => u.factionId === 'western_empire' && u.state !== 'DEAD');
  const actedCount  = playerUnits.filter(u => u.hasActed).length;
  const enemyAlive  = Object.values(units).filter(u => u.factionId === 'eastern_alliance' && u.state !== 'DEAD').length;

  return (
    <>
      {/* 상단 좌: 타이틀 */}
      <div className="absolute top-0 left-0 p-4 pointer-events-none">
        <h1 className="text-white text-2xl font-extrabold drop-shadow-lg">⚔️ Fantasy SRPG</h1>
        <p className="text-gray-400 text-xs mt-1">Turn {turnNumber}</p>
      </div>

      {/* 상단 우: 현재 턴 + 전력 현황 */}
      <div className={`absolute top-4 right-4 flex flex-col items-end gap-1 pointer-events-none`}>
        <div className={`px-4 py-2 rounded-lg border text-sm font-bold transition-all ${
          isPlayerTurn ? 'bg-blue-900/80 border-blue-400 text-blue-200' : 'bg-red-900/80 border-red-400 text-red-200'}`}>
          {isPlayerTurn ? `🔵 플레이어 턴 (${actedCount}/${playerUnits.length} 행동)` : '🔴 적군 턴 처리 중...'}
        </div>
        <div className="text-xs text-gray-400">
          아군 {playerUnits.length}기 · 적군 {enemyAlive}기 생존
        </div>
      </div>

      {/* 하단 상태바 */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
        <div className="bg-black/70 border border-gray-600 rounded-xl px-6 py-3 text-white text-sm flex items-center gap-6">
          {confirmedDest ? (
            <span className="text-yellow-300 font-bold">🎯 이동 확정 — 행동을 선택하세요 (우클릭=취소)</span>
          ) : selectedUnitId ? (
            <>
              <span className="text-yellow-300 font-bold">✅ 유닛 선택됨</span>
              <span className="text-gray-300">타일을 선택하여 이동</span>
              <button className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-xs pointer-events-auto cursor-pointer" onClick={handleDeselect}>
                선택 해제 [우클릭]
              </button>
            </>
          ) : (
            <span className="text-gray-300">
              {isPlayerTurn
                ? actedCount === playerUnits.length
                  ? '✔ 모든 유닛 행동 완료 — 턴 종료를 누르세요'
                  : '🖱 파란 유닛 클릭 (행동 안 한 유닛만 선택 가능)'
                : '⏳ 적 AI가 행동 중...'}
            </span>
          )}

          {isPlayerTurn && !confirmedDest && (
            <button
              className="bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded font-bold text-xs pointer-events-auto cursor-pointer ml-4"
              onClick={endPlayerTurn}
            >
              턴 종료 →
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  const setMapData          = useGameStore(s => s.setMapData);
  const initUnits           = useGameStore(s => s.initUnits);
  const mapData             = useGameStore(s => s.mapData);
  const selectUnit          = useGameStore(s => s.selectUnit);
  const selectedUnitId      = useGameStore(s => s.selectedUnitId);
  const cancelConfirmedMove = useGameStore(s => s.cancelConfirmedMove);
  const confirmedDest       = useGameStore(s => s.confirmedDestination);

  useEffect(() => {
    const { map } = generateMapData(MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT);
    setMapData(map);
  }, [setMapData]);

  useEffect(() => {
    if (mapData) initUnits(MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT);
  }, [mapData, initUnits]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (confirmedDest) cancelConfirmedMove();
    else if (selectedUnitId) selectUnit(null);
  }, [confirmedDest, cancelConfirmedMove, selectedUnitId, selectUnit]);

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative font-sans" onContextMenu={handleContextMenu}>
      <Stage
        width={window.innerWidth}
        height={window.innerHeight}
        options={{ autoDensity: true, resolution: window.devicePixelRatio, backgroundColor: 0x111111 }}
      >
        <TerrainMap />
        <MoveRangeLayer />
        <AttackRangeLayer />
        <PathLayer />
        <UnitsLayer />
        <CloudShadow />
      </Stage>

      <TurnHUD />
      <ActionMenu />
      <FloatingDamageLayer />
      <CombatLog />
    </div>
  );
}

export default App;
