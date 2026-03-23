// J:/AI/Game/SRPG/src/store/gameStore.ts
// 턴제 SRPG 핵심 상태 관리
//
// 플로우: 유닛 선택 → 이동 범위 BFS → 호버 경로 미리보기
//         → 클릭 확정 → 행동 메뉴(공격/스킬/대기/취소)
//         → 경로 이동 + 전투 처리 → 턴 종료

import { create } from 'zustand';
import type { Unit, FactionId, UnitType, TilePos } from '../types/gameTypes';
import { TerrainType } from '../types/gameTypes';
import { MAP_CONFIG, UNIT_CONFIG, BASE_STATS, UNIT_MATCHUPS } from '../constants/gameConfig';
import { calcMoveRange, findMovePath } from '../utils/moveRange';

// ─── 스폰 가능 여부 ──────────────────────────────────────────────────────────
const isSpawnBlockedTile = (type: TerrainType): boolean =>
  type === TerrainType.SEA || type === TerrainType.CLIFF;

export type TurnPhase = 'player' | 'enemy';
export type ActionMenuType = 'ATTACK' | 'SKILL' | 'ITEM' | 'WAIT' | 'CANCEL';

// ─── 맨해튼 거리 (SRPG 표준 +자/다이아몬드 형태, 대각선 미포함) ───────────────
const manhattan = (ax: number, ay: number, bx: number, by: number): number =>
  Math.abs(ax - bx) + Math.abs(ay - by);


// ─── 체비쇼프 거리 (대각선 포함) ─────────────────────────────────────────────
const chebyshevDist = (ax: number, ay: number, bx: number, by: number): number =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));

// ─── 공격 범위 내 적군 탐색 ─────────────────────────────────────────────────
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

// ─── 전투 데미지 계산 ──────────────────────────────────────────────────────
function calcDamage(attacker: Unit, defender: Unit): number {
  const matchup = UNIT_MATCHUPS[attacker.unitType];
  let multiplier = 1.0;
  if (matchup && matchup.advantage === defender.unitType) multiplier += matchup.bonus;
  if (matchup && matchup.disadvantage === defender.unitType) multiplier -= 0.2;

  const raw = attacker.attack - defender.defense * 0.5;
  const base = Math.max(1, raw) * multiplier;
  const variance = base * 0.1 * (Math.random() - 0.5) * 2; // ±10%
  return Math.max(1, Math.round(base + variance));
}

// ─── 타일/세력 집합 빌더 ─────────────────────────────────────────────────────
export const tileToPixel = (logical: number) =>
  logical * MAP_CONFIG.TILE_SIZE + MAP_CONFIG.TILE_SIZE / 2;

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

const getFactionByIndex = (i: number): FactionId =>
  i < UNIT_CONFIG.PLAYER_UNIT_COUNT ? 'western_empire' : 'eastern_alliance';

const getRandomType = (): UnitType => {
  const t: UnitType[] = ['INFANTRY', 'SPEARMAN', 'CAVALRY', 'ARCHER'];
  return t[Math.floor(Math.random() * t.length)];
};

export interface FloatingDamage {
  id: string;
  x: number; // pixel x (화면 좌표)
  y: number; // pixel y
  value: number;
  isCrit: boolean;
}

// ─── Store 타입 정의 ────────────────────────────────────────────────────────
interface GameState {
  units: Record<string, Unit>;
  mapData: TerrainType[][] | null;
  currentTurn: TurnPhase;
  turnNumber: number;
  selectedUnitId: string | null;
  moveRangeTiles: Set<string>;
  hoveredMoveTile: TilePos | null;
  previewPath: TilePos[];
  confirmedDestination: TilePos | null;
  confirmedPath: TilePos[];

  combatLog: string[];
  floatingDamages: FloatingDamage[];

