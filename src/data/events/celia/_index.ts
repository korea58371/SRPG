// J:/AI/Game/SRPG/src/data/events/celia/_index.ts
// 셀리아의 모든 이벤트를 한 곳에서 모아 export
// ────────────────────────────────────────────────────────────────────────────
// 새 셀리아 이벤트 추가 방법:
//   1. 이 폴더에 새 파일 생성 (ex: celia/story_act1.ts)
//   2. 아래에 import 한 줄 + CELIA_EVENTS 배열에 추가

import type { DialogueEvent } from '../../../types/dialogueTypes';
import { CELIA_RECRUITMENT }          from './recruitment';
import { CELIA_BATTLE_DEPLOY_FIRST,
         CELIA_BATTLE_DEPLOY_REPEAT,
         CELIA_LOW_HP,
         CELIA_LOW_HP_DEEP_BOND }     from './battle';
import { CELIA_AFFINITY_50 }          from './affinity';
// ↓ 새 이벤트 추가 시 여기에 import

export const CELIA_EVENTS: DialogueEvent[] = [
  CELIA_RECRUITMENT,
  CELIA_BATTLE_DEPLOY_FIRST,
  CELIA_BATTLE_DEPLOY_REPEAT,
  CELIA_LOW_HP,
  CELIA_LOW_HP_DEEP_BOND,
  CELIA_AFFINITY_50,
  // ↓ 새 이벤트 추가 시 여기에 한 줄
];
