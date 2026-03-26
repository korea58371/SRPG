import type { TilePos, AoEShape, TargetType, Skill, Unit, TerrainType } from '../types/gameTypes';
import { TERRAIN_BONUS } from '../constants/gameConfig';

// 개발을 위한 임시 스킬 픽스처
export const MOCK_SKILLS: Record<string, Skill> = {
  'mock-single': { id: 'mock-single', name: '정밀 타격', description: '[t:단일 대상]에게 [v:200%]의 [a:치명적인 타격 피해]를 입힙니다.', range: 1, aoeShape: 'single', aoeRadius: 0, targetType: 'enemy', requiresTarget: true, cost: [{type: 'mp', amount: 5}], effects: [{type: 'damage', value: 2.0, element: 'strike'}] },
  'mock-cross': { id: 'mock-cross', name: '십자 격파', description: '[t:십자 범위 내 적들]에게 [v:150%]의 [a:타격 피해]를 입힙니다.', range: 3, aoeShape: 'cross', aoeRadius: 1, targetType: 'enemy', requiresTarget: true, cost: [{type: 'mp', amount: 10}], effects: [{type: 'damage', value: 1.5, element: 'strike'}] },
  'mock-cone': { id: 'mock-cone', name: '화염 방사', description: '[t:부채꼴 범위 내 적들]에게 [v:200%]의 [a:화염 타격 피해]를 입힙니다.', range: 3, aoeShape: 'cone', aoeRadius: 2, targetType: 'enemy', requiresTarget: true, cost: [{type: 'mp', amount: 20}], effects: [{type: 'damage', value: 2.0, element: 'fire'}] },
  'mock-radius': { id: 'mock-radius', name: '대지 폭발', description: '[t:반경 내 모든 대상]에게 [v:250%]의 [a:대지 폭발 피해]를 입힙니다. [a:(아군 오폭 주의)]', range: 4, aoeShape: 'radius', aoeRadius: 2, targetType: 'any', requiresTarget: true, cost: [{type: 'mp', amount: 30}], effects: [{type: 'damage', value: 2.5, element: 'earth'}] },
  'mock-nova': { id: 'mock-nova', name: '지진파', description: '[t:반경 내 적군]에게만 [v:220%]의 [a:지진파 피해]를 입힙니다.', range: 4, aoeShape: 'radius', aoeRadius: 2, targetType: 'enemy', requiresTarget: true, cost: [{type: 'mp', amount: 35}], effects: [{type: 'damage', value: 2.2, element: 'earth'}] },
  'mock-line': { id: 'mock-line', name: '관통의 창', description: '[t:직선상 적군을 관통]하여 [v:300%]의 [a:강력한 찌르기 피해]를 입힙니다.', range: 5, aoeShape: 'line', aoeRadius: 4, targetType: 'enemy', requiresTarget: true, cost: [{type: 'rage', amount: 50}], effects: [{type: 'damage', value: 3.0, element: 'pierce'}] },
  'mock-push': { id: 'mock-push', name: '방패 밀치기', description: '[t:단일 대상]에게 [v:50%]의 [a:타격 피해]를 주고 [v:2칸 넉백]시킵니다.', range: 1, aoeShape: 'single', aoeRadius: 0, targetType: 'enemy', requiresTarget: true, cost: [{type: 'mp', amount: 0}], effects: [{type: 'push', value: 2}, {type: 'damage', value: 0.5, element: 'strike'}] },
  'mock-pull': { id: 'mock-pull', name: '사슬 낚아채기', description: '[t:십자 범위 내 적들]에게 [v:20%]의 [a:약한 피해]를 주고 [v:2칸 끌어당깁니다].', range: 4, aoeShape: 'cross', aoeRadius: 1, targetType: 'enemy', requiresTarget: true, cost: [{type: 'mp', amount: 0}], effects: [{type: 'pull', value: 2}, {type: 'damage', value: 0.2, element: 'slash'}] },
  'mock-teleport-react': { id: 'mock-teleport-react', name: '그림자 도약', description: '[t:지정한 빈 위치]로 [a:즉시 도약]한 뒤, [v:행동권을 1회 추가]로 얻습니다.', range: 10, aoeShape: 'single', aoeRadius: 0, targetType: 'empty', requiresTarget: true, cost: [{type: 'mp', amount: 20}], effects: [{type: 'teleport', value: 0}], grantsReAction: true },
  'mock-dash-attack': { id: 'mock-dash-attack', name: '섬광 찌르기', description: '[t:지정한 빈 위치]까지 [a:관통 돌진]하며 궤적 상 모든 적에게 [v:200%]의 [a:타격 피해]를 입힙니다.', range: 5, aoeShape: 'line_to_target', aoeRadius: 5, targetType: 'empty', requiresTarget: true, cost: [{type: 'mp', amount: 30}, {type: 'rage', amount: 15}], effects: [{type: 'damage', value: 2.0, element: 'pierce'}, {type: 'dash_to_target', value: 0}] },
  'mock-heal': { id: 'mock-heal', name: '치유의 빛', description: '[t:단일 아군]의 HP를 시전자 지력의 [v:250%]만큼 [a:회복]시킵니다.', range: 3, aoeShape: 'single', aoeRadius: 0, targetType: 'ally', requiresTarget: true, cost: [{type: 'mp', amount: 15}], effects: [{type: 'heal', value: 2.5}] },
  'mock-aoe-heal': { id: 'mock-aoe-heal', name: '신성한 세례', description: '[t:반경 내 아군]들의 HP를 시전자 지력의 [v:150%]만큼 [a:회복]시킵니다.', range: 4, aoeShape: 'radius', aoeRadius: 1, targetType: 'ally', requiresTarget: true, cost: [{type: 'mp', amount: 30}], effects: [{type: 'heal', value: 1.5}] },
  'mock-buff-atk': { id: 'mock-buff-atk', name: '전장의 함성', description: '[t:3x3 십자 아군]에게 [v:3턴] 동안 공격력이 [v:30%] 증가하는 [a:공격력 강화]를 부여합니다.', range: 0, aoeShape: 'cross', aoeRadius: 1, targetType: 'ally', requiresTarget: false, cost: [{type: 'rage', amount: 20}], effects: [{type: 'buff', buffType: 'atk_up', value: 30, duration: 4}] },
  'mock-debuff-def': { id: 'mock-debuff-def', name: '장갑 파괴', description: '[t:단일 적군]에게 [v:50%]의 [a:관통 피해]를 주고 [v:2턴] 간 방어력을 [v:50%] 감소시킵니다.', range: 2, aoeShape: 'single', aoeRadius: 0, targetType: 'enemy', requiresTarget: true, cost: [{type: 'mp', amount: 15}], effects: [{type: 'damage', value: 0.5, element: 'pierce'}, {type: 'debuff', buffType: 'def_down', value: 50, duration: 3}] },
  'mock-poison': { id: 'mock-poison', name: '맹독 찌르기', description: '[t:단일 적군]에게 [v:100%]의 [a:물리 피해]를 주고 매턴 [v:10의 피해]를 입는 [a:맹독]을 [v:3턴] 간 부여합니다.', range: 1, aoeShape: 'single', aoeRadius: 0, targetType: 'enemy', requiresTarget: true, cost: [{type: 'mp', amount: 15}], effects: [{type: 'damage', value: 1.0, element: 'pierce'}, {type: 'debuff', buffType: 'poison', value: 10, duration: 4}] },
  'mock-regen': { id: 'mock-regen', name: '재생의 소나기', description: '[t:십자 범위 내 아군]들에게 매턴 [v:15의 HP]를 회복하는 [a:재생]을 [v:3턴] 간 부여합니다.', range: 3, aoeShape: 'cross', aoeRadius: 1, targetType: 'ally', requiresTarget: true, cost: [{type: 'mp', amount: 25}], effects: [{type: 'buff', buffType: 'regen', value: 15, duration: 4}] },
};

