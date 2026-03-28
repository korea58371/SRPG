// J:/AI/Game/SRPG/src/data/events/_registry.ts
// 전체 이벤트 중앙 레지스트리
// ────────────────────────────────────────────────────────────────────────────
// 새 캐릭터 이벤트 추가 방법:
//   1. src/data/events/캐릭터명/ 폴더 생성
//   2. 이벤트 파일(들) + _index.ts 작성
//   3. 아래 import 한 줄 + ALL_DIALOGUE_EVENTS spread 한 줄 추가
// 다른 파일은 건드리지 않아도 됩니다.

import type { DialogueEvent } from '../../types/dialogueTypes';
import { CELIA_EVENTS } from './celia/_index';
// ↓ 새 캐릭터 이벤트 추가 시 여기에 import

export const ALL_DIALOGUE_EVENTS: DialogueEvent[] = [
  ...CELIA_EVENTS,
  // ↓ 새 캐릭터 이벤트 추가 시 여기에 spread
];
