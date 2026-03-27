// J:/AI/Game/SRPG/src/store/appStore.ts
// 전략 레이어 최상위 상태 관리 (화면 전환 + 영토 + 외교 + 캐릭터)
// gameStore(전투 전용)와 완전 분리
// [통합] GlobalHero 제거 — Character가 단일 진실 공급원

import { create } from 'zustand';
import type {
  StrategyState, AppScreen, BattleOutcome, DiplomacyRel, FactionResource
} from '../types/appTypes';
import type { FactionId } from '../types/gameTypes';
import type { Character } from '../types/characterTypes';
import { generateProvinces } from '../utils/provinceGenerator';
import { PLAYER_FACTION, FACTIONS } from '../constants/gameConfig';
import { processDomesticTurn } from '../utils/domesticLogic';

const WIN_RATIO = 0.7;

function checkVictory(provinces: StrategyState['provinces']): 'good' | 'bad' | null {
  const all = Object.values(provinces);
  const playerOwned = all.filter(p => p.owner === PLAYER_FACTION).length;
  const playerCapital = all.find(p => p.isCapital && p.owner === PLAYER_FACTION);
  if (!playerCapital) return 'bad';
  if (playerOwned >= Math.ceil(all.length * WIN_RATIO)) return 'good';
  return null;
}

// ─ 초기 캐릭터 풀 ────────────────────────────────────────────────────────────
// 추후 외부 JSON으로 이관 예정. 현재는 인라인 정의.
const INITIAL_CHARACTERS: Record<string, Character> = {
  'hero_001': {
    id: 'hero_001',
    name: '아르토리우스',
    factionId: PLAYER_FACTION,
    state: 'Factioned',
    locationProvinceId: null, // startGame()에서 수도 ID로 설정됨
    birthYear: 1980, lifespan: 80, lifespanBonus: 0,
    loyalty: 100,
    relationships: { 'hero_002': 50 },
    baseStats: { hp: 100, strength: 80, intelligence: 40, politics: 50, charisma: 90, speed: 12 },
    traits: [], equipment: [],
    skills: ['slash'],
    troopType: 'INFANTRY',
    troopCount: 500,
  },
  'hero_002': {
    id: 'hero_002',
    name: '베네딕트',
    factionId: PLAYER_FACTION,
    state: 'Factioned',
    locationProvinceId: null,
    birthYear: 1985, lifespan: 60, lifespanBonus: 5,
    loyalty: 85,
    relationships: { 'hero_001': 50 },
    baseStats: { hp: 70, strength: 30, intelligence: 95, politics: 80, charisma: 70, speed: 8 },
    traits: [], equipment: [],
    skills: ['heal'],
    troopType: 'ARCHER',
    troopCount: 300,
  },
  // 재야 인재 풀 (FreeAgent — 인재 등용으로 획득 가능)
  'hero_003': {
    id: 'hero_003',
    name: '가브리엘 바르트',
    factionId: null,
    state: 'FreeAgent',
    locationProvinceId: null,
    birthYear: 1978, lifespan: 70, lifespanBonus: 0,
    loyalty: 0,
    relationships: {},
    baseStats: { hp: 90, strength: 70, intelligence: 60, politics: 40, charisma: 75, speed: 10 },
    traits: [], equipment: [],
    skills: ['cleave'],
    troopType: 'CAVALRY',
    troopCount: 0,
  },
  'hero_004': {
    id: 'hero_004',
    name: '이리나 솔렌',
    factionId: null,
    state: 'FreeAgent',
    locationProvinceId: null,
    birthYear: 1990, lifespan: 65, lifespanBonus: 0,
    loyalty: 0,
    relationships: {},
    baseStats: { hp: 65, strength: 25, intelligence: 100, politics: 75, charisma: 60, speed: 9 },
    traits: [], equipment: [],
    skills: ['heal'],
    troopType: null,
    troopCount: 0,
  },
  // 적 세력 영웅 (적 세력 소속)
  'hero_101': {
    id: 'hero_101',
    name: '적장 레드워드',
    factionId: 'faction_02',
    state: 'Factioned',
    locationProvinceId: null,
    birthYear: 1975, lifespan: 50, lifespanBonus: 0,
    loyalty: 100,
    relationships: {},
    baseStats: { hp: 120, strength: 85, intelligence: 20, politics: 30, charisma: 50, speed: 10 },
    traits: [], equipment: [],
    skills: ['cleave'],
    troopType: 'SPEARMAN',
    troopCount: 400,
  },
};

