// J:/AI/Game/SRPG/src/components/UnitsLayer.tsx
// 병종 아이콘을 오버레이한 유닛 레이어
// Container (animation) → Sprite (색상 배경) + Sprite (병종 이모지 아이콘)
//
// 이동 상태별 처리:
//   IDLE     → container.x/y = unit.x/y (고정)
//   MOVING   → movePath waypoint 순차 보간
//   ATTACKING→ targetX/Y 향해 빠른 보간 (bump 연출)
//   DEAD     → 미렌더링

import { useRef } from 'react';
import { Container, Sprite, Text, Graphics, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useShallow } from 'zustand/react/shallow';
import { MAP_CONFIG, FACTIONS, PLAYER_FACTION, UNIT_RESISTANCES } from '../constants/gameConfig';
import { useGameStore, tileToPixel, getAttackableTargets } from '../store/gameStore';
import { getUnitTypeTexture } from '../utils/unitTextures';
import { getTurnOrder } from '../store/slices/turnSystemSlice';
import { MOCK_SKILLS, getAoETiles, getManhattanDist } from '../utils/skillTargeting';
import { getEffectiveStat } from '../engine/statEngine';

const MOVE_SPEED = 6;
// W, H 변수는 더 이상 단위 픽셀 계산에 직접 쓰지 않으므로 주석 처리
// const W = UNIT_CONFIG.SIZE_NORMAL.width;
// const H = UNIT_CONFIG.SIZE_NORMAL.height;

