// J:/AI/Game/SRPG/src/store/appStore.ts
// 전략 레이어 최상위 상태 관리 (화면 전환 + 영토 + 외교)
// gameStore(전투 전용)와 완전 분리

import { create } from 'zustand';
import type {
  StrategyState, AppScreen, BattleOutcome, DiplomacyRel, FactionResource, GlobalHero
} from '../types/appTypes';
import type { FactionId } from '../types/gameTypes';
import { generateProvinces } from '../utils/provinceGenerator';
import { PLAYER_FACTION, FACTIONS } from '../constants/gameConfig';
import { processDomesticTurn } from '../utils/domesticLogic';

const WIN_RATIO = 0.7; // 70% 점령 시 굿엔딩

function checkVictory(provinces: StrategyState['provinces']): 'good' | 'bad' | null {
  const all = Object.values(provinces);
  const playerOwned = all.filter(p => p.owner === PLAYER_FACTION).length;
  const playerCapital = all.find(p => p.isCapital && p.owner === PLAYER_FACTION);

  // 1. 플레이어 본거지 함락 시 즉시 배드엔딩
  if (!playerCapital) return 'bad';

  // 2. 다른 모든 세력이 멸망했거나(플레이어가 100% 점령) 목표치 달성 시 굿엔딩
  if (playerOwned >= Math.ceil(all.length * WIN_RATIO)) return 'good';
  
  return null;
}

export const useAppStore = create<StrategyState>((set, get) => ({
  screen: 'TITLE',
  provinces: {},
  globalHeroes: {},
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
    
    // 모든 타 세력과의 기본 관계를 'war' 로 설정 (군웅할거 시대) 및 기본 자원 할당
    Object.keys(FACTIONS).forEach(fId => {
      if (fId !== PLAYER_FACTION) diplomacyRelations[fId] = 'war';
      factionResources[fId] = { gold: 1000, food: 2000, manpower: 500 };
    });

    const globalHeroes: Record<string, GlobalHero> = {};
    const playerCapital = Object.values(provinces).find(p => p.owner === PLAYER_FACTION && p.isCapital);
    
    // 테스트용 초기 영웅 추가
    if (playerCapital) {
      globalHeroes['hero-orc'] = {
        id: 'hero-orc',
        name: '오크 대족장',
        factionId: PLAYER_FACTION,
        locationProvinceId: playerCapital.id,
        raceEffects: { recruitmentBonus: 30, foodConsumptionMultiplier: 1.5, securityBonus: -10, productionBonus: 0 },
        classEffects: { recruitmentBonus: 10, foodConsumptionMultiplier: 1.0, securityBonus: -5, productionBonus: -5 }
      };
      globalHeroes['hero-elf'] = {
        id: 'hero-elf',
        name: '엘프 대마법사',
        factionId: PLAYER_FACTION,
        locationProvinceId: playerCapital.id,
        raceEffects: { recruitmentBonus: -10, foodConsumptionMultiplier: 0.8, securityBonus: 20, productionBonus: 15 },
        classEffects: { recruitmentBonus: 0, foodConsumptionMultiplier: 1.0, securityBonus: 5, productionBonus: 20 }
      };
    }

    set({
      screen: 'STRATEGY_MAP',
      provinces,
      globalHeroes,
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
        [provinceId]: {
          ...p,
          food: p.food + 10,
          gold: p.gold + 8,
        },
      },
    });
  },

  // ─── 외교 (중립 → 동맹 시도) ─────────────────────────────────────────────
  executeDiplomacy: (targetFactionId) => {
    const { diplomacyRelations } = get();
    const current = diplomacyRelations[targetFactionId] ?? 'neutral';
    if (current !== 'neutral') return; // 전쟁 or 이미 동맹이면 불가
    set({
      diplomacyRelations: { ...diplomacyRelations, [targetFactionId]: 'ally' },
    });
  },

  // ─── 전쟁 선언 → 전투 화면으로 ─────────────────────────────────────────
  declareWar: (attackerId, defenderId) => {
    const { provinces } = get();
    const attacker = provinces[attackerId];
    const defender = provinces[defenderId];
    if (!attacker || !defender) return;
    if (attacker.owner !== PLAYER_FACTION) return;
    // 인접 Province만 공격 가능
    if (!attacker.adjacentIds.includes(defenderId)) return;

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
        newProvinces = {
          ...newProvinces,
          [defenderProvinceId]: { ...defender, owner: PLAYER_FACTION },
        };
      }
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
    const { strategyTurn } = get();
    // 적 AI: 군웅할거 난전 시뮬레이션
    const { provinces, diplomacyRelations, globalHeroes, factionResources } = get();
    let newProvinces = { ...provinces };
    let newFactionResources = { ...factionResources };
    const allFactions = Object.keys(FACTIONS);

    // 1. AI 세력들의 행동 (영토 확장 등)
    const enemyFactions = allFactions.filter(f => f !== PLAYER_FACTION);
    enemyFactions.forEach(fId => {
      if (Math.random() > 0.3) return;

      const myProvs = Object.values(newProvinces).filter(p => p.owner === fId);
      if (myProvs.length === 0) return; // 멸망한 세력

      let target = null;
      for (const myP of myProvs) {
        const adjs = myP.adjacentIds.map(id => newProvinces[id]);
        target = adjs.find(p => p.owner !== fId && p.owner !== PLAYER_FACTION);
        if (target) break;
      }
      
      if (target) {
        newProvinces = {
          ...newProvinces,
          [target.id]: { ...target, owner: fId },
        };
      }
    });

    // 2. 모든 세력의 내정 턴 결산 (생산 산출량 합산 및 치안 변동)
    allFactions.forEach(fId => {
      // 해당 팩션의 자원이 아직 초기화되지 않았다면 패스 (혹은 기본값)
      if (!newFactionResources[fId]) return;
      
      const { newProvinces: domProvinces, newResources } = processDomesticTurn(
        fId,
        newProvinces,
        globalHeroes,
        newFactionResources[fId]
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
    globalHeroes: {},
    factionResources: {},
    strategyTurn: 1,
    selectedProvinceId: null,
    pendingBattle: null,
    diplomacyRelations: {},
    lastBattleOutcome: null,
    endingType: null,
    worldSeed: 0,
  }),
}));
