// J:/AI/Game/SRPG/src/hooks/useBattleDialogueTrigger.ts
// 전투 이벤트 → 대화 발동 연결 허브 훅
//
// 역할:
//   - gameStore 상태 변화를 구독하여 적절한 시점에 triggerDialogue / enqueueDialogue 호출
//   - 엔진(skillEngine, turnSystemSlice)을 건드리지 않고 순수 useEffect 기반 감지
//
// 트리거 매핑:
//   BATTLE_START   → 전투 진입 시 (activeUnitId가 처음 non-null이 되는 시점)
//   TURN_START     → activeUnitId 변경 (새 유닛 차례 시작)
//   HP_THRESHOLD   → 유닛 HP 감소가 30% 이하로 떨어진 순간
//   ON_KILL        → 유닛이 DEAD 상태로 전환된 순간 (살해자 발화 + 반응 큐)

import { useEffect, useRef } from 'react';
import { useGameStore, tileToPixel } from '../store/gameStore';
import { PLAYER_FACTION } from '../constants/gameConfig';
import { pickDialogueEvent, buildTriggerContext } from '../engine/dialogueEngine';
import { ALL_DIALOGUE_EVENTS } from '../data/dialogueEvents';
import type { BattlePhase } from '../types/dialogueTypes';

// ─── 앵커 계산 헬퍼 (유닛 logicalX, logicalY → 화면 픽셀) ─────────────────
function getUnitAnchor(lx: number, ly: number): { x: number; y: number } {
  // isometric 변환: 실제 화면 좌표는 PixiJS 컨테이너 내부 좌표이므로
  // BattleDialogueBubble이 fixed position으로 렌더링되는 점을 감안.
  // UnitsLayer가 별도로 setBubbleAnchor를 매 프레임 갱신하므로, 
  // 여기서는 초기 대략 좌표만 넘긴다 (실제 동기화는 UnitsLayer에서).
  const px = tileToPixel(lx);
  const py = tileToPixel(ly) - 40; // 토큰 위쪽 여백
  return { x: px, y: py };
}

// ─── 이벤트 탐색 및 발동 헬퍼 ───────────────────────────────────────────────
function fireBattleEvent(params: {
  characterId: string;
  protagonistId: string;
  battlePhase: BattlePhase;
  battleEvent: string;
  unitHpPercent?: number;
  turnNumber?: number;
  defeatedUnitId?: string;
  anchor?: { x: number; y: number };
  mode: 'immediate' | 'queue'; // 즉시 발동 또는 큐 추가
}) {
  const state = useGameStore.getState();
  const playedEventIds = state.playedEventIds;

  const ctx = buildTriggerContext({
    characterId: params.characterId,
    protagonistId: params.protagonistId,
    dialogueContext: 'BATTLE',
    playedEventIds,
    battleEvent: params.battleEvent as any,
    unitHpPercent: params.unitHpPercent ?? 100,
    turnNumber: params.turnNumber ?? 0,
    defeatedUnitId: params.defeatedUnitId,
  });

  // battlePhase 필터: 이벤트의 battlePhase가 설정된 경우 일치해야 함
  const phaseEvents = ALL_DIALOGUE_EVENTS.filter(
    ev => !ev.battlePhase || ev.battlePhase === params.battlePhase
  );
  const event = pickDialogueEvent(phaseEvents, ctx);
  if (!event) return;

  const anchor = params.anchor ?? (() => {
    const unit = Object.values(state.units).find(u => u.characterId === params.characterId);
    return unit ? getUnitAnchor(unit.logicalX, unit.logicalY) : undefined;
  })();

  if (params.mode === 'immediate') {
    state.triggerDialogue(event, anchor);
  } else {
    state.enqueueDialogue(event, anchor);
  }
}

