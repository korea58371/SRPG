// J:/AI/Game/SRPG/src/constants/genericUnits.ts
// 범용 무장 템플릿 풀 (중립 몬스터, NPC 적군 등)
// 영웅(Character)과 달리 고정 스탯 — createUnitFromTemplate()으로 인스턴스화

import type { UnitType, DamageAttribute, Unit } from '../types/gameTypes';
import type { FactionId } from '../types/gameTypes';
import { tileToPixel } from '../store/gameStore';

export interface GenericUnitTemplate {
  id: string;
  name: string;
  unitType: UnitType;

  // 고정 전투 스탯 (가중 계산 없이 그대로 사용)
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  moveSteps: number;
  attackRange: number;
  baseAttackElement: DamageAttribute;

  skills: string[];
}

// ─ 범용 무장 템플릿 풀 ────────────────────────────────────────────────────
// 추가 시 이 객체에 새 항목만 넣으면 됨
export const GENERIC_UNIT_POOL: Record<string, GenericUnitTemplate> = {
  bandit_sword: {
    id: 'bandit_sword', name: '산적 검사', unitType: 'INFANTRY',
    hp: 60, attack: 12, defense: 6, speed: 35,
    moveSteps: 4, attackRange: 1, baseAttackElement: 'slash',
    skills: [],
  },
  bandit_archer: {
    id: 'bandit_archer', name: '산적 궁수', unitType: 'ARCHER',
    hp: 45, attack: 14, defense: 4, speed: 38,
    moveSteps: 3, attackRange: 3, baseAttackElement: 'pierce',
    skills: [],
  },
  orc_warrior: {
    id: 'orc_warrior', name: '오크 전사', unitType: 'INFANTRY',
    hp: 90, attack: 18, defense: 8, speed: 28,
    moveSteps: 3, attackRange: 1, baseAttackElement: 'strike',
    skills: [],
  },
  goblin_scout: {
    id: 'goblin_scout', name: '고블린 정찰병', unitType: 'CAVALRY',
    hp: 40, attack: 10, defense: 3, speed: 55,
    moveSteps: 6, attackRange: 1, baseAttackElement: 'slash',
    skills: [],
  },
  skeleton_spear: {
    id: 'skeleton_spear', name: '해골 창병', unitType: 'SPEARMAN',
    hp: 70, attack: 13, defense: 10, speed: 25,
    moveSteps: 3, attackRange: 2, baseAttackElement: 'pierce',
    skills: [],
  },
  wolf_pack: {
    id: 'wolf_pack', name: '야생 늑대 무리', unitType: 'CAVALRY',
    hp: 50, attack: 16, defense: 2, speed: 65,
    moveSteps: 7, attackRange: 1, baseAttackElement: 'slash',
    skills: [],
  },
};

/**
 * GenericUnitTemplate → 전장 Unit 인스턴스 생성
 * @param template    GENERIC_UNIT_POOL에서 가져온 템플릿
 * @param instanceId  유니크 인스턴스 ID (예: `unit_orc_0`)
 * @param factionId   소속 세력 ID
 * @param lx, ly      배치 논리 좌표
 */
export function createUnitFromTemplate(
  template: GenericUnitTemplate,
  instanceId: string,
  factionId: FactionId,
  lx: number,
  ly: number,
): Unit {
  const px = tileToPixel(lx);
  const py = tileToPixel(ly);

  return {
    id: instanceId,
    factionId,
    unitType: template.unitType,
    isHero: false,
    characterId: undefined,

    hp: template.hp,
    maxHp: template.hp,
    attack: template.attack,
    defense: template.defense,
    speed: template.speed,
    moveSteps: template.moveSteps,
    attackRange: template.attackRange,

    skills: template.skills,
    mp: 50, maxMp: 50,
    rage: 0, morale: 60,
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
