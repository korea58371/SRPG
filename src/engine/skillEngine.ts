import { useGameStore } from '../store/gameStore';
import type { Unit, TilePos } from '../types/gameTypes';
import { MAP_CONFIG, isPlayableTile } from '../constants/gameConfig';
import { getAoETiles, MOCK_SKILLS } from '../utils/skillTargeting';
import { tileToPixel } from '../store/gameStore';
import { getEffectiveStat, calcDamage } from './statEngine';
import type { ActiveBuff } from '../types/gameTypes';
// ─── 스킬 처리 핵심 로직 ───────────────────────────────────────────────────────
export function _resolveSkill(
  attackerId: string,
  targetTile: TilePos,
  skillId: string,
) {
  const s = useGameStore.getState();
  const skill = MOCK_SKILLS[skillId];
  const caster = s.units[attackerId];
  if (!skill || !caster || caster.state === 'DEAD') {
    useGameStore.getState().endUnitTurn();
    return;
  }

  let remainMp = caster.mp;
  let remainRage = caster.rage;
  for (const c of skill.cost) {
    if (c.type === 'mp') remainMp = Math.max(0, remainMp - c.amount);
    if (c.type === 'rage') remainRage = Math.max(0, remainRage - c.amount);
  }

  const aoeTiles = getAoETiles({ lx: caster.logicalX, ly: caster.logicalY }, targetTile, skill.aoeShape, skill.aoeRadius, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT);
  const affectedUnits: Unit[] = [];
  const hitIds = new Set<string>();

  for (const tile of aoeTiles) {
    const u = Object.values(s.units).find(u => u.logicalX === tile.lx && u.logicalY === tile.ly && u.state !== 'DEAD');
    if (u && !hitIds.has(u.id)) {
      const isEnemy = u.factionId !== caster.factionId;
      let validTarget = false;
      if (skill.targetType === 'any') validTarget = true;
      else if (skill.targetType === 'enemy' && isEnemy) validTarget = true;
      else if (skill.targetType === 'ally' && !isEnemy) validTarget = true;
      else if (skill.targetType === 'empty' && isEnemy) validTarget = true; // 이동형(빈칸 지정) 공격 스킬의 경우 궤도 내 적에게 피해를 입힘

      if (validTarget) {
        affectedUnits.push(u);
        hitIds.add(u.id);
      }
    }
  }

  const newUnits = { ...s.units, [attackerId]: { ...caster, mp: remainMp, rage: remainRage, state: 'IDLE' as any } };
  const floatings = [...s.floatingDamages];
  let logText = `${caster.unitType}의 [${skill.name}] 시전!`;

  let hitCount = 0;

  for (const effect of skill.effects) {
    if (effect.type === 'damage') {
      for (const target of affectedUnits) {
        hitCount++;
        const { dmg, isWeak, isResist } = calcDamage(caster, target, s.units, effect.element, effect.value || 1.0);

        const prevState = newUnits[target.id] || target;
        const newHp = Math.max(0, prevState.hp - dmg);
        const newState = newHp <= 0 ? 'DEAD' : prevState.state;
        const targetRage = Math.min(100, prevState.rage + 10);
        newUnits[target.id] = { ...prevState, hp: newHp, state: newState as any, rage: targetRage };
        
        const isCrit = dmg >= getEffectiveStat(caster, 'attack') * 0.95;

        floatings.push({
          id: `fd-${Date.now()}-${Math.random()}`,
          x: tileToPixel(target.logicalX),
          y: tileToPixel(target.logicalY) - 15,
          value: dmg,
          isCrit,
          isWeak,
          isResist
        });
      }
    } else if (effect.type === 'heal') {
      for (const target of affectedUnits) {
        hitCount++;
        const atkOrInt = caster.generalIntelligence ? (caster.generalIntelligence * 10) : getEffectiveStat(caster, 'attack');
        const rawHeal = Math.max(1, atkOrInt * (effect.value || 1.0));
        const healAmt = Math.round(rawHeal);
        
        const prevState = newUnits[target.id] || target;
        const newHp = Math.min(prevState.maxHp, prevState.hp + healAmt);
        const actualHeal = newHp - prevState.hp;
        
        newUnits[target.id] = { ...prevState, hp: newHp };
        
        if (actualHeal >= 0) {
          floatings.push({
            id: `fd-${Date.now()}-${Math.random()}`,
            x: tileToPixel(target.logicalX),
            y: tileToPixel(target.logicalY) - 15,
            value: actualHeal > 0 ? actualHeal : healAmt,
            isCrit: false,
            isHeal: true
          });
        }
      }
    } else if (effect.type === 'push' || effect.type === 'pull') {
      const dist = effect.value || 1;
      const sign = effect.type === 'push' ? 1 : -1;
      
      for (const target of affectedUnits) {
        hitCount++;
        let dx = Math.sign(target.logicalX - caster.logicalX);
        let dy = Math.sign(target.logicalY - caster.logicalY);
        if (dx === 0 && dy === 0) { dx = 1; dy = 0; }
        
        let nextX = target.logicalX;
        let nextY = target.logicalY;

        for (let step = 1; step <= dist; step++) {
          const tempX = target.logicalX + dx * step * sign;
          const tempY = target.logicalY + dy * step * sign;
          
          if (tempX < 0 || tempY < 0 || tempX >= MAP_CONFIG.WIDTH || tempY >= MAP_CONFIG.HEIGHT) break;
          if (!isPlayableTile(tempX, tempY, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT)) break;
          
          const collision = Object.values(newUnits).some(u => u.id !== target.id && u.state !== 'DEAD' && u.logicalX === tempX && u.logicalY === tempY);
          if (collision) break;

          nextX = tempX;
          nextY = tempY;
        }
        
        if (nextX !== target.logicalX || nextY !== target.logicalY) {
          const prevState = newUnits[target.id] || target;
          newUnits[target.id] = { 
            ...prevState, 
            logicalX: nextX, logicalY: nextY, 
            state: 'KNOCKBACK',
            targetX: tileToPixel(nextX), 
            targetY: tileToPixel(nextY) 
          };
          logText += ` [${effect.type === 'push' ? '넉백' : '당겨짐'}]`;
        }
      }
    } else if (effect.type === 'buff' || effect.type === 'debuff') {
      for (const target of affectedUnits) {
        hitCount++;
        const prevState = newUnits[target.id] || target;
        const existingBuffs = prevState.buffs || [];
        
        if (!effect.buffType) continue; // 버프 누락 시 스킵

        const newBuff: ActiveBuff = {
          id: `buff-${Date.now()}-${Math.random()}`,
          type: effect.buffType,
          value: effect.value || 0,
          duration: effect.duration || 1,
          sourceId: caster.id
        };
        
        // 동일 종류 버프 덮어쓰기 (효과 및 턴 수 갱신)
        const filtered = existingBuffs.filter(b => b.type !== effect.buffType);
        filtered.push(newBuff);
        
        newUnits[target.id] = { ...prevState, buffs: filtered };
        
        const isBuff = effect.type === 'buff';
        floatings.push({
          id: `fd-buff-${Date.now()}-${Math.random()}`,
          x: tileToPixel(target.logicalX),
          y: tileToPixel(target.logicalY) - 25,
          value: isBuff ? `⇧ ${effect.buffType}` : `⇩ ${effect.buffType}`,
          isCrit: false,
          fontColor: isBuff ? '#00ffff' : '#ff00ff'
        });
      }
    } else if (effect.type === 'dash') {
      const dist = effect.value || 1;
      let dx = Math.sign(targetTile.lx - caster.logicalX);
      let dy = Math.sign(targetTile.ly - caster.logicalY);
      if (dx === 0 && dy === 0) { dx = 1; dy = 0; }
      
      let nextX = caster.logicalX;
      let nextY = caster.logicalY;

      for (let step = 1; step <= dist; step++) {
        const tempX = caster.logicalX + dx * step;
        const tempY = caster.logicalY + dy * step;
        
        if (tempX < 0 || tempY < 0 || tempX >= MAP_CONFIG.WIDTH || tempY >= MAP_CONFIG.HEIGHT) break;
        if (!isPlayableTile(tempX, tempY, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT)) break;
        
        const collision = Object.values(newUnits).some(u => u.id !== attackerId && u.state !== 'DEAD' && u.logicalX === tempX && u.logicalY === tempY);
        if (collision) break;

        nextX = tempX;
        nextY = tempY;
      }

      if (nextX !== caster.logicalX || nextY !== caster.logicalY) {
        newUnits[attackerId] = { 
          ...newUnits[attackerId], 
          logicalX: nextX, logicalY: nextY, 
          state: 'KNOCKBACK',
          targetX: tileToPixel(nextX),
          targetY: tileToPixel(nextY) 
        };
        logText += ` [돌진]`;
      }
    } else if (effect.type === 'dash_to_target') {
      newUnits[attackerId] = { 
        ...newUnits[attackerId], 
        logicalX: targetTile.lx, logicalY: targetTile.ly, 
        state: 'KNOCKBACK',
        targetX: tileToPixel(targetTile.lx),
        targetY: tileToPixel(targetTile.ly) 
      };
      logText += ` [돌파 질주]`;
    } else if (effect.type === 'teleport') {
      newUnits[attackerId] = {
        ...newUnits[attackerId],
        logicalX: targetTile.lx, logicalY: targetTile.ly,
        x: tileToPixel(targetTile.lx), // 즉시 이동
        y: tileToPixel(targetTile.ly), // 즉시 이동
        targetX: tileToPixel(targetTile.lx),
        targetY: tileToPixel(targetTile.ly),
        state: 'IDLE'
      };
      logText += ` [도약]`;
    }
  }

  if (hitCount > 0) {
    logText += ` ${hitCount}회 적중.`;
  } else if (!skill.effects.some(e => e.type === 'dash' || e.type === 'buff' || e.type === 'heal' || e.type === 'teleport')) {
    logText += ` 허공을 갈랐다.`;
  }

  // 재행동 로직
  if (skill.grantsReAction) {
    logText += ` (연속 행동!)`;
  }

  useGameStore.setState({
    units: newUnits,
    combatLog: [logText, ...s.combatLog].slice(0, 8),
    floatingDamages: floatings,
  });

  const skipDelay = useGameStore.getState().isCtrlPressed ? 0 : 400;
  
  setTimeout(() => {
    if (skill.grantsReAction) {
      // 턴을 종료시키지 않고 타겟 지정을 초기화하여 유저가 조작 가능한 상태로 되돌림
      useGameStore.setState({
        skillTargetMode: false,
        selectedSkillId: null,
        confirmedDestination: null,
        attackTargetMode: false
      });
    } else {
      useGameStore.getState().endUnitTurn();
    }
  }, skipDelay);
}

