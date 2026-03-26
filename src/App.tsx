// J:/AI/Game/SRPG/src/App.tsx
// 최상위 라우터 — AppScreen enum에 따라 화면 전환
// 전투 결과 감지 + 모바일 뒤로가기 인터셉트 포함

import { Stage, Container }        from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useEffect, useCallback, useState, useRef } from 'react';
import TerrainMap       from './components/TerrainMap';
import UnitsLayer       from './components/UnitsLayer';
import MoveRangeLayer   from './components/MoveRangeLayer';
import PathLayer        from './components/PathLayer';
import AttackRangeLayer from './components/AttackRangeLayer';
import MapObjectsLayer  from './components/MapObjectsLayer';
import CloudShadow      from './components/CloudShadow';
import FogLayer         from './components/FogLayer';
import DynamicGridLayer from './components/DynamicGridLayer';
import ActionMenu       from './components/ActionMenu';
import FloatingDamageLayer from './components/FloatingDamageLayer';
import UnitInfoPanel    from './components/UnitInfoPanel';
import TurnEndPrompt    from './components/TurnEndPrompt';
import { useGameStore, getAttackableTargets } from './store/gameStore';
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
        <div className="bg-black/70 border border-gray-600 rounded-xl px-6 py-3 text-white text-sm flex items-center gap-6 shadow-lg">
          {useGameStore(s => s.attackTargetMode) ? (
            <>
              <span className="text-red-400 font-bold animate-pulse">⚔️ 공격할 적군을 클릭하세요</span>
              <button className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-xs pointer-events-auto cursor-pointer" onClick={() => useGameStore.getState().cancelConfirmedMove()}>
                취소 [우클릭]
              </button>
            </>
          ) : confirmedDest ? (
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
  const activeUnitId        = useGameStore(s => s.activeUnitId);
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
    const { map, elevMap, cities, mapInfo, mapObjects } = generateMapData(MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT);
    setMapData(map, elevMap, mapObjects);
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

  // ─── 카메라 팬 & 줌 로직 ───
  // 화면 중앙에 전체 맵 너비(약 1920px)가 한눈에 보이도록 초기 배율 반응형 설정
  const [camera, setCamera] = useState(() => {
    const initialScale = Math.max(0.4, Math.min(1.2, window.innerWidth / 1920));
    return { x: window.innerWidth / 2, y: window.innerHeight * 0.1, scale: initialScale };
  });
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // 안전 범위(Black Screen Void 방지용)
  const clampCamera = (cam: { x: number; y: number; scale: number }) => ({
    x: Math.max(-4000, Math.min(4000, cam.x)),
    y: Math.max(-4000, Math.min(4000, cam.y)),
    scale: cam.scale,
  });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const ZOOM_SPEED = 0.1;
    setCamera(prev => {
      let newScale = prev.scale - Math.sign(e.deltaY) * ZOOM_SPEED;
      newScale = Math.max(0.3, Math.min(newScale, 4.5));
      if (newScale === prev.scale) return prev;

      const mouseX = e.clientX;
      const mouseY = e.clientY;
      const mouseWorldX = (mouseX - prev.x) / prev.scale;
      const mouseWorldY = (mouseY - prev.y) / prev.scale;
      
      const newX = mouseX - mouseWorldX * newScale;
      const newY = mouseY - mouseWorldY * newScale;

      return clampCamera({ x: newX, y: newY, scale: newScale });
    });
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setCamera(prev => clampCamera({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // ─── 키보드 WASD 카메라 패닝 로직 ───
  const keys = useRef<{ [key: string]: boolean }>({});
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
      keys.current[e.key.toLowerCase()] = true; 
      if (e.key === 'Control') useGameStore.getState().setCtrlPressed(true);
    };
    const handleKeyUp   = (e: KeyboardEvent) => { 
      keys.current[e.key.toLowerCase()] = false; 
      if (e.key === 'Control') useGameStore.getState().setCtrlPressed(false);
    };
    const handleBlur    = () => {
      keys.current = {};
      isDragging.current = false;
      useGameStore.getState().setCtrlPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    let lastTime = performance.now();
    const updateCamera = (time: number) => {
      rafRef.current = requestAnimationFrame(updateCamera);
      const dt = time - lastTime;
      lastTime = time;

      // dt가 비정상적으로 크면 무시 (탭 전환 등)
      if (dt > 100) return;

      const speed = 0.8 * dt; // 이동 속도 조정
      let dx = 0; let dy = 0;

      // W: 카메라 위로 이동 (화면의 월드는 아래로 내려가야 함 -> y 증가)
      if (keys.current['w'] || keys.current['arrowup'])    dy += speed;
      if (keys.current['s'] || keys.current['arrowdown'])  dy -= speed;
      if (keys.current['a'] || keys.current['arrowleft'])  dx += speed;
      if (keys.current['d'] || keys.current['arrowright']) dx -= speed;

      if (dx !== 0 || dy !== 0) {
        setCamera(prev => clampCamera({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      }
    };
    rafRef.current = requestAnimationFrame(updateCamera);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ─── 턴 시작 시 활성 유닛으로 자동 카메라 포커스 ───
  useEffect(() => {
    if (!activeUnitId) return;
    const unit = useGameStore.getState().units[activeUnitId];
    if (!unit) return;

    // 1. 유닛의 로지컬 픽셀 공간 좌표
    const worldX = unit.logicalX * MAP_CONFIG.TILE_SIZE + MAP_CONFIG.TILE_SIZE / 2;
    const worldY = unit.logicalY * MAP_CONFIG.TILE_SIZE + MAP_CONFIG.TILE_SIZE / 2;

    // 2. 쿼터뷰(Isometric) 렌더링 파이프라인 수동 시뮬레이션
    //  a. 회전 (Math.PI / 4)
    const angle = Math.PI / 4;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const rx = worldX * cosA - worldY * sinA;
    const ry = worldX * sinA + worldY * cosA;
    //  b. 스케일 압축 (1, 0.5)
    const ix = rx * 1;
    const iy = ry * 0.5;

    // 3. 현재 스케일을 기준으로 화면 정중앙에 위치하도록 Camera 포지션 세팅
    setCamera(prev => clampCamera({
      ...prev,
      x: window.innerWidth / 2 - ix * prev.scale,
      y: window.innerHeight / 2 - iy * prev.scale,
    }));
  }, [activeUnitId]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (confirmedDest) cancelConfirmedMove();
    else if (selectedUnitId) selectUnit(null);
  }, [confirmedDest, cancelConfirmedMove, selectedUnitId, selectUnit]);

  return (
    <div 
      className="w-full h-screen bg-[#70714e] overflow-hidden relative font-sans" 
      onContextMenu={handleContextMenu}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <Stage
        width={window.innerWidth}
        height={window.innerHeight}
        options={{ autoDensity: true, resolution: window.devicePixelRatio, backgroundColor: 0x70714e }}
        style={{ touchAction: 'none' }} // 드래그 시 브라우저 스크롤 방지
      >
        <Container 
          x={camera.x} 
          y={camera.y}
          scale={camera.scale}
        >
          {/* Isometric Transform & 전역 Depth 정렬 */}
          <Container scale={{ x: 1, y: 0.5 }}>
            <Container 
              rotation={Math.PI / 4} 
              sortableChildren={true}
              eventMode="static"
              onpointerdown={(e) => {
                if (e.button === 2) return;
                
                const pos = e.data.getLocalPosition(e.currentTarget as PIXI.DisplayObject);
                const lx = Math.floor(pos.x / MAP_CONFIG.TILE_SIZE);
                const ly = Math.floor(pos.y / MAP_CONFIG.TILE_SIZE);
                
                const store = useGameStore.getState();
                const tileId = `${lx},${ly}`;
                
                // ─ 공격 모드: 타일 좌표로 적군 유닛 직접 탐색하여 공격 ─
                // (UnitsLayer Sprite의 역변환 이벤트 전달 문제를 우회)
                if (store.attackTargetMode && store.confirmedDestination && store.selectedUnitId) {
                  const attacker = store.units[store.selectedUnitId];
                  if (!attacker) return;
                  const dest = store.confirmedDestination;
                  const validTargets = getAttackableTargets(attacker, store.units, dest.lx, dest.ly);
                  // 클릭한 타일에 유효한 공격 대상이 있는지 확인
                  const target = validTargets.find(t => t.logicalX === lx && t.logicalY === ly);
                  console.log(`⚔️ [공격모드클릭] (${lx},${ly}) → target=${target?.id ?? '없음'}`);
                  if (target) {
                    store.executeAttackOnTarget(target.id);
                  }
                  return;
                }

                // 이동 가능 영역 클릭 시 이동 확정
                if (store.moveRangeTiles.has(tileId)) {
                  store.confirmMove(lx, ly);
                  return;
                }
                
                // 클릭한 좌표에 아군 유닛이 있으면 선택
                const clickedUnit = Object.values(store.units).find(u => u.logicalX === lx && u.logicalY === ly && u.state !== 'DEAD');
                if (clickedUnit) {
                  if (clickedUnit.factionId !== PLAYER_FACTION) return;
                  
                  // 이미 선택된 자신을 다시 클릭한 경우 (제자리 행동 처리)
                  if (store.selectedUnitId === clickedUnit.id) {
                    if (store.activeUnitId === clickedUnit.id) {
                      store.confirmMove(lx, ly);
                    }
                    return;
                  }
                  
                  // 다른 아군 유닛 선택
                  store.selectUnit(clickedUnit.id);
                  
                  // 사방이 막혀서 바로 이동 불가인 경우 자동 confirmMove (사방 막힘 버그 해결)
                  setTimeout(() => {
                    const st = useGameStore.getState();
                    if (st.selectedUnitId === clickedUnit.id && st.activeUnitId === clickedUnit.id && st.moveRangeTiles.size === 0) {
                      st.confirmMove(lx, ly);
                    }
                  }, 0);
                  return;
                }

                // 빈 땅 클릭 → 선택 해제
                if (store.selectedUnitId) {
                  store.selectUnit(null);
                }
              }}

              onpointermove={(e) => {
                // 상단 레이어들의 간섭을 피해 가장 넓은 컨테이너에서 마우스 위치를 감지합니다.
                const pos = e.data.getLocalPosition(e.currentTarget as PIXI.DisplayObject);
                const lx = Math.floor(pos.x / MAP_CONFIG.TILE_SIZE);
                const ly = Math.floor(pos.y / MAP_CONFIG.TILE_SIZE);
                const store = useGameStore.getState();
                store.setHoveredMapTile({ lx, ly });
                store.setHoveredMapPixel({ x: pos.x, y: pos.y });
                store.setHoveredMoveTile({ lx, ly });
              }}
              onpointerout={() => {
                useGameStore.getState().setHoveredMapTile(null);
                useGameStore.getState().setHoveredMapPixel(null);
              }}
            >
              <TerrainMap />
              <MoveRangeLayer />
              <AttackRangeLayer />
              <DynamicGridLayer />
              <PathLayer />
              
              {/* Entity Layout Nodes (Z-Index 기반 혼합 정렬됨) */}
              <MapObjectsLayer />
              <UnitsLayer />
              
              <FogLayer />
              <CloudShadow />
            </Container>
          </Container>
        </Container>
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
      <ActionMenu camera={camera} />
      <TurnEndPrompt />
      <UnitInfoPanel />
      <FloatingDamageLayer camera={camera} />
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
