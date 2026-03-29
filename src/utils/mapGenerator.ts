import { createNoise2D } from 'simplex-noise';
import { TerrainType } from '../types/gameTypes';
import type { MapObjectData } from '../types/gameTypes';
import type { Province } from '../types/appTypes';
import { MAP_CONFIG, getTileDarkness, isPlayableTile } from '../constants/gameConfig';
import type { ProvinceWithCells } from './provinceGenerator';

interface Point { x: number; y: number; }

export interface SpawnZone {
  team: 'attacker' | 'defender';
  center: Point;
  tiles: Point[];
}

// ─── 지형 프로필: 고도 기반 임계값 ────────────────────────────────────────────
// fBm 노이즈값 = 해발 고도 (-1 ~ 1)
// 임계값이 높을수록 해당 지형이 고지대에 분포
interface TerrainProfile {
  name: string;
  label: string;
  noiseScale: number;
  seaLevel:    number;
  beachLevel:  number;
  grassLevel:  number;
  forestLevel: number;
  baseTerrain?: TerrainType;
  altTerrain?: TerrainType;
}

export interface GeographyConfig {
  terrainProfile: 'plains' | 'highlands' | 'mixed' | 'desert' | 'snow';
  waterLayout: 'none' | 'lake' | 'coastal_one' | 'coastal_all';
  waterSides?: ('north' | 'south' | 'east' | 'west')[];
  roadSides?: ('north' | 'south' | 'east' | 'west')[];
  lakeRatio?: number;
  shapeMask?: number[][];
}

const TERRAIN_PROFILES: TerrainProfile[] = [
  {
    name: 'plains',  label: '평원',
    noiseScale: 40,
    seaLevel:   -0.80, beachLevel: -0.60,
    grassLevel:  0.50, forestLevel: 0.75,
  },
  {
    name: 'forested', label: '삼림',
    noiseScale: 30,
    seaLevel:   -0.75, beachLevel: -0.50,
    grassLevel:  0.10, forestLevel: 0.65,
  },
  {
    name: 'mixed', label: '혼합',
    noiseScale: 34,
    seaLevel:   -0.70, beachLevel: -0.45,
    grassLevel:  0.25, forestLevel: 0.60,
  },
  {
    name: 'desert', label: '사막',
    noiseScale: 40,
    seaLevel:   -0.80, beachLevel: -0.70,
    grassLevel:  0.30, forestLevel: 0.70,
    baseTerrain: TerrainType.DESERT, // 모래
    altTerrain: TerrainType.CLIFF,   // 바위산
  },
  {
    name: 'snow', label: '설원',
    noiseScale: 35,
    seaLevel:   -0.65, beachLevel: -0.55,
    grassLevel:  0.35, forestLevel: 0.80,
    baseTerrain: TerrainType.SNOW,     // 눈밭
    altTerrain: TerrainType.FOREST,    // 침엽수림(설원)
  },
];

// ─── 물 배치 레이아웃 ─────────────────────────────────────────────────────────
type WaterSide = 'north' | 'south' | 'east' | 'west';

interface WaterLayout {
  type: 'none' | 'lake' | 'coastal_one' | 'coastal_all';
  label: string;
  edgeSeaBias?: number;
  edgeRadius?:  number;
  lakeNoiseThreshold?: number;
  lakeEdgeMargin?:     number;
}

const WATER_LAYOUTS: WaterLayout[] = [
  { type: 'none',         label: '' },
  { type: 'none',         label: '' },
  {
    type: 'lake',    label: '+ 내륙 호수',
    lakeNoiseThreshold: -0.42, lakeEdgeMargin: 8,
  },
  {
    type: 'coastal_one', label: '+ 해안 (대륙)',
    edgeSeaBias: 1.8, edgeRadius: 12,
  },
  {
    type: 'coastal_all', label: '+ 사방 바다 (섬)',
    edgeSeaBias: 1.6, edgeRadius: 11,
  },
];

export interface MapInfo {
  label: string;
  terrainName: string;
  waterType: string;
  terrainProfile: TerrainProfile;
}

// ─── fBm 노이즈 생성기 ────────────────────────────────────────────────────────
function makeFbm(scale: number) {
  const n1 = createNoise2D();
  const n2 = createNoise2D();
  const n3 = createNoise2D();

  return (x: number, y: number): number => {
    const nx = x / scale, ny = y / scale;
    return (
      1.00 * n1(nx,      ny     ) +
      0.50 * n2(nx * 2,  ny * 2 ) +
      0.25 * n3(nx * 4,  ny * 4 )
    ) / 1.75;
  };
}