  // 코공 타곸 선택 모드
  attackTargetMode: boolean;       // true일 때 AttackRangeLayer 타일이 클릭 가능
  enterAttackTargetMode: () => void;
  executeAttackOnTarget: (targetId: string) => void;

  setMapData: (data: TerrainType[][]) => void;
  initUnits: (mapWidth: number, mapHeight: number) => void;
  selectUnit: (id: string | null) => void;
  setHoveredMoveTile: (tile: TilePos | null) => void;
  confirmMove: (lx: number, ly: number) => void;
  cancelConfirmedMove: () => void;
  executeAction: (action: ActionMenuType) => void;
  endPlayerTurn: () => void;
  removeFloatingDamage: (id: string) => void;
}

// ─── Store 생성 ────────────────────────────────────────────────────────────
export const useGameStore = create<GameState>((set, get) => ({
  units: {},
  mapData: null,
  currentTurn: 'player',
  turnNumber: 1,
  selectedUnitId: null,
  moveRangeTiles: new Set<string>(),
  hoveredMoveTile: null,
  previewPath: [],
  confirmedDestination: null,
  confirmedPath: [],
  combatLog: [],
  floatingDamages: [],
  attackTargetMode: false,

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

  // ─── 유닛 초기 배치 ─────────────────────────────────────────────────────
  initUnits: (mapWidth, mapHeight) => {
    const newUnits: Record<string, Unit> = {};
    const usedTiles = new Set<string>();
    const mapData = get().mapData;

    for (let i = 0; i < UNIT_CONFIG.INITIAL_SPAWN_COUNT; i++) {
      const isHero = i < UNIT_CONFIG.HERO_UNIT_COUNT;
      const type = getRandomType();
      const faction = getFactionByIndex(i);
      const stats = BASE_STATS[type];

      let lx = 0, ly = 0, attempts = 0;
      do {
        lx = Math.floor(Math.random() * mapWidth);
        ly = Math.floor(Math.random() * mapHeight);
        if (++attempts > 1000) break;
      } while (
        usedTiles.has(`${lx},${ly}`) ||
        (mapData ? isSpawnBlockedTile(mapData[ly]?.[lx]) : false)
      );
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
        state: 'IDLE',
        hasActed: false,
        logicalX: lx, logicalY: ly,
        x: px, y: py,
        targetX: px, targetY: py,
        movePath: [],
        isHero,
      };
    }
    set({ units: newUnits });
  },

  // ─── 유닛 선택 ──────────────────────────────────────────────────────────
  selectUnit: (id) => {
    const s = get();
    if (!id) {
      set({ selectedUnitId: null, moveRangeTiles: new Set(), hoveredMoveTile: null, previewPath: [], confirmedDestination: null, confirmedPath: [] });
      return;
    }
    const unit = s.units[id];
    if (!unit || unit.factionId !== 'western_empire') return;
    if (unit.state !== 'IDLE') return;
    if (unit.hasActed) return; // 이번 턴 이미 행동함

    if (!s.mapData) return;
    const { friendlyTiles, enemyTiles } = buildTileSets(s.units, id);
    const range = calcMoveRange(
      unit.logicalX, unit.logicalY, unit.speed,
      s.mapData, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT,
      friendlyTiles, enemyTiles,
    );
    set({ selectedUnitId: id, moveRangeTiles: range, hoveredMoveTile: null, previewPath: [], confirmedDestination: null, confirmedPath: [] });
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
    if (!s.moveRangeTiles.has(`${lx},${ly}`)) return;
    let path = s.previewPath;
    if (!path.length || path[path.length - 1].lx !== lx || path[path.length - 1].ly !== ly) {
      const unit = s.units[s.selectedUnitId];
      if (!unit) return;
      const { friendlyTiles, enemyTiles } = buildTileSets(s.units, s.selectedUnitId);
      path = findMovePath(
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

    if (action === 'ATTACK') {
      // 이동 후 공격: 이동을 먼저 처리하고, 이동 완료 시점에 공격을 해야 함
      // 여기서는 공격 가능 적군 목록을 선택해야 하지만
      // 단순화: 이동 완료 후 범위 내 첫 번째 적군을 자동 공격
      const targets = getAttackableTargets(unit, units, dest.lx, dest.ly);
      const target = targets[0];
      if (!target) {
        // 공격 대상 없음 → 그냥 대기처럼 이동만
        _moveThenAct(set, s, selectedUnitId, unit, dest, px, py, waypoints, null);
      } else {
        _moveThenAct(set, s, selectedUnitId, unit, dest, px, py, waypoints, target.id);
      }
    } else {
      // WAIT / SKILL / ITEM: 이동 후 행동 완료
      _moveThenAct(set, s, selectedUnitId, unit, dest, px, py, waypoints, null);
    }
  },

  // ─── 플레이어 턴 종료 ────────────────────────────────────────────────────
  endPlayerTurn: () => {
    const s = get();
    set({
      currentTurn: 'enemy',
      units: Object.fromEntries(
        Object.entries(s.units).map(([id, u]) => [id, { ...u, state: u.state === 'DEAD' ? 'DEAD' as const : 'IDLE' as const }])
      ),
      selectedUnitId: null,
      moveRangeTiles: new Set(),
      hoveredMoveTile: null,
      previewPath: [],
      confirmedDestination: null,
      confirmedPath: [],
    });

    // 적 AI 실행
    setTimeout(() => runEnemyAI(get, set), 500);
  },
}));

// ─── 이동 후 행동 헬퍼 (bump 애니메이션 + 공격 포함) ─────────────────────────
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
        hasActed: true,
        movePath: waypoints,
      },
    },
  });

  if (!attackTargetId) return;

  // 이동 완료 후: bump → recoil → 데미지 해결 (3단계)
  setTimeout(() => {
    const cur = useGameStore.getState();
    const atk = cur.units[selfId];
    const def = cur.units[attackTargetId];
    if (!atk || !def || def.state === 'DEAD') return;

    const dx = tileToPixel(def.logicalX) - px;
    const dy = tileToPixel(def.logicalY) - py;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const BUMP = 18;

    // 단계 1: ATTACKING 상태 + bump 위치
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

    // 단계 2: 220ms 후 recoil (원래 위치 복귀)
    setTimeout(() => {
      useGameStore.setState(s2 => ({
        units: {
          ...s2.units,
          [selfId]: { ...s2.units[selfId], targetX: px, targetY: py },
        },
      }));
    }, 220);

    // 단계 3: 450ms 후 데미지 해결
    setTimeout(() => {
      const cur2 = useGameStore.getState();
      const a2 = cur2.units[selfId];
      const d2 = cur2.units[attackTargetId];
      if (!a2 || !d2 || d2.state === 'DEAD') return;
      _resolveAttack(a2, d2, selfId, attackTargetId);
    }, 450);
  }, MOVE_MS);
}

