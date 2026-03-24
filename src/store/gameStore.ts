// J:/AI/Game/SRPG/src/store/gameStore.ts
// CT(Charge Time) 기반 이니셔티브 턴제 + 장수(General) 시스템
//
// ─ CT 이니셔티브 흐름 ────────────────────────────────────────────
//   1. 모든 유닛 ct += speed (틱마다)
//   2. CT ≥ CT_THRESHOLD(100) 도달 유닛이 행동권 획득
//   3. 플레이어 유닛이면 자동 선택 → 타일 클릭 / 행동 메뉴
//   4. 행동 완료 후 ct -= CT_THRESHOLD → 다음 유닛 계산
// ─ 장수(General) 버프 ────────────────────────────────────────────
//   장수 unitType='GENERAL'이 charisma 반경 내 아군 병종에 버프
//   attack += strength*0.5 / defense += intelligence*0.3
// ───────────────────────────────────────────────────────────────

import { create } from 'zustand';
import type { Unit, FactionId, UnitType, TilePos, BattleType } from '../types/gameTypes';
import { TerrainType } from '../types/gameTypes';
import { MAP_CONFIG, UNIT_CONFIG, BASE_STATS, UNIT_MATCHUPS, CT_THRESHOLD, GENERAL_INITIAL_STATS } from '../constants/gameConfig';
import { calcMoveRange, findMovePath } from '../utils/moveRange';
import type { MapInfo } from '../utils/mapGenerator';
import type { BattleOutcome } from '../types/appTypes';

// ─── 스폰 체크 ────────────────────────────────────────────────────────────────
const isSpawnBlockedTile = (type: TerrainType): boolean =>
  type === TerrainType.SEA || type === TerrainType.CLIFF;

export type ActionMenuType = 'ATTACK' | 'SKILL' | 'ITEM' | 'WAIT' | 'CANCEL';

// ─── 거리 함수 ────────────────────────────────────────────────────────────────
const manhattan = (ax: number, ay: number, bx: number, by: number): number =>
  Math.abs(ax - bx) + Math.abs(ay - by);

const chebyshevDist = (ax: number, ay: number, bx: number, by: number): number =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));

// ─── 장수 버프 계산 ───────────────────────────────────────────────────────────
// 지정 유닛에게 적용되는 가장 가까운 아군 장수의 버프를 반환
export function getGeneralBuff(
  unit: Unit,
  allUnits: Record<string, Unit>,
): { attackBonus: number; defenseBonus: number } {
  let best: Unit | null = null;
  let bestDist = Infinity;
  for (const u of Object.values(allUnits)) {
    if (u.unitType !== 'GENERAL' || u.factionId !== unit.factionId || u.state === 'DEAD') continue;
    const radius = u.generalCharisma ?? 3;
    const dist = manhattan(unit.logicalX, unit.logicalY, u.logicalX, u.logicalY);
    if (dist <= radius && dist < bestDist) { best = u; bestDist = dist; }
  }
  return {
    attackBonus:  best ? (best.generalStrength ?? 0) * 0.5 : 0,
    defenseBonus: best ? (best.generalIntelligence ?? 0) * 0.3 : 0,
  };
}

// ─── 공격 범위 내 적군 탐색 ───────────────────────────────────────────────────
export function getAttackableTargets(
  attacker: Unit,
  allUnits: Record<string, Unit>,
  fromLx: number,
  fromLy: number,
): Unit[] {
  return Object.values(allUnits).filter(
    u =>
      u.factionId !== attacker.factionId &&
      u.state !== 'DEAD' &&
      manhattan(fromLx, fromLy, u.logicalX, u.logicalY) <= attacker.attackRange,
  );
}

