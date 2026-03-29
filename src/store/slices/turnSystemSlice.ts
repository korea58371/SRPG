import type { StoreSlice, TurnSystemSlice } from './storeTypes';

import type { Unit } from '../../types/gameTypes';
import { PLAYER_FACTION, MAP_CONFIG } from '../../constants/gameConfig';
import { buildTileSets, tileToPixel } from '../gameStore';
import { calcMoveRange } from '../../utils/moveRange';
import { _runSingleEnemyAI } from '../../engine/aiEngine';

export function getTurnOrder(units: Record<string, Unit>): string[] {
  const alive = Object.values(units).filter(u => u.state !== 'DEAD');
  if (alive.length === 0) return [];

  // 현재 라운드 미행동 유닛 (hasActed === false 인 것들 중, 속도로 정렬)
  const currentRound = alive.filter(u => !u.hasActed).sort((a, b) => {
    if (b.speed !== a.speed) return b.speed - a.speed;
    if (a.factionId === PLAYER_FACTION && b.factionId !== PLAYER_FACTION) return -1;
    if (b.factionId === PLAYER_FACTION && a.factionId !== PLAYER_FACTION) return 1;
    return a.id.localeCompare(b.id);
  });

  // 다음 라운드 이후 행동 유닛 전체 (스피드 내림차순 정렬)
  const baseOrder = alive.sort((a, b) => {
    if (b.speed !== a.speed) return b.speed - a.speed;
    if (a.factionId === PLAYER_FACTION && b.factionId !== PLAYER_FACTION) return -1;
    if (b.factionId === PLAYER_FACTION && a.factionId !== PLAYER_FACTION) return 1;
    return a.id.localeCompare(b.id);
  });

  const nextRound = alive.filter(u => u.hasActed).sort((a, b) => {
    if (b.speed !== a.speed) return b.speed - a.speed;
    if (a.factionId === PLAYER_FACTION && b.factionId !== PLAYER_FACTION) return -1;
    if (b.factionId === PLAYER_FACTION && a.factionId !== PLAYER_FACTION) return 1;
    return a.id.localeCompare(b.id);
  });

  let order = [...currentRound, ...nextRound].map(u => u.id);
  
  // UI용으로 순서를 채워넣음
  while (order.length <= 15) {
    order.push(...baseOrder.map(u => u.id));
  }

  return order;
}

function _calcNextActive(units: Record<string, Unit>): { updatedUnits: Record<string, Unit>; activeId: string; roundEnded: boolean } {
  const alive = Object.values(units).filter(u => u.state !== 'DEAD');
  if (alive.length === 0) return { updatedUnits: units, activeId: '', roundEnded: false };

  let finalUnits = { ...units };
  let roundEnded = false;
  
  // 모든 생존 유닛이 이미 행동을 끝냈는가?
  const allActed = alive.every(u => u.hasActed);

  if (allActed) {
    for (const u of alive) {
      finalUnits[u.id] = { ...finalUnits[u.id], hasActed: false };
    }
    roundEnded = true;
  }

  const order = getTurnOrder(finalUnits);
  return { updatedUnits: finalUnits, activeId: order[0] ?? '', roundEnded };
}

export const createTurnSystemSlice: StoreSlice<TurnSystemSlice> = (set, get) => ({
  activeUnitId: null,
  turnNumber: 0,
  isCtrlPressed: false,

  setCtrlPressed: (val) => set({ isCtrlPressed: val }),

  endUnitTurn: () => {
    const s = get();
    if (!s.activeUnitId) {
      // 첫 게임 시작 시 _advanceTurn 강제 진행
      _advanceTurn(set, get);
      return;
    }
    
    const u = s.units[s.activeUnitId];
    if (u && u.state !== 'DEAD') {
      set(s2 => ({
        units: { ...s2.units, [s2.activeUnitId!]: { ...u, hasActed: true } }
      }));
    }

    if (checkMatchRules(get, set)) return;

    _advanceTurn(set, get);
  }
});

