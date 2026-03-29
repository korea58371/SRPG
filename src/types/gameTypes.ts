// J:/AI/Game/SRPG/src/types/gameTypes.ts

export const TerrainType = {
  SEA: 0,
  BEACH: 1,
  GRASS: 2,
  CLIFF: 3,
  PATH: 4,
  FOREST: 5,
  DESERT: 6,
  SNOW: 7,
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

export type BuffType = 'atk_up' | 'atk_down' | 'def_up' | 'def_down' | 'speed_up' | 'speed_down' | 'poison' | 'regen' | 'stun';

export interface ActiveBuff {
  id: string;       // 고유 인스턴스 ID 혹은 식별자
  type: BuffType;   // 버프 종류
  value: number;    // 증가율(e.g., 50 -> 50% 증가) 또는 데미지/회복 고정 수치
  duration: number; // 남은 턴 수
  sourceId?: string;// 시전자(부여한 자) ID
}

export interface SkillEffect {
  type: 'damage' | 'heal' | 'buff' | 'debuff' | 'push' | 'pull' | 'teleport' | 'dash' | 'dash_to_target';
  value?: number; // 데미지 계수, 힐량, 이동 칸 수, 버프 밸류 등
  duration?: number; // 버프/디버프 지속 턴
  buffType?: BuffType; // type이 buff나 debuff일 때 혹은 부가 효과일 때 부여할 버프 종류
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

  // ─ 정통 라운드(Round) 턴 시스템 ─────────────────────────
  // 매 라운드가 돌아올 때 false로 리셋되고, 1회 행동을 마치면 true로 전환되어 행동 제어
  hasActed: boolean;

  // ─ 스킬 시스템 전용 자원 ─────────────────────────────────────────
  mp: number;
  maxMp: number;
  rage: number;          // 분노 (0~100)
  morale: number;        // 사기 (0~100)
  skills: string[];      // 보유 스킬 ID 목록
  skillCooldowns: Record<string, number>; // 스킬별 남은 쿨타임
  skillCharges: Record<string, number>;   // 스킬별 남은 사용 횟수
  buffs?: ActiveBuff[];  // 활성화된 상태이상 및 버프 목록

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
  characterId?: string;  // 연결된 Character ID (포트레이트 조회용)
  name?: string;         // 전투 UI에 렌더링될 실제 이름

  // ─ 장수(General) 전용 전술 오라 능력치 ─────────────────────────
  generalPower?: number;        // 힘(Power): 지휘 범위 내 물리 공격력 보너스
  generalCommand?: number;      // 지휘(Command): 지휘 범위 내 전술/치명타 보너스
  generalLeadership?: number;   // 통솔(Leadership): 지휘 반경 (타일 수) 및 통솔 오라 방어력 보너스
  generalIntelligence?: number; // 지력(Intelligence): 지휘 범위 내 마법/계략 보너스

  // ─ 장수 내정 전용 능력치 ──────────────────────────────────────
  raceEffects?: HeroPassiveEffect;   // 종족 기반 기본 패시브
  classEffects?: HeroPassiveEffect;  // 직업 기반 패시브
}

// ─ 승리 / 패배 조건 (Level Objective) 확장 설계 ────────────────────────
export type ObjectiveType = 
  | 'ROUT_ENEMY'       // 적 모두 처치
  | 'WIPEOUT_ALLY'     // 아군 모두 사망
  | 'KILL_TARGET'      // 특정 유닛 사망
  | 'REACH_LOCATION'   // 특정 위치 도달
  | 'SURVIVE_TURNS';   // N턴간 생존

export interface LevelObjective {
  type: ObjectiveType;       // 판정 타입
  description: string;       // 유저 UI 다이얼로그 출력값
  targetId?: string;         // 'KILL_TARGET' (암살 대상 단위 ID)
  targetTile?: TilePos;      // 'REACH_LOCATION' (도달할 타일 X/Y 좌표)
  turnLimit?: number;        // 'SURVIVE_TURNS' 전용 한계치
}
