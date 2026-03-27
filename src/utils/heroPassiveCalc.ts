// J:/AI/Game/SRPG/src/utils/heroPassiveCalc.ts
// 영웅(Character) 1차 스탯 → 내정 패시브 효과 동적 계산
// GlobalHero.raceEffects/classEffects 하드코딩을 완전 대체

import type { Character } from '../types/characterTypes';
import type { HeroPassiveEffect } from '../types/gameTypes';
import { HERO_FORMULA as F } from '../constants/heroFormula';

/**
 * Character baseStats에서 내정 패시브 효과를 동적 계산한다.
 *
 * 계수 조정: constants/heroFormula.ts 참조
 */
export function calcHeroPassive(char: Character): HeroPassiveEffect {
  const { politics, charisma } = char.baseStats;
  const troopCount = char.troopCount ?? 0;

  return {
    // 정치力 → 상업/농업 생산 보너스 (%)
    productionBonus: Math.floor(politics * F.PASSIVE_PRODUCTION_PER_POLITICS),

    // 통솔力 → 치안 수치 (절대값)
    securityBonus: Math.floor(charisma * F.PASSIVE_SECURITY_PER_CHARISMA),

    // 통솔力 → 모병 효율 보너스 (%)
    recruitmentBonus: Math.floor(charisma * F.PASSIVE_RECRUIT_PER_CHARISMA),

    // 편제 병력 규모 → 식량 소모 배율
    // 병력 1000명당 기본 소모의 +20% 추가 부담
    foodConsumptionMultiplier:
      1.0 + (troopCount / 1000) * F.FOOD_CONSUMPTION_PER_1000_TROOP,
  };
}

/**
 * 영웅의 현재 최대 편제 가능 병력 계산 (통솔 기반)
 */
export function calcMaxTroopCount(char: Character): number {
  return Math.floor(char.baseStats.charisma * F.MAX_TROOP_PER_CHARISMA);
}