export const useAppStore = create<StrategyState>((set, get) => ({
  screen: 'TITLE',
  provinces: {},
  characters: INITIAL_CHARACTERS,
  factionResources: {},
  strategyTurn: 1,
  selectedProvinceId: null,
  pendingBattle: null,
  diplomacyRelations: {},
  lastBattleOutcome: null,
  endingType: null,
  worldSeed: 0,
  coastlineEdges: null,
  coastlinePolygons: null,

  // ─── 화면 이동 ──────────────────────────────────────────────────────────
  goTo: (screen: AppScreen) => set({ screen }),

  // ─── 게임 시작 ──────────────────────────────────────────────────────────
  startGame: () => {
    const seed = Date.now();
    const { provinces } = generateProvinces(1440, 820, seed);
    const diplomacyRelations: Record<string, DiplomacyRel> = {};
    const factionResources: Record<FactionId, FactionResource> = {};

    Object.keys(FACTIONS).forEach(fId => {
      if (fId !== PLAYER_FACTION) diplomacyRelations[fId] = 'war';
      factionResources[fId] = { gold: 1000, food: 2000, manpower: 500 };
    });

    // 플레이어 수도 찾아 소속 영웅들 배치
    const playerCapital = Object.values(provinces).find(p => p.owner === PLAYER_FACTION && p.isCapital);
    const updatedChars = { ...get().characters };

    if (playerCapital) {
      Object.values(updatedChars).forEach(char => {
        if (char.factionId === PLAYER_FACTION && char.state === 'Factioned') {
          updatedChars[char.id] = { ...char, locationProvinceId: playerCapital.id };
        }
      });
    }

    set({
      screen: 'STRATEGY_MAP',
      provinces,
      characters: updatedChars,
      factionResources,
      strategyTurn: 1,
      selectedProvinceId: null,
      pendingBattle: null,
      diplomacyRelations,
      lastBattleOutcome: null,
      endingType: null,
      worldSeed: seed,
    });
  },

  // ─── Province 선택 ──────────────────────────────────────────────────────
  selectProvince: (id) => set({ selectedProvinceId: id }),

  // ─── 내정 (식량/금 +) ────────────────────────────────────────────────────
  executeDomestic: (provinceId) => {
    const { provinces } = get();
    const p = provinces[provinceId];
    if (!p || p.owner !== PLAYER_FACTION) return;
    set({
      provinces: {
        ...provinces,
        [provinceId]: { ...p, food: p.food + 10, gold: p.gold + 8 },
      },
    });
  },

  // ─── 외교 ─────────────────────────────────────────────────────────────────
  executeDiplomacy: (targetFactionId) => {
    const { diplomacyRelations } = get();
    const current = diplomacyRelations[targetFactionId] ?? 'neutral';
    if (current !== 'neutral') return;
    set({ diplomacyRelations: { ...diplomacyRelations, [targetFactionId]: 'ally' } });
  },

  // ─── 전쟁 선언 → 전투 화면으로 ─────────────────────────────────────────
  declareWar: (attackerId, defenderId) => {
    const { provinces } = get();
    const attacker = provinces[attackerId];
    const defender = provinces[defenderId];
    if (!attacker || !defender) return;
    if (attacker.owner !== PLAYER_FACTION) return;

    const isAdjacent = attacker.adjacentIds.includes(defenderId);
    const isNavalAdjacent = attacker.isCoastal && defender.isCoastal &&
      (attacker.navalAdjacentIds || []).includes(defenderId);

    if (!isAdjacent && !isNavalAdjacent) {
      console.warn('DeclareWar Rejected: 인접하지 않거나 도항 불가 거리.', { attackerId, defenderId });
      return;
    }

    set({
      pendingBattle: { attackerProvinceId: attackerId, defenderProvinceId: defenderId },
      screen: 'BATTLE',
    });
  },

  // ─── 전투 결과 처리 ──────────────────────────────────────────────────────
  resolveBattle: (outcome: BattleOutcome) => {
    const { provinces, pendingBattle } = get();
    if (!pendingBattle) return;

    const { defenderProvinceId } = pendingBattle;
    let newProvinces = { ...provinces };

    if (outcome === 'player_win') {
      const defender = newProvinces[defenderProvinceId];
      if (defender) {
        newProvinces = { ...newProvinces, [defenderProvinceId]: { ...defender, owner: PLAYER_FACTION } };
      }
    }

    if (pendingBattle.isCheat || Object.keys(newProvinces).length === 0) {
      set({ pendingBattle: null, lastBattleOutcome: outcome, screen: 'BATTLE_RESULT', endingType: null });
      return;
    }

    const victory = checkVictory(newProvinces);
    set({
      provinces: newProvinces,
      pendingBattle: null,
      lastBattleOutcome: outcome,
      screen: victory ? 'ENDING' : 'BATTLE_RESULT',
      endingType: victory,
    });
  },

  // ─── 전략 턴 종료 ────────────────────────────────────────────────────────
  endStrategyTurn: () => {
    const { strategyTurn, provinces, diplomacyRelations, characters, factionResources } = get();
    let newProvinces = { ...provinces };
    let newFactionResources = { ...factionResources };
    const allFactions = Object.keys(FACTIONS);

    // 1. AI 세력 행동
    const enemyFactions = allFactions.filter(f => f !== PLAYER_FACTION);
    enemyFactions.forEach(fId => {
      if (Math.random() > 0.3) return;
      const myProvs = Object.values(newProvinces).filter(p => p.owner === fId);
      if (myProvs.length === 0) return;
      let target = null;
      for (const myP of myProvs) {
        const adjs = myP.adjacentIds.map(id => newProvinces[id]);
        target = adjs.find(p => p.owner !== fId && p.owner !== PLAYER_FACTION);
        if (target) break;
      }
      if (target) {
        newProvinces = { ...newProvinces, [target.id]: { ...target, owner: fId } };
      }
    });

    // 2. 모든 세력 내정 턴 결산 (Character 기반으로 패시브 계산)
    allFactions.forEach(fId => {
      if (!newFactionResources[fId]) return;
      const { newProvinces: domProvinces, newResources } = processDomesticTurn(
        fId, newProvinces, characters, newFactionResources[fId]
      );
      newProvinces = domProvinces;
      newFactionResources[fId] = newResources;
    });

    const victory = checkVictory(newProvinces);
    set({
      provinces: newProvinces,
      factionResources: newFactionResources,
      strategyTurn: strategyTurn + 1,
      screen: victory ? 'ENDING' : 'STRATEGY_MAP',
      endingType: victory,
      diplomacyRelations,
    });
  },

  // ─── 리셋 ────────────────────────────────────────────────────────────────
  resetGame: () => set({
    screen: 'TITLE',
    provinces: {},
    characters: INITIAL_CHARACTERS,
    factionResources: {},
    strategyTurn: 1,
    selectedProvinceId: null,
    pendingBattle: null,
    diplomacyRelations: {},
    lastBattleOutcome: null,
    endingType: null,
    worldSeed: 0,
  }),

  // ─── Character 관련 Actions ───────────────────────────────────────────────
  addCharacter: (char: Character) => set(s => ({
    characters: { ...s.characters, [char.id]: char },
  })),

  // 인재 등용: FreeAgent → Factioned, 세력 및 배속 영지 설정
  recruitCharacter: (charId, targetFactionId, locationProvinceId) => {
    const { characters } = get();
    const char = characters[charId];
    if (!char || char.state !== 'FreeAgent') return;
    set({
      characters: {
        ...characters,
        [charId]: {
          ...char,
          state: 'Factioned',
          factionId: targetFactionId,
          locationProvinceId,
          loyalty: 60, // 초기 충성도
        },
      },
    });
  },

  // 부대 편제 변경 (군단 편제 메뉴)
  updateCharacterTroop: (charId, troopType, troopCount) => {
    const { characters } = get();
    const char = characters[charId];
    if (!char) return;
    set({
      characters: {
        ...characters,
        [charId]: { ...char, troopType, troopCount },
      },
    });
  },

  // 영지 간 이동 (인사 메뉴)
  moveCharacter: (charId, provinceId) => {
    const { characters } = get();
    const char = characters[charId];
    if (!char) return;
    set({
      characters: {
        ...characters,
        [charId]: { ...char, locationProvinceId: provinceId },
      },
    });
  },
}));