// ─── 전투 데미지 계산 (장수 버프 포함) ────────────────────────────────────────
function calcDamage(attacker: Unit, defender: Unit, allUnits: Record<string, Unit>): number {
  const matchup = UNIT_MATCHUPS[attacker.unitType as keyof typeof UNIT_MATCHUPS];
  let multiplier = 1.0;
  if (matchup?.advantage === defender.unitType) multiplier += matchup.bonus;
  if (matchup?.disadvantage === defender.unitType) multiplier -= 0.2;

  // 장수 버프 적용
  const atkBuff = getGeneralBuff(attacker, allUnits);
  const defBuff = getGeneralBuff(defender, allUnits);
  const effectiveAtk = attacker.attack + atkBuff.attackBonus;
  const effectiveDef = defender.defense + defBuff.defenseBonus;

  const raw = effectiveAtk - effectiveDef * 0.5;
  const base = Math.max(1, raw) * multiplier;
  const variance = base * 0.1 * (Math.random() - 0.5) * 2;
  return Math.max(1, Math.round(base + variance));
}

// ─── 픽셀 변환 ───────────────────────────────────────────────────────────────
export const tileToPixel = (logical: number) =>
  logical * MAP_CONFIG.TILE_SIZE + MAP_CONFIG.TILE_SIZE / 2;

// ─── 타일/세력 세트 빌더 ─────────────────────────────────────────────────────
function buildTileSets(units: Record<string, Unit>, selfId: string) {
  const friendlyTiles = new Set<string>();
  const enemyTiles = new Set<string>();
  const selfUnit = units[selfId];
  for (const u of Object.values(units)) {
    if (u.id === selfId || u.state === 'DEAD') continue;
    const key = `${u.logicalX},${u.logicalY}`;
    if (u.factionId === selfUnit?.factionId) friendlyTiles.add(key);
    else enemyTiles.add(key);
  }
  return { friendlyTiles, enemyTiles };
}

// ─── 팩션/병종 결정 ───────────────────────────────────────────────────────────
const getFactionByIndex = (i: number, attacker: FactionId, defender: FactionId): FactionId =>
  i < UNIT_CONFIG.PLAYER_UNIT_COUNT ? attacker : defender;

const getRandomType = (): UnitType => {
  const t: UnitType[] = ['INFANTRY', 'SPEARMAN', 'CAVALRY', 'ARCHER'];
  return t[Math.floor(Math.random() * t.length)];
};

export interface FloatingDamage {
  id: string;
  x: number;
  y: number;
  value: number;
  isCrit: boolean;
}

// ─── CT 이니셔티브 계산 ───────────────────────────────────────────────────────
// 살아있는 모든 유닛의 CT를 진행시켜 다음 행동 유닛을 결정
function _calcNextActive(
  units: Record<string, Unit>,
): { updatedUnits: Record<string, Unit>; activeId: string } {
  const alive = Object.values(units).filter(u => u.state !== 'DEAD');
  if (alive.length === 0) return { updatedUnits: units, activeId: '' };

  // CT_THRESHOLD 이상인 유닛이 없으면 최소 시간 계산 후 일괄 증가
  const alreadyReady = alive.filter(u => u.ct >= CT_THRESHOLD);
  let finalUnits = { ...units };

  if (alreadyReady.length === 0) {
    // 가장 빠르게 CT_THRESHOLD에 도달하는 시간 계산
    let minTime = Infinity;
    for (const u of alive) {
      const timeNeeded = (CT_THRESHOLD - u.ct) / u.speed;
      if (timeNeeded < minTime) minTime = timeNeeded;
    }
    // 전체 CT 증가
    for (const u of alive) {
      const newCt = u.ct + minTime * u.speed;
      finalUnits[u.id] = { ...finalUnits[u.id], ct: newCt };
    }
  }

  // 가장 높은 CT를 가진 유닛 선택 (동률: 속도 우선, 그다음 플레이어 우선)
  const ready = alive
    .map(u => finalUnits[u.id])
    .filter(u => u.ct >= CT_THRESHOLD)
    .sort((a, b) => {
      if (b.ct !== a.ct) return b.ct - a.ct;
      if (b.speed !== a.speed) return b.speed - a.speed;
      // 우선권은 잠정적으로 플레이어 진영(또는 특정 공격자 진영)에게 줍니다. (TODO: initiative 속성)
      // 여기서는 하드코딩된 'western_empire' 대신 임의 배정
      return -1; 
    });

  return { updatedUnits: finalUnits, activeId: ready[0]?.id ?? '' };
}

