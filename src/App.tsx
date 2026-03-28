// J:/AI/Game/SRPG/src/App.tsx
// 최상위 라우터 — AppScreen enum에 따라 화면 전환
// 전투 결과 감지 + 모바일 뒤로가기 인터셉트 포함

import { Stage, Container }        from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useEffect, useCallback, useState, useRef, memo } from 'react';
import TerrainMap       from './components/TerrainMap';
import UnitsLayer       from './components/UnitsLayer';
import MoveRangeLayer   from './components/MoveRangeLayer';
import PathLayer        from './components/PathLayer';
import AttackRangeLayer from './components/AttackRangeLayer';
import SkillRangeLayer  from './components/SkillRangeLayer';
import MapObjectsLayer  from './components/MapObjectsLayer';
import CloudShadow      from './components/CloudShadow';
import FogLayer         from './components/FogLayer';
import DynamicGridLayer from './components/DynamicGridLayer';
import ObjectiveLayer   from './components/ObjectiveLayer';
import ActionMenu       from './components/ActionMenu';
import FloatingDamageLayer from './components/FloatingDamageLayer';
import UnitInfoPanel    from './components/UnitInfoPanel';
import HoverInfoPanel   from './components/HoverInfoPanel';
import TurnEndPrompt    from './components/TurnEndPrompt';
import FieldMenu        from './components/FieldMenu';
import UnitListModal    from './components/UnitListModal';
import BattleAbandonModal from './components/BattleAbandonModal';
import { useGameStore } from './store/gameStore';
import { useAppStore }  from './store/appStore';
import { useInteractionManager } from './hooks/useInteractionManager';
import { generateMapData } from './utils/mapGenerator';
import { MAP_CONFIG, PLAYER_FACTION }   from './constants/gameConfig';

// 화면 컴포넌트
import TitleScreen       from './screens/TitleScreen';
import StrategyMapScreen from './screens/StrategyMapScreen';
import BattleResultScreen from './screens/BattleResultScreen';
import EndingScreen      from './screens/EndingScreen';

import './index.css';

// ─── React.memo 래핑: camera 변경 시 불필요한 리렌더링 방지 ──────────────────
// camera 는 BattleScreen local state → setCamera 60fps 호출 시 BattleScreen 재렌더링.
// camera prop을 받지 않는 컴포넌트는 memo로 차단해서 Pixi/HTML 재조정 비용 제거.
const MemoTerrainMap     = memo(TerrainMap);
const MemoUnitsLayer     = memo(UnitsLayer);
const MemoMoveRange      = memo(MoveRangeLayer);
const MemoAttackRange    = memo(AttackRangeLayer);
const MemoSkillRange     = memo(SkillRangeLayer);
const MemoDynGrid        = memo(DynamicGridLayer);
const MemoPath           = memo(PathLayer);
const MemoObjective      = memo(ObjectiveLayer);
const MemoMapObjects     = memo(MapObjectsLayer);
const MemoFog            = memo(FogLayer);
const MemoCloud          = memo(CloudShadow);

// ─── 전투 로그 ─────────────────────────────────────────────────────────────
const CombatLog = memo(function CombatLog() {
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
});