// ─── 고도 → 지형 타입 변환 ────────────────────────────────────────────────────
function elevToTerrain(elev: number, p: TerrainProfile): TerrainType {
  if (elev <= p.seaLevel)    return TerrainType.SEA;
  if (elev <= p.beachLevel)  return TerrainType.BEACH;
  if (elev <= p.grassLevel)  return p.baseTerrain ?? TerrainType.GRASS;
  if (elev <= p.forestLevel) return p.altTerrain ?? TerrainType.FOREST;
  return TerrainType.CLIFF;
}

// ─── A* (8방향 + 고도차 패널티) ─────────────────────────────────────────────────────
export function findPath(
  map: TerrainType[][],
  elevMap: number[][],
  start: Point,
  end: Point,
): Point[] {
  const height = map.length;
  const width  = map[0].length;

  const getCost = (from: Point, to: Point, diag: boolean): number => {
    const t = map[to.y][to.x];
    if (t === TerrainType.CLIFF)  return 50;
    if (t === TerrainType.SEA)    return 200;
    if (t === TerrainType.PATH)   return diag ? 1.414 : 1;
    if (t === TerrainType.FOREST) return diag ? 28 : 20;

    const grad = Math.abs((elevMap[to.y]?.[to.x] ?? 0) - (elevMap[from.y]?.[from.x] ?? 0));
    const slopePenalty = grad * 18;
    const base = (t === TerrainType.BEACH ? 4 : 2) * (diag ? 1.414 : 1);
    return base + slopePenalty;
  };

  // 체비쉐프 거리 (8방향 휴리스틱)
  const h = (a: Point, b: Point) =>
    Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const key  = (p: Point) => `${p.x},${p.y}`;
  const open = new Set<string>();
  const closed = new Set<string>();
  const came = new Map<string, Point>();
  const g = new Map<string, number>();
  const f = new Map<string, number>();
  const sk = key(start);
  open.add(sk); g.set(sk, 0); f.set(sk, h(start, end));

  const minF = () => {
    let mk = '', mv = Infinity;
    for (const k of open) { const v = f.get(k) ?? Infinity; if (v < mv) { mv = v; mk = k; } }
    return mk;
  };

  // 8방향 이웃 (대각: isDiag=true)
  const DIRS = [
    { dx:  1, dy:  0, diag: false }, { dx: -1, dy:  0, diag: false },
    { dx:  0, dy:  1, diag: false }, { dx:  0, dy: -1, diag: false },
    { dx:  1, dy:  1, diag: true  }, { dx: -1, dy:  1, diag: true  },
    { dx:  1, dy: -1, diag: true  }, { dx: -1, dy: -1, diag: true  },
  ];

  while (open.size > 0) {
    const ck = minF();
    const [cx, cy] = ck.split(',').map(Number);
    if (cx === end.x && cy === end.y) {
      const path: Point[] = [];
      let cur = ck;
      while (came.has(cur)) {
        const [px, py] = cur.split(',').map(Number);
        path.unshift({ x: px, y: py });
        cur = key(came.get(cur)!);
      }
      return path;
    }
    open.delete(ck); closed.add(ck);
    for (const { dx, dy, diag } of DIRS) {
      const n = { x: cx + dx, y: cy + dy };
      if (n.x < 0 || n.x >= width || n.y < 0 || n.y >= height) continue;
      // 대각 이동 시: 양쪽 담장 들[cx,n.y]와 [n.x,cy]가 올 수 있어야 함 (코너커팅 방지)
      if (diag) {
        const t1 = map[cy]?.[n.x]; const t2 = map[n.y]?.[cx];
        if (t1 === TerrainType.CLIFF || t1 === TerrainType.SEA) continue;
        if (t2 === TerrainType.CLIFF || t2 === TerrainType.SEA) continue;
      }
      const nk = key(n);
      if (closed.has(nk)) continue;
      const from: Point = { x: cx, y: cy };
      const tg = (g.get(ck) ?? Infinity) + getCost(from, n, diag);
      if (!open.has(nk)) open.add(nk);
      else if (tg >= (g.get(nk) ?? Infinity)) continue;
      came.set(nk, from);
      g.set(nk, tg);
      f.set(nk, tg + h(n, end));
    }
  }
  return [];
}