// ─── Store 타입 정의 ──────────────────────────────────────────────────────────
interface GameState {
  units: Record<string, Unit>;
  mapData: TerrainType[][] | null;
  cities: { x: number; y: number }[];
  battleType: BattleType;
  biome: MapInfo | null;

  // ─ CT 이니셔티브 ─
  activeUnitId: string | null;     // 현재 행동권을 가진 유닛
  turnNumber: number;              // 행동 횟수 (표시용)

  // ─ 선택/이동 ─
  selectedUnitId: string | null;
  moveRangeTiles: Set<string>;
  hoveredMoveTile: TilePos | null;
  previewPath: TilePos[];
  confirmedDestination: TilePos | null;
  confirmedPath: TilePos[];

  combatLog: string[];
  floatingDamages: FloatingDamage[];

  // 전투 결과 (appStore가 읽어서 화면 전환에 사용)
  battleResult: BattleOutcome | null;
  clearBattleResult: () => void;

  // 공격 타겟 선택 모드
  attackTargetMode: boolean;

  hoveredUnitId: string | null;
  setHoveredUnitId: (id: string | null) => void;
  removeFloatingDamage: (id: string) => void;
  enterAttackTargetMode: () => void;
  executeAttackOnTarget: (targetId: string) => void;

  setMapData: (data: TerrainType[][]) => void;
  setCities: (cities: { x: number; y: number }[]) => void;
  setBattleType: (type: BattleType) => void;
  setBiome: (biome: MapInfo) => void;
  initUnits: (mapWidth: number, mapHeight: number, attackerFactionId: FactionId, defenderFactionId: FactionId) => void;
  selectUnit: (id: string | null) => void;
  setHoveredMoveTile: (tile: TilePos | null) => void;
  confirmMove: (lx: number, ly: number) => void;
  cancelConfirmedMove: () => void;
  executeAction: (action: ActionMenuType) => void;
  endUnitTurn: () => void;      // CT 차감 후 다음 유닛 계산 (구 endPlayerTurn)
}

