// J:/AI/Game/SRPG/src/store/appStore.ts
// 전략 레이어 최상위 상태 관리 (화면 전환 + 영토 + 외교 + 캐릭터)
// gameStore(전투 전용)와 완전 분리
// [통합] GlobalHero 제거 — Character가 단일 진실 공급원

import { create } from 'zustand';
import type {
  StrategyState, AppScreen, BattleOutcome, DiplomacyRel, FactionResource
} from '../types/appTypes';
import { AP_PER_TURN } from '../types/appTypes';

import type { FactionId } from '../types/gameTypes';
import type { Character } from '../types/characterTypes';
import { generateProvinces } from '../utils/provinceGenerator';
import { PLAYER_FACTION, FACTIONS } from '../constants/gameConfig';
import { processDomesticTurn } from '../utils/domesticLogic';
import { ALL_CHARACTERS } from '../data/characters/_registry';

const WIN_RATIO = 0.7;

function checkVictory(provinces: StrategyState['provinces']): 'good' | 'bad' | null {
  const all = Object.values(provinces);
  const playerOwned = all.filter(p => p.owner === PLAYER_FACTION).length;
  const playerCapital = all.find(p => p.isCapital && p.owner === PLAYER_FACTION);
  if (!playerCapital) return 'bad';
  if (playerOwned >= Math.ceil(all.length * WIN_RATIO)) return 'good';
  return null;
}