// ─── 메인 훅 ─────────────────────────────────────────────────────────────────
export function useBattleDialogueTrigger() {
  const activeUnitId = useGameStore(s => s.activeUnitId);
  const turnNumber   = useGameStore(s => s.turnNumber);

  // refs: 이전 상태 추적용 (useEffect deps로 비교)
  const prevActiveUnitIdRef = useRef<string | null>(null);
  const prevTurnNumberRef   = useRef<number>(0);
  const battleStartFiredRef = useRef(false);
  const prevHpMapRef        = useRef<Record<string, number>>({});
  const prevDeadSetRef      = useRef<Set<string>>(new Set());

  // ─── BATTLE_START: 첫 activeUnitId 결정 시 ──────────────────────────────
  useEffect(() => {
    if (!activeUnitId) return;
    if (battleStartFiredRef.current) return;
    battleStartFiredRef.current = true;

    const state = useGameStore.getState();
    const allUnits = Object.values(state.units);
    const playerUnits = allUnits.filter(u => u.factionId === PLAYER_FACTION && u.characterId);

    // 모든 아군 캐릭터 유닛에 대해 BATTLE_START 이벤트 탐색 (우선도 높은 1개만 즉시 발동)
    for (const unit of playerUnits) {
      if (!unit.characterId) continue;
      fireBattleEvent({
        characterId: unit.characterId,
        protagonistId: unit.characterId,
        battlePhase: 'TURN_START',
        battleEvent: 'BATTLE_START',
        anchor: getUnitAnchor(unit.logicalX, unit.logicalY),
        mode: 'immediate',
      });
      break; // 첫 번째 캐릭터만 즉시 발동 (나머지는 큐에 추가하거나 생략)
    }
  }, [activeUnitId]);

  // ─── TURN_START: activeUnitId 변경 감지 ─────────────────────────────────
  useEffect(() => {
    if (!activeUnitId) return;
    if (activeUnitId === prevActiveUnitIdRef.current) return;
    prevActiveUnitIdRef.current = activeUnitId;

    const state = useGameStore.getState();
    const unit = state.units[activeUnitId];
    if (!unit || unit.state === 'DEAD') return;
    if (!unit.characterId) return;
    if (unit.factionId !== PLAYER_FACTION) return; // 플레이어 유닛만 대사

    fireBattleEvent({
      characterId: unit.characterId,
      protagonistId: unit.characterId,
      battlePhase: 'TURN_START',
      battleEvent: 'TURN_START',
      unitHpPercent: unit.maxHp > 0 ? (unit.hp / unit.maxHp) * 100 : 100,
      turnNumber: state.turnNumber,
      anchor: getUnitAnchor(unit.logicalX, unit.logicalY),
      mode: 'immediate',
    });
  }, [activeUnitId]);

  // ─── HP_THRESHOLD & ON_KILL: 유닛 상태 변화 감지 ─────────────────────────
  useEffect(() => {
    // 매 PixiJS tick이 아니라 turnNumber 기반으로 검사 (과도한 리렌더 방지)
    const state = useGameStore.getState();
    const currentUnits = state.units;

    // HP 임계치 체크
    for (const [unitId, unit] of Object.entries(currentUnits)) {
      if (!unit.characterId) continue;
      if (unit.state === 'DEAD') continue;
      if (unit.factionId !== PLAYER_FACTION) continue;

      const prevHp = prevHpMapRef.current[unitId] ?? unit.maxHp;
      const currPct = unit.maxHp > 0 ? (unit.hp / unit.maxHp) * 100 : 100;
      const prevPct = unit.maxHp > 0 ? (prevHp    / unit.maxHp) * 100 : 100;

      // 처음으로 30% 임계치를 넘어 떨어졌을 때만 발동
      if (prevPct >= 30 && currPct < 30) {
        fireBattleEvent({
          characterId: unit.characterId,
          protagonistId: unit.characterId,
          battlePhase: 'TURN_START',
          battleEvent: 'HP_THRESHOLD',
          unitHpPercent: currPct,
          anchor: getUnitAnchor(unit.logicalX, unit.logicalY),
          mode: 'queue',
        });
      }
      prevHpMapRef.current[unitId] = unit.hp;
    }

    // ON_KILL: 새로 DEAD가 된 유닛 감지
    for (const [unitId, unit] of Object.entries(currentUnits)) {
      if (unit.state !== 'DEAD') continue;
      if (prevDeadSetRef.current.has(unitId)) continue;
      prevDeadSetRef.current.add(unitId);

      // 현재 액티브 유닛이 killerCharacter
      const killerUnit = activeUnitId ? currentUnits[activeUnitId] : null;
      if (!killerUnit?.characterId) continue;
      if (killerUnit.factionId !== PLAYER_FACTION) continue;

      // 살해자 ON_KILL 발화
      fireBattleEvent({
        characterId: killerUnit.characterId,
        protagonistId: killerUnit.characterId,
        battlePhase: 'ON_KILL',
        battleEvent: 'ON_KILL',
        defeatedUnitId: unitId,
        anchor: getUnitAnchor(killerUnit.logicalX, killerUnit.logicalY),
        mode: 'immediate',
      });

      // 사망 유닛에 호감도 관계 있는 아군 반응 (ALLY_DEFEATED)
      if (unit.factionId === PLAYER_FACTION && unit.characterId) {
        const allies = Object.values(currentUnits).filter(
          u => u.factionId === PLAYER_FACTION && u.characterId && u.id !== killerUnit.id && u.state !== 'DEAD'
        );
        for (const ally of allies.slice(0, 2)) { // 최대 2명 반응
          if (!ally.characterId) continue;
          fireBattleEvent({
            characterId: ally.characterId,
            protagonistId: ally.characterId,
            battlePhase: 'ON_KILL',
            battleEvent: 'ALLY_DEFEATED',
            defeatedUnitId: unitId,
            reactToUnitId: unitId,
            anchor: getUnitAnchor(ally.logicalX, ally.logicalY),
            mode: 'queue',
          } as any);
        }
      }
    }
  }, [activeUnitId, turnNumber]);

  // ─── 전투 종료 시 refs 초기화 ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      battleStartFiredRef.current = false;
      prevActiveUnitIdRef.current = null;
      prevTurnNumberRef.current   = 0;
      prevHpMapRef.current        = {};
      prevDeadSetRef.current      = new Set();
    };
  }, []); // 마운트/언마운트 시에만
}
