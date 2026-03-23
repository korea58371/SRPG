import { useEffect, useRef } from 'react';
import { Container, Sprite, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useShallow } from 'zustand/react/shallow';
import { MAP_CONFIG, UNIT_CONFIG, FACTIONS } from '../constants/gameConfig';
import { useGameStore } from '../store/gameStore';

// 각 유닛별로 독립적인 제어를 통해 60FPS 렌더링 시 React 상태 업데이트 병목 회피
function UnitSprite({ id }: { id: string }) {
  const spriteRef = useRef<PIXI.Sprite>(null);
  // 초기 렌더링을 위한 좌표 캡처
  const isInitialized = useRef(false);

  useTick((delta) => {
    if (!spriteRef.current) return;
    
    // Zustand 스토어에서 최신 상태를 직구독 (React 렌더 사이클 우회)
    const unit = useGameStore.getState().units[id];
    if (!unit) return;

    const sprite = spriteRef.current;
    
    if (!isInitialized.current) {
      sprite.x = unit.x;
      sprite.y = unit.y;
      isInitialized.current = true;
    }
    
    const dx = unit.targetX - sprite.x;
    const dy = unit.targetY - sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // 목표 지점으로 직접 보간 이동 (논리 제어는 gameStore에서 지시)
    if (dist > unit.speed) {
      sprite.x += (dx / dist) * unit.speed * Number(delta);
      sprite.y += (dy / dist) * unit.speed * Number(delta);
    } else {
      sprite.x = unit.targetX;
      sprite.y = unit.targetY;
    }

    // Y-Sort 자동 정렬
    sprite.zIndex = sprite.y;
  });

  // 최초 렌더링용 정적 데이터 읽어오기 (색상, 크기 등 고정 데이터)
  const unitInitialState = useGameStore.getState().units[id];
  if (!unitInitialState) return null;

  const color = FACTIONS[unitInitialState.factionId].color;

  return (
    <Sprite
      ref={spriteRef}
      texture={PIXI.Texture.WHITE}
      tint={color}
      width={unitInitialState.isHero ? UNIT_CONFIG.SIZE_HERO.width : UNIT_CONFIG.SIZE_NORMAL.width}
      height={unitInitialState.isHero ? UNIT_CONFIG.SIZE_HERO.height : UNIT_CONFIG.SIZE_NORMAL.height}
      anchor={0.5}
      x={unitInitialState.x}
      y={unitInitialState.y}
      zIndex={unitInitialState.y}
    />
  );
}

export default function UnitsLayer() {
  const initUnits = useGameStore(state => state.initUnits);
  
  // 상태 변경 시 리렌더링 범위를 제한하기 위해 객체 key 배열만 구독 (무한 루프 방지를 위해 useShallow 사용)
  const unitIds = useGameStore(useShallow(state => Object.keys(state.units)));

  useEffect(() => {
    if (unitIds.length === 0) {
      initUnits(MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT);
    }
  }, [initUnits, unitIds.length]);

  useEffect(() => {
    if (unitIds.length === 0) return;
    
    // 2초마다 모든 랜덤 유닛의 논리적 목표 좌표를 Zustand로 업데이트하는 가상 AI 루프
    const interval = setInterval(() => {
      const updateFn = useGameStore.getState().updateUnitLogicalPosition;
      unitIds.forEach(id => {
        const lx = Math.floor(Math.random() * MAP_CONFIG.WIDTH);
        const ly = Math.floor(Math.random() * MAP_CONFIG.HEIGHT);
        updateFn(id, lx, ly);
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [unitIds.length]); // ID 배열 길이에 의존하여 최초 생성 시 1회만 바인딩

  return (
    // sortableChildren 활성화 시 하위 객체들의 zIndex 우선순위가 자동 재정렬 됨 (Y-Sort의 근간)
    <Container sortableChildren={true}>
      {unitIds.map(id => (
        <UnitSprite key={id} id={id} />
      ))}
    </Container>
  );
}
