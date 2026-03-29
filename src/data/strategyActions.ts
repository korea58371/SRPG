// J:/AI/Game/SRPG/src/data/strategyActions.ts
// 전략맵 ActionPanel에 표시할 행동 목록 생성기
// 선택된 영지 + 글로벌 상태를 입력받아 탭별 StrategyActionItem[] 반환 (순수 데이터 레이어)

import type { Province, StrategyActionItem, ActionTab } from '../types/appTypes';
import type { Character } from '../types/characterTypes';
import type { FactionId } from '../types/gameTypes';
import { PLAYER_FACTION, FACTIONS } from '../constants/gameConfig';

// ─── 컨텍스트 타입 ────────────────────────────────────────────────────────────
export interface ActionContext {
  selectedProvince: Province | null;
  allProvinces: Record<string, Province>;
  characters: Record<string, Character>;
  playerFactionId: FactionId;
  remainingAP: number;
  // 액션 콜백
  onDeclareWar: (attackerId: string, defenderId: string) => void;
  onExecuteDomestic: (provinceId: string) => void;
  onRecruitCharacter: (charId: string) => void;
  onOpenDomesticModal: (menu: string) => void;
}

// ─── 헬퍼: 플레이어가 선전포고 가능한 공격자 영지 찾기 ────────────────────────
function findAttackerProvince(
  target: Province,
  allProvinces: Record<string, Province>
): Province | null {
  return Object.values(allProvinces).find(p =>
    p.owner === PLAYER_FACTION &&
    (
      p.adjacentIds.includes(target.id) ||
      (p.isCoastal && target.isCoastal && (p.navalAdjacentIds || []).includes(target.id))
    )
  ) ?? null;
}

