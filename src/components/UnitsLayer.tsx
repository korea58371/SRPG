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
import { Container, Sprite, Text, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useShallow } from 'zustand/react/shallow';
import { MAP_CONFIG, FACTIONS, PLAYER_FACTION } from '../constants/gameConfig';
import { useGameStore, tileToPixel, getAttackableTargets } from '../store/gameStore';
import { getUnitTypeTexture } from '../utils/unitTextures';

const MOVE_SPEED = 6;
// W, H 변수는 더 이상 단위 픽셀 계산에 직접 쓰지 않으므로 주석 처리
// const W = UNIT_CONFIG.SIZE_NORMAL.width;
// const H = UNIT_CONFIG.SIZE_NORMAL.height;

function UnitSprite({ id }: { id: string }) {
  const containerRef    = useRef<PIXI.Container>(null);
  const waypointIndexRef = useRef(0);

  const unit           = useGameStore(s => s.units[id]);
  const selectedUnitId  = useGameStore(s => s.selectedUnitId);
  const confirmedDest   = useGameStore(s => s.confirmedDestination);
  const selectUnit      = useGameStore(s => s.selectUnit);
  const setHoveredUnit  = useGameStore(s => s.setHoveredUnitId);

  const isConfirmedTarget = selectedUnitId === id && confirmedDest !== null;
  const visualX = isConfirmedTarget && confirmedDest ? tileToPixel(confirmedDest.lx) : (unit?.x ?? 0);
  const visualY = isConfirmedTarget && confirmedDest ? tileToPixel(confirmedDest.ly) : (unit?.y ?? 0);

  useTick((delta) => {
    const ct = containerRef.current;
    if (!ct) return;

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
  const alpha = (unit.factionId === PLAYER_FACTION && !isActive && useGameStore.getState().activeUnitId !== null)
    ? 0.55  // 아군이지만 현재 행동권 없을 때 살짝 어둡게
    : 1.0;
  const iconTexture = getUnitTypeTexture(unit.unitType);

  // 선택된 유닛은 흰색 외곽선(배경을 흰색으로)
  const bgColor = isSelected ? 0xffffff : color;

  const hasActed  = unit.ct < 100;
  const attackMode = useGameStore(s => s.attackTargetMode);
  const activeUnit = useGameStore(s => s.activeUnitId ? s.units[s.activeUnitId] : null);
  const isTargetableEnemy = attackMode && activeUnit && unit.factionId !== activeUnit.factionId;

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
          />
        )}
        
        {/* 장수(GENERAL) 왕관 표시 */}
        {unit.unitType === 'GENERAL' && (
          <Text
            text="👑"
            style={new PIXI.TextStyle({ fontSize: 14 })}
            anchor={0.5}
            y={-24}
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
        />

        {isActive && (
          <Text
            text="▼"
            style={new PIXI.TextStyle({ fontSize: 16, fill: 0xffff00, fontWeight: 'bold' })}
            anchor={0.5}
            y={-34}
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