// ─── 전투 해결 + 플로팅 데미지 ──────────────────────────────────────────────
function _resolveAttack(attacker: Unit, defender: Unit, attackerId: string, defenderId: string) {
  const dmg = calcDamage(attacker, defender);
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
      {
        id: floatId,
        x: tileToPixel(defender.logicalX),
        y: tileToPixel(defender.logicalY) - 10,
        value: dmg,
        isCrit,
      },
    ],
  }));
}


// ─── 적 AI ──────────────────────────────────────────────────────────────────
async function runEnemyAI(
  get: () => GameState,
  set: (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void,
) {
  const enemyIds = Object.keys(get().units).filter(
    id => {
      const u = get().units[id];
      return u.factionId === 'eastern_alliance' && u.state !== 'DEAD';
    }
  );

  // 셔플 (랜덤 순서)
  enemyIds.sort(() => Math.random() - 0.5);

  for (const eid of enemyIds) {
    await new Promise(r => setTimeout(r, 300 + Math.random() * 200));

    const state = get();
    if (state.currentTurn !== 'enemy') break;

    const enemy = state.units[eid];
    if (!enemy || enemy.state === 'DEAD') continue;

    const { mapData } = state;
    if (!mapData) continue;

    // 아군 유닛 목록 (살아있는)
    const playerUnits = Object.values(state.units).filter(
      u => u.factionId === 'western_empire' && u.state !== 'DEAD',
    );
    if (playerUnits.length === 0) break;

    // 가장 가까운 아군 탐색 (체비쇼프 거리)
    playerUnits.sort((a, b) =>
      chebyshevDist(enemy.logicalX, enemy.logicalY, a.logicalX, a.logicalY) -
      chebyshevDist(enemy.logicalX, enemy.logicalY, b.logicalX, b.logicalY)
    );
    const nearest = playerUnits[0];

    const { friendlyTiles, enemyTiles } = buildTileSets(state.units, eid);
    const range = calcMoveRange(
      enemy.logicalX, enemy.logicalY, enemy.speed,
      mapData, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT,
      friendlyTiles, enemyTiles,
    );

    // 이동 범위 안에서 nearest에 가장 가까운 타일 선택
    let bestTile: { lx: number; ly: number } | null = null;
    let bestDist = Infinity;

    // 먼저 현재 위치도 후보로 포함
    const candidates: string[] = [
      ...Array.from(range),
      `${enemy.logicalX},${enemy.logicalY}`,
    ];

    for (const key of candidates) {
      const [lx, ly] = key.split(',').map(Number);
      const dist = chebyshevDist(lx, ly, nearest.logicalX, nearest.logicalY);
      if (dist < bestDist) {
        bestDist = dist;
        bestTile = { lx, ly };
      }
    }

    if (!bestTile) continue;

    // 경로 계산
    const path = findMovePath(
      enemy.logicalX, enemy.logicalY,
      bestTile.lx, bestTile.ly,
      enemy.speed, mapData,
      MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT,
      friendlyTiles, enemyTiles,
    );

    const dest = bestTile;
    const px = tileToPixel(dest.lx);
    const py = tileToPixel(dest.ly);
    const waypoints = path.slice(1);

    // 이동 가능 여부 확인 (range에 있거나 현재 위치)
    const canMove = range.has(`${dest.lx},${dest.ly}`) ||
      (dest.lx === enemy.logicalX && dest.ly === enemy.logicalY);
    if (!canMove) continue;

    set(s => ({
      units: {
        ...s.units,
        [eid]: {
          ...s.units[eid],
          logicalX: dest.lx,
          logicalY: dest.ly,
          targetX: px,
          targetY: py,
          state: waypoints.length > 0 ? 'MOVING' : 'IDLE',
          hasActed: true,
          movePath: waypoints,
        },
      },
    }));

    // 이동 완료 후 공격 체크
    const animMs = waypoints.length * 150 + 50;
    await new Promise(r => setTimeout(r, animMs + 100));

    const afterMove = get();
    const afterEnemy = afterMove.units[eid];
    if (!afterEnemy || afterEnemy.state === 'DEAD') continue;

    const targets = getAttackableTargets(afterEnemy, afterMove.units, dest.lx, dest.ly);
    if (targets.length > 0) {
      _resolveAttack(afterEnemy, targets[0], eid, targets[0].id);
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // 적 턴 완료 → player 턴으로 전환 (아군 hasActed 초기화)
  await new Promise(r => setTimeout(r, 300));
  set(s => ({
    currentTurn: 'player',
    turnNumber: s.turnNumber + 1,
    units: Object.fromEntries(
      Object.entries(s.units).map(([id, u]) => [
        id,
        { ...u, hasActed: false, state: u.state === 'DEAD' ? 'DEAD' as const : 'IDLE' as const },
      ])
    ),
  }));
}
