// J:/AI/Game/SRPG/src/data/dialogueEvents.ts
// 이벤트 대화 스크립트 데이터
// 새 캐릭터/이벤트 추가 시 코드 변경 없이 여기만 수정

import type { DialogueEvent, ConditionNode, TriggerContext } from '../types/dialogueTypes';

// ─── 조건 빌더 헬퍼 (가독성 향상) ───────────────────────────────────────────
type LeafFn = (ctx: TriggerContext) => boolean;

const and = (...conditions: ConditionNode[]): ConditionNode => ({
  type: 'AND',
  conditions,
});
const or = (...conditions: ConditionNode[]): ConditionNode => ({
  type: 'OR',
  conditions,
});
const leaf = (check: LeafFn): ConditionNode => ({
  type: 'LEAF',
  check,
});

// ─── 공통 조건 프리셋 ─────────────────────────────────────────────────────────
const IS_BATTLE_START:    ConditionNode = leaf((ctx) => ctx.battleEvent === 'BATTLE_START');
const IS_TURN_START:      ConditionNode = leaf((ctx) => ctx.battleEvent === 'TURN_START');
const IS_RECRUIT_SUCCESS: ConditionNode = leaf((ctx) => ctx.recruitSuccess === true);

const NOT_YET_PLAYED = (id: string): ConditionNode =>
  leaf((ctx) => !ctx.playedEventIds.has(id));
const RELATION_GTE = (n: number): ConditionNode =>
  leaf((ctx) => ctx.relationshipWithProtagonist >= n);
const HP_BELOW = (pct: number): ConditionNode =>
  leaf((ctx) => (ctx.unitHpPercent ?? 100) < pct);
const IS_CHARACTER = (id: string): ConditionNode =>
  leaf((ctx) => ctx.characterId === id);
const AFFINITY_GTE = (n: number): ConditionNode =>
  leaf((ctx) => (ctx.affinityLevel ?? 0) >= n);

// or은 현재 직접 쓰이지 않지만 향후 사용 예정 (빌더 API 일관성 유지)
void or;

// ─────────────────────────────────────────────────────────────────────────────
// 셀리아 (고대 엘프 메이지) 이벤트 스크립트
// characterId: 'celia' (실제 Character 데이터와 매핑 필요)
// ─────────────────────────────────────────────────────────────────────────────

export const CELIA_EVENTS: DialogueEvent[] = [
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. 등용 이벤트
  // 조건: 등용 성공 AND 셀리아 AND 아직 미발동
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
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
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. 출진 대사 (전투 시작 시 — 첫 번째 전투만)
  // 조건: 셀리아 첫 출진 AND 전투 개시
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
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
        RELATION_GTE(0), // 관계 0 이상 (적대 아님)
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
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. 반복 출진 대사 (랜덤 선택 풀 — once: false)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
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
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. HP 위기 대사
  // 조건: 셀리아 AND HP < 30% AND 턴 시작
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
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
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. 인연 이벤트 — 친밀도 50 도달 시
  // 조건: 셀리아 AND 친밀도 >= 50 AND 미발동
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
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
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6. 셀리아 — 관계 높을 때 HP 위기 (주인공과 관계 70 이상일 때 다른 대사)
  // 조건: (셀리아 AND HP < 30% AND 턴 시작) AND 관계 >= 70
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
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
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// char_001 (기본 주인공 지휘관) 전투 이벤트 — 치트 전투 즉시 확인 가능
// characterId: 'char_001' — gameStateSlice initUnits (cheat 모드)에서 unit-p-0에 할당
// ─────────────────────────────────────────────────────────────────────────────
export const CHAR_001_EVENTS: DialogueEvent[] = [
  // ── 전투 시작 (BATTLE_START) ──────────────────────────────────────────────
  {
    id: 'char001_battle_start_first',
    title: 'char_001 첫 출진',
    context: 'BATTLE',
    once: true,
    priority: 10,
    battlePhase: 'TURN_START',
    trigger: {
      context: 'BATTLE',
      condition: and(
        IS_CHARACTER('char_001'),
        IS_BATTLE_START,
        NOT_YET_PLAYED('char001_battle_start_first'),
      ),
    },
    lines: [
      {
        speakerId: 'char_001',
        speakerName: '지휘관',
        text: '전군, 전진하라. 오늘의 전장은 우리 것이다!',
        emotion: 'serious',
      },
      {
        speakerId: 'char_001',
        speakerName: '지휘관',
        text: '물러서는 자는 없다. 승리만이 우리의 길이다.',
        emotion: 'serious',
      },
    ],
  },

  // ── 턴 시작 반복 대사 (TURN_START) ───────────────────────────────────────
  {
    id: 'char001_turn_start_repeat',
    title: 'char_001 턴 시작 (반복)',
    context: 'BATTLE',
    once: false,
    priority: 0,
    battlePhase: 'TURN_START',
    trigger: {
      context: 'BATTLE',
      condition: and(
        IS_CHARACTER('char_001'),
        IS_TURN_START,
      ),
    },
    lines: [
      {
        speakerId: 'char_001',
        speakerName: '지휘관',
        text: '내 차례다. 움직인다.',
        emotion: 'normal',
      },
    ],
  },

  // ── HP 위기 (HP < 30%) ─────────────────────────────────────────────────
  {
    id: 'char001_low_hp',
    title: 'char_001 HP 위기',
    context: 'BATTLE',
    once: false,
    priority: 5,
    battlePhase: 'TURN_START',
    trigger: {
      context: 'BATTLE',
      condition: and(
        IS_CHARACTER('char_001'),
        IS_TURN_START,
        HP_BELOW(30),
      ),
    },
    lines: [
      {
        speakerId: 'char_001',
        speakerName: '지휘관',
        text: '큭... 아직이다. 여기서 쓰러질 수는 없어!',
        emotion: 'serious',
      },
    ],
  },

  // ── 적 처치 (ON_KILL) ──────────────────────────────────────────────────
  {
    id: 'char001_on_kill',
    title: 'char_001 처치 대사',
    context: 'BATTLE',
    once: false,
    priority: 8,
    battlePhase: 'ON_KILL',
    trigger: {
      context: 'BATTLE',
      condition: and(
        IS_CHARACTER('char_001'),
        leaf((ctx) => ctx.battleEvent === 'ON_KILL'),
      ),
    },
    lines: [
      {
        speakerId: 'char_001',
        speakerName: '지휘관',
        text: '하나 처리했다. 계속 전진!',
        emotion: 'serious',
      },
    ],
  },
];

// ─── 전체 이벤트 풀 (캐릭터별 배열을 평탄화) ──────────────────────────────
export const ALL_DIALOGUE_EVENTS: DialogueEvent[] = [
  ...CELIA_EVENTS,
  ...CHAR_001_EVENTS,   // char_001 전투 이벤트
  // 추후 다른 캐릭터 이벤트 배열을 여기에 spread
];
