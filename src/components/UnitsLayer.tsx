// J:/AI/Game/SRPG/src/components/UnitsLayer.tsx
// 턴제 SRPG 유닛 레이어:
// - IDLE 상태 유닛은 타일 중앙에 정적 배치
// - MOVING 상태 유닛은 movePath waypoint 순서로 보간 이동
// - hasActed=true 유닛은 반투명으로 표시 (행동 소모)
// - state='DEAD' 유닛은 렌더링하지 않음

import { useRef } from 'react';
import { Container, Sprite, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useShallow } from 'zustand/react/shallow';
import { UNIT_CONFIG, FACTIONS } from '../constants/gameConfig';
import { useGameStore, tileToPixel } from '../store/gameStore';

const MOVE_SPEED = 6; // 픽셀/프레임 보간 속도

function UnitSprite({ id }: { id: string }) {
  const spriteRef = useRef<PIXI.Sprite>(null);
  const waypointIndexRef = useRef(0);

  const unit          = useGameStore(s => s.units[id]);
  const selectedUnitId = useGameStore(s => s.selectedUnitId);
  const selectUnit    = useGameStore(s => s.selectUnit);

  useTick((delta) => {
    const sprite = spriteRef.current;
    if (!sprite) return;

    const u = useGameStore.getState().units[id];
    if (!u || u.state === 'IDLE' || u.state === 'DEAD') {
      if (u) { sprite.x = u.x; sprite.y = u.y; }
      waypointIndexRef.current = 0;
      return;
    }

    // ATTACKING: targetX/Y로 빠른 보간 (bump 연출)
    if (u.state === 'ATTACKING') {
      const dx = u.targetX - sprite.x;
      const dy = u.targetY - sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.5) {
        const ratio = Math.min(1, (MOVE_SPEED * 2.5 * delta) / dist);
        sprite.x += dx * ratio;
        sprite.y += dy * ratio;
      } else {
        sprite.x = u.targetX;
        sprite.y = u.targetY;
      }
      return;
    }

    const path = u.movePath;
    const wpIdx = waypointIndexRef.current;

    if (!path || path.length === 0 || wpIdx >= path.length) {
      // 경로 완료 → IDLE 복귀
      useGameStore.setState(s => ({
        units: {
          ...s.units,
          [id]: { ...s.units[id], state: 'IDLE', x: sprite!.x, y: sprite!.y, movePath: [] },
        },
      }));
      waypointIndexRef.current = 0;
      return;
    }

    const wp = path[wpIdx];
    const targetX = tileToPixel(wp.lx);
    const targetY = tileToPixel(wp.ly);
    const dx = targetX - sprite.x;
    const dy = targetY - sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= MOVE_SPEED * delta) {
      sprite.x = targetX;
      sprite.y = targetY;
      waypointIndexRef.current = wpIdx + 1;
    } else {
      const ratio = (MOVE_SPEED * delta) / dist;
      sprite.x += dx * ratio;
      sprite.y += dy * ratio;
    }
  });

  if (!unit || unit.state === 'DEAD') return null;

  const isSelected = selectedUnitId === id;
  const color = FACTIONS[unit.factionId].color;
  const alpha = unit.hasActed ? 0.4 : 1.0; // 행동 소모한 유닛은 반투명

  return (
    <Sprite
      ref={spriteRef}
      texture={PIXI.Texture.WHITE}
      tint={isSelected ? 0xffffff : color}
      alpha={alpha}
      width={UNIT_CONFIG.SIZE_NORMAL.width}
      height={UNIT_CONFIG.SIZE_NORMAL.height}
      anchor={0.5}
      x={unit.x}
      y={unit.y}
      zIndex={unit.y}
      eventMode="static"
      cursor={unit.hasActed && !useGameStore.getState().attackTargetMode ? 'default' : 'pointer'}
      onclick={() => {
        const state = useGameStore.getState();

        // ─ 공격 타겟 선택 모드: 적군 클릭 → 공격 실행
        if (state.attackTargetMode && state.confirmedDestination && state.selectedUnitId) {
          const clickedUnit = state.units[id];
          const attacker = state.units[state.selectedUnitId];
          if (!clickedUnit || !attacker) return;
          if (clickedUnit.factionId === attacker.factionId) return; // 아군 클릭 무시
          if (clickedUnit.state === 'DEAD') return;

          // 맨해튼 거리 검사: 이동 목적지 기준 공격 범위 내인지
          const dist = Math.abs(clickedUnit.logicalX - state.confirmedDestination.lx)
                     + Math.abs(clickedUnit.logicalY - state.confirmedDestination.ly);
          if (dist > attacker.attackRange) return;

          state.executeAttackOnTarget(id);
          return;
        }

        // ─ 일반 유닛 선택
        if (state.confirmedDestination) return; // 행동 메뉴 열려있으면 무시
        selectUnit(id);
      }}
    />
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