// ─── 도시 간 중간 경유지 생성 (길을 자연스럽게 우회시킴) ──────────────────────
function getWaypoints(
  start: Point, end: Point,
  map: TerrainType[][], width: number, height: number,
): Point[] {
  const dist = Math.abs(start.x - end.x) + Math.abs(start.y - end.y);
  if (dist < 20) return []; // 짧은 거리는 경유지 없이 직접 연결

  const count  = dist < 40 ? 1 : 2;
  const spread = Math.min(width, height) * 0.12;
  const waypoints: Point[] = [];

  for (let i = 1; i <= count; i++) {
    const t     = i / (count + 1);
    const baseX = Math.round(start.x + (end.x - start.x) * t);
    const baseY = Math.round(start.y + (end.y - start.y) * t);

    for (let attempt = 0; attempt < 80; attempt++) {
      const ox = Math.round((Math.random() - 0.5) * spread * 2);
      const oy = Math.round((Math.random() - 0.5) * spread * 2);
      const px = Math.max(2, Math.min(width - 3, baseX + ox));
      const py = Math.max(2, Math.min(height - 3, baseY + oy));
      const type = map[py]?.[px];
      if (type === TerrainType.GRASS || type === TerrainType.BEACH) {
        waypoints.push({ x: px, y: py });
        break;
      }
    }
  }
  return waypoints;
}

// ─── 생태적 도시 배치 ─────────────────────────────────────────────────────────
// 스코어 기준 (높을수록 좋음):
//   1. 평탄도: 주변 3×3 고도 분산이 낮을수록 점수 高
//   2. 수변 접근: 5타일 이내에 SEA/BEACH가 있으면 보너스
//   3. 도시 간 최소 이격 보장 (너무 가까우면 제외)
function placeEcologicalCities(
  map: TerrainType[][],
  elevMap: number[][],
  width: number,
  height: number,
  count: number,
): Point[] {
  const MIN_DIST = Math.min(width, height) / (count + 1); // 최소 이격
  const WATER_RADIUS = 6;

  interface Candidate { pos: Point; score: number; }
  const candidates: Candidate[] = [];

  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      if (map[y][x] !== TerrainType.GRASS) continue;
      // 안개 밖에 놓인 타일은 제외 → 본사인 장소는 이동 가능 영역에만 배치
      if (!isPlayableTile(x, y, width, height)) continue;

      // 평탄도: 주변 3×3 고도 분산
      let sumElev = 0, sumSq = 0, cnt = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const e = elevMap[y + dy]?.[x + dx];
          if (e !== undefined) { sumElev += e; sumSq += e * e; cnt++; }
        }
      }
      const mean = sumElev / cnt;
      const variance = sumSq / cnt - mean * mean;
      const flatScore = 1 / (1 + variance * 50); // 분산 낮을수록 1에 가까움

      // 수변 접근 보너스
      let waterNear = false;
      outer: for (let dy = -WATER_RADIUS; dy <= WATER_RADIUS; dy++) {
        for (let dx = -WATER_RADIUS; dx <= WATER_RADIUS; dx++) {
          const t = map[y + dy]?.[x + dx];
          if (t === TerrainType.SEA || t === TerrainType.BEACH) { waterNear = true; break outer; }
        }
      }
      const waterScore = waterNear ? 1.5 : 1.0;

      candidates.push({ pos: { x, y }, score: flatScore * waterScore });
    }
  }

  // 스코어 내림차순 정렬 후, 최소 이격 거리 보장하며 선택
  candidates.sort((a, b) => b.score - a.score);
  const chosen: Point[] = [];

  for (const c of candidates) {
    if (chosen.length >= count) break;
    const tooClose = chosen.some(
      p => Math.abs(p.x - c.pos.x) + Math.abs(p.y - c.pos.y) < MIN_DIST,
    );
    if (!tooClose) chosen.push(c.pos);
  }

  // 부족하면 폈야블 영역 내의 랜덤 GRASS로 보충
  let fallbackAttempts = 0;
  while (chosen.length < count && fallbackAttempts++ < 3000) {
    const rx = Math.floor(Math.random() * width);
    const ry = Math.floor(Math.random() * height);
    if (map[ry][rx] === TerrainType.GRASS && isPlayableTile(rx, ry, width, height)) {
      const tooClose = chosen.some(p => Math.abs(p.x - rx) + Math.abs(p.y - ry) < MIN_DIST * 0.5);
      if (!tooClose) chosen.push({ x: rx, y: ry });
    }
  }

  return chosen;
}

