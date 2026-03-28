// J:/AI/Game/SRPG/src/engine/dialogueEngine.ts
// 이벤트 대화 트리거 평가 엔진 (순수 함수 모음)
// AND/OR 복합 조건 트리를 재귀 평가하여 발동 여부를 결정

import type {
  ConditionNode,
  DialogueEvent,
  TriggerContext,
} from '../types/dialogueTypes';

// ─── 핵심: ConditionNode 재귀 평가 ───────────────────────────────────────────
export function evaluateCondition(
  node: ConditionNode,
  ctx: TriggerContext,
): boolean {
  switch (node.type) {
    case 'LEAF':
      return node.check(ctx);

    case 'AND':
      return node.conditions.every((child) => evaluateCondition(child, ctx));

    case 'OR':
      return node.conditions.some((child) => evaluateCondition(child, ctx));
  }
}

// ─── 단일 이벤트 트리거 여부 판별 ────────────────────────────────────────────
export function isEventTriggered(
  event: DialogueEvent,
  ctx: TriggerContext,
): boolean {
  // 컨텍스트 불일치 → 즉시 false
  if (event.trigger.context !== ctx.dialogueContext) return false;

  // 1회성 이벤트이고 이미 재생됐으면 false
  if (event.once && ctx.playedEventIds.has(event.id)) return false;

  return evaluateCondition(event.trigger.condition, ctx);
}

// ─── 전체 이벤트 풀에서 현재 컨텍스트에 맞는 이벤트 목록 반환 ──────────────
// 우선순위: once=true가 once=false보다 먼저 (1회성 이벤트가 더 중요)
export function getTriggeredEvents(
  events: DialogueEvent[],
  ctx: TriggerContext,
): DialogueEvent[] {
  const triggered = events.filter((ev) => isEventTriggered(ev, ctx));

  // once=true 이벤트 우선 정렬
  return triggered.sort((a, b) => {
    if (a.once && !b.once) return -1;
    if (!a.once && b.once) return 1;
    return 0;
  });
}

// ─── 최우선 이벤트 하나만 선택 (중복 발동 방지) ──────────────────────────────
export function pickDialogueEvent(
  events: DialogueEvent[],
  ctx: TriggerContext,
): DialogueEvent | null {
  const triggered = getTriggeredEvents(events, ctx);
  return triggered.length > 0 ? triggered[0] : null;
}

// ─── TriggerContext 빌더 헬퍼 ─────────────────────────────────────────────────
// 호출 측에서 필요한 필드만 오버라이드해서 사용
export function buildTriggerContext(
  overrides: Partial<TriggerContext> & {
    characterId: string;
    protagonistId: string;
    dialogueContext: TriggerContext['dialogueContext'];
    playedEventIds: Set<string>;
  },
): TriggerContext {
  return {
    relationshipWithProtagonist: 0,
    ...overrides,
  };
}
