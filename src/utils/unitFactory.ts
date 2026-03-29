// J:/AI/Game/SRPG/src/utils/unitFactory.ts
// Character(영웅) → 전장 Unit 인스턴스 변환
// 영웅 1차 스탯 + 편제 병종/병력 → 실제 전투 스탯 합성

import type { Character } from '../types/characterTypes';
import type { Unit } from '../types/gameTypes';
import type { FactionId } from '../types/gameTypes';
import { BASE_STATS } from '../constants/gameConfig';
import { HERO_FORMULA as F } from '../constants/heroFormula';
import { tileToPixel } from '../store/gameStore';

/**
 * Character(영웅) → 전장 Unit 인스턴스 생성
 *
 * 전투력 계산 구조 (맹장과 명장의 교차 역전):
 *   개인 2차 고정 스탯 = 1차 보디 스탯(power, toughness, constitution) * 상수
 *   부대 3차 통솔 배율 = 1.0 + 지휘력(command) or 통솔력(leadership) 보너스%
 *   최종스탯 = 개인 2차 고정 + (병력수 * 부대기본 * 배율 가중치)
 *
 * 계수 조정: constants/heroFormula.ts 참조
 */
export function createUnitFromHero(
  char: Character,
  factionId: FactionId,
  lx: number,
  ly: number,
): Unit {
  const troopType = char.troopType ?? 'INFANTRY';
  const troopBase = BASE_STATS[troopType] ?? BASE_STATS.INFANTRY;
  const s = char.baseStats;
  const troopCount = char.troopCount ?? 0;

  // 1. 개인 2차 고정 전투 스탯
  const personalHp  = s.constitution * F.HP_PERSONAL_BETA;
  const personalAtk = Math.floor(s.power * F.ATK_PERSONAL_BETA);
  const personalDef = Math.floor(s.toughness * F.DEF_PERSONAL_BETA);

  // 2. 부대 3차 지휘/통솔 스케일링 배율
  const commandMult    = 1.0 + (s.command * F.COMMAND_ATK_MULTIPLIER_BETA);
  const leadershipMult = 1.0 + (s.leadership * F.LEADERSHIP_DEF_MULTIPLIER_BETA);

  // 3. 편제 병력에 전술 통솔 배율을 곱한 스탯
  const troopHp  = Math.floor(troopCount * troopBase.hp * F.TROOP_HP_WEIGHT * leadershipMult);
  const troopAtk = Math.floor(troopCount * troopBase.attack * F.TROOP_ATK_WEIGHT * commandMult);
  const troopDef = Math.floor(troopCount * troopBase.defense * F.TROOP_DEF_WEIGHT * leadershipMult);

  // 4. 최종 영웅 유닛 전투력
  const hp  = personalHp + troopHp;
  const atk = personalAtk + troopAtk;
  const def = personalDef + troopDef;

  const px = tileToPixel(lx);
  const py = tileToPixel(ly);

  return {
    id: `unit_${char.id}`,
    factionId,
    unitType: troopType,
    isHero: true,
    characterId: char.id,

    hp, maxHp: hp,
    attack: atk,
    defense: def,
    speed:       s.agility, // 민첩이 행동속도로 작동
    moveSteps:   troopBase.moveSteps,
    attackRange: troopBase.attackRange,

    // 장수 진형 보너스 오라용 (오라 로직에서 참조)
    generalPower:        s.power,
    generalCommand:      s.command,
    generalIntelligence: s.intelligence,
    generalLeadership:   s.leadership,

    skills: char.skills,
    mp: 100, maxMp: 100,
    rage: 0, morale: 80,
    skillCooldowns: {}, skillCharges: {},
    buffs: [],

    hasActed: false,
    state: 'IDLE',
    logicalX: lx, logicalY: ly,
    x: px, y: py,
    targetX: px, targetY: py,
    movePath: [],
  };
}
