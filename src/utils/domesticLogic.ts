// J:/AI/Game/SRPG/src/utils/domesticLogic.ts
// [수정] GlobalHero 제거 — Character 타입으로 교체, calcHeroPassive() 연동

import type { Province, FactionResource } from '../types/appTypes';
import type { Character } from '../types/characterTypes';
import { calcHeroPassive } from './heroPassiveCalc';

export interface ProvinceYield {
  gold: number;
  food: number;
  recruitment: number;
  securityDelta: number;
  foodConsumption: number;
}

/**
 * 특정 영지의 턴당 예상 산출량을 계산합니다.
 * 장수 패시브는 calcHeroPassive()를 통해 Character.baseStats에서 동적 계산됩니다.
 */
export function calculateProvinceYield(province: Province, stationedChars: Character[]): ProvinceYield {
  let totalRecruitmentBonus = 0;
  let totalProductionBonus = 0;
  let totalSecurityDelta = 0;
  let totalFoodConsumptionMultiplierDelta = 0;

  for (const char of stationedChars) {
    const passive = calcHeroPassive(char);

    totalRecruitmentBonus   += passive.recruitmentBonus;
    totalProductionBonus    += passive.productionBonus;
    totalSecurityDelta      += passive.securityBonus;
    // 식량 소모 배율: 기본값 1.0에서 초과분 합산
    totalFoodConsumptionMultiplierDelta += (passive.foodConsumptionMultiplier - 1.0);
  }

  const recruitmentMultiplier  = Math.max(0, 1 + totalRecruitmentBonus / 100);
  const productionMultiplier   = Math.max(0, 1 + totalProductionBonus / 100);
  const foodConsumpMultiplier  = Math.max(0, 1.0 + totalFoodConsumptionMultiplierDelta);

  // 치안이 낮으면 생산량에 패널티 (치안 50 이하 → 감소)
  const securityPenalty = province.security < 50 ? (province.security / 50) : 1.0;

  const gold        = Math.floor(province.baseGoldProduction * productionMultiplier * securityPenalty);
  const food        = Math.floor(province.baseFoodProduction * productionMultiplier * securityPenalty);
  const recruitment = Math.floor(province.baseRecruitment * recruitmentMultiplier * securityPenalty);

  // 식량 소모: 장수 1명당 기본 5 + 편제 병력 기반 추가 소모
  const baseFoodCost = 5 * stationedChars.length;
  const troopFoodCost = stationedChars.reduce((sum, c) => sum + Math.floor(c.troopCount * 0.01), 0);
  const foodConsumption = Math.floor((baseFoodCost + troopFoodCost) * foodConsumpMultiplier);

  return { gold, food, recruitment, securityDelta: totalSecurityDelta, foodConsumption };
}

/**
 * 팩션의 턴 종료 시 모든 영지의 산출량을 합산하여 팩션 자원에 반영합니다.
 */
export function processDomesticTurn(
  factionId: string,
  provinces: Record<string, Province>,
  characters: Record<string, Character>,
  currentResources: FactionResource
): { newProvinces: Record<string, Province>, newResources: FactionResource } {

  let newGold     = currentResources.gold;
  let newFood     = currentResources.food;
  let newManpower = currentResources.manpower;

  const newProvinces = { ...provinces };

  const myProvinces = Object.values(provinces).filter(p => p.owner === factionId);
  // Factioned 상태이며 해당 팩션 소속인 영웅만 적용
  const myChars = Object.values(characters).filter(
    c => c.factionId === factionId && c.state === 'Factioned'
  );

  for (const province of myProvinces) {
    const stationedChars = myChars.filter(c => c.locationProvinceId === province.id);
    const yields = calculateProvinceYield(province, stationedChars);

    newGold     += yields.gold;
    newFood     += yields.food - yields.foodConsumption;
    newManpower += yields.recruitment;

    const newSecurity = Math.max(0, Math.min(100, province.security + yields.securityDelta));
    newProvinces[province.id] = { ...province, security: newSecurity };
  }

  return {
    newProvinces,
    newResources: { gold: newGold, food: newFood, manpower: newManpower },
  };
}
