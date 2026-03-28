// J:/AI/Game/SRPG/src/data/events/celia/affinity.ts
// 셀리아 — 친밀도 이벤트

import type { DialogueEvent } from '../../../types/dialogueTypes';
import {
  and,
  IS_CHARACTER,
  NOT_YET_PLAYED,
  AFFINITY_GTE,
} from '../_builders';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 친밀도 50 달성 — 홍차 이벤트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const CELIA_AFFINITY_50: DialogueEvent = {
  id: 'celia_affinity_50',
  title: '셀리아 인연 이벤트 — 홍차',
  context: 'AFFINITY',
  once: true,
  trigger: {
    context: 'AFFINITY',
    condition: and(
      IS_CHARACTER('celia'),
      AFFINITY_GTE(50),
      NOT_YET_PLAYED('celia_affinity_50'),
    ),
  },
  lines: [
    {
      speakerId: 'NARRATOR',
      text: '야영지. 늦은 밤, 모두가 잠든 시간에도 홀로 화톳불 앞에서 고대 문헌을 읽고 있는 셀리아. 주인공이 따뜻한 차를 들고 다가간다.',
      emotion: 'normal',
    },
    {
      speakerId: 'celia',
      text: '이 시간까지 깨어 있다니. 내일 전투에서 지휘관이 졸기라도 하면 곤란한데.',
      emotion: 'normal',
    },
    {
      speakerId: 'NARRATOR',
      text: '주인공이 따뜻한 홍차와 쿠키를 건넨다.',
      emotion: 'normal',
    },
    {
      speakerId: 'celia',
      text: '...홍차? 달콤한 냄새. 굳이 이런 걸 챙겨주다니, 넌 정말 쓸데없이 참견이 많네.',
      emotion: 'surprised',
    },
    {
      speakerId: 'NARRATOR',
      text: '셀리아가 마지못해 찻잔을 받아 들고 한 모금 마신다. 미세하게 표정이 부드러워진다.',
      emotion: 'normal',
    },
    {
      speakerId: 'celia',
      text: '...온도도, 향도, 나쁘지 않아. 아니... 꽤 훌륭해. 머리가 맑아지는 기분이야.',
      emotion: 'happy',
    },
    {
      speakerId: 'protagonist',
      speakerName: '주인공',
      text: '(웃으며 다행이라고 말한다.)',
      emotion: 'happy',
    },
    {
      speakerId: 'celia',
      text: '흥, 착각하지 마. 차가 맛있다는 거지, 네가 좋다는 건 아니니까. ...그래도, 뭐.',
      emotion: 'embarrassed',
    },
    {
      speakerId: 'NARRATOR',
      text: '셀리아가 찻잔을 무릎에 올린 채 주인공의 옆자리를 툭툭 친다.',
      emotion: 'normal',
    },
    {
      speakerId: 'celia',
      text: '이왕 왔으니 앉던가. 혼자 차를 마시는 건, 천 년 동안 질리도록 해왔어. ...네 숨소리 정도는, 백색소음 삼아 허락해 줄 테니까.',
      emotion: 'embarrassed',
    },
  ],
};