export function _moveThenAct(
  selfId: string,
  unit: Unit,
  dest: TilePos,
  px: number,
  py: number,
  waypoints: TilePos[],
  targetTile: TilePos | null,
  skillId: string | null,
) {
  const isSkip = useGameStore.getState().isCtrlPressed;
  const MOVE_MS = isSkip ? 0 : waypoints.length * 150 + 100;
  
  const s = useGameStore.getState();

  useGameStore.setState({
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
        state: isSkip ? 'IDLE' : 'MOVING',
        movePath: isSkip ? [] : waypoints,
        x: isSkip ? px : unit.x,
        y: isSkip ? py : unit.y,
      },
    },
  });

  setTimeout(() => {
    // 렌더링 루프의 불확실성에 대비하여 이동이 완료된 시점에 x, y 픽셀값을 강제 덮어씌움 (위치 롤백 버그 방지)
    useGameStore.setState(s2 => ({
      units: { ...s2.units, [selfId]: { ...s2.units[selfId], x: px, y: py, targetX: px, targetY: py } }
    }));

    if (!skillId || !targetTile) {
      useGameStore.getState().endUnitTurn();
      return;
    }

    if (isSkip) {
      _resolveSkill(selfId, targetTile, skillId);
      return;
    }

    const dx = tileToPixel(targetTile.lx) - px;
    const dy = tileToPixel(targetTile.ly) - py;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const BUMP = 18;

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
      isMoveAnimating: true,
    }));

    setTimeout(() => {
      useGameStore.setState(s2 => ({
        units: { ...s2.units, [selfId]: { ...s2.units[selfId], targetX: px, targetY: py } }
      }));
    }, 200);

    setTimeout(() => {
      useGameStore.setState({ isMoveAnimating: false });
      _resolveSkill(selfId, targetTile, skillId);
    }, 350);

  }, MOVE_MS);
}
