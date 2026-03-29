// J:/AI/Game/SRPG/src/constants/heroFormula.ts
// 영웅 스탯 → 전장/내정 계산 계수 (밸런스 조정은 이 파일만 수정)

/**
 * 영웅 1차 스탯(baseStats) → 전장 Unit 변환 계수
 * 모든 계산식이 이 상수를 참조하므로 밸런스 조정 시 여기만 수정
 */
export const HERO_FORMULA = {

  // ─ 2차 계수 (장수 개인 스탯 변환) ──────────────────────────────────
  HP_PERSONAL_BETA: 5.0,    // 체력(constitution) * 5 = 개인 HP
  ATK_PERSONAL_BETA: 1.0,   // 힘(power) * 1.0 = 개인 공격력
  DEF_PERSONAL_BETA: 1.0,   // 방어(toughness) * 1.0 = 개인 방어력

  // ─ 3차 계수 (지휘/통솔 부대 배율 보너스) ───────────────────────────
  // 지휘력(command)은 전술 효율(공격)에, 통솔력(leadership)은 조직 유지(방어/체력)에 관여
  COMMAND_ATK_MULTIPLIER_BETA: 0.01,    // 지휘력 1당 부대 공격 배율 1% 증가 (100이면 1.0 추가 = 200%)
  LEADERSHIP_DEF_MULTIPLIER_BETA: 0.01, // 통솔력 1당 부대 방어/HP 배율 1% 증가

  // 병력 비례 기본 적용 비율
  TROOP_HP_WEIGHT: 1.0,    // 병력수의 비율을 HP에 반영 (가장 다이나믹)
  TROOP_ATK_WEIGHT: 0.02,  // 밸런스 계수 (병력이 공격/방어 수치에 미치는 비중 완화)
  TROOP_DEF_WEIGHT: 0.02,

  // ─ 내정/전략 패시브 보너스 ──────────────────────────────────────────
  // 자원 생산 보너스 (%) = politics * PASSIVE_PRODUCTION_PER_POLITICS
  PASSIVE_PRODUCTION_PER_POLITICS:  0.5,

  // 치안 보너스 = charm * PASSIVE_SECURITY_PER_CHARM
  PASSIVE_SECURITY_PER_CHARM:       0.3,

  // 징병 보너스 (%) = charm * PASSIVE_RECRUIT_PER_CHARM
  PASSIVE_RECRUIT_PER_CHARM:        0.5,

  // 최대 편제 병력 = leadership * MAX_TROOP_PER_LEADERSHIP
  MAX_TROOP_PER_LEADERSHIP:         100, // 통솔 1당 병력 100명 한도 (예: 100이면 1만 명)

  // 식량 소모 배율
  FOOD_CONSUMPTION_PER_1000_TROOP:  0.2,

} as const;