function _advanceTurn(set: any, get: any) {
  const s = get();
  const { updatedUnits, activeId, roundEnded } = _calcNextActive(s.units);

  const isNewTurn = roundEnded || s.turnNumber === 0;

  const applyTurnDetails = () => {
    const sCurrent = get(); // 지연 후의 최신 상태 체크용
    const activeUnit = updatedUnits[activeId];
    if (!activeUnit) {
      if (isNewTurn) get().setIsCameraLocked(false);
      return;
    }
    
    // ─── 턴 시작 시 버프/디버프 틱(Tick) 및 지속 효과 처리 ───
    const buffs = activeUnit.buffs || [];
    const nextBuffs: typeof buffs = [];
    let hpDiff = 0;
    
    for (const b of buffs) {
      if (b.type === 'poison') hpDiff -= b.value;
      if (b.type === 'regen') hpDiff += b.value;
      
      // 남은 턴수 차감 (1보다 크면 유지, 1 이하면 소멸되므로 nextBuffs에 안 넣음)
      if (b.duration > 1) {
        nextBuffs.push({ ...b, duration: b.duration - 1 });
      }
    }
    
    const currentHp = activeUnit.hp;
    let newHp = currentHp;
    if (hpDiff !== 0) {
      newHp = Math.max(0, Math.min(activeUnit.maxHp, currentHp + Math.round(hpDiff)));
      
      const floatings = get().floatingDamages || [];
      set({
        floatingDamages: [
          ...floatings,
          {
            id: `fd-dot-${Date.now()}-${Math.random()}`,
            x: tileToPixel(activeUnit.logicalX),
            y: tileToPixel(activeUnit.logicalY) - 15,
            value: hpDiff > 0 ? hpDiff : -hpDiff,
            isCrit: false,
            fontColor: hpDiff > 0 ? '#00ff00' : '#800080',
            isHeal: hpDiff > 0
          }
        ]
      });
    }
    
    updatedUnits[activeId] = { ...activeUnit, hp: newHp, buffs: nextBuffs, state: newHp <= 0 ? 'DEAD' : activeUnit.state };
    
    // 도트 데미지로 사망 시 턴 즉시 강제 종료
    if (newHp <= 0) {
      set({ units: updatedUnits, activeUnitId: null });
      if (isNewTurn) get().setIsCameraLocked(false);
      get().endUnitTurn();
      return;
    }

    set({ units: updatedUnits, activeUnitId: activeId });

    if (activeUnit.factionId === PLAYER_FACTION) {
      if (!sCurrent.mapData) {
        if (isNewTurn) get().setIsCameraLocked(false);
        return;
      }
      const { friendlyTiles, enemyTiles } = buildTileSets(updatedUnits, activeId);
      const range = calcMoveRange(
        activeUnit.logicalX, activeUnit.logicalY, activeUnit.moveSteps,
        sCurrent.mapData, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT, friendlyTiles, enemyTiles,
      );
      set({ selectedUnitId: activeId, moveRangeTiles: range });
    } else {
      // Enemy AI deferral
      const aiDelay = get().isCtrlPressed ? 0 : 400;
      setTimeout(() => _runSingleEnemyAI(activeId), aiDelay);
    }

    if (isNewTurn) {
      // 턴 진입 연출용 2.5초 딜레이 종료 → 플레이어 카메라/액션 락 해제
      get().setIsCameraLocked(false);
    }
  };

  if (isNewTurn) {
    set((s2: any) => ({ 
      turnNumber: Math.max(1, s2.turnNumber + (roundEnded ? 1 : 0)),
      activeUnitId: null // 2.5초 연출 대기 중에는 활성화 유닛을 비움 (대화 발동 방지)
    }));
    get().setIsCameraLocked(true); // 입력 일시 강제 잠금 방어
    setTimeout(applyTurnDetails, 2500); // 연출 지속 시간과 동일하게 맞춤
  } else {
    applyTurnDetails();
  }
}

// ─── 승리 / 패배 조건 동적 판정 로직 (16단계) ──────────────────────────
function checkMatchRules(get: any, set: any): boolean {
  const s = get();
  if (s.battleResult) return true; // 결과 중복 방어

  const victory = s.victoryCondition;
  const defeat = s.defeatCondition;

  const isWin = victory ? evaluateCondition(victory, s) : false;
  const isLoss = defeat ? evaluateCondition(defeat, s) : false;

  if (isWin || isLoss) {
    const playerWon = isWin;
    const playerUnits = Object.values(s.units).filter((u: any) => u.factionId === PLAYER_FACTION);
    const survivorCount = playerUnits.filter((u: any) => u.state !== 'DEAD').length;
    
    // 전투 종료 후 소모된 병사 수 환산 (HP 역산)
    const survivingTroops: Record<string, number> = {};
    for (const u of playerUnits as any[]) {
      if (u.characterId) {
        if (u.state === 'DEAD' || u.hp <= 0) {
          survivingTroops[u.characterId] = 0;
        } else {
          survivingTroops[u.characterId] = Math.floor(u.hp / 1.5);
        }
      }
    }

    setTimeout(() => {
      set({ battleResult: { isVictory: playerWon, turn: get().turnNumber, survivorCount, survivingTroops } });
    }, 1000);
    return true;
  }
  return false;
}

function evaluateCondition(cond: any, s: any): boolean {
  if (!cond) return false;
  const alivePlayers = Object.values(s.units).filter((u: any) => u.factionId === PLAYER_FACTION && u.state !== 'DEAD');
  const aliveEnemies = Object.values(s.units).filter((u: any) => u.factionId !== PLAYER_FACTION && u.state !== 'DEAD');
  
  switch (cond.type) {
    case 'ROUT_ENEMY':
      return aliveEnemies.length === 0;
    case 'WIPEOUT_ALLY':
      return alivePlayers.length === 0;
    case 'KILL_TARGET':
      if (!cond.targetId) return false;
      const target = s.units[cond.targetId];
      return !target || target.state === 'DEAD';
    case 'REACH_LOCATION':
      if (!cond.targetTile) return false;
      return alivePlayers.some((u: any) => u.logicalX === cond.targetTile.lx && u.logicalY === cond.targetTile.ly);
    case 'SURVIVE_TURNS':
      return s.turnNumber >= (cond.turnLimit || 999);
    default:
      return false;
  }
}
