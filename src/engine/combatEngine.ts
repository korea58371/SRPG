import { useGameStore } from '../store/gameStore';
import type { Unit, TilePos } from '../types/gameTypes';
import { UNIT_MATCHUPS, UNIT_RESISTANCES, BASE_STATS } from '../constants/gameConfig';
import { getGeneralBuff, tileToPixel } from '../store/gameStore'; // 나중에 util로 뺄 수 있음
import { getEffectiveStat } from './statEngine';

// ─── 전투 데미지 계산 (장수 버프 포함) ────────────────────────────────────────
export function calcBaseDamage(attacker: Unit, defender: Unit, allUnits: Record<string, Unit>): { base: number; multiplier: number; isWeak: boolean; isResist: boolean } {
  const matchup = UNIT_MATCHUPS[attacker.unitType as keyof typeof UNIT_MATCHUPS];
  let multiplier = 1.0;
  if (matchup?.advantage === defender.unitType) multiplier += matchup.bonus;
  if (matchup?.disadvantage === defender.unitType) multiplier -= 0.2;

  // 공격 속성에 따른 방어측 약점/내성 배율 추가
  const attackElement = BASE_STATS[attacker.unitType]?.baseAttackElement || 'none';
  const resistMap = UNIT_RESISTANCES[defender.unitType];
  const elementalMult = (resistMap && attackElement in resistMap) 
    ? (resistMap[attackElement as keyof typeof resistMap] || 1.0) 
    : 1.0;
  
  multiplier *= elementalMult;
  const isWeak = elementalMult > 1.0;
  const isResist = elementalMult < 1.0;

  const atkBuff = getGeneralBuff(attacker, allUnits);
  const defBuff = getGeneralBuff(defender, allUnits);
  const effectiveAtk = getEffectiveStat(attacker, 'attack') + atkBuff.attackBonus;
  const effectiveDef = getEffectiveStat(defender, 'defense') + defBuff.defenseBonus;

  // 기반 공식: ((공격력 * 속성상성배율) - (방어력 * 0.5))
  const raw = (effectiveAtk * multiplier) - (effectiveDef * 0.5);
  return { base: Math.max(1, raw), multiplier, isWeak, isResist };
}

export function calcDamage(attacker: Unit, defender: Unit, allUnits: Record<string, Unit>): { dmg: number; isWeak: boolean; isResist: boolean } {
  const { base, isWeak, isResist } = calcBaseDamage(attacker, defender, allUnits);
  const variance = base * 0.1 * (Math.random() - 0.5) * 2;
  return { dmg: Math.max(1, Math.round(base + variance)), isWeak, isResist };
}

// ─── 전투 해결 + 플로팅 데미지 + 턴 종료 ───────────────────────────────────────
export function _resolveAttack(
  attacker: Unit,
  defender: Unit,
  attackerId: string,
  defenderId: string,
  allUnits: Record<string, Unit>,
) {
  const { dmg, isWeak, isResist } = calcDamage(attacker, defender, allUnits);
  const newHp = Math.max(0, defender.hp - dmg);
  const isDead = newHp <= 0;
  const isCrit = dmg >= attacker.attack * 0.95; // 임시 크리티컬 로직
  const log = `${attacker.unitType}(·${attackerId.slice(-2)}) → ${dmg}dmg → ${defender.unitType}(·${defenderId.slice(-2)})${isDead ? ' [사망]' : ''}`;
  const floatId = `fd-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const atkRage = Math.min(100, attacker.rage + 10);
  const defRage = Math.min(100, defender.rage + (isCrit ? 20 : 10));

  useGameStore.setState(s => ({
    units: {
      ...s.units,
      [attackerId]: { ...s.units[attackerId], state: 'IDLE', rage: atkRage },
      [defenderId]: { ...s.units[defenderId], hp: newHp, state: isDead ? 'DEAD' : 'IDLE', rage: defRage },
    },
    combatLog: [log, ...s.combatLog].slice(0, 8),
    floatingDamages: [
      ...s.floatingDamages,
      { id: floatId, x: tileToPixel(defender.logicalX), y: tileToPixel(defender.logicalY) - 10, value: dmg, isCrit, isWeak, isResist },
    ],
  }));

  const skipDelay = useGameStore.getState().isCtrlPressed ? 0 : 300;
  setTimeout(() => useGameStore.getState().endUnitTurn(), skipDelay);
}

// ─── 이동 후 행동 헬퍼 (bump 애니메이션 포함) ──────────────────────────────────
export function _moveThenAct(
  selfId: string,
  unit: Unit,
  dest: TilePos,
  px: number,
  py: number,
  waypoints: TilePos[],
  attackTargetId: string | null,
) {
  const isSkip = useGameStore.getState().isCtrlPressed;
  const MOVE_MS = isSkip ? 0 : waypoints.length * 150 + 100;

  useGameStore.setState(s => ({
    selectedUnitId: null,
    moveRangeTiles: new Set(),
    hoveredMoveTile: null,
    previewPath: [],
    confirmedDestination: null,
    confirmedPath: [],
    units: {
      ...s.units,
      [selfId]: {
        ...unit,
        logicalX: dest.lx,
        logicalY: dest.ly,
        targetX: px,
        targetY: py,
        state: isSkip ? 'IDLE' : 'MOVING',
        movePath: isSkip ? [] : waypoints,
        x: isSkip ? px : unit.x,
        y: isSkip ? py : unit.y,
      },
    },
  }));

  setTimeout(() => {
    // 렌더링 루프의 불확실성에 대비하여 이동이 완료된 시점에 x, y 픽셀값을 강제 덮어씌움 (위치 롤백 버그 방지)
    useGameStore.setState(s2 => ({
      units: {
        ...s2.units,
        [selfId]: { ...s2.units[selfId], x: px, y: py, targetX: px, targetY: py }
      }
    }));

    if (!attackTargetId) {
      useGameStore.getState().endUnitTurn();
      return;
    }

    const cur = useGameStore.getState();
    const atk = cur.units[selfId];
    const def = cur.units[attackTargetId];
    if (!atk || !def || def.state === 'DEAD') {
      useGameStore.getState().endUnitTurn();
      return;
    }

    if (isSkip) {
      _resolveAttack(atk, def, selfId, attackTargetId, cur.units);
      return;
    }

    const dx = tileToPixel(def.logicalX) - px;
    const dy = tileToPixel(def.logicalY) - py;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const BUMP = 18;

    useGameStore.setState(s2 => ({
      units: {
        ...s2.units,
        [selfId]: {
          ...s2.units[selfId],
          state: 'ATTACKING',
          targetX: px + (dx / len) * BUMP,
          targetY: py + (dy / len) * BUMP,
        },
      },
    }));

    setTimeout(() => {
      useGameStore.setState(s2 => ({
        units: { ...s2.units, [selfId]: { ...s2.units[selfId], targetX: px, targetY: py } },
      }));
    }, 220);

    setTimeout(() => {
      const cur2 = useGameStore.getState();
      const a2 = cur2.units[selfId];
      const d2 = cur2.units[attackTargetId];
      if (!a2 || !d2 || d2.state === 'DEAD') {
        useGameStore.getState().endUnitTurn();
        return;
      }
      _resolveAttack(a2, d2, selfId, attackTargetId, cur2.units);
    }, 450);
  }, MOVE_MS);
}