// Manhattan 거리를 구합니다.
export const getManhattanDist = (ax: number, ay: number, bx: number, by: number) =>
  Math.abs(ax - bx) + Math.abs(ay - by);

// 체비셰프 거리를 구합니다 (대각선 1칸 취급).
export const getChebyshevDist = (ax: number, ay: number, bx: number, by: number) =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/**
 * 특정 기준점(center)에서 지정된 형태(AoEShape)와 반경(radius)에 해당하는 타일 좌표 목록을 반환합니다.
 * 방향성(Line, Cone 등)이 필요한 스킬의 경우 시전자의 위치(caster)를 활용하여 뻗어나갈 방향을 결정합니다.
 */
export function getAoETiles(
  caster: TilePos,
  target: TilePos,
  shape: AoEShape,
  radius: number,
  mapWidth: number,
  mapHeight: number
): TilePos[] {
  const tiles: TilePos[] = [];
  const cx = target.lx;
  const cy = target.ly;

  const addTile = (x: number, y: number) => {
    if (x >= 0 && x < mapWidth && y >= 0 && y < mapHeight) {
      tiles.push({ lx: x, ly: y });
    }
  };

  switch (shape) {
    case 'single':
      addTile(cx, cy);
      break;
    case 'cross':
      addTile(cx, cy);
      for (let i = 1; i <= radius; i++) {
        addTile(cx + i, cy);
        addTile(cx - i, cy);
        addTile(cx, cy + i);
        addTile(cx, cy - i);
      }
      break;
    case 'diagonal':
      addTile(cx, cy);
      for (let i = 1; i <= radius; i++) {
        addTile(cx + i, cy + i);
        addTile(cx - i, cy - i);
        addTile(cx + i, cy - i);
        addTile(cx - i, cy + i);
      }
      break;
    case 'radius':
      // 지정한 1칸을 중심으로 반경(Manhattan) radius 만큼의 다이아몬드형 범위
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) + Math.abs(dy) <= radius) {
            addTile(cx + dx, cy + dy);
          }
        }
      }
      break;
    case 'donut':
      // 자신(중심)을 제외한 radius 범위
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const dist = Math.abs(dx) + Math.abs(dy);
          if (dist > 0 && dist <= radius) {
            addTile(cx + dx, cy + dy);
          }
        }
      }
      break;
    case 'line_to_target': {
      // caster에서 target까지의 직선 경로 (체비셰프 거리 기준) 타일 모두 포함
      const dist = Math.max(Math.abs(target.lx - caster.lx), Math.abs(target.ly - caster.ly));
      let dx = Math.sign(target.lx - caster.lx);
      let dy = Math.sign(target.ly - caster.ly);
      if (dx === 0 && dy === 0) { dx = 1; dy = 0; }
      for (let i = 1; i <= dist; i++) {
        addTile(caster.lx + dx * i, caster.ly + dy * i);
      }
      break;
    }
    case 'line':
      // 시전자로부터 타겟을 향한 직선 (가장 큰 diff 방향 기준)
      const dxL = target.lx - caster.lx;
      const dyL = target.ly - caster.ly;
      if (Math.abs(dxL) >= Math.abs(dyL)) { // X축 방향
        const signX = dxL >= 0 ? 1 : -1;
        for (let i = 0; i <= radius; i++) addTile(caster.lx + signX * i, caster.ly);
      } else { // Y축 방향
        const signY = dyL >= 0 ? 1 : -1;
        for (let i = 0; i <= radius; i++) addTile(caster.lx, caster.ly + signY * i);
      }
      break;
    case 'cone':
      // 시전자로부터 타겟을 향한 부채꼴
      const dxC = target.lx - caster.lx;
      const dyC = target.ly - caster.ly;
      if (Math.abs(dxC) >= Math.abs(dyC)) { // X 방향 메인
        const signX = dxC >= 0 ? 1 : -1;
        for (let i = 1; i <= radius; i++) {
          const w = Math.floor(i / 2); // 퍼지는 폭
          for (let dy = -w; dy <= w; dy++) addTile(caster.lx + signX * i, caster.ly + dy);
        }
      } else { // Y 방향 메인
        const signY = dyC >= 0 ? 1 : -1;
        for (let i = 1; i <= radius; i++) {
          const w = Math.floor(i / 2);
          for (let dx = -w; dx <= w; dx++) addTile(caster.lx + dx, caster.ly + signY * i);
        }
      }
      break;
    case 'global':
      for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
          addTile(x, y);
        }
      }
      break;
  }

  return tiles;
}