// ─── 맵 생성 (생태 파이프라인) ───────────────────────────────────────────────
// 파이프라인:
//   1. fBm 고도맵 생성 / 2. 물 레이아웃 / 3. 고도→지형 / 4. 도시배치
//   5. 도로 라우팅 / 6. 프롭 오브젝트 / 7. 스폰 존 (attacker/defender)
export function generateMapData(
  width: number,
  height: number,
  config?: GeographyConfig
): { map: TerrainType[][]; elevMap: number[][]; cities: Point[]; mapInfo: MapInfo; mapObjects: MapObjectData[]; spawnZones: SpawnZone[] } {
  const terrain = config
    ? TERRAIN_PROFILES.find(p => p.name === config.terrainProfile) || TERRAIN_PROFILES[0]
    : TERRAIN_PROFILES[Math.floor(Math.random() * TERRAIN_PROFILES.length)];

  const water = config
    ? WATER_LAYOUTS.find(w => w.type === config.waterLayout) || WATER_LAYOUTS[0]
    : WATER_LAYOUTS[Math.floor(Math.random() * WATER_LAYOUTS.length)];

  const waterSides: WaterSide[] = config && config.waterSides
    ? config.waterSides
    : (water.type === 'coastal_one'
        ? [(['north', 'south', 'east', 'west'] as WaterSide[])[Math.floor(Math.random() * 4)]]
        : []);

  const label = water.label
    ? `${terrain.label} ${water.label}${waterSides.length > 0 ? ` (${
        waterSides.map(w => w === 'north' ? '북' : w === 'south' ? '남' : w === 'east' ? '동' : '서').join(',')
      })` : ''}`
    : terrain.label;

  const roadSides    = config?.roadSides || [];
  const edgeSeaBias  = water.edgeSeaBias ?? 0;
  const edgeRadius   = water.edgeRadius  ?? 0;
  const lakeRatio    = config?.lakeRatio ?? 0;
  let lakeNoiseThreshold = water.lakeNoiseThreshold;
  if (lakeRatio > 0.05) lakeNoiseThreshold = (lakeNoiseThreshold ?? -0.6) + lakeRatio * 0.8;
  const lakeEdgeMargin = water.lakeEdgeMargin ?? 8;

  // STEP 1: 고도맵 생성 (fBm)
  const fbm = makeFbm(terrain.noiseScale);
  const elevMap: number[][] = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => fbm(x, y)),
  );
  const T = MAP_CONFIG.TILE_SIZE;

  // STEP 2: 물 레이아웃 → 고도 조정
  const lakeNoise = lakeNoiseThreshold !== undefined ? (() => {
    const fn = createNoise2D();
    return (x: number, y: number) => fn(x / 30, y / 30);
  })() : null;

  if (config?.shapeMask) {
    const mask = config.shapeMask;
    let blurredMask = mask.map(row => [...row]);
    for (let iter = 0; iter < 3; iter++) {
      const nextMask = blurredMask.map(row => [...row]);
      for (let y = 1; y < height - 1; y++)
        for (let x = 1; x < width - 1; x++) {
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += blurredMask[y+dy][x+dx];
          nextMask[y][x] = sum / 9;
        }
      blurredMask = nextMask;
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let mv = blurredMask[y][x];
        if (mask[y][x] === 1 && mv < 0.25) mv = 0.25;
        if (mask[y][x] === 0 && mv < 0.1)  mv = 0.1;
        if (mv < -0.1)                elevMap[y][x] += mv * 2.5;
        else if (mv >= -0.1 && mv < 0.2) elevMap[y][x] += (mv - 0.2);
        else                          elevMap[y][x] += (mv * 0.3);
        if ((mask[y][x] === 1 || mask[y][x] === 0) && elevMap[y][x] <= terrain.beachLevel)
          elevMap[y][x] = terrain.beachLevel + 0.05 + Math.random() * 0.1;
      }
    }
  } else {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (edgeSeaBias && edgeRadius) {
          if (water.type === 'coastal_all') {
            const dist = Math.min(x, width - 1 - x, y, height - 1 - y);
            if (dist < edgeRadius) { const t = 1 - dist / edgeRadius; elevMap[y][x] -= edgeSeaBias * t * t; }
          } else if (waterSides.length > 0) {
            let biasApplied = 0;
            for (const side of waterSides) {
              let dist = Infinity;
              if (side === 'north') dist = y;
              else if (side === 'south') dist = height - 1 - y;
              else if (side === 'east')  dist = width  - 1 - x;
              else if (side === 'west')  dist = x;
              if (dist < edgeRadius) { const t = 1 - dist / edgeRadius; biasApplied = Math.max(biasApplied, edgeSeaBias * t * t); }
            }
            if (biasApplied > 0) elevMap[y][x] -= biasApplied;
          }
        }
      }
    }
  }

  // STEP 3: 고도 → 지형 변환
  const map: TerrainType[][] = elevMap.map((row, y) =>
    row.map((elev, x) => {
      let type = elevToTerrain(elev, terrain);
      if (!config?.shapeMask && lakeNoise && lakeNoiseThreshold !== undefined) {
        const distEdge = Math.min(x, width - 1 - x, y, height - 1 - y);
        if (distEdge >= lakeEdgeMargin && type !== TerrainType.SEA && type !== TerrainType.CLIFF)
          if (lakeNoise(x, y) < lakeNoiseThreshold) type = TerrainType.SEA;
      }
      return type;
    }),
  );

  // STEP 4: 생태 도시 배치
  const cities = placeEcologicalCities(map, elevMap, width, height, 3);

  // STEP 5: 도로 앵커 계산
  const roadAnchors: Point[] = [];
  if (config?.shapeMask) {
    const candidates: Point[] = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (config.shapeMask[y][x] === 0 &&
           (config.shapeMask[y-1][x] === 1 || config.shapeMask[y+1][x] === 1 ||
            config.shapeMask[y][x-1] === 1 || config.shapeMask[y][x+1] === 1))
          candidates.push({ x, y });
      }
    }
    candidates.sort(() => Math.random() - 0.5);
    for (const cand of candidates) {
      if (roadAnchors.length >= 4) break;
      let anchor = cand;
      if (!isPlayableTile(cand.x, cand.y, width, height)) {
        const cx2 = Math.floor(width / 2), cy2 = Math.floor(height / 2);
        for (let step = 1; step <= Math.max(width, height); step++) {
          const tx = Math.round(cand.x + (cx2 - cand.x) * step / Math.max(width, height));
          const ty = Math.round(cand.y + (cy2 - cand.y) * step / Math.max(width, height));
          if (isPlayableTile(tx, ty, width, height) && map[ty]?.[tx] !== TerrainType.SEA) { anchor = { x: tx, y: ty }; break; }
        }
      }
      if (map[anchor.y]?.[anchor.x] !== TerrainType.SEA && map[anchor.y]?.[anchor.x] !== TerrainType.CLIFF)
        roadAnchors.push(anchor);
    }
  } else {
    roadSides.forEach(side => {
      let px = Math.floor(width / 2), py = Math.floor(height / 2);
      if (side === 'north') { py = 1;          px = Math.floor(width  * (0.3 + Math.random() * 0.4)); }
      if (side === 'south') { py = height - 2; px = Math.floor(width  * (0.3 + Math.random() * 0.4)); }
      if (side === 'west')  { px = 1;          py = Math.floor(height * (0.3 + Math.random() * 0.4)); }
      if (side === 'east')  { px = width - 2;  py = Math.floor(height * (0.3 + Math.random() * 0.4)); }
      roadAnchors.push({ x: px, y: py });
    });
  }

  // STEP 5b: A* 도로 라우팅
  const allStops = [...roadAnchors, ...cities];
  for (let i = 0; i < allStops.length; i++) {
    const from = allStops[i];
    const to   = allStops[(i + 1) % allStops.length];
    const viaPoints = getWaypoints(from, to, map, width, height);
    const stops = [from, ...viaPoints, to];
    for (let j = 0; j < stops.length - 1; j++) {
      const seg = findPath(map, elevMap, stops[j], stops[j + 1]);
      for (const p of seg)
        if (map[p.y][p.x] !== TerrainType.SEA && map[p.y][p.x] !== TerrainType.CLIFF)
          map[p.y][p.x] = TerrainType.PATH;
    }
  }

  // STEP 6: 프롭 오브젝트 생성
  const mapObjects: MapObjectData[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const type = map[y][x];
      const cx = x * T + T / 2, cy = y * T + T / 2;
      if (type === TerrainType.FOREST) {
        const count = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++)
          mapObjects.push({ id: `tree_${x}_${y}_${i}`, type: 'TREE', lx: x, ly: y,
            px: cx + (Math.random() - 0.5) * T * 0.6, py: cy + (Math.random() - 0.5) * T * 0.6 });
      } else if (type === TerrainType.CLIFF) {
        mapObjects.push({ id: `mountain_${x}_${y}`, type: 'MOUNTAIN', lx: x, ly: y, px: cx, py: cy });
      }
    }
  }
  for (const c of cities)
    mapObjects.push({ id: `house_${c.x}_${c.y}`, type: 'HOUSE', lx: c.x, ly: c.y, px: c.x * T + T / 2, py: c.y * T + T / 2 });

  // STEP 7: 스폰 존 계산 (attacker / defender)
  // 안개 경계(0.65)보다 훨씬 안쪽(0.55)에만 배치하여 안전 마진 확보
  const SAFE_MARGIN = 0.55;
  const ZONE_RADIUS = 3;
  const MIN_SEPARATION = 18; // 공격/수비 스폰 간 최소 맨해튼 거리

  const isSafeSpawn = (sx: number, sy: number): boolean => {
    const mcx = width / 2, mcy = height / 2;
    return Math.max(Math.abs(sx - mcx + 0.5) / mcx, Math.abs(sy - mcy + 0.5) / mcy) <= SAFE_MARGIN;
  };

  const snapToSafe = (pt: Point): Point => {
    if (isSafeSpawn(pt.x, pt.y)) return pt;
    const mcx = Math.floor(width / 2), mcy = Math.floor(height / 2);
    for (let step = 1; step <= Math.max(width, height); step++) {
      const tx = Math.round(pt.x + (mcx - pt.x) * step / Math.max(width, height));
      const ty = Math.round(pt.y + (mcy - pt.y) * step / Math.max(width, height));
      if (isSafeSpawn(tx, ty) && map[ty]?.[tx] !== TerrainType.SEA && map[ty]?.[tx] !== TerrainType.CLIFF)
        return { x: tx, y: ty };
    }
    return { x: mcx, y: mcy };
  };

  // 공격 앵커를 안전 영역으로 스냅
  const safeAnchors = roadAnchors.slice(0, 4).map(snapToSafe)
    .filter(a => map[a.y]?.[a.x] !== TerrainType.SEA && map[a.y]?.[a.x] !== TerrainType.CLIFF);

  // 수비 스폰: 도시 중 공격 앵커에서 가장 먼 위치 선택
  let defCenter: Point = cities.length > 0 ? snapToSafe(cities[0]) : { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  if (cities.length > 1 && safeAnchors.length > 0) {
    const sorted = [...cities]
      .map(c => ({ pt: snapToSafe(c), minDist: Math.min(...safeAnchors.map(a => Math.abs(c.x - a.x) + Math.abs(c.y - a.y))) }))
      .sort((a, b) => b.minDist - a.minDist);
    defCenter = sorted[0].pt;
  }

  const spawnZones: SpawnZone[] = [];

  // 수비측 존
  const defTiles: Point[] = [];
  for (let dy = -ZONE_RADIUS; dy <= ZONE_RADIUS; dy++) {
    for (let dx = -ZONE_RADIUS; dx <= ZONE_RADIUS; dx++) {
      const nx = defCenter.x + dx, ny = defCenter.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (dx * dx + dy * dy > ZONE_RADIUS * ZONE_RADIUS) continue;
      const t = map[ny][nx];
      if (t !== TerrainType.SEA && t !== TerrainType.CLIFF && isSafeSpawn(nx, ny)) defTiles.push({ x: nx, y: ny });
    }
  }
  if (defTiles.length > 0) spawnZones.push({ team: 'defender', center: defCenter, tiles: defTiles });

  // 공격측 존 (수비와 MIN_SEPARATION 이상 거리가 떨어진 경우만)
  for (const anchor of safeAnchors) {
    if (Math.abs(anchor.x - defCenter.x) + Math.abs(anchor.y - defCenter.y) < MIN_SEPARATION) continue;
    const atkTiles: Point[] = [];
    for (let dy = -ZONE_RADIUS; dy <= ZONE_RADIUS; dy++) {
      for (let dx = -ZONE_RADIUS; dx <= ZONE_RADIUS; dx++) {
        const nx = anchor.x + dx, ny = anchor.y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (dx * dx + dy * dy > ZONE_RADIUS * ZONE_RADIUS) continue;
        const t = map[ny][nx];
        if (t !== TerrainType.SEA && t !== TerrainType.CLIFF && isSafeSpawn(nx, ny)) atkTiles.push({ x: nx, y: ny });
      }
    }
    if (atkTiles.length > 0) spawnZones.push({ team: 'attacker', center: anchor, tiles: atkTiles });
  }

  return { map, elevMap, cities, mapInfo: { label, terrainName: terrain.name, waterType: water.type, terrainProfile: terrain }, mapObjects, spawnZones };
}


