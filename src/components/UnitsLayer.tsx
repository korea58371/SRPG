// J:/AI/Game/SRPG/src/components/UnitsLayer.tsx
// 유닛 토큰 UI - 개선된 버전
//
// 구조:
//   ┌─────────────────────────────────┐
//   │[순서번호]  ← 전체 유닛 / 뒤로 갈수록 투명 │
//   │     ▼     ← isActive 인디케이터             │
//   │  ┌──────┐ ← 마름모 포트레이트 프레임         │
//   │[🗡]     │   + 세력 컬러 테두리               │
//   │  └──────┘                                 │
//   │  [HP 눈금바] ← 1눈금=1만 병력, LoL 스타일  │
//   └─────────────────────────────────┘
//
// 이동 상태별 처리:
//   IDLE     → container.x/y = unit.x/y (고정)
//   MOVING   → movePath waypoint 순차 보간
//   ATTACKING→ targetX/Y 향해 빠른 보간 (bump 연출)
//   DEAD     → 미렌더링

import { useRef, useState, useEffect } from 'react';
import { Container, Sprite, Text, Graphics, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useShallow } from 'zustand/react/shallow';
import { MAP_CONFIG, FACTIONS, PLAYER_FACTION, UNIT_RESISTANCES } from '../constants/gameConfig';
import { useGameStore, tileToPixel, getAttackableTargets } from '../store/gameStore';
import { getUnitTypeTexture, getPortraitFallbackTexture } from '../utils/unitTextures';
import { getCharacterImageUrl } from '../utils/characterAssets';
import { getTurnOrder } from '../store/slices/turnSystemSlice';
import { MOCK_SKILLS, getAoETiles, getManhattanDist } from '../utils/skillTargeting';
import { getEffectiveStat } from '../engine/statEngine';


const MOVE_SPEED = 6;

// ─── 레이아웃 상수 ────────────────────────────────────────────────────────
// 아이소메트릭 역변환 컨테이너(rotation=-45°, scaleX=0.5) 안에서 렌더링.
// 로지컬 좌표의 W×H 직사각형 → 화면에서 마름모로 자동 변환됨.
const TOKEN_W = MAP_CONFIG.TILE_SIZE * 0.85; // 토큰 가로 (로지컬)
const TOKEN_H = TOKEN_W;                     // 포트레이트 1:1 비율
const BORDER_THICKNESS = 2;                  // 세력 컬러 테두리 두께
const HP_BAR_W = TOKEN_W * 1.0;             // HP 바가 토큰과 같은 너비
const HP_BAR_H = 4;                          // HP 바 높이
const TICK_UNIT = 10000;                     // 1눈금 = 1만 병력
const BADGE_SIZE = 10;                       // 병종 아이콘 배지 크기

