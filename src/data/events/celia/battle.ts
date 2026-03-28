// J:/AI/Game/SRPG/src/data/events/celia/battle.ts
// 셀리아 — 전투 관련 이벤트 (출진, HP 위기)

import type { DialogueEvent } from '../../../types/dialogueTypes';
import {
  and,
  IS_BATTLE_START,
  IS_TURN_START,
  IS_CHARACTER,
  NOT_YET_PLAYED,
  RELATION_GTE,
  HP_BELOW,
} from '../_builders';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 첫 출진 대사 (첫 번째 전투만)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const CELIA_BATTLE_DEPLOY_FIRST: DialogueEvent = {
  id: 'celia_battle_deploy_first',
  title: '셀리아 첫 출진',
  context: 'BATTLE',
  once: true,
  trigger: {
    context: 'BATTLE',
    condition: and(
      IS_CHARACTER('celia'),
      IS_BATTLE_START,
      NOT_YET_PLAYED('celia_battle_deploy_first'),
      RELATION_GTE(0),
    ),
  },
  lines: [
    {
      speakerId: 'celia',
      text: '풍향, 습도, 마나의 흐름... 지형 스캔 완료. 적의 전력도 계산 범위 안이야.',
      emotion: 'normal',
    },
    {
      speakerId: 'celia',
      text: '새로운 고대 마법의 임상 실험을 시작할게. 다치기 싫으면, 내 사거리 안에서 벗어나는 게 좋을 거야.',
      emotion: 'serious',
    },
  ],
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 반복 출진 대사 (매 전투 랜덤 — once: false)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const CELIA_BATTLE_DEPLOY_REPEAT: DialogueEvent = {
  id: 'celia_battle_deploy_repeat',
  title: '셀리아 출진 (반복)',
  context: 'BATTLE',
  once: false,
  trigger: {
    context: 'BATTLE',
    condition: and(
      IS_CHARACTER('celia'),
      IS_BATTLE_START,
    ),
  },
  lines: [
    {
      speakerId: 'celia',
      text: '...또 전장이군. 이번 귀환길엔 홍차 한 잔 부탁해.',
      emotion: 'normal',
    },
  ],
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HP 위기 대사 (일반)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const CELIA_LOW_HP: DialogueEvent = {
  id: 'celia_low_hp',
  title: '셀리아 위기',
  context: 'BATTLE',
  once: false,
  trigger: {
    context: 'BATTLE',
    condition: and(
      IS_CHARACTER('celia'),
      IS_TURN_START,
      HP_BELOW(30),
    ),
  },
  lines: [
    {
      speakerId: 'celia',
      text: '...흥. 이 정도로 쓰러질 것 같으면, 천 년을 견뎌오지 못했겠지.',
      emotion: 'serious',
    },
  ],
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HP 위기 대사 (깊은 인연 — 관계 70 이상)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const CELIA_LOW_HP_DEEP_BOND: DialogueEvent = {
  id: 'celia_low_hp_deep_bond',
  title: '셀리아 위기 (깊은 인연)',
  context: 'BATTLE',
  once: false,
  trigger: {
    context: 'BATTLE',
    condition: and(
      IS_CHARACTER('celia'),
      IS_TURN_START,
      HP_BELOW(30),
      RELATION_GTE(70),
    ),
  },
  lines: [
    {
      speakerId: 'celia',
      text: '...이건... 예상 밖이야. 조금만 기다려. 회복 마법 준비 중이니까.',
      emotion: 'serious',
    },
    {
      speakerId: 'celia',
      text: '...어서 오지 않으려면, 네가 직접 막아줘도 괜찮아. 딱 이번만이야.',
      emotion: 'embarrassed',
    },
  ],
};