// ─── 부드러운 통짜 맵 텍스처 렌더링기 (단색 타일 버전) ──────────────────────
// 사용자가 지정한 안개/외곽 장식을 생성하기 위한 함수
// 타일과 같은 사이즈로 빈 캔버스를 만들고, 어두워지는 구역에만 alpha 값이 섞인 색상을 그립니다.
export function generateFogTexture(
  width: number,
  height: number,
  tileSize: number,
): HTMLCanvasElement {
  // 프롭들(Mountain 등 최대 높이 80px 이상)이 맵 바깥으로 렌더링되면서 안개에 잘리는(튀어나오는) 현상 방지.
  // 실제 맵보다 상하좌우 6타일(144px)씩 확장하여 그립니다.
  const padding = 6;
  const canvas = document.createElement('canvas');
  canvas.width = (width + padding * 2) * tileSize;
  canvas.height = (height + padding * 2) * tileSize;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return canvas;

  // -padding 부터 width+padding 까지 루프
  for (let y = -padding; y < height + padding; y++) {
    for (let x = -padding; x < width + padding; x++) {
      const darkness = getTileDarkness(x, y, width, height);
      if (darkness > 0) {
        ctx.fillStyle = `rgba(112, 113, 78, ${darkness})`;
        const drawX = x + padding;
        const drawY = y + padding;
        // 그리드(격자) 아티팩트 원인 제거: 반투명 사각형이 겹치면 알파 채널이 더블링되므로, 오버랩 없이 정확하게 타일 사이즈로 그립니다.
        ctx.fillRect(drawX * tileSize, drawY * tileSize, tileSize, tileSize);
      }
    }
  }

  return canvas;
}

