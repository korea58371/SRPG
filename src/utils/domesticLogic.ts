import type { Province, GlobalHero, FactionResource } from '../types/appTypes';

export interface ProvinceYield {
  gold: number;
  food: number;
  recruitment: number;
  securityDelta: number;
  foodConsumption: number; // 주둔 영웅들로 인한 추가 식량 소모 (옵션)
}

/**
 * 특정 영지(Province)의 턴당 예상 산출량을 계산합니다.
 * @param province 계산할 영지
 * @param stationedHeroes 영지에 주둔 중인 장수 목록
 * @returns 턴당 예상 산출량 객체
 */
export function calculateProvinceYield(province: Province, stationedHeroes: GlobalHero[]): ProvinceYield {
  let totalRecruitmentBonus = 0;
  let totalProductionBonus = 0;
  let totalSecurityDelta = 0;
  let maxFoodConsumptionMultiplier = 1.0;

  for (const hero of stationedHeroes) {
    const { raceEffects, classEffects } = hero;
    
    // 모병량 보너스 합산
    totalRecruitmentBonus += (raceEffects?.recruitmentBonus || 0) + (classEffects?.recruitmentBonus || 0);
    
    // 생산량 보너스 합산
    totalProductionBonus += (raceEffects?.productionBonus || 0) + (classEffects?.productionBonus || 0);
    
    // 치안 보너스 합산
    totalSecurityDelta += (raceEffects?.securityBonus || 0) + (classEffects?.securityBonus || 0);
    
    // 식량 소모 배율 합산 (기본 계수 1.0에서 초과/미달분 합산)
    const raceFoodMult = raceEffects?.foodConsumptionMultiplier ?? 1.0;
    const classFoodMult = classEffects?.foodConsumptionMultiplier ?? 1.0;
    maxFoodConsumptionMultiplier += (raceFoodMult - 1.0) + (classFoodMult - 1.0);
  }

  // 곱연산은 하한선 0을 둡니다 (역생산 방지)
  const recruitmentMultiplier = Math.max(0, 1 + totalRecruitmentBonus / 100);
  const productionMultiplier  = Math.max(0, 1 + totalProductionBonus / 100);
  const foodConsumpMultiplier = Math.max(0, maxFoodConsumptionMultiplier);

  // 최종 산출량 계산 (치안이 낮으면 생산량에 패널티 부여 가능 - 예: 치안 50 이하면 생산량 감소)
  const securityPenalty = province.security < 50 ? (province.security / 50) : 1.0;

  const gold = Math.floor(province.baseGoldProduction * productionMultiplier * securityPenalty);
  const food = Math.floor(province.baseFoodProduction * productionMultiplier * securityPenalty);
  const recruitment = Math.floor(province.baseRecruitment * recruitmentMultiplier * securityPenalty);

  return {
    gold,
    food,
    recruitment,
    securityDelta: totalSecurityDelta,
    foodConsumption: Math.floor(5 * foodConsumpMultiplier) * stationedHeroes.length, // 장수 1명당 기본 5의 식량 소모로 가정
  };
}

/**
 * 팩션의 턴 종료 시 모든 영지의 산출량을 합산하여 팩션 자원에 반영합니다.
 */
export function processDomesticTurn(
  factionId: string,
  provinces: Record<string, Province>,
  globalHeroes: Record<string, GlobalHero>,
  currentResources: FactionResource
): { newProvinces: Record<string, Province>, newResources: FactionResource } {
  
  let newGold = currentResources.gold;
  let newFood = currentResources.food;
  let newManpower = currentResources.manpower;

  const newProvinces = { ...provinces };

  const myProvinces = Object.values(provinces).filter(p => p.owner === factionId);
  const myHeroes = Object.values(globalHeroes).filter(h => h.factionId === factionId);

  for (const province of myProvinces) {
    const stationedHeroes = myHeroes.filter(h => h.locationProvinceId === province.id);
    const yields = calculateProvinceYield(province, stationedHeroes);

    // 자원 합산
    newGold += yields.gold;
    newFood += yields.food - yields.foodConsumption;
    newManpower += yields.recruitment;

    // 영지 치안 업데이트 (0 ~ 100 제한)
    const newSecurity = Math.max(0, Math.min(100, province.security + yields.securityDelta));
    
    newProvinces[province.id] = {
      ...province,
      security: newSecurity
    };
  }

  return {
    newProvinces,
    newResources: { gold: newGold, food: newFood, manpower: newManpower }
  };
}
