// J:/AI/Game/SRPG/src/data/characters/_registry.ts
// 중앙 캐릭터 레지스트리
// ────────────────────────────────────────────────────────────────────────────
// 새 캐릭터 추가 방법:
//   1. src/data/characters/캐릭터명.ts 파일 생성
//   2. 아래 import 한 줄 추가
//   3. ALL_CHARACTERS 객체에 [캐릭터.id]: 캐릭터 한 줄 추가
// 다른 파일은 건드리지 않아도 됩니다.

import type { Character } from '../../types/characterTypes';

import { ARTORIOUS } from './hero_001';
import { BENEDICT }  from './hero_002';
import { GABRIEL }   from './hero_003';
import { IRINA }     from './hero_004';
import { REDWARD }   from './hero_101';
import { CELIA }     from './celia';
// ↓ 새 캐릭터 추가 시 여기에 import 한 줄

export const ALL_CHARACTERS: Record<string, Character> = {
  [ARTORIOUS.id]: ARTORIOUS,
  [BENEDICT.id]:  BENEDICT,
  [GABRIEL.id]:   GABRIEL,
  [IRINA.id]:     IRINA,
  [REDWARD.id]:   REDWARD,
  [CELIA.id]:     CELIA,
  // ↓ 새 캐릭터 추가 시 여기에 한 줄
};