// 사용자가 지정한 대로, 프랙탈 노이즈 없이 타일별 단색(Solid Color)으로 그려냅니다.
export function generateMapTexture(
  width: number,
  height: number,
  tileSize: number,
  mapData: TerrainType[][],     // 로지컬 맵 (타일 색칠용)
  spawnZones?: SpawnZone[],     // 스폰 존 오버레이 (선택)
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width * tileSize;
  canvas.height = height * tileSize;
  // alpha:true 으로 반투명 오버레이(rgba) 합성을 사용함
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return canvas;

  // 플랫/파스텔톤 팔레트
  const PALETTE: Record<number, number[]> = {
    [TerrainType.SEA]:    [107, 140, 206],
    [TerrainType.BEACH]:  [211, 196, 163],
    [TerrainType.GRASS]:  [172, 177, 123],
    [TerrainType.FOREST]: [141, 151,  97],
    [TerrainType.CLIFF]:  [136, 139, 119],
    [TerrainType.PATH]:   [210, 208, 196],
    [TerrainType.DESERT]: [224, 206, 153], // #e0ce99 Sand color
    [TerrainType.SNOW]:   [235, 240, 245], // #ebf0f5 Snow color
  };

  // Base Pass: 각 타일을 단색 사각형으로 렌더링
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const type = mapData[y][x];
      const baseColor = PALETTE[type] || PALETTE[TerrainType.GRASS];
      ctx.fillStyle = `rgb(${baseColor.join(',')})`;
      
      // 약간의 겹침(비는 공간 방지)을 위해 크기를 1px 크게 칠함
      ctx.fillRect(x * tileSize, y * tileSize, tileSize + 0.5, tileSize + 0.5);
    }
  }

  // Path 렌더링: 블록형태가 아닌 타일 자체를 PATH 색상으로 칠함
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mapData[y][x] === TerrainType.PATH) {
        const baseColor = PALETTE[TerrainType.PATH];
        ctx.fillStyle = `rgb(${baseColor.join(',')})`;
        ctx.fillRect(x * tileSize, y * tileSize, tileSize + 0.5, tileSize + 0.5);
      }
    }
  }

  // 그리드 라인 오버레이 생략 (동적 로컬 그리드로 대체됨)

  // 스폰 존 오버레이 렌더링 (지형 및 PATH 렌더 후에 그려 아이콘이 덮어사운)
  if (spawnZones && spawnZones.length > 0) {
    for (const zone of spawnZones) {
      // 수비측: 파랑, 공격측: 빨강
      const isDefender = zone.team === 'defender';
      const fillColor  = isDefender ? 'rgba(60,120,255,0.45)' : 'rgba(255,60,60,0.45)';
      const borderColor = isDefender ? 'rgba(140,200,255,1.0)' : 'rgba(255,140,140,1.0)';
      const glowColor   = isDefender ? 'rgba(40,100,220,0.25)' : 'rgba(220,40,40,0.25)';

      ctx.save();
      for (const tile of zone.tiles) {
        ctx.fillStyle = fillColor;
        ctx.fillRect(tile.x * tileSize, tile.y * tileSize, tileSize, tileSize);
      }

      const tileSet = new Set(zone.tiles.map(t => `${t.x},${t.y}`));
      for (const tile of zone.tiles) {
        const sides: [number, number, boolean][] = [
          [tile.x * tileSize,         tile.y * tileSize,         true  ],  // top
          [tile.x * tileSize,         (tile.y+1) * tileSize,     true  ],  // bottom
          [tile.x * tileSize,         tile.y * tileSize,         false ],  // left
          [(tile.x+1) * tileSize,     tile.y * tileSize,         false ],  // right
        ];
        const neighbors = [
          [tile.x, tile.y-1], [tile.x, tile.y+1], [tile.x-1, tile.y], [tile.x+1, tile.y]
        ];
        sides.forEach(([bx, by, isHoriz], si) => {
          const [nx, ny] = neighbors[si];
          if (!tileSet.has(`${nx},${ny}`)) {
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            if (isHoriz) { ctx.moveTo(bx, by); ctx.lineTo(bx + tileSize, by); }
            else         { ctx.moveTo(bx, by); ctx.lineTo(bx, by + tileSize); }
            ctx.stroke();
          }
        });
      }

      const icx = zone.center.x * tileSize + tileSize / 2;
      const icy = zone.center.y * tileSize + tileSize / 2;
      const iconR = tileSize * 1.2;

      ctx.fillStyle = glowColor;
      ctx.beginPath(); ctx.arc(icx, icy, iconR * 1.6, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(icx, icy, iconR, 0, Math.PI * 2); ctx.stroke();

      // 수비=방패 컡펜, 공격=✕
      ctx.fillStyle = borderColor;
      ctx.font = `bold ${Math.round(tileSize * 1.2)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isDefender ? '★' : '✕', icx, icy);

      ctx.restore();
    }
  }

  return canvas;
}

// ─── 전략맵 보로노이 셀 기반 전술맵 설정 추출 함수 ──────────────────────────────────────────────
export function computeGeographyConfig(prov: Province, currentMap: ProvinceWithCells): GeographyConfig | undefined {
  if (!currentMap) return undefined;
  
  let profile: 'plains' | 'highlands' | 'mixed' | 'desert' | 'snow' = 'mixed';
  if (['peak', 'mountain', 'hill'].includes(prov.terrainType)) profile = 'highlands';
  else if (['plains', 'savanna'].includes(prov.terrainType)) profile = 'plains';
  else if (prov.terrainType === 'desert') profile = 'desert';
  else if (['tundra', 'ice'].includes(prov.terrainType)) profile = 'snow';
  
  const provCells = currentMap.allCells.filter(c => c.provinceId === prov.id);
  
  // 1. 후보 셀 찾기 (자기 자신 + 인접 영지 + 바다)
  const candidateSet = new Set<string>([prov.id, ...prov.adjacentIds, ...prov.navalAdjacentIds]);
  const candidates = currentMap.allCells.filter(c => 
      c.isOcean || c.terrain === 'ocean' || c.terrain === 'coastal' || (c.provinceId && candidateSet.has(c.provinceId))
  );

  // 2. 바운딩 박스 및 스케일 계산
  let minCx = Infinity, maxCx = -Infinity;
  let minCy = Infinity, maxCy = -Infinity;
  provCells.forEach(c => {
      if (c.cx < minCx) minCx = c.cx;
      if (c.cx > maxCx) maxCx = c.cx;
      if (c.cy < minCy) minCy = c.cy;
      if (c.cy > maxCy) maxCy = c.cy;
  });
  
  const cx = (minCx + maxCx) / 2;
  const cy = (minCy + maxCy) / 2;
  const radiusX = (maxCx - minCx) / 2;
  const radiusY = (maxCy - minCy) / 2;
  // 여백 확보 (약 40%). 매우 작은 섬/초소형 영지의 경우 바다가 보일 수 있도록 최소 반지름(60)을 강제합니다.
  const MIN_RADIUS = 60;
  const renderRadius = Math.max(radiusX, radiusY, MIN_RADIUS) * 1.4;

  // 3. 맵 해상도 기반 마스크 생성
  const W = MAP_CONFIG.WIDTH;
  const H = MAP_CONFIG.HEIGHT;
  const shapeMask: number[][] = [];
  
  for (let ty = 0; ty < H; ty++) {
      shapeMask[ty] = [];
      for (let tx = 0; tx < W; tx++) {
          // 아이소메트릭 화면 기준으로 중심점(W/2, H/2)부터의 상대 좌표
          const dx = tx - W/2;
          const dy = ty - H/2;
          // 인게임 쿼터뷰 렌더링 시 나타나는 실제 월드 방향으로 변환 (정확한 회전각 보정)
          const vx = (dx + dy) * 0.5;
          const vy = (dy - dx) * 0.5;
          
          // 월드 맵 좌표로 투영 (배열 인덱스 범위를 정확히 radius 반경으로 매핑)
          const wx = cx + vx * (renderRadius / (W/2));
          const wy = cy + vy * (renderRadius / (H/2));

          // 가장 가까운 마이크로셀 검색 (nearest neighbor)
          let closestDist = Infinity;
          let closestCell = candidates[0];
          for (let i = 0; i < candidates.length; i++) {
              const cInfo = candidates[i];
              const dist = (cInfo.cx - wx)**2 + (cInfo.cy - wy)**2;
              if (dist < closestDist) {
                  closestDist = dist;
                  closestCell = cInfo;
              }
          }

          // 1: 내 영지 (Land)
          // 0: 타 영지 육지 (가장자리 경계 / 길 연결 가능 지점)
          // -1: 진짜 바다 (접근 불가/고도 낮춤)
          if (closestCell) {
              if (closestCell.isOcean || closestCell.terrain === 'ocean') {
                  shapeMask[ty].push(-1);
              } else if (closestCell.provinceId === prov.id) {
                  shapeMask[ty].push(1);
              } else {
                  shapeMask[ty].push(0);
              }
          } else {
              shapeMask[ty].push(-1);
          }
      }
  }
  
  return { 
      terrainProfile: profile, 
      waterLayout: 'none', // 내부 호수/바다 등도 이제 마스크가 담당
      shapeMask 
  };
}
