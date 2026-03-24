// J:/AI/Game/SRPG/src/App.tsx
// 최상위 라우터 — AppScreen enum에 따라 화면 전환
// 전투 결과 감지 + 모바일 뒤로가기 인터셉트 포함

import { Stage }        from '@pixi/react';
import { useEffect, useCallback } from 'react';
import TerrainMap       from './components/TerrainMap';
import UnitsLayer       from './components/UnitsLayer';
import MoveRangeLayer   from './components/MoveRangeLayer';
import PathLayer        from './components/PathLayer';
import AttackRangeLayer from './components/AttackRangeLayer';
import CitiesLayer      from './components/CitiesLayer';
import CloudShadow      from './components/CloudShadow';
import ActionMenu       from './components/ActionMenu';
import FloatingDamageLayer from './components/FloatingDamageLayer';
import UnitInfoPanel    from './components/UnitInfoPanel';
import TurnEndPrompt    from './components/TurnEndPrompt';
import { useGameStore } from './store/gameStore';
import { useAppStore }  from './store/appStore';
import { generateMapData } from './utils/mapGenerator';
import { MAP_CONFIG, PLAYER_FACTION }   from './constants/gameConfig';

// 화면 컴포넌트
import TitleScreen       from './screens/TitleScreen';
import StrategyMapScreen from './screens/StrategyMapScreen';
import BattleResultScreen from './screens/BattleResultScreen';
import EndingScreen      from './screens/EndingScreen';

import './index.css';

// ─── 전투 로그 ─────────────────────────────────────────────────────────────
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

