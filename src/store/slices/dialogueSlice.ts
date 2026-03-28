// J:/AI/Game/SRPG/src/store/slices/dialogueSlice.ts
// 활성 이벤트 대화 상태 관리 Zustand 슬라이스

import type { StoreSlice } from './storeTypes';
import type { DialogueSlice } from '../../types/dialogueTypes';
import type { DialogueEvent } from '../../types/dialogueTypes';

export const createDialogueSlice: StoreSlice<DialogueSlice> = (set) => ({
  // ─── 초기 상태 ────────────────────────────────────────────────────────────
  activeDialogue: null,
  currentLineIndex: 0,
  playedEventIds: new Set<string>(),
  bubbleAnchor: null,

  // ─── 이벤트 발동 ─────────────────────────────────────────────────────────
  triggerDialogue: (event: DialogueEvent, anchor?: { x: number; y: number }) => {
    set((state) => {
      // 이미 동일 이벤트가 재생 중이면 무시
      if (state.activeDialogue?.id === event.id) return state;

      return {
        activeDialogue: event,
        currentLineIndex: 0,
        bubbleAnchor: anchor ?? null,
      };
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
        return {
          activeDialogue: null,
          currentLineIndex: 0,
          playedEventIds: newPlayedIds,
          bubbleAnchor: null,
        };
      }

      return { currentLineIndex: nextIndex };
    });
  },

  // ─── 강제 종료 (ESC, 스킵 등) ────────────────────────────────────────────
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
      };
    });
  },

  // ─── 말풍선 앵커 위치 갱신 (유닛 이동에 따라 매 프레임 업데이트 가능) ────
  setBubbleAnchor: (anchor) => set({ bubbleAnchor: anchor }),
});
