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
 * 전투력 계산 구조:
 *   HP      = 영웅hp * MULTIPLIER + floor(병력수 * 병종기본HP / DIVISOR)
 *   공격    = floor(무력 * FACTOR  + 병종기본공격 + 병력수 * TROOP_FACTOR)
 *   방어    = floor(지력 * FACTOR  + 병종기본방어)
 *   속도    = 영웅 speed (병종 무관)
 *   이동/사거리 = 편제 병종 기본값
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

  const troopHpContrib = Math.floor(troopCount * (troopBase.hp / F.HP_TROOP_DIVISOR));
  const hp    = s.hp * F.HP_BASE_MULTIPLIER + troopHpContrib;
  const atk   = Math.floor(s.strength * F.ATK_STRENGTH_FACTOR + troopBase.attack + troopCount * F.ATK_TROOP_FACTOR);
  const def   = Math.floor(s.intelligence * F.DEF_INTELLIGENCE_FACTOR + troopBase.defense);

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
    speed:       s.speed,
    moveSteps:   troopBase.moveSteps,
    attackRange: troopBase.attackRange,

    // 장수 능력치 (지휘 오라 등 전장 버프에 사용)
    generalStrength:     s.strength,
    generalIntelligence: s.intelligence,
    generalPolitics:     s.politics,
    generalCharisma:     s.charisma,

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