// ─── HUD ──────────────────────────────────────────────────────────────────
function TurnHUD({ onAbandonRequest }: { onAbandonRequest: () => void }) {
  const selectedUnitId = useGameStore(s => s.selectedUnitId);
  const confirmedDest  = useGameStore(s => s.confirmedDestination);
  const units          = useGameStore(s => s.units);
  const selectUnit     = useGameStore(s => s.selectUnit);
  const endUnitTurn    = useGameStore(s => s.endUnitTurn);
  const turnNumber = useGameStore(s => s.turnNumber);
  const activeUnit = useGameStore(s => s.activeUnitId ? s.units[s.activeUnitId] : null);
  const isPlayerTurn = activeUnit?.factionId === PLAYER_FACTION;
  const playerUnits = Object.values(units).filter(u => u.factionId === PLAYER_FACTION && u.state !== 'DEAD');
  const enemyAlive = Object.values(units).filter(u => u.factionId !== PLAYER_FACTION && u.state !== 'DEAD').length;
  const attackTargetMode = useGameStore(s => s.attackTargetMode);
  const skillTargetMode = useGameStore(s => s.skillTargetMode);
  const biome          = useGameStore(s => s.biome);
  const screen         = useAppStore(s => s.screen);

  if (screen !== 'BATTLE') return null;
  const handleDeselect = useCallback(() => selectUnit(null), [selectUnit]);

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
        {/* 군략화면으로 복귀 버튼 — 포기 확인 다이얼로그 경유 */}
        <button
          className="mt-1 px-3 py-1 rounded bg-gray-800/80 border border-gray-600 text-gray-300 text-xs pointer-events-auto cursor-pointer hover:bg-gray-700/80"
          onClick={onAbandonRequest}
        >
          🗺 군략화면
        </button>
      </div>

      {/* 하단 */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
        <div className="bg-black/70 border border-gray-600 rounded-xl px-6 py-3 text-white text-sm flex items-center gap-6 shadow-lg">
          {attackTargetMode ? (
            <>
              <span className="text-red-400 font-bold animate-pulse">⚔️ 공격할 적군을 클릭하세요</span>
              <button className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-xs pointer-events-auto cursor-pointer" onClick={() => useGameStore.getState().cancelConfirmedMove()}>
                취소 [우클릭]
              </button>
            </>
          ) : skillTargetMode ? (
            <>
              <span className="text-purple-400 font-bold animate-pulse">✨ 스킬을 시전할 타겟을 지정하세요</span>
              <button className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-xs pointer-events-auto cursor-pointer" onClick={() => useGameStore.getState().cancelSkillTargetMode()}>
                스킬 취소 [우클릭]
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

// ─── 턴 전환 애니메이션 오버레이 ─────────────────────────────────────────────────
function TurnTransitionLayer() {
  const turnNumber = useGameStore(s => s.turnNumber);
  const battleResult = useGameStore(s => s.battleResult);
  const victoryCondition = useGameStore(s => s.victoryCondition);
  const defeatCondition = useGameStore(s => s.defeatCondition);
  const [transitionTurn, setTransitionTurn] = useState<number | null>(null);

  useEffect(() => {
    // 0턴(초기 구동)이나 게임 종료 시점에는 연출을 스킵
    if (turnNumber > 0 && !battleResult) {
      setTransitionTurn(turnNumber);
      const t = setTimeout(() => setTransitionTurn(null), 2500); // 미션 읽을 시간을 위해 2.5초 유지
      return () => clearTimeout(t);
    }
  }, [turnNumber, battleResult]);

  if (transitionTurn === null) return null;

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none turn-transition-bg bg-black/40 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-8">
        <div className="turn-transition-enter flex items-baseline gap-6 drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">
          <span className="text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 to-amber-600 text-[6rem] font-black italic tracking-widest drop-shadow-[0_0_20px_rgba(251,191,36,0.6)]">
            TURN
          </span>
          <span className="text-white text-[8rem] font-black italic drop-shadow-[0_0_25px_rgba(255,255,255,1)]">
            {transitionTurn}
          </span>
        </div>
        
        {/* 1턴 시작 시점에 한하여 승패 목표(Objective) 강제 노출 */}
        {transitionTurn === 1 && victoryCondition && (
          <div className="turn-objective-enter bg-black/80 border border-yellow-500/50 rounded-2xl px-10 py-5 shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-md flex flex-col items-center gap-3">
            <span className="text-yellow-400 font-bold text-sm tracking-widest">MISSION OBJECTIVE</span>
            <span className="text-white text-3xl font-black">{victoryCondition.description}</span>
            {defeatCondition && (
              <span className="text-red-400/90 text-sm mt-1 font-semibold">패배 조건: {defeatCondition.description}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 안전 범위(Black Screen Void 방지용)
const clampCamera = (cam: { x: number; y: number; scale: number }) => ({
  x: Math.max(-4000, Math.min(4000, cam.x)),
  y: Math.max(-4000, Math.min(4000, cam.y)),
  scale: cam.scale,
});

// ─── 전투 화면 ───────────────────────────────────────────────────────────────
function BattleScreen({ onAbandonRequest }: { onAbandonRequest: () => void }) {
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
  const { onTileClick }     = useInteractionManager();

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
    const isWin = typeof battleResult === 'object' ? battleResult.isVictory : battleResult === 'player_win';
    resolveBattle(isWin ? 'player_win' : 'player_lose');
    clearBattleResult();
  }, [battleResult, resolveBattle, clearBattleResult]);

  const handleStartBattle = useCallback((type: 'defensive' | 'offensive' | 'cheat') => {
    if (!pendingBattle) return;
    const attackerId = provinces[pendingBattle.attackerProvinceId]?.owner || PLAYER_FACTION;
    const defenderId = provinces[pendingBattle.defenderProvinceId]?.owner || 'faction_02';
    
    setBattleType(type);
    useGameStore.setState({ battleType: type });
    initUnits(MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT, attackerId, defenderId);
  }, [setBattleType, initUnits, pendingBattle, provinces]);

  // 전장 타입 자동 진입 처리
  // - 치트 모드: cheat
  // - 플레이어가 공격자(attackerProvinceId 소유): offensive
  // - 플레이어가 수비자(defenderProvinceId 소유): defensive
  useEffect(() => {
    if (!isReady || isStarted || !pendingBattle) return;
    if (pendingBattle.isCheat) {
      handleStartBattle('cheat');
      return;
    }
    const attackerOwner = provinces[pendingBattle.attackerProvinceId]?.owner;
    const autoType = attackerOwner === PLAYER_FACTION ? 'offensive' : 'defensive';
    handleStartBattle(autoType);
  }, [isReady, isStarted, pendingBattle, handleStartBattle, provinces]);

  // ─── 카메라 팬 & 줌 로직 ───
  // 화면 중앙에 전체 맵 너비(약 1920px)가 한눈에 보이도록 초기 배율 반응형 설정
  const targetScaleRef = useRef(0);
  const [camera, setCamera] = useState(() => {
    const initialScale = Math.max(0.4, Math.min(1.2, window.innerWidth / 1920)) * 2.0;
    targetScaleRef.current = initialScale; // 최종 목표 배율

    const startScale = initialScale * 0.8;
    let startX = window.innerWidth / 2;
    let startY = window.innerHeight * 0.1;

    // [버그 수정] 첫 렌더링 시 카메라가 엉뚱한 곳에 있다가 1프레임 뒤 튀는 현상 방지:
    // 초기화 시점부터 현재 활성화된(턴을 쥔) 유닛의 위치를 계산해 화면 중앙에 고정시킵니다.
    const store = useGameStore.getState();
    const activeUnit = store.activeUnitId ? store.units[store.activeUnitId] : null;
    
    if (activeUnit) {
      const worldX = activeUnit.logicalX * MAP_CONFIG.TILE_SIZE + MAP_CONFIG.TILE_SIZE / 2;
      const worldY = activeUnit.logicalY * MAP_CONFIG.TILE_SIZE + MAP_CONFIG.TILE_SIZE / 2;
      const angle = Math.PI / 4;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const rx = worldX * cosA - worldY * sinA;
      const ry = worldX * sinA + worldY * cosA;
      const ix = rx;
      const iy = ry * 0.5;
      
      startX = window.innerWidth / 2 - ix * startScale;
      startY = window.innerHeight / 2 - iy * startScale;
    }

    // 20% 줌아웃 된 상태(0.8)에서 출발
    return { x: startX, y: startY, scale: startScale };
  });
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  // 카메라 현재값 ref (scale 접근용, useEffect 동기화 없이 사용)
  const cameraRef = useRef(camera);
  // smooth pan 상태 — 별도 RAF 없이 기존 updateCamera 루프 안에서 처리
  const panTargetRef   = useRef<{ x: number; y: number } | null>(null);
  const panStartRef    = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartTimeRef = useRef<number>(0);
  const PAN_DURATION   = 500; // ms

  // 전투 진입 시 다이브 줌인 연출 (Lerp Animation) — 연출 중 카메라 조작 잠금
  useEffect(() => {
    let rafId: number;
    let isAnimating = true;

    // 연출 시작 즉시 입력 잠금
    useGameStore.getState().setIsCameraLocked(true);

    const animateTransition = () => {
      setCamera(prev => {
        const target = targetScaleRef.current;
        if (!isAnimating || Math.abs(target - prev.scale) < 0.001) {
          isAnimating = false;
          // 연출 완료 → 입력 잠금 해제
          useGameStore.getState().setIsCameraLocked(false);
          return clampCamera({ ...prev, scale: target });
        }

        const newScale = prev.scale + (target - prev.scale) * 0.04;
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const scaleRatio = newScale / prev.scale;

        return clampCamera({
          x: centerX - (centerX - prev.x) * scaleRatio,
          y: centerY - (centerY - prev.y) * scaleRatio,
          scale: newScale
        });
      });

      if (isAnimating) {
        rafId = requestAnimationFrame(animateTransition);
      }
    };
    rafId = requestAnimationFrame(animateTransition);

    return () => {
      isAnimating = false;
      cancelAnimationFrame(rafId);
      // 컴포넌트 언마운트 시에도 잠금 해제 보장
      useGameStore.getState().setIsCameraLocked(false);
    };
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (useGameStore.getState().isCameraLocked) return;
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
    if (useGameStore.getState().isCameraLocked) return;
    panTargetRef.current = null; // 드래그 시작 시 smooth pan 즉시 취소
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (useGameStore.getState().isCameraLocked) return;
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
      if (useGameStore.getState().isCameraLocked) {
        lastTime = time;
        return;
      }

      const dt = time - lastTime;
      lastTime = time;
      if (dt > 100) return; // 탭 전환 등 비정상 dt 무시

      // ── smooth pan (별도 RAF 없이 이 루프에서 처리) ──────────────────
      if (panTargetRef.current && !isDragging.current) {
        const elapsed = time - panStartTimeRef.current;
        const t = Math.min(elapsed / PAN_DURATION, 1);
        const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
        const nx = panStartRef.current.x + (panTargetRef.current.x - panStartRef.current.x) * ease;
        const ny = panStartRef.current.y + (panTargetRef.current.y - panStartRef.current.y) * ease;
        setCamera(prev => { cameraRef.current = { ...prev, x: nx, y: ny }; return clampCamera({ ...prev, x: nx, y: ny }); });
        if (t >= 1) panTargetRef.current = null;
        return; // smooth pan 중에는 WASD 입력 무시
      }

      // ── WASD 카메라 패닝 ──────────────────────────────────────────────
      const speed = 0.8 * dt;
      let dx = 0; let dy = 0;
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

  // ─── 턴 시작 시 활성 유닛 자동 카메라 포커스 ───
  const hasShownIntroRef = useRef(false);

  useEffect(() => {
    if (!activeUnitId) return;
    const store = useGameStore.getState();
    const unit = store.units[activeUnitId];
    if (!unit) return;

    const scale = cameraRef.current.scale;
    const angle = Math.PI / 4;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // isometric 좌표 → 화면 중앙 기준 카메라 목표 계산 헬퍼
    const toDestXY = (lx: number, ly: number) => {
      const wx = lx * MAP_CONFIG.TILE_SIZE + MAP_CONFIG.TILE_SIZE / 2;
      const wy = ly * MAP_CONFIG.TILE_SIZE + MAP_CONFIG.TILE_SIZE / 2;
      const rx = wx * cosA - wy * sinA;
      const ry = (wx * sinA + wy * cosA) * 0.5;
      return { x: window.innerWidth / 2 - rx * scale, y: window.innerHeight / 2 - ry * scale };
    };

    // smooth pan 시작: panTargetRef를 세팅하면 updateCamera 루프가 처리
    const startPan = (dest: { x: number; y: number }) => {
      panStartRef.current    = { x: cameraRef.current.x, y: cameraRef.current.y };
      panStartTimeRef.current = performance.now();
      panTargetRef.current   = dest;
    };

    // 첫 턴 탈출 목표 인트로 패닝
    const v = store.victoryCondition;
    if (store.turnNumber === 1 && v?.type === 'REACH_LOCATION' && v.targetTile && !hasShownIntroRef.current) {
      hasShownIntroRef.current = true;
      store.setIsCameraLocked(true);
      startPan(toDestXY(v.targetTile.lx, v.targetTile.ly));
      setTimeout(() => {
        startPan(toDestXY(unit.logicalX, unit.logicalY));
        useGameStore.getState().setIsCameraLocked(false);
      }, 1500);
      return;
    }

    // 일반 포커스
    startPan(toDestXY(unit.logicalX, unit.logicalY));
  }, [activeUnitId]);


  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const store = useGameStore.getState();
    let handled = false;
    
    // 1. 진행 중 타겟팅 또는 조작 해제
    if (store.attackTargetMode || store.skillTargetMode || store.confirmedDestination || store.selectedUnitId) {
      if (store.skillTargetMode) store.cancelSkillTargetMode();
      else if (store.confirmedDestination) store.cancelConfirmedMove();
      else if (store.selectedUnitId) store.selectUnit(null);
      handled = true;
    }

    // 2. 아무것도 안 하고 빈 맵을 우클릭한 경우 -> 전장 메뉴
    if (!handled && !store.battleResult && store.turnNumber > 0) {
      store.openFieldMenu({ x: e.clientX, y: e.clientY });
    }
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
                const store = useGameStore.getState();
                if (store.fieldMenuPos || store.unitListModalOpen) return;
                
                const pos = e.data.getLocalPosition(e.currentTarget as PIXI.DisplayObject);
                const lx = Math.floor(pos.x / MAP_CONFIG.TILE_SIZE);
                const ly = Math.floor(pos.y / MAP_CONFIG.TILE_SIZE);
                
                onTileClick(lx, ly);
              }}

              onpointermove={(e) => {
                const store = useGameStore.getState();
                if (store.fieldMenuPos || store.unitListModalOpen) return;

                // 상단 레이어들의 간섭을 피해 가장 넓은 컨테이너에서 마우스 위치를 감지합니다.
                const pos = e.data.getLocalPosition(e.currentTarget as PIXI.DisplayObject);
                const lx = Math.floor(pos.x / MAP_CONFIG.TILE_SIZE);
                const ly = Math.floor(pos.y / MAP_CONFIG.TILE_SIZE);
                store.setHoveredMapTile({ lx, ly });
                store.setHoveredMapPixel({ x: pos.x, y: pos.y });
                store.setHoveredMoveTile({ lx, ly });
              }}
              onpointerleave={() => {
                useGameStore.getState().setHoveredMapTile(null);
                useGameStore.getState().setHoveredMapPixel(null);
              }}
            >
              <MemoTerrainMap />
              <MemoMoveRange />
              <MemoAttackRange />
              <MemoSkillRange />
              <MemoDynGrid />
              <MemoPath />
              
              {/* Entity Layout Nodes (Z-Index 기반 혼합 정렬됨) */}
              <MemoObjective />
              <MemoMapObjects />
              <MemoUnitsLayer />
              
              <MemoFog />
              <MemoCloud />
            </Container>
          </Container>
        </Container>
      </Stage>

      {/* 전장 진입 로딩 오버레이 (자동 판별 중) */}
      {isReady && !isStarted && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <span className="text-4xl animate-pulse">⚔️</span>
            <span className="text-white text-xl font-bold tracking-widest">전장 준비 중...</span>
          </div>
        </div>
      )}

      <TurnHUD onAbandonRequest={onAbandonRequest} />
      <ActionMenu camera={camera} />
      <TurnEndPrompt />
      <UnitInfoPanel />
      <HoverInfoPanel />
      <FloatingDamageLayer camera={camera} />
      <CombatLog />
      <TurnTransitionLayer />
      <FieldMenu />
      <UnitListModal />
    </div>
  );
}

// ─── 최상위 라우터 ────────────────────────────────────────────────────────────
function App() {
  const screen = useAppStore(s => s.screen);
  const goTo   = useAppStore(s => s.goTo);

  // 전투 포기 확인 모달 상태
  const [showAbandonModal, setShowAbandonModal] = useState(false);

  const handleAbandonRequest = useCallback(() => {
    setShowAbandonModal(true);
  }, []);

  const handleAbandonConfirm = useCallback(() => {
    setShowAbandonModal(false);
    goTo('STRATEGY_MAP');
  }, [goTo]);

  const handleAbandonCancel = useCallback(() => {
    setShowAbandonModal(false);
  }, []);

  // 모바일 뒤로가기 인터셉트
  useEffect(() => {
    const handlePopState = () => {
      // 히스토리 스택에 항상 현재 상태 push → 앱 이탈 방지
      history.pushState(null, '', location.href);
      // BATTLE 화면: 포기 확인 다이얼로그 표시
      if (screen === 'BATTLE') {
        setShowAbandonModal(true);
      } else if (screen === 'STRATEGY_MAP') goTo('TITLE');
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
  if (screen === 'BATTLE')        return (
    <>
      <BattleScreen onAbandonRequest={handleAbandonRequest} />
      {showAbandonModal && (
        <BattleAbandonModal
          onConfirm={handleAbandonConfirm}
          onCancel={handleAbandonCancel}
        />
      )}
    </>
  );
  if (screen === 'BATTLE_RESULT') return <BattleResultScreen />;
  if (screen === 'ENDING')        return <EndingScreen />;

  // fallback
  return <TitleScreen />;
}

export default App;