// ─── 눈금 HP 바 드로어 ───────────────────────────────────────────────────
function drawTickedHPBar(
  g: PIXI.Graphics,
  unit: { hp: number; maxHp: number; factionId: string },
  expectedDamage: number,
) {
  g.clear();
  const ticks = Math.max(1, unit.maxHp / TICK_UNIT); // 전체 눈금 수
  const pct = Math.max(0, Math.min(1, unit.hp / unit.maxHp));
  const filledW = HP_BAR_W * pct;
  const segW = HP_BAR_W / ticks;
  const ox = -HP_BAR_W / 2;
  const oy = 0;
  const isEnemy = unit.factionId !== PLAYER_FACTION;

  // 배경
  g.beginFill(0x111111, 0.85);
  g.drawRect(ox, oy, HP_BAR_W, HP_BAR_H);
  g.endFill();

  // 예상 데미지 미리보기 (노란색, 먼저 그림)
  if (expectedDamage > 0) {
    const afterPct = Math.max(0, Math.min(1, (unit.hp - expectedDamage) / unit.maxHp));
    const afterW = HP_BAR_W * afterPct;
    // 체력 유실 구간을 노란색으로
    if (pct > afterPct) {
      g.beginFill(0xffdd00, 0.9);
      g.drawRect(ox + afterW, oy, filledW - afterW, HP_BAR_H);
      g.endFill();
    }
  } else if (expectedDamage < 0) {
    // 회복 미리보기 (형광 연두)
    const afterPct = Math.max(0, Math.min(1, (unit.hp - expectedDamage) / unit.maxHp)); // expectedDamage 음수
    const afterW = HP_BAR_W * afterPct;
    g.beginFill(0x39ff14, 0.9);
    g.drawRect(ox + filledW, oy, afterW - filledW, HP_BAR_H);
    g.endFill();
  }

  // 현재 HP 채색
  const displayPct = expectedDamage > 0
    ? Math.max(0, Math.min(1, (unit.hp - expectedDamage) / unit.maxHp))
    : pct;
  const displayW = HP_BAR_W * displayPct;

  const hpColor = isEnemy
    ? 0xef4444
    : (pct > 0.5 ? 0x22c55e : pct > 0.25 ? 0xf59e0b : 0xef4444);
  g.beginFill(hpColor);
  g.drawRect(ox, oy, displayW, HP_BAR_H);
  g.endFill();

  // 눈금 구분선 (tick marks)
  const fullTicks = Math.floor(ticks);
  g.lineStyle(1, 0x000000, 0.55);
  for (let i = 1; i <= fullTicks; i++) {
    const lineX = ox + segW * i;
    if (lineX >= ox && lineX <= ox + HP_BAR_W - 1) {
      g.moveTo(lineX, oy);
      g.lineTo(lineX, oy + HP_BAR_H);
    }
  }
  g.lineStyle(0);

  // 외곽선
  g.lineStyle(0.5, 0x000000, 0.6);
  g.drawRect(ox, oy, HP_BAR_W, HP_BAR_H);
  g.lineStyle(0);
}

