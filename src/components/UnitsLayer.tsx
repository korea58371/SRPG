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
import { Container, Sprite, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useShallow } from 'zustand/react/shallow';
import { UNIT_CONFIG, FACTIONS } from '../constants/gameConfig';
import { useGameStore, tileToPixel } from '../store/gameStore';
import { getUnitTypeTexture } from '../utils/unitTextures';

const MOVE_SPEED = 6;
const W = UNIT_CONFIG.SIZE_NORMAL.width;
const H = UNIT_CONFIG.SIZE_NORMAL.height;

function UnitSprite({ id }: { id: string }) {
  const containerRef    = useRef<PIXI.Container>(null);
  const waypointIndexRef = useRef(0);

  const unit           = useGameStore(s => s.units[id]);
  const selectedUnitId  = useGameStore(s => s.selectedUnitId);
  const selectUnit      = useGameStore(s => s.selectUnit);
  const setHoveredUnit  = useGameStore(s => s.setHoveredUnitId);

  useTick((delta) => {
    const ct = containerRef.current;
    if (!ct) return;

    const u = useGameStore.getState().units[id];
    if (!u || u.state === 'IDLE' || u.state === 'DEAD') {
      if (u) { ct.x = u.x; ct.y = u.y; }
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
      waypointIndexRef.current = wpIdx + 1;
    } else {
      ct.x += dx * (MOVE_SPEED * delta) / dist;
      ct.y += dy * (MOVE_SPEED * delta) / dist;
    }
  });

  if (!unit || unit.state === 'DEAD') return null;

  const isSelected = selectedUnitId === id;
  const color = FACTIONS[unit.factionId].color;
  const alpha = unit.hasActed ? 0.4 : 1.0;
  const iconTexture = getUnitTypeTexture(unit.unitType);

  // 선택된 유닛은 흰색 외곽선(배경을 흰색으로)
  const bgColor = isSelected ? 0xffffff : color;

  return (
    <Container
      ref={containerRef}
      x={unit.x}
      y={unit.y}
      alpha={alpha}
      zIndex={unit.y}
      eventMode="static"
      cursor={unit.hasActed && !useGameStore.getState().attackTargetMode ? 'default' : 'pointer'}
      onpointerenter={() => setHoveredUnit(id)}
      onpointerleave={() => setHoveredUnit(null)}
      onclick={() => {
        const state = useGameStore.getState();

        if (state.attackTargetMode && state.confirmedDestination && state.selectedUnitId) {
          const clickedUnit = state.units[id];
          const attacker = state.units[state.selectedUnitId];
          if (!clickedUnit || !attacker) return;
          if (clickedUnit.factionId === attacker.factionId) return;
          if (clickedUnit.state === 'DEAD') return;
          const dist = Math.abs(clickedUnit.logicalX - state.confirmedDestination.lx)
                     + Math.abs(clickedUnit.logicalY - state.confirmedDestination.ly);
          if (dist > attacker.attackRange) return;
          state.executeAttackOnTarget(id);
          return;
        }

        // ─ 일반 유닛 선택 / 제자리 행동
        if (state.confirmedDestination) return;

        if (state.selectedUnitId === id) {
          // 이미 선택된 유닛 재클릭 → 제자리 행동 메뉴
          const u = state.units[id];
          if (u && !u.hasActed) state.confirmMove(u.logicalX, u.logicalY);
          return;
        }
        selectUnit(id);
      }}
    >
      {/* 배경 사각형 (세력 색상) */}
      <Sprite
        texture={PIXI.Texture.WHITE}
        tint={bgColor}
        width={W}
        height={H}
        anchor={0.5}
      />

      {/* 선택 시 내부 색 표시 (흰 배경에 세력색 작은 사각형) */}
      {isSelected && (
        <Sprite
          texture={PIXI.Texture.WHITE}
          tint={color}
          width={W - 4}
          height={H - 4}
          anchor={0.5}
        />
      )}

      {/* 병종 아이콘 (이모지) */}
      <Sprite
        texture={iconTexture}
        width={W * 0.75}
        height={H * 0.75}
        anchor={0.5}
        y={-2}
      />
    </Container>
  );
}

export default function UnitsLayer() {
  const unitIds = useGameStore(useShallow(s =>
    Object.keys(s.units).filter(id => s.units[id].state !== 'DEAD')
  ));

  return (
    <Container sortableChildren={true}>
      {unitIds.map(id => (
        <UnitSprite key={id} id={id} />
      ))}
    </Container>
  );
}