export const useAppStore = create<StrategyState>((set, get) => ({
  screen: 'TITLE',
  provinces: {},
  characters: ALL_CHARACTERS,  // 캐릭터 레지스트리에서 주입
  factionResources: {},
  strategyTurn: 1,
  remainingAP: AP_PER_TURN,
  selectedProvinceId: null,
  pendingBattle: null,
  pendingDeployment: null,
  diplomacyRelations: {},
  lastBattleOutcome: null,
  endingType: null,
  worldSeed: 0,
  coastlineEdges: null,
  coastlinePolygons: null,

  // ─── 화면 이동 ──────────────────────────────────────────────────────────
  goTo: (screen: AppScreen) => set({ screen }),

  // ─── 게임 시작 ──────────────────────────────────────────────────────────
  startGame: (scenarioData?: { seed: number; factions: Record<string, string> }) => {
    const seed = scenarioData ? scenarioData.seed : Date.now();
    const { provinces } = generateProvinces(1440, 820, seed);
    const diplomacyRelations: Record<string, DiplomacyRel> = {};
    const factionResources: Record<FactionId, FactionResource> = {};

    Object.keys(FACTIONS).forEach(fId => {
      if (fId !== PLAYER_FACTION) diplomacyRelations[fId] = 'war';
      factionResources[fId] = { gold: 1000, food: 2000, manpower: 500 };
    });

    // If scenarioData is provided, override province owners
    if (scenarioData && scenarioData.factions) {
      Object.keys(provinces).forEach(provId => {
        const scenarioOwner = scenarioData.factions[provId];
        if (scenarioOwner && FACTIONS[scenarioOwner]) {
          provinces[provId].owner = scenarioOwner as FactionId;
        } else {
          provinces[provId].owner = 'neutral';
        }
      });
    }

    // 플레이어 수도 찾아 소속 영웅들 배치
    const playerCapital = Object.values(provinces).find(p => p.owner === PLAYER_FACTION && p.isCapital);
    const updatedChars = { ...get().characters };

    if (playerCapital) {
      Object.values(updatedChars).forEach(char => {
        if (char.factionId === PLAYER_FACTION && char.state === 'Factioned') {
          updatedChars[char.id] = { ...char, locationProvinceId: playerCapital.id };
        } else if (char.state === 'FreeAgent') {
          // TODO: 추후 지역별 무작위 분배로 변경. 현재는 테스트를 위해 아군 수도에 전원 배치
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
      remainingAP: AP_PER_TURN,
      selectedProvinceId: null,
      pendingBattle: null,
      pendingDeployment: null,
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

  // ─── 전쟁 선언 → 출격 준비 모달로 이동 ──────────────────────────────────
  declareWar: (attackerId, defenderId) => {
    const { provinces, remainingAP } = get();
    if (remainingAP < 2) {
      console.warn('DeclareWar Rejected: 행동력 부족', { remainingAP });
      return;
    }

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

    // 전투 화면으로 진입하지 않고, 상태만 기록하여 모달을 켬
    set({
      pendingDeployment: { attackerProvinceId: attackerId, defenderProvinceId: defenderId },
    });
  },

  // ─── 출격 준비 취소 ──────────────────────────────────────────────────────────
  cancelDeployment: () => set({ pendingDeployment: null }),

  // ─── 출격 확정 → 실제 전투 화면 진입 ─────────────────────────────────────────
  confirmDeployment: (deployingHeroIds: string[]) => {
    const { pendingDeployment, consumeAP } = get();
    if (!pendingDeployment) return;
    
    // AP는 이때 소모됨
    if (!consumeAP(2)) return;

    set({
      pendingBattle: { 
        attackerProvinceId: pendingDeployment.attackerProvinceId, 
        defenderProvinceId: pendingDeployment.defenderProvinceId,
        deployingHeroIds
      },
      pendingDeployment: null,
      screen: 'BATTLE',
    });
  },

  // ─── 전투 결과 처리 ──────────────────────────────────────────────────────
  resolveBattle: (outcome: BattleOutcome) => {
    const { provinces, pendingBattle, characters } = get();
    if (!pendingBattle) return;

    const isWin = typeof outcome === 'string' ? outcome === 'player_win' : outcome.isVictory;
    const survivingTroops = typeof outcome === 'object' ? outcome.survivingTroops : undefined;

    const { defenderProvinceId } = pendingBattle;
    let newProvinces = { ...provinces };
    let newCharacters = { ...characters };

    // 생존 병력(HP 역산결과) 업데이트
    if (survivingTroops) {
      for (const [charId, remainingCount] of Object.entries(survivingTroops)) {
        if (newCharacters[charId]) {
          newCharacters[charId] = {
            ...newCharacters[charId],
            troopCount: remainingCount
          };
        }
      }
    }

    if (isWin) {
      const defender = newProvinces[defenderProvinceId];
      if (defender) {
        newProvinces = { ...newProvinces, [defenderProvinceId]: { ...defender, owner: PLAYER_FACTION } };
      }
    }

    if (pendingBattle.isCheat || Object.keys(newProvinces).length === 0) {
      set({ characters: newCharacters, pendingBattle: null, lastBattleOutcome: outcome, screen: 'BATTLE_RESULT', endingType: null });
      return;
    }

    const victory = checkVictory(newProvinces);
    set({
      characters: newCharacters,
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
      remainingAP: AP_PER_TURN, // 턴 시작 시 AP 완전 충전
      screen: victory ? 'ENDING' : 'STRATEGY_MAP',
      endingType: victory,
      diplomacyRelations,
    });
  },

  // ─── 리셋 ────────────────────────────────────────────────────────────────
  resetGame: () => set({
    screen: 'TITLE',
    provinces: {},
    characters: ALL_CHARACTERS,
    factionResources: {},
    strategyTurn: 1,
    remainingAP: AP_PER_TURN,
    selectedProvinceId: null,
    pendingBattle: null,
    pendingDeployment: null,
    diplomacyRelations: {},
    lastBattleOutcome: null,
    endingType: null,
    worldSeed: 0,
  }),

  // ─── AP 소모 ─────────────────────────────────────────────────────────────
  consumeAP: (amount: number) => {
    const { remainingAP } = get();
    if (remainingAP < amount) return false;
    set({ remainingAP: remainingAP - amount });
    return true;
  },

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

  // 출격 전 긴급 모병
  quickRecruit: (charId) => {
    const { characters, factionResources } = get();
    const char = characters[charId];
    if (!char || !char.factionId) return;

    const res = factionResources[char.factionId];
    if (!res || res.gold < 50) {
      alert('금화가 부족합니다! (50G 필요)');
      return;
    }

    set({
      factionResources: {
        ...factionResources,
        [char.factionId]: { ...res, gold: res.gold - 50 }
      },
      characters: {
        ...characters,
        [charId]: { ...char, troopCount: (char.troopCount || 0) + 100 }
      }
    });
  },
}));