export function UnitSprite({ id }: { id: string }) {
  const containerRef    = useRef<PIXI.Container>(null);
  const dmgBarRef       = useRef<PIXI.Graphics>(null);
  const healBarRef      = useRef<PIXI.Graphics>(null);
  const waypointIndexRef = useRef(0);

  const unit           = useGameStore(s => s.units[id]);
  const turnIndex      = useGameStore(s => getTurnOrder(s.units).indexOf(id));
  const selectedUnitId  = useGameStore(s => s.selectedUnitId);
  const selectUnit      = useGameStore(s => s.selectUnit);
  const setHoveredUnit  = useGameStore(s => s.setHoveredUnitId);
  
  const skillTargetMode = useGameStore(s => s.skillTargetMode);
  const selectedSkillId = useGameStore(s => s.selectedSkillId);
  const hoveredMapTile  = useGameStore(s => s.hoveredMapTile);
  const confirmedDest   = useGameStore(s => s.confirmedDestination);

  const visualX = (unit?.x ?? 0);
  const visualY = (unit?.y ?? 0);

  useTick((delta) => {
    const ct = containerRef.current;
    if (!ct) return;

    if (dmgBarRef.current) {
      // 깜빡임 점등 효과 (0.3 ~ 1.0)
      dmgBarRef.current.alpha = (Math.sin(Date.now() / 150) + 1) / 2 * 0.7 + 0.3;
    }
    if (healBarRef.current) {
      healBarRef.current.alpha = (Math.sin(Date.now() / 150) + 1) / 2 * 0.7 + 0.3;
    }

    const u = useGameStore.getState().units[id];
    if (!u || u.state === 'IDLE' || u.state === 'DEAD') {
      if (u) {
        // 확정된 이동 타겟이 있다면 (아직 state는 IDLE이어도) 시각적으로만 옮겨둠
        const isTarget = useGameStore.getState().selectedUnitId === id;
        const dest = useGameStore.getState().confirmedDestination;
        if (isTarget && dest) {
          ct.x = tileToPixel(dest.lx);
          ct.y = tileToPixel(dest.ly);
        } else {
          ct.x = u.x;
          ct.y = u.y;
        }
      }
      waypointIndexRef.current = 0;
      return;
    }

    // ATTACKING: bump 보간
    if (u.state === 'ATTACKING') {
      const dx = u.targetX - ct.x;
      const dy = u.targetY - ct.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.5) {
        const ratio = Math.min(1, (MOVE_SPEED * 2.5 * delta) / dist);
        ct.x += dx * ratio;
        ct.y += dy * ratio;
      } else {
        ct.x = u.targetX;
        ct.y = u.targetY;
      }
      return;
    }

    // KNOCKBACK: push/pull 등 강제 스킬 이동 (트윈 애니메이션)
    if (u.state === 'KNOCKBACK') {
      const dx = u.targetX - ct.x;
      const dy = u.targetY - ct.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.5) {
        // 밀리거나 당기는 속도는 보통 이동보다 훨씬 빠르고 역동적이어야 함 (3.5배)
        const ratio = Math.min(1, (MOVE_SPEED * 3.5 * delta) / dist);
        ct.x += dx * ratio;
        ct.y += dy * ratio;
      } else {
        ct.x = u.targetX;
        ct.y = u.targetY;
        useGameStore.setState(s => ({
          units: {
            ...s.units,
            [id]: { ...s.units[id], state: 'IDLE', x: ct.x, y: ct.y },
          },
        }));
      }
      return;
    }

    // MOVING: waypoint 순차 이동
    const path = u.movePath;
    const wpIdx = waypointIndexRef.current;

    if (!path || path.length === 0 || wpIdx >= path.length) {
      useGameStore.setState(s => ({
        units: {
          ...s.units,
          [id]: { ...s.units[id], state: 'IDLE', x: ct.x, y: ct.y, movePath: [] },
        },
      }));
      waypointIndexRef.current = 0;
      return;
    }

    const wp = path[wpIdx];
    const targetX = tileToPixel(wp.lx);
    const targetY = tileToPixel(wp.ly);
    const dx = targetX - ct.x;
    const dy = targetY - ct.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= MOVE_SPEED * delta) {
      ct.x = targetX;
      ct.y = targetY;
      ct.zIndex = targetY;
      waypointIndexRef.current = wpIdx + 1;
    } else {
      ct.x += dx * (MOVE_SPEED * delta) / dist;
      ct.y += dy * (MOVE_SPEED * delta) / dist;
      ct.zIndex = ct.y;
    }
  });

  if (!unit || unit.state === 'DEAD') return null;

  const isSelected = selectedUnitId === id;
  const color = FACTIONS[unit.factionId]?.color ?? 0xaaaaaa;
  const isActive  = useGameStore(s => s.activeUnitId) === id;
  const alpha = 1.0; // 전황 및 경고 UI 시인성 확보
  const iconTexture = getUnitTypeTexture(unit.unitType);

  const hasActed  = unit.hasActed;

  // 선택된 유닛은 흰색 외곽선, 이미 행동을 마친 유닛은 짙은 회색(dimmed) 배경
  const bgColor = isSelected ? 0xffffff : (hasActed && !isActive ? 0x555555 : color);
  const iconTint = (hasActed && !isActive) ? 0x777777 : 0xffffff;

  const attackMode = useGameStore(s => s.attackTargetMode);
  const activeUnit = useGameStore(s => s.activeUnitId ? s.units[s.activeUnitId] : null);
  const isTargetableEnemy = attackMode && activeUnit && unit.factionId !== activeUnit.factionId;

  // --- 예상 데미지 계산 ---
  let expectedDamage = 0;
  let isWeak = false;
  let isResist = false;
  
  if (skillTargetMode && selectedSkillId && hoveredMapTile && activeUnit) {
    const skill = MOCK_SKILLS[selectedSkillId];
    if (skill) {
      const casterPos = confirmedDest || { lx: activeUnit.logicalX, ly: activeUnit.logicalY };
      const dist = getManhattanDist(casterPos.lx, casterPos.ly, hoveredMapTile.lx, hoveredMapTile.ly);
      if (dist <= skill.range) {
        const aoeTiles = getAoETiles(casterPos, hoveredMapTile, skill.aoeShape, skill.aoeRadius, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT);
        const inAoE = aoeTiles.some(t => t.lx === unit.logicalX && t.ly === unit.logicalY);

        if (inAoE) {
          const isEnemy = unit.factionId !== activeUnit.factionId;
          let validTarget = false;
          if (skill.targetType === 'any') validTarget = true;
          else if (skill.targetType === 'enemy' && isEnemy) validTarget = true;
          else if (skill.targetType === 'ally' && !isEnemy) validTarget = true;
          else if (skill.targetType === 'empty' && isEnemy) validTarget = true; // 빈 구역용 공격은 적에게만 데미지

          if (validTarget) {
            const dmgEffect = skill.effects.find(e => e.type === 'damage');
            if (dmgEffect) {
              const attackElement = dmgEffect.element || 'none';
              const resistMap = UNIT_RESISTANCES[unit.unitType];
              const elementalMult = (resistMap && attackElement in resistMap) 
                ? (resistMap[attackElement as keyof typeof resistMap] || 1.0) 
                : 1.0;
              isResist = elementalMult < 1.0;
              
              const atk = getEffectiveStat(activeUnit, 'attack');
              const def = getEffectiveStat(unit, 'defense');
              const rawDmg = Math.max(1, (atk * (dmgEffect.value || 1) * elementalMult) - (def * 0.5));
              expectedDamage = Math.round(rawDmg);
            } else if (skill.effects.some(e => e.type === 'heal')) {
              const healEffect = skill.effects.find(e => e.type === 'heal')!;
              const atkOrInt = activeUnit.generalIntelligence ? (activeUnit.generalIntelligence * 10) : getEffectiveStat(activeUnit, 'attack');
              const rawHeal = Math.max(1, atkOrInt * (healEffect.value || 1));
              expectedDamage = -Math.round(rawHeal); // 회복은 음수 데미지로 처리
            }
          }
        }
      }
    }
  } else if (attackMode && activeUnit && hoveredMapTile && isTargetableEnemy) {
    // 일반 공격 타겟팅 호버 데미지 예측
    if (unit.logicalX === hoveredMapTile.lx && unit.logicalY === hoveredMapTile.ly) {
      const dest = confirmedDest || { lx: activeUnit.logicalX, ly: activeUnit.logicalY };
      const validTargets = getAttackableTargets(activeUnit, useGameStore.getState().units, dest.lx, dest.ly);
      if (validTargets.some(t => t.id === id)) {
        const atk = getEffectiveStat(activeUnit, 'attack');
        const def = getEffectiveStat(unit, 'defense');
        const rawDmg = Math.max(1, atk - (def * 0.5));
        expectedDamage = Math.round(rawDmg);
      }
    }
  }

  let cursorType = 'default';
  if (isActive && !hasActed) cursorType = 'pointer';
  else if (isTargetableEnemy) cursorType = 'crosshair';

  // ─── 공통 onpointerdown 핸들러 ─────────────────────────────────────────────
  const handlePointerDown = (e: PIXI.FederatedPointerEvent) => {
    if (e.button === 2) return; // 우클릭 무시
    const state = useGameStore.getState();
    const clickedUnit = state.units[id];
    if (!clickedUnit) return;

    const isAlly = clickedUnit.factionId === PLAYER_FACTION;
    const isEnemy = !isAlly;

    // ─ 공격 대상 선택 로직 ─
    if (state.attackTargetMode && state.confirmedDestination && state.selectedUnitId) {
      e.stopPropagation();
      if (isAlly || clickedUnit.state === 'DEAD') return;
      const attacker = state.units[state.selectedUnitId];
      if (!attacker) return;
      const dest = state.confirmedDestination;
      const validTargets = getAttackableTargets(attacker, state.units, dest.lx, dest.ly);
      if (!validTargets.some(t => t.id === id)) return;
      state.executeAttackOnTarget(id);
      return;
    }

    // ─ 이동 모드 or 대기 상태 ─
    if (state.confirmedDestination) return;
    if (isEnemy) return; // 버블링 허용 → App.tsx 타일 이동 처리

    // ─ 아군 유닛 선택 / 제자리 행동 ─
    e.stopPropagation();
    if (state.selectedUnitId === id) {
      const u = state.units[id];
      if (u && state.activeUnitId === id) state.confirmMove(u.logicalX, u.logicalY);
      return;
    }
    selectUnit(id);
    // 사방이 막혀 이동 불가한 경우, 선택 즉시 제자리 confirmMove → ActionMenu 바로 표시
    // (moveRangeTiles는 selectUnit 후 재계산되므로 다음 tick에서 확인)
    setTimeout(() => {
      const st = useGameStore.getState();
      if (st.selectedUnitId === id && st.activeUnitId === id && st.moveRangeTiles.size === 0) {
        const u = st.units[id];
        if (u) st.confirmMove(u.logicalX, u.logicalY);
      }
    }, 0);

  };

  return (
    <Container
      ref={containerRef}
      key={id}
      x={visualX}
      y={visualY}
      alpha={alpha}
      zIndex={visualY}
      eventMode="static"
      hitArea={null as unknown as PIXI.IHitArea}
    >
      {/* 쿼터뷰 역변환: 스프라이트를 화면상 직립으로 그림 */}
      <Container rotation={-Math.PI / 4} scale={{ x: 0.5, y: 1.0 }}>
        
        {/* [핵심] 배경 Sprite에 이벤트 핸들러를 달아,
             역변환된 실제 화면 위치에서 hit detection이 이루어지도록 함.
             (외부 Container의 hitArea는 아이소메트릭 변환으로 왜곡됨) */}
        <Sprite
          texture={PIXI.Texture.WHITE}
          tint={bgColor}
          width={MAP_CONFIG.TILE_SIZE * 0.8}
          height={MAP_CONFIG.TILE_SIZE * 0.8}
          anchor={{ x: 0.5, y: 1.0 }}
          eventMode="static"
          cursor={cursorType}
          onpointerenter={() => setHoveredUnit(id)}
          onpointerleave={() => setHoveredUnit(null)}
          onpointerdown={handlePointerDown}
        />
        
        {/* 병종 아이콘 */}
        {iconTexture && (
          <Sprite
            texture={iconTexture}
            width={MAP_CONFIG.TILE_SIZE * 0.6}
            height={MAP_CONFIG.TILE_SIZE * 0.6}
            anchor={0.5}
            y={-12}
            alpha={0.9}
            tint={iconTint}
          />
        )}
        
        {/* 장수(GENERAL) 왕관 표시 */}
        {unit.unitType === 'GENERAL' && (
          <Text
            text="👑"
            style={new PIXI.TextStyle({ fontSize: 14 })}
            anchor={0.5}
            y={-24}
            resolution={4}
          />
        )}

        {/* 아군 오폭(Friendly Fire) 경고 아이콘 */}
        {expectedDamage > 0 && unit.factionId === PLAYER_FACTION && (
          <Text
            text="⚠️"
            style={new PIXI.TextStyle({ fontSize: 20 })}
            anchor={0.5}
            x={16}
            y={-24}
            resolution={4}
          />
        )}

        {/* 사망 예정(Lethal Damage) 표시 아이콘 (적군 한정, 혹은 적군 처치 확신) */}
        {expectedDamage >= unit.hp && unit.factionId !== PLAYER_FACTION && (
          <Text
            text="💀"
            style={new PIXI.TextStyle({ fontSize: 20 })}
            anchor={0.5}
            x={16}
            y={-24}
            resolution={4}
          />
        )}
        
        {/* 미니 HP 바 (전황 파악용) */}
        <Graphics 
          draw={(g) => {
            g.clear();
            const w = 24;
            const h = 4;
            const ox = -w / 2;
            const oy = -4; // 아이콘 밑
            
            // outline & background
            g.beginFill(0x222222);
            g.drawRect(ox, oy, w, h);
            g.endFill();

            // hp fill
            const pct = Math.max(0, Math.min(1, unit.hp / unit.maxHp));
            const isEnemy = unit.factionId !== PLAYER_FACTION;
            const color = isEnemy ? 0xef4444 : (pct > 0.5 ? 0x22c55e : pct > 0.2 ? 0xf59e0b : 0xef4444);
            
            if (expectedDamage > 0) {
              const afterHp = Math.max(0, unit.hp - expectedDamage);
              const afterPct = Math.max(0, Math.min(1, afterHp / unit.maxHp));
              
              // 남게 될 체력 부분 (데미지로 깎인 후)
              g.beginFill(color);
              g.drawRect(ox + 1, oy + 1, (w - 2) * afterPct, h - 2);
              g.endFill();
            } else if (expectedDamage < 0) {
              // 현재 체력 (기존 체력 부분)
              g.beginFill(color);
              g.drawRect(ox + 1, oy + 1, (w - 2) * pct, h - 2);
              g.endFill();
            } else {
              g.beginFill(color);
              g.drawRect(ox + 1, oy + 1, (w - 2) * pct, h - 2);
              g.endFill();
            }
          }}
        />

        {/* 깎일 예정인 데미지 부분 (노란색 점등 효과 적용) */}
        {expectedDamage > 0 && (
          <Graphics
            ref={dmgBarRef}
            draw={(g) => {
              g.clear();
              const w = 24; const h = 4;
              const ox = -w / 2; const oy = -4;
              
              const pct = Math.max(0, Math.min(1, unit.hp / unit.maxHp));
              const afterHp = Math.max(0, unit.hp - expectedDamage);
              const afterPct = Math.max(0, Math.min(1, afterHp / unit.maxHp));
              const dmgPct = pct - afterPct;
              
              if (dmgPct > 0) {
                g.beginFill(0xffea00); // 밝은 노랑
                g.drawRect(ox + 1 + (w - 2) * afterPct, oy + 1, (w - 2) * dmgPct, h - 2);
                g.endFill();
              }
            }}
          />
        )}
        
        {/* 차오를 예정인 회복 부분 (형광 연두색 점등 효과 적용) */}
        {expectedDamage < 0 && (
          <Graphics
            ref={healBarRef}
            draw={(g) => {
              g.clear();
              const w = 24; const h = 4;
              const ox = -w / 2; const oy = -4;
              
              const pct = Math.max(0, Math.min(1, unit.hp / unit.maxHp));
              const afterHp = Math.min(unit.maxHp, unit.hp - expectedDamage); // expectedDamage가 음수
              const afterPct = Math.max(0, Math.min(1, afterHp / unit.maxHp));
              const healPct = afterPct - pct;
              
              if (healPct > 0) {
                g.beginFill(0x39ff14); // 형광 연두색
                g.drawRect(ox + 1 + (w - 2) * pct, oy + 1, (w - 2) * healPct, h - 2);
                g.endFill();
              }
            }}
          />
        )}

        <Text
          text={unit.id.substring(0, 4)}
          style={
            new PIXI.TextStyle({
              fontSize: 10,
              fill: isSelected ? 0x000000 : 0xffffff,
              fontWeight: 'bold',
            })
          }
          anchor={0.5}
          y={2}
          resolution={4}
        />

        {isActive && (
          <Text
            text="▼"
            style={new PIXI.TextStyle({ fontSize: 16, fill: 0xffff00, fontWeight: 'bold' })}
            anchor={0.5}
            y={-34}
            resolution={4}
          />
        )}
        {!isActive && turnIndex === 1 && (
          <Text
            text="next"
            style={new PIXI.TextStyle({ fontSize: 13, fill: '#ff4444', fontWeight: '900', stroke: '#ffffff', strokeThickness: 2 })}
            anchor={0.5}
            y={-34}
            resolution={4}
          />
        )}
        {!isActive && turnIndex > 1 && turnIndex <= 10 && (
          <Text
            text={turnIndex.toString()}
            style={new PIXI.TextStyle({ fontSize: 12, fill: '#ffffff', fontWeight: 'bold', stroke: '#000000', strokeThickness: 2 })}
            anchor={0.5}
            y={-34}
            resolution={4}
          />
        )}
        
        {/* 상성 (WEAK / RESIST) 렌더링 - 아이소메트릭 보정 컨테이너 내부이므로 정면으로 깨끗하게 렌더링됨 */}
        {(isWeak || isResist) && (
          <Text
            text={isWeak ? 'WEAK' : 'RESIST'}
            style={new PIXI.TextStyle({ 
              fontSize: 16, 
              fill: isWeak ? '#fca5a5' : '#9ca3af', 
              fontWeight: '900', 
              fontStyle: 'italic',
              stroke: '#000000', 
              strokeThickness: 3 
            })}
            anchor={0.5}
            y={-50}
            resolution={4}
          />
        )}
      </Container>
    </Container>
  );
}


export default function UnitsLayer() {
  const unitIds = useGameStore(useShallow(s =>
    Object.keys(s.units).filter(id => s.units[id].state !== 'DEAD')
  ));

  return (
    <>
      {unitIds.map(id => (
        <UnitSprite key={id} id={id} />
      ))}
    </>
  );
}
