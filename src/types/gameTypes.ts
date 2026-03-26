// J:/AI/Game/SRPG/src/types/gameTypes.ts

export const TerrainType = {
  SEA: 0,
  BEACH: 1,
  GRASS: 2,
  CLIFF: 3,
  PATH: 4,
  FOREST: 5,
} as const;

export type TerrainType = typeof TerrainType[keyof typeof TerrainType];

export type FactionId = string;
export type UnitType = 'INFANTRY' | 'SPEARMAN' | 'CAVALRY' | 'ARCHER' | 'GENERAL';
export type UnitState = 'IDLE' | 'MOVING' | 'ATTACKING' | 'KNOCKBACK' | 'DEAD';
export type DamageAttribute = 'strike' | 'pierce' | 'slash' | 'fire' | 'earth' | 'none';

// defensive: 아군이 거점 수비, offensive: 아군이 길목에서 공격, cheat: 디버그 테스트용 중앙 밀집
export type BattleType = 'defensive' | 'offensive' | 'cheat';

export interface TilePos {
  lx: number;
  ly: number;
}

export interface MapObjectData {
  id: string;
  type: 'TREE' | 'MOUNTAIN' | 'HOUSE';
  lx: number;
  ly: number;
  px: number; /* 내부 오프셋 적용된 픽셀 좌표 */
  py: number;
}

// ─── 스킬 및 자원 시스템 ──────────────────────────────────────────────
export type AoEShape = 'single' | 'cross' | 'diagonal' | 'radius' | 'line' | 'cone' | 'donut' | 'global' | 'line_to_target';
export type CostType = 'cooldown' | 'mp' | 'rage' | 'morale' | 'hp';
export type TargetType = 'enemy' | 'ally' | 'self' | 'empty' | 'any';

export interface SkillCost {
  type: CostType;
  amount: number;
}

export interface SkillEffect {
  type: 'damage' | 'heal' | 'buff' | 'debuff' | 'push' | 'pull' | 'teleport' | 'dash' | 'dash_to_target';
  value?: number; // 데미지 계수, 힐량, 이동 칸 수 등
  duration?: number; // 버프/디버프 지속 턴
  element?: DamageAttribute; // 기술 고유 데미지 속성
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  range: number;          // 시전 사거리 (0이면 자신)
  aoeShape: AoEShape;     // 범위 형태
  aoeRadius: number;      // 범위 크기
  targetType: TargetType; // 타겟 제한
  requiresTarget: boolean;// 시전 시 범위 내 유효 타겟이 최소 1개 반드시 존재해야 하는지 여부
  cost: SkillCost[];      // 발동 비용 (복수 가능)
  effects: SkillEffect[]; // 스킬 효과
  cooldownTurn?: number;  // 기본 쿨타임 (적용된 경우)
  maxCharge?: number;     // 전투 당 최대 사용 횟수 (궁극기 등)
  grantsReAction?: boolean; // 스킬 사용 후 즉각적으로 턴을 이어나감
}

// ─ 장수 내정 특성 (Passive Effects) ─────────────────────────
export interface HeroPassiveEffect {
  recruitmentBonus: number;            // 모병량 보너스 (%)
  foodConsumptionMultiplier: number;   // 군량 소모 배율 (기본 1.0)
  securityBonus: number;               // 치안 증감 수치 (절대값)
  productionBonus: number;             // 자원 생산량 보너스 (%)
}

export interface Unit {
  id: string;
  factionId: FactionId;
  unitType: UnitType;

  // 전투 및 생존 스탯
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;       // CT 증가 속도 (CT 시스템 전용)
  moveSteps: number;   // 1턴에 이동 가능한 타일 수
  attackRange: number;

  // ─ CT(Charge Time) 이니셔티브 시스템 ─────────────────────────
  // 매 틱마다 speed만큼 증가. CT_THRESHOLD(=100) 도달 시 행동권 획득
  ct: number;

  // ─ 스킬 시스템 전용 자원 ─────────────────────────────────────────
  mp: number;
  maxMp: number;
  rage: number;          // 분노 (0~100)
  morale: number;        // 사기 (0~100)
  skills: string[];      // 보유 스킬 ID 목록
  skillCooldowns: Record<string, number>; // 스킬별 남은 쿨타임
  skillCharges: Record<string, number>;   // 스킬별 남은 사용 횟수

  // 위치 및 렌더링
  state: UnitState;
  logicalX: number;
  logicalY: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  movePath: TilePos[];

  isHero: boolean;

  // ─ 장수(General) 전용 능력치 (unitType === 'GENERAL' 일 때만 유효) ──
  generalStrength?: number;     // 武力: 지휘 범위 내 병종 공격 +
  generalIntelligence?: number; // 知力: 지휘 범위 내 병종 방어 +
  generalPolitics?: number;     // 政治: 지휘 범위 내 병종 HP 보너스
  generalCharisma?: number;     // 統率: 지휘 반경 (타일 수)

  // ─ 장수 내정 전용 능력치 ──────────────────────────────────────
  raceEffects?: HeroPassiveEffect;   // 종족 기반 기본 패시브
  classEffects?: HeroPassiveEffect;  // 직업 기반 패시브
}
