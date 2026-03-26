import { useGameStore } from '../store/gameStore';
import { MAP_CONFIG, PLAYER_FACTION } from '../constants/gameConfig';
import { calcMoveRange, findMovePath } from '../utils/moveRange';
import { getAttackableTargets, buildTileSets, chebyshevDist, tileToPixel } from '../store/gameStore'; // 나중에 util로 뺄 수 있음
import { _resolveSkill } from './skillEngine';

// ─── 단일 적 AI ───────────────────────────────────────────────────────────────
export async function _runSingleEnemyAI(
  enemyId: string,
) {
  const state = useGameStore.getState();
  const skipAI = state.isCtrlPressed;
  
  if (!skipAI) {
    await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
  }

  // 상태 재조회
  const curState = useGameStore.getState();
  const enemy = curState.units[enemyId];
  if (!enemy || enemy.state === 'DEAD') {
    useGameStore.getState().endUnitTurn();
    return;
  }

  const { mapData } = curState;
  if (!mapData) { useGameStore.getState().endUnitTurn(); return; }

  const playerUnits = Object.values(curState.units).filter(
    u => u.factionId === PLAYER_FACTION && u.state !== 'DEAD',
  );
  if (playerUnits.length === 0) { useGameStore.getState().endUnitTurn(); return; }

  // 가장 가까운 아군 선택
  playerUnits.sort((a, b) =>
    chebyshevDist(enemy.logicalX, enemy.logicalY, a.logicalX, a.logicalY) -
    chebyshevDist(enemy.logicalX, enemy.logicalY, b.logicalX, b.logicalY)
  );
  const nearest = playerUnits[0];

  const { friendlyTiles, enemyTiles } = buildTileSets(curState.units, enemyId);
  const range = calcMoveRange(
    enemy.logicalX, enemy.logicalY, enemy.moveSteps,
    mapData, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT, friendlyTiles, enemyTiles,
  );

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
  const isSkip = useGameStore.getState().isCtrlPressed;

  // 이동 시작
  useGameStore.setState(s => ({
    units: {
      ...s.units,
      [enemyId]: {
        ...s.units[enemyId],
        logicalX: dest.lx, logicalY: dest.ly,
        targetX: px, targetY: py,
        x: isSkip ? px : s.units[enemyId].x,
        y: isSkip ? py : s.units[enemyId].y,
        state: isSkip ? 'IDLE' : (waypoints.length > 0 ? 'MOVING' : 'IDLE'),
        movePath: isSkip ? [] : waypoints,
      },
    },
  }));

  const animMs = isSkip ? 0 : waypoints.length * 150 + 50;
  await new Promise(r => setTimeout(r, animMs + 100));

  const afterMove = useGameStore.getState();
  const afterEnemy = afterMove.units[enemyId];
  if (!afterEnemy || afterEnemy.state === 'DEAD') {
    useGameStore.getState().endUnitTurn();
    return;
  }

  const targets = getAttackableTargets(afterEnemy, afterMove.units, dest.lx, dest.ly);
  if (targets.length > 0) {
    targets.sort((a, b) => a.hp - b.hp);
    const target = targets[0];

    if (isSkip) {
      _resolveSkill(enemyId, { lx: target.logicalX, ly: target.logicalY }, 'basic-attack');
    } else {
      const px = tileToPixel(afterEnemy.logicalX);
      const py = tileToPixel(afterEnemy.logicalY);
      const dx = tileToPixel(target.logicalX) - px;
      const dy = tileToPixel(target.logicalY) - py;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const BUMP = 18;

      useGameStore.setState(s => ({
        units: {
          ...s.units,
          [enemyId]: {
            ...s.units[enemyId],
            x: px,
            y: py,
            state: 'ATTACKING',
            targetX: px + (dx / len) * BUMP,
            targetY: py + (dy / len) * BUMP,
          },
        },
      }));

      setTimeout(() => {
        useGameStore.setState(s => ({
          units: { ...s.units, [enemyId]: { ...s.units[enemyId], targetX: px, targetY: py } },
        }));
      }, 220);

      setTimeout(() => {
        const cur2 = useGameStore.getState();
        const a2 = cur2.units[enemyId];
        const d2 = cur2.units[target.id];
        if (!a2 || !d2 || d2.state === 'DEAD') {
          useGameStore.getState().endUnitTurn();
        } else {
          _resolveSkill(enemyId, { lx: target.logicalX, ly: target.logicalY }, 'basic-attack');
        }
      }, 450);
    }
  } else {
    useGameStore.getState().endUnitTurn();
  }
}
