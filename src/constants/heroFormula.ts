// J:/AI/Game/SRPG/src/constants/heroFormula.ts
// 영웅 스탯 → 전장/내정 계산 계수 (밸런스 조정은 이 파일만 수정)

/**
 * 영웅 1차 스탯(baseStats) → 전장 Unit 변환 계수
 * 모든 계산식이 이 상수를 참조하므로 밸런스 조정 시 여기만 수정
 */
export const HERO_FORMULA = {

  // ─ 전장 Unit 생성 계수 ───────────────────────────────────────────────
  // HP = 영웅hp * HP_BASE_MULTIPLIER + floor(병력수 * 병종기본HP / HP_TROOP_DIVISOR)
  HP_BASE_MULTIPLIER:           5,
  HP_TROOP_DIVISOR:             100,

  // 공격력 = floor(무력 * ATK_STRENGTH_FACTOR + 병종기본공격 + 병력수 * ATK_TROOP_FACTOR)
  ATK_STRENGTH_FACTOR:          0.6,
  ATK_TROOP_FACTOR:             0.05,

  // 방어력 = floor(지력 * DEF_INTELLIGENCE_FACTOR + 병종기본방어)
  DEF_INTELLIGENCE_FACTOR:      0.4,

  // ─ 내정 패시브 계산 계수 ────────────────────────────────────────────
  // 자원 생산 보너스 (%) = politics * PASSIVE_PRODUCTION_PER_POLITICS
  PASSIVE_PRODUCTION_PER_POLITICS:  0.5,

  // 치안 보너스 = charisma * PASSIVE_SECURITY_PER_CHARISMA
  PASSIVE_SECURITY_PER_CHARISMA:    0.3,

  // 징병 보너스 (%) = charisma * PASSIVE_RECRUIT_PER_CHARISMA
  PASSIVE_RECRUIT_PER_CHARISMA:     0.5,

  // 최대 편제 병력 = charisma * MAX_TROOP_PER_CHARISMA
  MAX_TROOP_PER_CHARISMA:           10,

  // 식량 소모 배율 기본값 (1.0 = 100%)
  // 실계산: 1.0 + (troopCount / 1000) * FOOD_CONSUMPTION_PER_1000_TROOP
  FOOD_CONSUMPTION_PER_1000_TROOP:  0.2,

} as const;