// ─── Store 생성 ───────────────────────────────────────────────────────────────
export const useGameStore = create<GameState>((set, get) => ({
  units: {},
  mapData: null,
  cities: [],
  battleType: 'defensive',
  biome: null,
  activeUnitId: null,
  turnNumber: 0,
  selectedUnitId: null,
  moveRangeTiles: new Set<string>(),
  hoveredMoveTile: null,
  previewPath: [],
  confirmedDestination: null,
  confirmedPath: [],
  combatLog: [],
  floatingDamages: [],
  attackTargetMode: false,
  hoveredUnitId: null,
  battleResult: null,

  setHoveredUnitId: (id) => set({ hoveredUnitId: id }),
  clearBattleResult: () => set({ battleResult: null }),
  removeFloatingDamage: (id) => set(s => ({ floatingDamages: s.floatingDamages.filter(d => d.id !== id) })),
  enterAttackTargetMode: () => set({ attackTargetMode: true }),

  executeAttackOnTarget: (targetId) => {
    const s = get();
    const { selectedUnitId, units, confirmedDestination, confirmedPath } = s;
    if (!selectedUnitId || !confirmedDestination) return;
    const unit = units[selectedUnitId];
    if (!unit) return;
    const dest = confirmedDestination;
    const px = tileToPixel(dest.lx);
    const py = tileToPixel(dest.ly);
    const waypoints = confirmedPath.slice(1);
    set({ attackTargetMode: false });
    _moveThenAct(set, s, selectedUnitId, unit, dest, px, py, waypoints, targetId);
  },

  setMapData: (data) => set({ mapData: data }),
  setCities: (cities) => set({ cities }),
  setBattleType: (type) => set({ battleType: type }),
  setBiome: (biome) => set({ biome }),

  // ─── 유닛 초기 배치 ──────────────────────────────────────────────────────
  initUnits: (mapWidth, mapHeight, attacker, defender) => {
    const newUnits: Record<string, Unit> = {};
    const usedTiles = new Set<string>();
    const { mapData, cities, battleType } = get();

    const isValidSpawn = (lx: number, ly: number): boolean => {
      if (lx < 0 || lx >= mapWidth || ly < 0 || ly >= mapHeight) return false;
      if (usedTiles.has(`${lx},${ly}`)) return false;
      if (!mapData) return true;
      return !isSpawnBlockedTile(mapData[ly]?.[lx]);
    };

    const CITY_RADIUS = 4;
    const getCityPool = (): { lx: number; ly: number }[] => {
      const pool: { lx: number; ly: number }[] = [];
      for (const city of cities) {
        for (let dy = -CITY_RADIUS; dy <= CITY_RADIUS; dy++) {
          for (let dx = -CITY_RADIUS; dx <= CITY_RADIUS; dx++) {
            if (Math.abs(dx) + Math.abs(dy) > CITY_RADIUS) continue;
            const lx = city.x + dx, ly = city.y + dy;
            if (isValidSpawn(lx, ly)) pool.push({ lx, ly });
          }
        }
      }
      return pool;
    };

    const getRandomSpawn = (faction: FactionId): { lx: number; ly: number } | null => {
      if (cities.length > 0 && battleType === 'defensive') {
        const pool = getCityPool().filter(t =>
          !usedTiles.has(`${t.lx},${t.ly}`) && isValidSpawn(t.lx, t.ly)
        );
        if (pool.length > 0) {
          const tile = pool[Math.floor(Math.random() * pool.length)];
          return tile;
        }
      }
      // Faction-based spawn zone (해당 팩션이 공격자냐 방어자냐에 따라 구분)
      const xMin = faction === attacker ? 0 : Math.floor(mapWidth * 0.6);
      const xMax = faction === attacker ? Math.floor(mapWidth * 0.4) : mapWidth - 1;
      for (let attempt = 0; attempt < 50; attempt++) {
        const lx = Math.floor(Math.random() * (xMax - xMin + 1)) + xMin;
        const ly = Math.floor(Math.random() * mapHeight);
        if (isValidSpawn(lx, ly)) return { lx, ly };
      }
      return null;
    };

    // 일반 병종 스폰
    const totalUnits = UNIT_CONFIG.PLAYER_UNIT_COUNT + (UNIT_CONFIG.INITIAL_SPAWN_COUNT - UNIT_CONFIG.PLAYER_UNIT_COUNT);
    for (let i = 0; i < totalUnits; i++) {
      const faction = getFactionByIndex(i, attacker, defender);
      const type = getRandomType();
      const stats = BASE_STATS[type];
      if (!stats) continue;
      const isHero = i < UNIT_CONFIG.HERO_UNIT_COUNT || (i >= UNIT_CONFIG.PLAYER_UNIT_COUNT && i < UNIT_CONFIG.PLAYER_UNIT_COUNT + UNIT_CONFIG.HERO_UNIT_COUNT);

      const spawn = getRandomSpawn(faction);
      if (!spawn) continue;
      const { lx, ly } = spawn;
      usedTiles.add(`${lx},${ly}`);
      const px = tileToPixel(lx);
      const py = tileToPixel(ly);

      newUnits[`unit-${i}`] = {
        id: `unit-${i}`,
        factionId: faction,
        unitType: type,
        hp: stats.hp * (isHero ? 2 : 1),
        maxHp: stats.hp * (isHero ? 2 : 1),
        attack: stats.attack * (isHero ? 1.5 : 1),
        defense: stats.defense,
        speed: stats.speed,
        attackRange: stats.attackRange,
        ct: Math.floor(Math.random() * 50), // 초기 CT 무작위 (선제 불균형 방지)
        state: 'IDLE',
        logicalX: lx, logicalY: ly,
        x: px, y: py,
        targetX: px, targetY: py,
        movePath: [],
        isHero,
      };
    }

    // 장수(General) 스폰 (세력당 2명)
    const factions: FactionId[] = ['western_empire', 'eastern_alliance'];
    let genIdx = totalUnits;
    for (const faction of factions) {
      for (let g = 0; g < 2; g++) {
        const spawn = getRandomSpawn(faction);
        if (!spawn) continue;
        const { lx, ly } = spawn;
        usedTiles.add(`${lx},${ly}`);
        const px = tileToPixel(lx);
        const py = tileToPixel(ly);
        const genStats = GENERAL_INITIAL_STATS[g === 0 ? 'senior' : 'junior'];

        newUnits[`general-${faction}-${g}`] = {
          id: `general-${faction}-${g}`,
          factionId: faction,
          unitType: 'GENERAL',
          hp: BASE_STATS.GENERAL.hp,
          maxHp: BASE_STATS.GENERAL.hp,
          attack: BASE_STATS.GENERAL.attack,
          defense: BASE_STATS.GENERAL.defense,
          speed: BASE_STATS.GENERAL.speed,
          attackRange: BASE_STATS.GENERAL.attackRange,
          ct: Math.floor(Math.random() * 30),
          state: 'IDLE',
          logicalX: lx, logicalY: ly,
          x: px, y: py,
          targetX: px, targetY: py,
          movePath: [],
          isHero: true,
          generalStrength:     genStats.strength,
          generalIntelligence: genStats.intelligence,
          generalPolitics:     genStats.politics,
          generalCharisma:     genStats.charisma,
        };
        genIdx++;
      }
    }

    set({ units: newUnits });
    // CT 계산 시작
    setTimeout(() => _advanceTurn(set, get), 300);
  },

  // ─── 유닛 선택 ──────────────────────────────────────────────────────────
  selectUnit: (id) => {
    const s = get();
    if (!id) {
      set({ selectedUnitId: null, moveRangeTiles: new Set(), hoveredMoveTile: null, previewPath: [], confirmedDestination: null, confirmedPath: [] });
      return;
    }
    // 클릭으로 타 유닛 선택 시: hoveredUnitId만 업데이트 (이미 activeUnitId 자동 선택)
    // activeUnitId인 경우에만 실제 선택 처리
    const unit = s.units[id];
    if (!unit || unit.factionId !== 'western_empire') return;
    if (s.activeUnitId !== id) return; // 행동권이 없는 유닛은 이동 범위 못 봄

    if (!s.mapData) return;
    const { friendlyTiles, enemyTiles } = buildTileSets(s.units, id);
    const range = calcMoveRange(
      unit.logicalX, unit.logicalY, unit.speed,
      s.mapData, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT, friendlyTiles, enemyTiles,
    );
    set({ selectedUnitId: id, moveRangeTiles: range, confirmedDestination: null, confirmedPath: [], hoveredMoveTile: null, previewPath: [] });
  },

  // ─── 호버 경로 미리보기 ─────────────────────────────────────────────────
  setHoveredMoveTile: (tile) => {
    const s = get();
    if (!tile) { set({ hoveredMoveTile: null, previewPath: [] }); return; }
    if (s.confirmedDestination) return;
    const { selectedUnitId, units, mapData, moveRangeTiles } = s;
    if (!selectedUnitId || !mapData) return;
    if (!moveRangeTiles.has(`${tile.lx},${tile.ly}`)) return;
    const unit = units[selectedUnitId];
    if (!unit) return;
    const { friendlyTiles, enemyTiles } = buildTileSets(units, selectedUnitId);
    const path = findMovePath(
      unit.logicalX, unit.logicalY, tile.lx, tile.ly, unit.speed,
      mapData, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT, friendlyTiles, enemyTiles,
    );
    set({ hoveredMoveTile: tile, previewPath: path });
  },

  // ─── 이동 확정 ──────────────────────────────────────────────────────────
  confirmMove: (lx, ly) => {
    const s = get();
    if (!s.selectedUnitId || !s.mapData) return;
    const unit = s.units[s.selectedUnitId];
    if (!unit) return;

    const isCurrentTile = unit.logicalX === lx && unit.logicalY === ly;
    if (!isCurrentTile && !s.moveRangeTiles.has(`${lx},${ly}`)) return;

    let path = s.previewPath;
    if (!path.length || path[path.length - 1].lx !== lx || path[path.length - 1].ly !== ly) {
      const { friendlyTiles, enemyTiles } = buildTileSets(s.units, s.selectedUnitId);
      path = isCurrentTile
        ? [{ lx, ly }]
        : findMovePath(
            unit.logicalX, unit.logicalY, lx, ly, unit.speed,
            s.mapData, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT, friendlyTiles, enemyTiles,
          );
    }
    set({ confirmedDestination: { lx, ly }, confirmedPath: path });
  },

  // ─── 이동 취소 ──────────────────────────────────────────────────────────
  cancelConfirmedMove: () => set({ confirmedDestination: null, confirmedPath: [], hoveredMoveTile: null, previewPath: [] }),

  // ─── 행동 실행 ──────────────────────────────────────────────────────────
  executeAction: (action) => {
    if (action === 'CANCEL') { get().cancelConfirmedMove(); return; }

    const s = get();
    const { selectedUnitId, units, confirmedDestination, confirmedPath } = s;
    if (!selectedUnitId || !confirmedDestination) return;
    const unit = units[selectedUnitId];
    if (!unit) return;

    const dest = confirmedDestination;
    const px = tileToPixel(dest.lx);
    const py = tileToPixel(dest.ly);
    const waypoints = confirmedPath.slice(1);

    // WAIT / SKILL / ITEM → 이동만 하고 턴 종료
    _moveThenAct(set, s, selectedUnitId, unit, dest, px, py, waypoints, null);
  },

  // ─── 유닛 턴 종료 (CT 차감 → 다음 유닛 계산) ────────────────────────────
  endUnitTurn: () => {
    const s = get();
    const { activeUnitId, units } = s;
    if (!activeUnitId) return;
    const unit = units[activeUnitId];
    if (!unit) return;

    // CT 차감 (행동 완료)
    const newCt = Math.max(0, unit.ct - CT_THRESHOLD);
    set({
      activeUnitId: null,
      selectedUnitId: null,
      moveRangeTiles: new Set(),
      confirmedDestination: null,
      confirmedPath: [],
      attackTargetMode: false,
      turnNumber: s.turnNumber + 1,
      units: { ...units, [activeUnitId]: { ...unit, ct: newCt, state: unit.state === 'DEAD' ? 'DEAD' : 'IDLE' } },
    });

    setTimeout(() => _advanceTurn(set, get), 200);
  },
}));

