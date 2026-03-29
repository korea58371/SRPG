// J:/AI/Game/SRPG/src/store/slices/dialogueSlice.ts
// 활성 이벤트 대화 상태 관리 Zustand 슬라이스
// [확장] 대화 큐(Queue) 추가 - 연속/반응 이벤트 순서 보장

import type { StoreSlice } from './storeTypes';
import type { DialogueSlice, DialogueQueueItem } from '../../types/dialogueTypes';
import type { DialogueEvent } from '../../types/dialogueTypes';

export const createDialogueSlice: StoreSlice<DialogueSlice> = (set, get) => ({
  // ─── 초기 상태 ────────────────────────────────────────────────────────────
  activeDialogue: null,
  currentLineIndex: 0,
  playedEventIds: new Set<string>(),
  bubbleAnchor: null,
  dialogueQueue: [],

  // ─── 이벤트 즉시 발동 (현재 대화 없을 때만 바로 재생, 있으면 큐 추가) ──
  triggerDialogue: (event: DialogueEvent, anchor?: { x: number; y: number }) => {
    const state = get();
    // 이미 동일 이벤트가 재생 중이면 무시
    if (state.activeDialogue?.id === event.id) return;
    // 대화가 진행 중이면 큐에 추가
    if (state.activeDialogue !== null) {
      get().enqueueDialogue(event, anchor);
      return;
    }
    set({
      activeDialogue: event,
      currentLineIndex: 0,
      bubbleAnchor: anchor ?? null,
    });
  },

  // ─── 큐에 추가 (현재 진행 중 여부 무관하게 큐에 추가) ────────────────────
  enqueueDialogue: (event: DialogueEvent, anchor?: { x: number; y: number }) => {
    set((state) => {
      // 동일 이벤트 중복 큐 방지
      if (state.dialogueQueue.some(q => q.event.id === event.id)) return state;
      if (state.activeDialogue?.id === event.id) return state;
      const item: DialogueQueueItem = { event, anchor };
      return { dialogueQueue: [...state.dialogueQueue, item] };
    });
  },

  // ─── 다음 줄로 이동 (유저 클릭) ───────────────────────────────────────────
  advanceLine: () => {
    set((state) => {
      if (!state.activeDialogue) return state;

      const nextIndex = state.currentLineIndex + 1;
      const isFinished = nextIndex >= state.activeDialogue.lines.length;

      if (isFinished) {
        // 1회성 이벤트: playedEventIds에 등록
        const newPlayedIds = new Set(state.playedEventIds);
        if (state.activeDialogue.once) {
          newPlayedIds.add(state.activeDialogue.id);
        }

        // onComplete 콜백 호출 (동기)
        state.activeDialogue.onComplete?.();

        // ─── 큐에 다음 이벤트가 있으면 즉시 실행 ──────────────────────────
        if (state.dialogueQueue.length > 0) {
          const [next, ...rest] = state.dialogueQueue;
          return {
            activeDialogue: next.event,
            currentLineIndex: 0,
            bubbleAnchor: next.anchor ?? null,
            playedEventIds: newPlayedIds,
            dialogueQueue: rest,
          };
        }

        return {
          activeDialogue: null,
          currentLineIndex: 0,
          playedEventIds: newPlayedIds,
          bubbleAnchor: null,
          dialogueQueue: [],
        };
      }

      return { currentLineIndex: nextIndex };
    });
  },

  // ─── 강제 종료 (ESC, 스킵 등) — 큐도 비움 ────────────────────────────────
  closeDialogue: () => {
    set((state) => {
      if (!state.activeDialogue) return state;

      const newPlayedIds = new Set(state.playedEventIds);
      if (state.activeDialogue.once) {
        newPlayedIds.add(state.activeDialogue.id);
      }

      return {
        activeDialogue: null,
        currentLineIndex: 0,
        playedEventIds: newPlayedIds,
        bubbleAnchor: null,
        dialogueQueue: [], // 강제 종료 시 큐 전체 비움
      };
    });
  },

  // ─── 말풍선 앵커 위치 갱신 (유닛 이동에 따라 매 프레임 업데이트 가능) ────
  setBubbleAnchor: (anchor) => set({ bubbleAnchor: anchor }),
});
