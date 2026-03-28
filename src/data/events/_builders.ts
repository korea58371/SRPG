// J:/AI/Game/SRPG/src/data/events/_builders.ts
// 조건 빌더 헬퍼 및 공통 조건 프리셋
// ────────────────────────────────────────────────────────────────────────────
// 이벤트 파일에서 import해서 사용:
//   import { and, or, leaf, IS_BATTLE_START, IS_RECRUIT_SUCCESS, ... } from '../_builders';

import type { ConditionNode, TriggerContext } from '../../types/dialogueTypes';

// ─── 기본 조건 노드 빌더 (타입 안전한 DSL) ───────────────────────────────────
type LeafFn = (ctx: TriggerContext) => boolean;

export const and = (...conditions: ConditionNode[]): ConditionNode => ({
  type: 'AND',
  conditions,
});

export const or = (...conditions: ConditionNode[]): ConditionNode => ({
  type: 'OR',
  conditions,
});

export const leaf = (check: LeafFn): ConditionNode => ({
  type: 'LEAF',
  check,
});

export const not = (condition: ConditionNode): ConditionNode => ({
  type: 'AND',
  conditions: [
    leaf((ctx) => !evaluateCondition(condition, ctx)),
  ],
});

// 조건 평가 (런타임 — 이벤트 트리거 체크 시 사용)
export function evaluateCondition(node: ConditionNode, ctx: TriggerContext): boolean {
  if (node.type === 'LEAF') return node.check(ctx);
  if (node.type === 'AND') return node.conditions.every(c => evaluateCondition(c, ctx));
  if (node.type === 'OR')  return node.conditions.some(c => evaluateCondition(c, ctx));
  return false;
}

// ─── 공통 조건 프리셋 ────────────────────────────────────────────────────────
// 자주 쓰는 조건은 여기 추가해두면 이벤트 파일에서 재사용 가능

/** 전투 시작 시 */
export const IS_BATTLE_START: ConditionNode =
  leaf((ctx) => ctx.battleEvent === 'BATTLE_START');

/** 턴 시작 시 */
export const IS_TURN_START: ConditionNode =
  leaf((ctx) => ctx.battleEvent === 'TURN_START');

/** 등용 성공 시 */
export const IS_RECRUIT_SUCCESS: ConditionNode =
  leaf((ctx) => ctx.recruitSuccess === true);

/** 특정 이벤트 미발동 여부 */
export const NOT_YET_PLAYED = (id: string): ConditionNode =>
  leaf((ctx) => !ctx.playedEventIds.has(id));

/** 특정 캐릭터인지 확인 */
export const IS_CHARACTER = (id: string): ConditionNode =>
  leaf((ctx) => ctx.characterId === id);

/** 주인공과의 관계도 n 이상 */
export const RELATION_GTE = (n: number): ConditionNode =>
  leaf((ctx) => ctx.relationshipWithProtagonist >= n);

/** HP가 n% 미만 */
export const HP_BELOW = (pct: number): ConditionNode =>
  leaf((ctx) => (ctx.unitHpPercent ?? 100) < pct);

/** 친밀도 n 이상 */
export const AFFINITY_GTE = (n: number): ConditionNode =>
  leaf((ctx) => (ctx.affinityLevel ?? 0) >= n);

/** 전략 맵 턴 수 n 이상 */
export const STRATEGY_TURN_GTE = (n: number): ConditionNode =>
  leaf((ctx) => (ctx.strategyTurn ?? 0) >= n);