// ─── CT 이니셔티브: 다음 행동 유닛 결정 ──────────────────────────────────────
function _advanceTurn(
  set: (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void,
  get: () => GameState,
) {
  const s = get();
  const { updatedUnits, activeId } = _calcNextActive(s.units);

  if (!activeId) return; // 유닛 없음

  const activeUnit = updatedUnits[activeId];
  set({ units: updatedUnits, activeUnitId: activeId });

  if (activeUnit.factionId === 'western_empire') {
    // 플레이어 유닛: 자동 선택 + 이동 범위 표시
    if (!s.mapData) return;
    const { friendlyTiles, enemyTiles } = buildTileSets(updatedUnits, activeId);
    const range = calcMoveRange(
      activeUnit.logicalX, activeUnit.logicalY, activeUnit.speed,
      s.mapData, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT, friendlyTiles, enemyTiles,
    );
    set({ selectedUnitId: activeId, moveRangeTiles: range });
  } else {
    // 적 유닛: AI 실행
    setTimeout(() => _runSingleEnemyAI(set, get, activeId), 400);
  }
}

// ─── 이동 후 행동 헬퍼 (bump 애니메이션 포함) ──────────────────────────────────
function _moveThenAct(
  set: (partial: Partial<GameState>) => void,
  s: GameState,
  selfId: string,
  unit: Unit,
  dest: TilePos,
  px: number,
  py: number,
  waypoints: TilePos[],
  attackTargetId: string | null,
) {
  const MOVE_MS = waypoints.length * 150 + 100;

  set({
    selectedUnitId: null,
    moveRangeTiles: new Set(),
    hoveredMoveTile: null,
    previewPath: [],
    confirmedDestination: null,
    confirmedPath: [],
    units: {
      ...s.units,
      [selfId]: {
        ...unit,
        logicalX: dest.lx,
        logicalY: dest.ly,
        targetX: px,
        targetY: py,
        state: 'MOVING',
        movePath: waypoints,
      },
    },
  });

  // 이동 완료 후 처리
  setTimeout(() => {
    if (!attackTargetId) {
      // 공격 없음 → 턴 종료
      useGameStore.getState().endUnitTurn();
      return;
    }

    const cur = useGameStore.getState();
    const atk = cur.units[selfId];
    const def = cur.units[attackTargetId];
    if (!atk || !def || def.state === 'DEAD') {
      useGameStore.getState().endUnitTurn();
      return;
    }

    const dx = tileToPixel(def.logicalX) - px;
    const dy = tileToPixel(def.logicalY) - py;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const BUMP = 18;

    // 단계 1: ATTACKING + bump
    useGameStore.setState(s2 => ({
      units: {
        ...s2.units,
        [selfId]: {
          ...s2.units[selfId],
          state: 'ATTACKING',
          targetX: px + (dx / len) * BUMP,
          targetY: py + (dy / len) * BUMP,
        },
      },
    }));

    // 단계 2: recoil
    setTimeout(() => {
      useGameStore.setState(s2 => ({
        units: { ...s2.units, [selfId]: { ...s2.units[selfId], targetX: px, targetY: py } },
      }));
    }, 220);

    // 단계 3: 데미지 해결 + 턴 종료
    setTimeout(() => {
      const cur2 = useGameStore.getState();
      const a2 = cur2.units[selfId];
      const d2 = cur2.units[attackTargetId];
      if (!a2 || !d2 || d2.state === 'DEAD') {
        useGameStore.getState().endUnitTurn();
        return;
      }
      _resolveAttack(a2, d2, selfId, attackTargetId, cur2.units);
    }, 450);
  }, MOVE_MS);
}

// ─── 전투 해결 + 플로팅 데미지 + 턴 종료 ───────────────────────────────────────
function _resolveAttack(
  attacker: Unit,
  defender: Unit,
  attackerId: string,
  defenderId: string,
  allUnits: Record<string, Unit>,
) {
  const dmg = calcDamage(attacker, defender, allUnits);
  const newHp = Math.max(0, defender.hp - dmg);
  const isDead = newHp <= 0;
  const isCrit = dmg >= attacker.attack * 0.95;
  const log = `${attacker.unitType}(·${attackerId.slice(-2)}) → ${dmg}dmg → ${defender.unitType}(·${defenderId.slice(-2)})${isDead ? ' [사망]' : ''}`;
  const floatId = `fd-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  useGameStore.setState(s => ({
    units: {
      ...s.units,
      [attackerId]: { ...s.units[attackerId], state: 'IDLE' },
      [defenderId]: { ...s.units[defenderId], hp: newHp, state: isDead ? 'DEAD' : 'IDLE' },
    },
    combatLog: [log, ...s.combatLog].slice(0, 8),
    floatingDamages: [
      ...s.floatingDamages,
      { id: floatId, x: tileToPixel(defender.logicalX), y: tileToPixel(defender.logicalY) - 10, value: dmg, isCrit },
    ],
  }));

  // 공격 후 턴 종료
  setTimeout(() => useGameStore.getState().endUnitTurn(), 300);
}

// ─── 단일 적 AI ───────────────────────────────────────────────────────────────
async function _runSingleEnemyAI(
  set: (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void,
  get: () => GameState,
  enemyId: string,
) {
  await new Promise(r => setTimeout(r, 200 + Math.random() * 300));

  const state = get();
  const enemy = state.units[enemyId];
  if (!enemy || enemy.state === 'DEAD') {
    get().endUnitTurn();
    return;
  }

  const { mapData } = state;
  if (!mapData) { get().endUnitTurn(); return; }

  const playerUnits = Object.values(state.units).filter(
    u => u.factionId === 'western_empire' && u.state !== 'DEAD',
  );
  if (playerUnits.length === 0) { get().endUnitTurn(); return; }

  // 가장 가까운 아군 선택
  playerUnits.sort((a, b) =>
    chebyshevDist(enemy.logicalX, enemy.logicalY, a.logicalX, a.logicalY) -
    chebyshevDist(enemy.logicalX, enemy.logicalY, b.logicalX, b.logicalY)
  );
  const nearest = playerUnits[0];

  const { friendlyTiles, enemyTiles } = buildTileSets(state.units, enemyId);
  const range = calcMoveRange(
    enemy.logicalX, enemy.logicalY, enemy.speed,
    mapData, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT, friendlyTiles, enemyTiles,
  );

  // 이동 범위 내에서 가장 가까운 타일 선택
  let bestTile: { lx: number; ly: number } = { lx: enemy.logicalX, ly: enemy.logicalY };
  let bestDist = chebyshevDist(enemy.logicalX, enemy.logicalY, nearest.logicalX, nearest.logicalY);

  for (const key of range) {
    const [lx, ly] = key.split(',').map(Number);
    const dist = chebyshevDist(lx, ly, nearest.logicalX, nearest.logicalY);
    if (dist < bestDist) { bestDist = dist; bestTile = { lx, ly }; }
  }

  const dest = bestTile;
  const px = tileToPixel(dest.lx);
  const py = tileToPixel(dest.ly);
  const path = findMovePath(
    enemy.logicalX, enemy.logicalY, dest.lx, dest.ly, enemy.speed,
    mapData, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT, friendlyTiles, enemyTiles,
  );
  const waypoints = path.slice(1);

  // 이동
  set(s => ({
    units: {
      ...s.units,
      [enemyId]: {
        ...s.units[enemyId],
        logicalX: dest.lx, logicalY: dest.ly,
        targetX: px, targetY: py,
        state: waypoints.length > 0 ? 'MOVING' : 'IDLE',
        movePath: waypoints,
      },
    },
  }));

  // 이동 완료 대기
  const animMs = waypoints.length * 150 + 50;
  await new Promise(r => setTimeout(r, animMs + 100));

  // 공격 체크
  const afterMove = get();
  const afterEnemy = afterMove.units[enemyId];
  if (!afterEnemy || afterEnemy.state === 'DEAD') {
    get().endUnitTurn();
    return;
  }

  const targets = getAttackableTargets(afterEnemy, afterMove.units, dest.lx, dest.ly);
  if (targets.length > 0) {
    // 가장 HP가 낮은 적 우선 공격
    targets.sort((a, b) => a.hp - b.hp);
    _resolveAttack(afterEnemy, targets[0], enemyId, targets[0].id, afterMove.units);
    // _resolveAttack 내부에서 endUnitTurn 호출됨
  } else {
    get().endUnitTurn();
  }
}