// ─── 메인 유닛 스프라이트 컴포넌트 ──────────────────────────────────────
export function UnitSprite({ id }: { id: string }) {
  const containerRef     = useRef<PIXI.Container>(null);
  const hpBarRef         = useRef<PIXI.Graphics>(null);
  const waypointIndexRef = useRef(0);

  const unit            = useGameStore(s => s.units[id]);
  const allUnits        = useGameStore(useShallow(s => s.units));
  const turnIndex       = useGameStore(s => getTurnOrder(s.units).indexOf(id));
  const totalUnits      = useGameStore(useShallow(s => Object.keys(s.units).filter(uid => s.units[uid].state !== 'DEAD').length));
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

    const u = useGameStore.getState().units[id];
    if (!u || u.state === 'IDLE' || u.state === 'DEAD') {
      if (u) {
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

    // KNOCKBACK: push/pull 강제 이동
    if (u.state === 'KNOCKBACK') {
      const dx = u.targetX - ct.x;
      const dy = u.targetY - ct.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.5) {
        const ratio = Math.min(1, (MOVE_SPEED * 3.5 * delta) / dist);
        ct.x += dx * ratio;
        ct.y += dy * ratio;
      } else {
        ct.x = u.targetX;
        ct.y = u.targetY;
        useGameStore.setState(s => ({
          units: { ...s.units, [id]: { ...s.units[id], state: 'IDLE', x: ct.x, y: ct.y } },
        }));
      }
      return;
    }

    // MOVING: waypoint 순차 이동
    const path = u.movePath;
    const wpIdx = waypointIndexRef.current;

    if (!path || path.length === 0 || wpIdx >= path.length) {
      useGameStore.setState(s => ({
        units: { ...s.units, [id]: { ...s.units[id], state: 'IDLE', x: ct.x, y: ct.y, movePath: [] } },
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
  const factionColor = FACTIONS[unit.factionId]?.color ?? 0xaaaaaa;
  const isActive  = useGameStore(s => s.activeUnitId) === id;
  const hasActed  = unit.hasActed;
  const iconTexture = getUnitTypeTexture(unit.unitType);

  // ─── 포트레이트 텍스처 결정 ──────────────────────────────────────────
  // characterId가 있으면 영웅 이미지 URL 시도, 없으면 폴백 아바타
  const [portraitTexture, setPortraitTexture] = useState<PIXI.Texture>(() =>
    getPortraitFallbackTexture(`${id}-${unit.factionId}`, factionColor, unit.id.slice(0, 2))
  );

  useEffect(() => {
    if (!unit.characterId) return;
    const url = getCharacterImageUrl(unit.characterId, 'token');
    const tex = PIXI.Texture.from(url);
    if (tex.valid) {
      setPortraitTexture(tex);
    } else {
      tex.baseTexture.on('loaded', () => setPortraitTexture(tex));
      tex.baseTexture.on('error', () => {
        // URL 로드 실패 → 폴백 유지
      });
    }
  }, [unit.characterId, id, unit.factionId, factionColor]);

  // 테두리 색상: 선택된 경우 흰색, 행동완료면 회색, 기본은 세력 컬러
  const borderColor = isSelected ? 0xffffff : (hasActed && !isActive ? 0x444444 : factionColor);
  const dimmed = hasActed && !isActive;

  const attackMode = useGameStore(s => s.attackTargetMode);
  const activeUnit = useGameStore(s => s.activeUnitId ? s.units[s.activeUnitId] : null);
  const isTargetableEnemy = attackMode && activeUnit && unit.factionId !== activeUnit.factionId;

  // ─── 예상 데미지 계산 ───────────────────────────────────────────────────
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
          else if (skill.targetType === 'empty' && isEnemy) validTarget = true;

          if (validTarget) {
            const dmgEffect = skill.effects.find(e => e.type === 'damage');
            if (dmgEffect) {
              const attackElement = dmgEffect.element || 'none';
              const resistMap = UNIT_RESISTANCES[unit.unitType];
              const elementalMult = (resistMap && attackElement in resistMap)
                ? (resistMap[attackElement as keyof typeof resistMap] || 1.0)
                : 1.0;
              isResist = elementalMult < 1.0;
              isWeak   = elementalMult > 1.0;

              const atk = getEffectiveStat(activeUnit, 'attack');
              const def = getEffectiveStat(unit, 'defense');
              expectedDamage = Math.round(Math.max(1, (atk * (dmgEffect.value || 1) * elementalMult) - (def * 0.5)));
            } else if (skill.effects.some(e => e.type === 'heal')) {
              const healEffect = skill.effects.find(e => e.type === 'heal')!;
              const atkOrInt = activeUnit.generalIntelligence
                ? (activeUnit.generalIntelligence * 10)
                : getEffectiveStat(activeUnit, 'attack');
              expectedDamage = -Math.round(Math.max(1, atkOrInt * (healEffect.value || 1)));
            }
          }
        }
      }
    }
  } else if (attackMode && activeUnit && hoveredMapTile && isTargetableEnemy) {
    if (unit.logicalX === hoveredMapTile.lx && unit.logicalY === hoveredMapTile.ly) {
      const dest = confirmedDest || { lx: activeUnit.logicalX, ly: activeUnit.logicalY };
      const validTargets = getAttackableTargets(activeUnit, allUnits, dest.lx, dest.ly);
      if (validTargets.some(t => t.id === id)) {
        const atk = getEffectiveStat(activeUnit, 'attack');
        const def = getEffectiveStat(unit, 'defense');
        expectedDamage = Math.round(Math.max(1, atk - (def * 0.5)));
      }
    }
  }

  let cursorType = 'default';
  if (isActive && !hasActed) cursorType = 'pointer';
  else if (isTargetableEnemy) cursorType = 'crosshair';

  // ─── 턴 순서 투명도 계산 (0-based index) ──────────────────────────────
  // turnIndex: 현재 유닛의 이번 라운드 행동 순서
  // 뒤로 갈수록 점점 투명해짐
  const turnAlpha = turnIndex < 0
    ? 0.1
    : Math.max(0.12, 1.0 - (turnIndex / Math.max(1, totalUnits)) * 0.88);

  // ─── 클릭 핸들러 ───────────────────────────────────────────────────────
  const handlePointerDown = (e: PIXI.FederatedPointerEvent) => {
    if (e.button === 2) return;
    const state = useGameStore.getState();
    const clickedUnit = state.units[id];
    if (!clickedUnit) return;

    const isAlly = clickedUnit.factionId === PLAYER_FACTION;
    const isEnemyUnit = !isAlly;

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

    if (state.confirmedDestination) return;
    if (isEnemyUnit) return;

    e.stopPropagation();
    if (state.selectedUnitId === id) {
      const u = state.units[id];
      if (u && state.activeUnitId === id) state.confirmMove(u.logicalX, u.logicalY);
      return;
    }
    selectUnit(id);
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
      alpha={1.0}
      zIndex={visualY}
      eventMode="static"
      hitArea={null as unknown as PIXI.IHitArea}
    >
      {/*
        아이소메트릭 역변환 컨테이너:
        rotation=-45°, scaleX=0.5 → 내부의 직사각형이 화면에서 마름모로 보임
      */}
      <Container rotation={-Math.PI / 4} scale={{ x: 0.5, y: 1.0 }}>

        {/* ── 세력 컬러 테두리 (마름모 외곽, 선 굵기=BORDER_THICKNESS) ── */}
        <Graphics
          draw={(g) => {
            g.clear();
            g.lineStyle(BORDER_THICKNESS + (isSelected ? 1.5 : 0), borderColor, isSelected ? 1.0 : 0.9);
            g.beginFill(0x1a1a2e, 0.15); // 아주 살짝 어두운 반투명 배경
            g.drawRect(-TOKEN_W / 2, -TOKEN_H, TOKEN_W, TOKEN_H);
            g.endFill();
          }}
        />

        {/* ── 포트레이트 이미지 (마름모 안쪽 채움) ── */}
        <Sprite
          texture={portraitTexture}
          width={TOKEN_W - BORDER_THICKNESS * 2}
          height={TOKEN_H - BORDER_THICKNESS * 2}
          anchor={{ x: 0.5, y: 1.0 }}
          y={-BORDER_THICKNESS}
          alpha={dimmed ? 0.45 : 1.0}
          eventMode="static"
          cursor={cursorType}
          onpointerenter={() => {
            const store = useGameStore.getState();
            if (store.fieldMenuPos || store.unitListModalOpen) return;
            setHoveredUnit(id);
          }}
          onpointerleave={() => setHoveredUnit(null)}
          onpointerdown={(e) => {
            const store = useGameStore.getState();
            if (store.fieldMenuPos || store.unitListModalOpen) return;
            handlePointerDown(e);
          }}
        />

        {/* ── 행동 완료 dimming 오버레이 ── */}
        {dimmed && (
          <Graphics
            draw={(g) => {
              g.clear();
              g.beginFill(0x000000, 0.38);
              g.drawRect(-TOKEN_W / 2, -TOKEN_H, TOKEN_W, TOKEN_H);
              g.endFill();
            }}
          />
        )}

        {/* ── 병종 아이콘 배지 (HP바 기준 좌상단) ── */}
        {iconTexture && (
          <Container
            x={-HP_BAR_W / 2}
            y={-(BADGE_SIZE + 3)}
          >
            {/* 배지 배경 */}
            <Graphics
              draw={(g) => {
                g.clear();
                g.beginFill(0x111111, 0.82);
                g.drawRect(0, 0, BADGE_SIZE + 2, BADGE_SIZE + 2);
                g.endFill();
                g.lineStyle(0.8, borderColor, 0.8);
                g.drawRect(0, 0, BADGE_SIZE + 2, BADGE_SIZE + 2);
                g.lineStyle(0);
              }}
            />
            {/* 병종 아이콘 */}
            <Sprite
              texture={iconTexture}
              width={BADGE_SIZE}
              height={BADGE_SIZE}
              anchor={0}
              x={1}
              y={1}
              tint={dimmed ? 0x666666 : 0xffffff}
            />
          </Container>
        )}

        {/* ── 장수(GENERAL) 왕관 배지 ── */}
        {unit.unitType === 'GENERAL' && (
          <Text
            text="👑"
            style={new PIXI.TextStyle({ fontSize: 10 })}
            anchor={{ x: 1, y: 0 }}
            x={TOKEN_W / 2 - 1}
            y={-TOKEN_H + 2}
            resolution={4}
          />
        )}

        {/* ── 턴 순서 번호 (전체 유닛, 뒤로 갈수록 투명) ── */}
        {turnIndex >= 0 && (
          <Text
            text={isActive ? '▼' : String(turnIndex + 1)}
            style={new PIXI.TextStyle({
              fontSize: isActive ? 14 : 11,
              fill: isActive ? '#ffee00' : '#ffffff',
              fontWeight: 'bold',
              stroke: '#000000',
              strokeThickness: isActive ? 3 : 2,
            })}
            anchor={0.5}
            x={0}
            y={-TOKEN_H - (isActive ? 10 : 8)}
            alpha={isActive ? 1.0 : turnAlpha}
            resolution={4}
          />
        )}

        {/* ── 아군 오폭(Friendly Fire) 경고 ── */}
        {expectedDamage > 0 && unit.factionId === PLAYER_FACTION && (
          <Text
            text="⚠️"
            style={new PIXI.TextStyle({ fontSize: 16 })}
            anchor={0.5}
            x={TOKEN_W / 2 - 2}
            y={-TOKEN_H / 2}
            resolution={4}
          />
        )}

        {/* ── 치명타(Lethal) 예고 아이콘 ── */}
        {expectedDamage >= unit.hp && unit.factionId !== PLAYER_FACTION && (
          <Text
            text="💀"
            style={new PIXI.TextStyle({ fontSize: 16 })}
            anchor={0.5}
            x={TOKEN_W / 2 - 2}
            y={-TOKEN_H / 2}
            resolution={4}
          />
        )}

        {/* ── 상성 표시 (WEAK / RESIST) ── */}
        {(isWeak || isResist) && (
          <Text
            text={isWeak ? 'WEAK' : 'RESIST'}
            style={new PIXI.TextStyle({
              fontSize: 12,
              fill: isWeak ? '#fca5a5' : '#9ca3af',
              fontWeight: '900',
              fontStyle: 'italic',
              stroke: '#000000',
              strokeThickness: 2,
            })}
            anchor={0.5}
            x={0}
            y={-TOKEN_H - 20}
            resolution={4}
          />
        )}

        {/* ── HP 눈금 바 (하단) ── */}
        <Graphics
          ref={hpBarRef}
          draw={(g) => drawTickedHPBar(g, unit, expectedDamage)}
          x={0}
          y={2}
        />

      </Container>
    </Container>
  );
}

// ─── 말풍선 앵커 동기화 컴포넌트 (PixiJS useTick 기반) ──────────────────────
// 대화가 활성화된 동안 발화 유닛의 현재 화면 픽셀 좌표를 매 프레임 추적하여
// dialogueSlice.setBubbleAnchor에 반영합니다.
function BubbleAnchorSync() {
  const activeDialogue  = useGameStore(s => s.activeDialogue);
  const setBubbleAnchor = useGameStore(s => s.setBubbleAnchor);

  useTick(() => {
    if (!activeDialogue) return;

    const state = useGameStore.getState();
    const speakerId = state.activeDialogue?.lines[state.currentLineIndex]?.speakerId;
    if (!speakerId || speakerId === 'NARRATOR') return;

    // speakerId는 characterId이므로 유닛 중 characterId 매칭 검색
    const unit = Object.values(state.units).find(
      u => u.characterId === speakerId && u.state !== 'DEAD'
    );
    if (!unit) return;

    // 유닛 현재 화면 위치 추적 (logicalX/Y 기준 → 픽셀)
    // - 주의: 여기서 Y축을 직접 빼면 PIXI 컨테이너의 (1,0.5) 스케일 및 45도 회전을 거치면서 우상단 평행이동으로 왜곡됨.
    // 좌표 자체(Tile Base 기준)는 그대로 넘기고 UI Layer에서 스크린 Y 좌표를 빼줘야 올바르게 수직 상승함.
    const screenX = unit.x;
    const screenY = unit.y;

    // 이전 앵커와 같으면 업데이트 스킵 (불필요한 리렌더 방지)
    const prevAnchor = state.bubbleAnchor;
    if (prevAnchor && Math.abs(prevAnchor.x - screenX) < 1 && Math.abs(prevAnchor.y - screenY) < 1) return;

    setBubbleAnchor({ x: screenX, y: screenY });
  });

  return null;
}

export default function UnitsLayer() {
  const unitIds = useGameStore(useShallow(s =>
    Object.keys(s.units).filter(id => s.units[id].state !== 'DEAD')
  ));

  return (
    <>
      <BubbleAnchorSync />
      {unitIds.map(id => (
        <UnitSprite key={id} id={id} />
      ))}
    </>
  );
}