/**
 * 특정 유닛이 현재 지정한 타겟팅 방식을 충족하는지 검사합니다.
 */
export function isValidTargetType(
  casterFaction: string,
  targetFaction: string,
  targetType: TargetType
): boolean {
  if (targetType === 'any') return true;
  if (targetType === 'enemy' && casterFaction !== targetFaction) return true;
  if (targetType === 'ally' && casterFaction === targetFaction) return true;
  if (targetType === 'self') return false; // self만인 경우는 보통 좌표 기반 검증 사용
  if (targetType === 'empty') return !targetFaction; 
  return false;
}

/**
 * 스킬 시전 시 해당 좌표가 유효한지(사거리, 필수 타겟 여부 등) 검증합니다.
 */
export function isSkillTargetValid(
  skill: Skill,
  casterOrigin: TilePos,
  targetPos: TilePos,
  casterFaction: string,
  units: Record<string, Unit>,
  mapW: number,
  mapH: number,
  mapData?: TerrainType[][] // 추가: 지형 이동 가능 여부 판별용 데이터
): { valid: boolean; reason?: string } {
  // 1. 사거리 검사
  const dist = getManhattanDist(casterOrigin.lx, casterOrigin.ly, targetPos.lx, targetPos.ly);
  if (dist > skill.range) {
    return { valid: false, reason: '사거리를 벗어났습니다.' };
  }

  // 2. 타겟 필수 검사
  if (skill.requiresTarget) {
    const aoeTiles = getAoETiles(casterOrigin, targetPos, skill.aoeShape, skill.aoeRadius, mapW, mapH);
    let hasTarget = false;
    for (const t of aoeTiles) {
      const u = Object.values(units).find(unit => unit.logicalX === t.lx && unit.logicalY === t.ly && unit.state !== 'DEAD');
      
      if (skill.targetType === 'empty') {
        if (!u) {
          // 추가: 지형이 이동 불가능한 곳(물, 벽 등)이거나 시야 밖 맵 끄트머리인 경우 스킬 사용 불가
          const terrain = mapData?.[t.ly]?.[t.lx];
          const isPassable = terrain !== undefined && TERRAIN_BONUS[terrain] !== undefined && TERRAIN_BONUS[terrain].moveCost < 10;
          if (!isPassable) {
            continue; // 이 타일은 타겟으로 부적합하므로 무시 (하지만 aoeTiles 중 하나라도 적합하면 됨)
          }
          hasTarget = true;
          break;
        }
      } else {
        if (u && isValidTargetType(casterFaction, u.factionId, skill.targetType)) {
          hasTarget = true;
          break;
        }
      }
    }
    if (!hasTarget) {
      return { valid: false, reason: '범위 내에 유효한 대상이 없습니다.' };
    }
  }

  return { valid: true };
}
