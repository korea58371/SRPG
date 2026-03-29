// J:/AI/Game/SRPG/src/types/dialogueTypes.ts
// 이벤트 대화 시스템 전용 타입 모듈
// 전략 맵, 등용, 인연, 전투 모든 컨텍스트를 포괄

import type { FactionId } from './gameTypes';

// ─── 이벤트 발동 컨텍스트 ─────────────────────────────────────────────────────
export type DialogueContext = 'BATTLE' | 'RECRUITMENT' | 'AFFINITY' | 'STORY';

// ─── 감정 상태 (포트레이트 필터/표정 변환용) ────────────────────────────────
export type DialogueEmotion =
  | 'normal'
  | 'happy'
  | 'embarrassed'
  | 'serious'
  | 'surprised'
  | 'sad'
  | 'angry';

// ─── 전투 트리거 이벤트 타입 ──────────────────────────────────────────────────
export type BattleTriggerEvent =
  | 'TURN_START'        // 특정 캐릭터의 턴 시작
  | 'ENEMY_DEFEATED'    // 적 유닛 처치
  | 'ALLY_DEFEATED'     // 아군 유닛 사망
  | 'HP_THRESHOLD'      // HP가 특정 % 이하로 하락
  | 'FIRST_ENGAGEMENT'  // 대상 vs 대상 첫 교전
  | 'BATTLE_START'      // 전투 시작 (첫 출진)
  | 'BEFORE_ATTACK'     // 공격 직전 (행동 확정 시)
  | 'AFTER_ATTACK'      // 공격 직후 (데미지 처리 완료)
  | 'ON_KILL'           // 적을 처치하는 순간
  | 'SKILL_USED';       // 특정 스킬 사용

// ─── 전투 내 발화 페이즈 (같은 유닛 턴 내 시점 구분) ────────────────────────
export type BattlePhase =
  | 'TURN_START'    // 차례가 오는 순간
  | 'BEFORE_ATTACK' // 공격/스킬 확정 직전
  | 'AFTER_ATTACK'  // 공격/스킬 결과 직후
  | 'ON_KILL';      // 적 처치 확인 직후

// ─── 트리거 평가에 사용되는 컨텍스트 스냅샷 ────────────────────────────────
export interface TriggerContext {
  // 공통
  dialogueContext: DialogueContext;
  characterId: string;          // 이벤트 주인공 캐릭터 ID
  protagonistId: string;        // 플레이어 주인공 ID

  // 관계 수치
  relationshipWithProtagonist: number;  // -100 ~ 100
  relationshipWithTarget?: number;      // 대상 캐릭터와의 관계 (선택)
  targetCharacterId?: string;

  // 전투 전용
  battleEvent?: BattleTriggerEvent;
  unitHpPercent?: number;        // 0~100 (현재 HP / maxHp * 100)
  turnNumber?: number;
  defeatedUnitId?: string;       // ENEMY_DEFEATED / ALLY_DEFEATED 시 대상 ID
  skillId?: string;              // SKILL_USED 시 스킬 ID

  // 등용 전용
  recruitSuccess?: boolean;
  targetFactionId?: FactionId;

  // 인연 전용
  affinityLevel?: number;        // 0 ~ 100
  sharedBattleCount?: number;    // 함께한 전투 횟수

  // 1회성 방지용
  playedEventIds: Set<string>;

  // 전략 맵 전용
  strategyTurn?: number;  // 현재 전략 맵 턴 수
}

// ─── AND/OR 복합 조건 트리 ────────────────────────────────────────────────────
export type ConditionNode =
  | { type: 'AND'; conditions: ConditionNode[] }
  | { type: 'OR';  conditions: ConditionNode[] }
  | { type: 'LEAF'; check: (ctx: TriggerContext) => boolean };

export interface DialogueTrigger {
  context: DialogueContext;
  condition: ConditionNode;
}

// ─── 대사 한 줄 ───────────────────────────────────────────────────────────────
export interface DialogueLine {
  speakerId: 'NARRATOR' | string; // characterId 또는 'NARRATOR'
  speakerName?: string;           // 표시 이름 (없으면 캐릭터 name 사용)
  text: string;
  emotion?: DialogueEmotion;
}

// ─── 이벤트 대사 스크립트 단위 ───────────────────────────────────────────────
export interface DialogueEvent {
  id: string;
  title: string;                  // 내부 식별용 제목 (UI 미표시)
  context: DialogueContext;
  trigger: DialogueTrigger;
  once: boolean;                  // true: 1회만 발동, false: 매번 발동 가능
  lines: DialogueLine[];
  priority?: number;              // 높을수록 같은 시점 이벤트 중 우선 발동 (기본값: 0)
  battlePhase?: BattlePhase;      // 발화 시점 구분 (BATTLE 컨텍스트 전용)
  reactToUnitId?: string;         // 이 unitId가 처치당했을 때 반응 (ALLY_DEFEATED/ENEMY_DEFEATED용)
  onComplete?: () => void;        // 대사 완료 후 콜백 (선택, 직렬화 불가)
}

// ─── 큐 항목 타입 ─────────────────────────────────────────────────────────────
export interface DialogueQueueItem {
  event: DialogueEvent;
  anchor?: { x: number; y: number };
}

// ─── Zustand Slice 상태 타입 ──────────────────────────────────────────────────
export interface DialogueSliceState {
  activeDialogue: DialogueEvent | null;
  currentLineIndex: number;
  playedEventIds: Set<string>;

  // 전투용 말풍선 위치 (유닛 포트레이트 토큰 화면 좌표)
  bubbleAnchor: { x: number; y: number } | null;

  // 대기 큐 — 연속 이벤트(예: ON_KILL 발화자 → 동료 반응) 순서 보장
  dialogueQueue: DialogueQueueItem[];
}

export interface DialogueSliceActions {
  triggerDialogue: (event: DialogueEvent, anchor?: { x: number; y: number }) => void;
  enqueueDialogue: (event: DialogueEvent, anchor?: { x: number; y: number }) => void; // 현재 진행 중이면 큐에 추가
  advanceLine: () => void;   // 유저 클릭 → 다음 줄 또는 종료
  closeDialogue: () => void;
  setBubbleAnchor: (anchor: { x: number; y: number } | null) => void;
}

export type DialogueSlice = DialogueSliceState & DialogueSliceActions;
