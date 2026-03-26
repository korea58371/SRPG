import type { Unit } from '../types/gameTypes';
import { UNIT_MATCHUPS, UNIT_RESISTANCES, BASE_STATS } from '../constants/gameConfig';
import { getGeneralBuff } from '../store/gameStore';

/**
 * 유닛의 기본 스탯에 현재 걸려있는 버프/디버프 배율을 합산하여 
 * 최종 실질 판정 스탯(Effective Stat)을 반환하는 엔진 유틸입니다.
 */
export function getEffectiveStat(unit: Unit, stat: 'attack' | 'defense' | 'speed'): number {
  const base = unit[stat];
  const buffs = unit.buffs || [];
  let mult = 1.0;
  
  for (const b of buffs) {
    if (stat === 'attack') {
      if (b.type === 'atk_up') mult += (b.value / 100);
      else if (b.type === 'atk_down') mult -= (b.value / 100);
    } else if (stat === 'defense') {
      if (b.type === 'def_up') mult += (b.value / 100);
      else if (b.type === 'def_down') mult -= (b.value / 100);
    } else if (stat === 'speed') {
      if (b.type === 'speed_up') mult += (b.value / 100);
      else if (b.type === 'speed_down') mult -= (b.value / 100);
    }
  }
  
  // 중첩된 디버프로 인해 스탯 값이 1 미만으로 떨어지지 않게 하한 보장
  return Math.max(1, Math.round(base * mult));
}

// ─── 전투 데미지 계산 로직 (기본 평타 및 범용 스킬 적용) ────────────────────────
export function calcBaseDamage(
  attacker: Unit, 
  defender: Unit, 
  allUnits: Record<string, Unit>,
  skillElement?: string,
  skillValueMult: number = 1.0
): { base: number; multiplier: number; isWeak: boolean; isResist: boolean } {
  const matchup = UNIT_MATCHUPS[attacker.unitType as keyof typeof UNIT_MATCHUPS];
  let multiplier = 1.0;
  if (matchup?.advantage === defender.unitType) multiplier += matchup.bonus;
  if (matchup?.disadvantage === defender.unitType) multiplier -= 0.2;

  // 스킬 고유 속성이 없으면 평타 기본 속성 사용
  const attackElement = skillElement && skillElement !== 'none' 
    ? skillElement 
    : (BASE_STATS[attacker.unitType]?.baseAttackElement || 'none');
    
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

  // 기반 공식: ((공격력 * 스킬계수 * 상성배율) - (방어력 * 0.5))
  const raw = (effectiveAtk * skillValueMult * multiplier) - (effectiveDef * 0.5);
  return { base: Math.max(1, raw), multiplier, isWeak, isResist };
}

export function calcDamage(
  attacker: Unit, 
  defender: Unit, 
  allUnits: Record<string, Unit>,
  skillElement?: string,
  skillValueMult: number = 1.0
): { dmg: number; isWeak: boolean; isResist: boolean } {
  const { base, isWeak, isResist } = calcBaseDamage(attacker, defender, allUnits, skillElement, skillValueMult);
  const variance = base * 0.1 * (Math.random() - 0.5) * 2;
  return { dmg: Math.max(1, Math.round(base + variance)), isWeak, isResist };
}
