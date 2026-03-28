// J:/AI/Game/SRPG/src/data/events/celia/recruitment.ts
// 셀리아 — 등용 이벤트

import type { DialogueEvent } from '../../../types/dialogueTypes';
import {
  and,
  IS_RECRUIT_SUCCESS,
  IS_CHARACTER,
  NOT_YET_PLAYED,
} from '../_builders';

export const CELIA_RECRUITMENT: DialogueEvent = {
  id: 'celia_recruitment_success',
  title: '셀리아 등용',
  context: 'RECRUITMENT',
  once: true,
  trigger: {
    context: 'RECRUITMENT',
    condition: and(
      IS_CHARACTER('celia'),
      IS_RECRUIT_SUCCESS,
      NOT_YET_PLAYED('celia_recruitment_success'),
    ),
  },
  lines: [
    {
      speakerId: 'NARRATOR',
      text: '인적 드문 고대 숲의 버려진 탑. 산더미처럼 쌓인 책장 사이에서 조그만 체구의 엘프 소녀가 책을 덮고 돌아본다.',
      emotion: 'normal',
    },
    {
      speakerId: 'celia',
      text: '...소란스럽군. 아까부터 쿵쾅거리는 발소리. 내 천 년의 정적이 너희들의 무식한 쇳덩이 부딪히는 소리에 산산조각 났어.',
      emotion: 'serious',
    },
    {
      speakerId: 'NARRATOR',
      text: '주인공이 정중하게 사과하며, 전란의 상황을 설명하고 힘을 빌려달라 요청한다.',
      emotion: 'normal',
    },
    {
      speakerId: 'celia',
      text: '전쟁? 짧은 수명을 가진 종족들의 영토 놀음엔 관심 없어. 돌아가. 당장 이 탑에서...',
      emotion: 'serious',
    },
    {
      speakerId: 'NARRATOR',
      text: '셀리아가 주인공을 쫓아내려다 멈칫하며 눈을 가늘게 뜬다.',
      emotion: 'normal',
    },
    {
      speakerId: 'celia',
      text: '...잠깐. 너, 방금 그 마력 파동... 흥미롭네. 고대 문헌에서나 보던 특이한 파장이 얽혀 있어.',
      emotion: 'surprised',
    },
    {
      speakerId: 'protagonist',
      speakerName: '주인공',
      text: '...나 말인가?',
      emotion: 'normal',
    },
    {
      speakerId: 'celia',
      text: '그래. 너라는 존재 자체가 꽤 훌륭한 연구 대상이 될 것 같아. ...좋아. 따라가 주지.',
      emotion: 'normal',
    },
    {
      speakerId: 'NARRATOR',
      text: '셀리아가 허공에 손짓해 마도서를 띄우며 담담하게 말한다.',
      emotion: 'normal',
    },
    {
      speakerId: 'celia',
      text: '대신 조건이 있어. 내 연구를 방해하지 말 것. 그리고... 식후에는 반드시 홍차와 달콤한 다과를 준비할 것. 뇌를 쓰려면 당분이 필요하니까. 계약, 성립인가?',
      emotion: 'serious',
    },
  ],
};
