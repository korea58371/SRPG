import type { Unit } from '../types/gameTypes';

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