// ─── HUD ──────────────────────────────────────────────────────────────────
function TurnHUD() {
  const activeUnitId   = useGameStore(s => s.activeUnitId);
  const turnNumber     = useGameStore(s => s.turnNumber);
  const selectedUnitId = useGameStore(s => s.selectedUnitId);
  const confirmedDest  = useGameStore(s => s.confirmedDestination);
  const units          = useGameStore(s => s.units);
  const selectUnit     = useGameStore(s => s.selectUnit);
  const endUnitTurn    = useGameStore(s => s.endUnitTurn);
  const biome          = useGameStore(s => s.biome);
  const goTo           = useAppStore(s => s.goTo);

  const handleDeselect = useCallback(() => selectUnit(null), [selectUnit]);

  const activeUnit = activeUnitId ? units[activeUnitId] : null;
  const isPlayerTurn = activeUnit?.factionId === PLAYER_FACTION;

  const playerUnits = Object.values(units).filter(u => u.factionId === PLAYER_FACTION && u.state !== 'DEAD');
  const enemyAlive  = Object.values(units).filter(u => u.factionId !== PLAYER_FACTION && u.state !== 'DEAD').length;

  return (
    <>
      {/* 상단 좌 */}
      <div className="absolute top-0 left-0 p-4 pointer-events-none">
        <h1 className="text-white text-2xl font-extrabold drop-shadow-lg">⚔️ Fantasy SRPG</h1>
        <p className="text-gray-400 text-xs mt-1">Turn {turnNumber}</p>
        {biome && <p className="text-gray-500 text-xs mt-0.5">🗺 {biome.label}</p>}
      </div>

      {/* 상단 우 */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-1 pointer-events-none">
        <div className={`px-4 py-2 rounded-lg border text-sm font-bold transition-all ${
          isPlayerTurn ? 'bg-blue-900/80 border-blue-400 text-blue-200' : 'bg-red-900/80 border-red-400 text-red-200'}`}>
          {isPlayerTurn
            ? `🔵 아군 행동 (${activeUnit?.unitType ?? '?'} · Turn ${turnNumber})`
            : '🔴 적군 행동 처리 중...'}
        </div>
        <div className="text-xs text-gray-400">
          아군 {playerUnits.length}기 · 적군 {enemyAlive}기 생존
        </div>
        {/* 군략화면으로 복귀 버튼 */}
        <button
          className="mt-1 px-3 py-1 rounded bg-gray-800/80 border border-gray-600 text-gray-300 text-xs pointer-events-auto cursor-pointer hover:bg-gray-700/80"
          onClick={() => goTo('STRATEGY_MAP')}
        >
          🗺 군략화면
        </button>
      </div>

      {/* 하단 */}
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
                ? '🖱 아군 유닛 클릭하여 이동'
                : '⏳ 적군 행동 중...'}
            </span>
          )}
          {isPlayerTurn && !confirmedDest && (
            <button
              className="bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded font-bold text-xs pointer-events-auto cursor-pointer ml-4"
              onClick={endUnitTurn}
            >
              행동 종료 →
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── 전투 화면 ───────────────────────────────────────────────────────────────
function BattleScreen() {
  const setMapData          = useGameStore(s => s.setMapData);
  const setCities           = useGameStore(s => s.setCities);
  const setBattleType       = useGameStore(s => s.setBattleType);
  const setBiome            = useGameStore(s => s.setBiome);
  const initUnits           = useGameStore(s => s.initUnits);
  const mapData             = useGameStore(s => s.mapData);
  const units               = useGameStore(s => s.units);
  const selectUnit          = useGameStore(s => s.selectUnit);
  const selectedUnitId      = useGameStore(s => s.selectedUnitId);
  const cancelConfirmedMove = useGameStore(s => s.cancelConfirmedMove);
  const confirmedDest       = useGameStore(s => s.confirmedDestination);
  const battleResult        = useGameStore(s => s.battleResult);
  const clearBattleResult   = useGameStore(s => s.clearBattleResult);
  const resolveBattle       = useAppStore(s => s.resolveBattle);
  const pendingBattle       = useAppStore(s => s.pendingBattle);
  const provinces           = useAppStore(s => s.provinces);

  const isReady   = mapData !== null;
  const isStarted = Object.keys(units).length > 0;

  // 맵 초기화 (전투 진입 시마다)
  useEffect(() => {
    const { map, cities, mapInfo } = generateMapData(MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT);
    setMapData(map);
    setCities(cities);
    setBiome(mapInfo);
  }, [setMapData, setCities, setBiome]);

  // 전투 결과 감지 → appStore로 전달
  useEffect(() => {
    if (!battleResult) return;
    resolveBattle(battleResult);
    clearBattleResult();
  }, [battleResult, resolveBattle, clearBattleResult]);

  const handleStartBattle = useCallback((type: 'defensive' | 'offensive') => {
    if (!pendingBattle) return;
    const attackerId = provinces[pendingBattle.attackerProvinceId]?.owner || PLAYER_FACTION;
    const defenderId = provinces[pendingBattle.defenderProvinceId]?.owner || 'faction_02';
    
    setBattleType(type);
    useGameStore.setState({ battleType: type });
    initUnits(MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT, attackerId, defenderId);
  }, [setBattleType, initUnits, pendingBattle, provinces]);

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
        <CitiesLayer />
        <MoveRangeLayer />
        <AttackRangeLayer />
        <PathLayer />
        <UnitsLayer />
        <CloudShadow />
      </Stage>

      {/* 전장 타입 선택 오버레이 */}
      {isReady && !isStarted && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <div className="bg-black/80 border border-gray-600 rounded-2xl p-10 flex flex-col items-center gap-6 shadow-2xl">
            <h2 className="text-white text-3xl font-extrabold tracking-wide">⚔️ 전장 선택</h2>
            <p className="text-gray-400 text-sm">배치 방식이 달라집니다</p>
            <div className="flex gap-6 mt-2">
              <button
                onClick={() => handleStartBattle('defensive')}
                className="flex flex-col items-center gap-2 bg-blue-900/80 border border-blue-500 hover:bg-blue-700/80 text-white px-8 py-5 rounded-xl transition-all cursor-pointer"
              >
                <span className="text-4xl">🛡</span>
                <span className="font-bold text-lg">수비전</span>
                <span className="text-xs text-blue-300 text-center max-w-[140px]">아군이 거점 주변 배치<br />적군은 맵 가장자리에서 침입</span>
              </button>
              <button
                onClick={() => handleStartBattle('offensive')}
                className="flex flex-col items-center gap-2 bg-red-900/80 border border-red-500 hover:bg-red-700/80 text-white px-8 py-5 rounded-xl transition-all cursor-pointer"
              >
                <span className="text-4xl">⚔️</span>
                <span className="font-bold text-lg">공격전</span>
                <span className="text-xs text-red-300 text-center max-w-[140px]">아군이 길목(좌측)에서 진격<br />적군은 거점 주변 방어</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <TurnHUD />
      <ActionMenu />
      <TurnEndPrompt />
      <UnitInfoPanel />
      <FloatingDamageLayer />
      <CombatLog />
    </div>
  );
}

// ─── 최상위 라우터 ────────────────────────────────────────────────────────────
function App() {
  const screen = useAppStore(s => s.screen);
  const goTo   = useAppStore(s => s.goTo);

  // 모바일 뒤로가기 인터셉트
  useEffect(() => {
    const handlePopState = () => {
      // 히스토리 스택에 항상 현재 상태 push → 앱 이탈 방지
      history.pushState(null, '', location.href);
      // TITLE이 아닐 때: 이전 화면으로 복귀
      if (screen === 'BATTLE')         goTo('STRATEGY_MAP');
      else if (screen === 'STRATEGY_MAP') goTo('TITLE');
      else if (screen === 'STRATEGY_TURN') goTo('STRATEGY_MAP');
      else if (screen === 'BATTLE_RESULT') goTo('STRATEGY_MAP');
      else if (screen === 'ENDING')   goTo('TITLE');
    };
    history.pushState(null, '', location.href);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [screen, goTo]);

  if (screen === 'TITLE')         return <TitleScreen />;
  if (screen === 'STRATEGY_MAP')  return <StrategyMapScreen />;
  if (screen === 'BATTLE')        return <BattleScreen />;
  if (screen === 'BATTLE_RESULT') return <BattleResultScreen />;
  if (screen === 'ENDING')        return <EndingScreen />;

  // fallback
  return <TitleScreen />;
}

export default App;