// ─── 메인 생성 함수 ───────────────────────────────────────────────────────────
export function buildActionItems(ctx: ActionContext): StrategyActionItem[] {
  const { selectedProvince, allProvinces, characters, remainingAP } = ctx;

  const items: StrategyActionItem[] = [];

  // ========================
  // 플레이어 소유 영지 행동
  // ========================
  if (selectedProvince && selectedProvince.owner === PLAYER_FACTION) {
    const prov = selectedProvince;

    // ── 인재 탭: 배속 장수 ──
    const assignedChars = Object.values(characters).filter(
      c => c.factionId === PLAYER_FACTION && c.locationProvinceId === prov.id
    );
    assignedChars.forEach(char => {
      items.push({
        id: `char_${char.id}`,
        tab: 'talent',
        icon: '⚔️',
        label: char.name,
        subLabel: `${char.troopType ?? '문관'} · 병력 ${char.troopCount}`,
        cost: 0,
        isAvailable: true,
        onExecute: () => { /* 장수 상세 패널 추후 구현 */ },
      });
    });

    // ── 인재 탭: FreeAgent 등용 후보 ──
    // 조건: 현재 선택된 영지(prov) 내에 있거나, 인접한 영지에 위치한 재야 인재만
    const provAndAdjacents = new Set([prov.id, ...prov.adjacentIds]);
    const freeAgents = Object.values(characters).filter(c => 
      c.state === 'FreeAgent' && 
      c.locationProvinceId && 
      provAndAdjacents.has(c.locationProvinceId)
    );
    freeAgents.forEach(char => {
      const canRecruit = (prov.gold ?? 0) >= 50;
      items.push({
        id: `recruit_${char.id}`,
        tab: 'talent',
        icon: '🌟',
        label: char.name,
        subLabel: `등용 비용: 금 50 · ${char.troopType ?? '문관'}형`,
        cost: 1,
        isAvailable: canRecruit && remainingAP >= 1,
        onExecute: () => ctx.onRecruitCharacter(char.id),
      });
    });

    // ── 군사 탭: 인접 적 영지 선전포고 ──
    const enemyAdjacentIds = [
      ...prov.adjacentIds,
      ...(prov.isCoastal ? (prov.navalAdjacentIds || []) : []),
    ];
    const uniqueEnemyIds = [...new Set(enemyAdjacentIds)];
    uniqueEnemyIds.forEach(adjId => {
      const adj = allProvinces[adjId];
      if (!adj || adj.owner === PLAYER_FACTION) return;
      const factionName = FACTIONS[adj.owner]?.name ?? '중립';
      // 군사 탭에 노출
      items.push({
        id: `war_${adjId}`,
        tab: 'military',
        icon: '⚔️',
        label: `${adj.name} 침공`,
        subLabel: factionName,
        cost: 2,
        isAvailable: remainingAP >= 2,
        danger: true,
        onExecute: () => ctx.onDeclareWar(prov.id, adjId),
      });
      // 추천 탭에도 노출 (편의성)
      items.push({
        id: `war_recommend_${adjId}`,
        tab: 'recommend',
        icon: '⚔️',
        label: `${adj.name} 침공`,
        subLabel: factionName,
        cost: 2,
        isAvailable: remainingAP >= 2,
        danger: true,
        onExecute: () => ctx.onDeclareWar(prov.id, adjId),
      });
    });

    // ── 내정 탭 ──
    items.push({
      id: 'domestic_farm',
      tab: 'domestic',
      icon: '🌾',
      label: '농업 장려',
      subLabel: `식량 +10, 금 +8`,
      cost: 1,
      isAvailable: remainingAP >= 1,
      onExecute: () => ctx.onExecuteDomestic(prov.id),
    });
    items.push({
      id: 'domestic_recruit',
      tab: 'domestic',
      icon: '📯',
      label: '징병령',
      subLabel: `인력 +50`,
      cost: 1,
      isAvailable: remainingAP >= 1,
      onExecute: () => ctx.onOpenDomesticModal('conscript'),
    });
    items.push({
      id: 'domestic_security',
      tab: 'domestic',
      icon: '🏰',
      label: '치안 강화',
      subLabel: `치안 +5`,
      cost: 1,
      isAvailable: remainingAP >= 1,
      onExecute: () => ctx.onOpenDomesticModal('formation'),
    });

    // ── 외교 탭 ──
    const adjacentFactions = new Set<string>();
    prov.adjacentIds.forEach(adjId => {
      const adj = allProvinces[adjId];
      if (adj && adj.owner !== PLAYER_FACTION) adjacentFactions.add(adj.owner);
    });
    adjacentFactions.forEach(fId => {
      const fName = FACTIONS[fId]?.name ?? fId;
      items.push({
        id: `diplomacy_${fId}`,
        tab: 'diplomacy',
        icon: '📜',
        label: `${fName}에 사신 파견`,
        subLabel: '관계 개선 시도',
        cost: 1,
        isAvailable: remainingAP >= 1,
        onExecute: () => { /* 외교 로직 추후 연결 */ },
      });
    });
  }

  // ========================
  // 적 영지 선택 시
  // ========================
  if (selectedProvince && selectedProvince.owner !== PLAYER_FACTION) {
    const attacker = findAttackerProvince(selectedProvince, allProvinces);
    if (attacker) {
      const factionName = FACTIONS[selectedProvince.owner]?.name ?? '?';
      items.push({
        id: `war_from_${attacker.id}`,
        tab: 'military',
        icon: '⚔️',
        label: `${selectedProvince.name} 침공`,
        subLabel: `${factionName} 영지 · ${attacker.name}에서 출전`,
        cost: 2,
        isAvailable: remainingAP >= 2,
        danger: true,
        onExecute: () => ctx.onDeclareWar(attacker.id, selectedProvince.id),
      });
      items.push({
        id: `war_recommend_${attacker.id}`,
        tab: 'recommend',
        icon: '⚔️',
        label: `${selectedProvince.name} 침공`,
        subLabel: `${factionName} 영지 · ${attacker.name}에서 출전`,
        cost: 2,
        isAvailable: remainingAP >= 2,
        danger: true,
        onExecute: () => ctx.onDeclareWar(attacker.id, selectedProvince.id),
      });
    }
    // 정보 탐색 (항상 가능, 비용 0)
    items.push({
      id: `scout_${selectedProvince.id}`,
      tab: 'recommend',
      icon: '🔍',
      label: `${selectedProvince.name} 정찰`,
      subLabel: `${FACTIONS[selectedProvince.owner]?.name ?? '?'} 영지`,
      cost: 0,
      isAvailable: true,
      onExecute: () => { /* 정찰 상세 추후 구현 */ },
    });
  }

  // ========================
  // 글로벌 행동 (추천 탭)
  // ========================
  // FreeAgent 등용 가능 시 추천에도 노출
  // 글로벌에서는 '플레이어가 소유한 어느 영지에서든' 인접하거나 포함된 재야 인재를 추천
  const playerProvs = Object.values(allProvinces).filter(p => p.owner === PLAYER_FACTION);
  const allReachableIds = new Set<string>();
  playerProvs.forEach(p => {
    allReachableIds.add(p.id);
    p.adjacentIds.forEach(adj => allReachableIds.add(adj));
  });

  const globalFreeAgents = Object.values(characters).filter(c => 
    c.state === 'FreeAgent' && 
    c.locationProvinceId && 
    allReachableIds.has(c.locationProvinceId)
  );

  if (globalFreeAgents.length > 0) {
    globalFreeAgents.slice(0, 3).forEach(char => {
      if (items.some(i => i.id === `recruit_${char.id}`)) return; // 중복 제거
      
      // 등용을 실행할 타겟 영지(캐릭터가 위치한 곳이거나, 인접한 아군 영지)를 찾아야 함
      // 여기서는 ActionPanel의 onRecruitCharacter가 자동으로 targetProv를 찾도록 위임합니다.
      items.push({
        id: `recruit_recommend_${char.id}`,
        tab: 'recommend',
        icon: '🌟',
        label: char.name,
        subLabel: `재야 인재 등용 가능 (위치: ${allProvinces[char.locationProvinceId!]?.name ?? '알 수 없음'})`,
        cost: 1,
        isAvailable: remainingAP >= 1,
        onExecute: () => ctx.onRecruitCharacter(char.id),
      });
    });
  }

  // 전체 내정 글로벌 버튼 (영지 미선택 시에만 노출)
  if (!selectedProvince) {
    const playerProvs = Object.values(allProvinces).filter(p => p.owner === PLAYER_FACTION);
    if (playerProvs.length > 0) {
      items.push({
        id: 'global_domestic',
        tab: 'recommend',
        icon: '🏛️',
        label: '내정 명령 (전체)',
        subLabel: `${playerProvs.length}개 영지 관리`,
        cost: 1,
        isAvailable: remainingAP >= 1,
        onExecute: () => ctx.onOpenDomesticModal('recruit'),
      });
    }
  }

  return items;
}

// ─── 탭 메타데이터 ────────────────────────────────────────────────────────────
export const ACTION_TABS: { id: ActionTab; label: string }[] = [
  { id: 'recommend', label: '추천' },
  { id: 'talent',    label: '인재' },
  { id: 'military',  label: '군사' },
  { id: 'domestic',  label: '내정' },
  { id: 'diplomacy', label: '외교' },
];
