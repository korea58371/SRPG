import { createNoise2D } from 'simplex-noise';
import { TerrainType } from '../types/gameTypes';
import type { MapObjectData } from '../types/gameTypes';
import { MAP_CONFIG, getTileDarkness } from '../constants/gameConfig';

interface Point { x: number; y: number; }

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
  if (elev <= p.grassLevel)  return TerrainType.GRASS;
  if (elev <= p.forestLevel) return TerrainType.FOREST;
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

  // 부족하면 랜덤 GRASS로 보충
  let fallbackAttempts = 0;
  while (chosen.length < count && fallbackAttempts++ < 3000) {
    const rx = Math.floor(Math.random() * width);
    const ry = Math.floor(Math.random() * height);
    if (map[ry][rx] === TerrainType.GRASS) {
      const tooClose = chosen.some(p => Math.abs(p.x - rx) + Math.abs(p.y - ry) < MIN_DIST * 0.5);
      if (!tooClose) chosen.push({ x: rx, y: ry });
    }
  }

  return chosen;
}

// ─── 맵 생성 (생태 파이프라인) ───────────────────────────────────────────────
// 파이프라인:
//   1. fBm 고도맵 생성
//   2. 물 레이아웃 (해안/호수) → 고도 조정
//   3. 고도 → 지형 변환
//   4. 생태 도시 배치 (평탄 + 수변 스코어링)
//   5. 계곡/평야 우선 길 라우팅 (경사도 패널티 A*)
export function generateMapData(
  width: number,
  height: number,
): { map: TerrainType[][]; elevMap: number[][]; cities: Point[]; mapInfo: MapInfo; mapObjects: MapObjectData[] } {
  const terrain = TERRAIN_PROFILES[Math.floor(Math.random() * TERRAIN_PROFILES.length)];
  const water   = WATER_LAYOUTS[Math.floor(Math.random() * WATER_LAYOUTS.length)];
  const waterSide: WaterSide | null =
    water.type === 'coastal_one'
      ? (['north', 'south', 'east', 'west'] as WaterSide[])[Math.floor(Math.random() * 4)]
      : null;

  const label = water.label
    ? `${terrain.label} ${water.label}${waterSide ? ` (${
        waterSide === 'north' ? '북' : waterSide === 'south' ? '남' :
        waterSide === 'east'  ? '동' : '서'})` : ''}`
    : terrain.label;

  const { edgeSeaBias, edgeRadius, lakeNoiseThreshold, lakeEdgeMargin } = water;

  // STEP 1: 고도맵 생성 (fBm)
  const fbm = makeFbm(terrain.noiseScale);
  const elevMap: number[][] = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => fbm(x, y)),
  );
  
  // 오브젝트 배치를 위한 팩터 (가변 그리드 동기화)
  const T = MAP_CONFIG.TILE_SIZE;

  // STEP 2: 물 레이아웃 → 고도 조정
  // coastal: 가장자리 고도를 낮춰 해수면 아래로 → 바다
  // lake: 보조 노이즈로 내륙 저지대에 호수
  const lakeNoise = lakeNoiseThreshold !== undefined ? (() => {
    const fn = createNoise2D();
    return (x: number, y: number) => fn(x / 30, y / 30);
  })() : null;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (edgeSeaBias && edgeRadius) {
        let dist: number;
        if (water.type === 'coastal_all') {
          dist = Math.min(x, width - 1 - x, y, height - 1 - y);
        } else if (waterSide === 'north')  { dist = y; }
        else if (waterSide === 'south')    { dist = height - 1 - y; }
        else if (waterSide === 'east')     { dist = width - 1 - x; }
        else                               { dist = x; }
        if (dist < edgeRadius) {
          const t = 1 - dist / edgeRadius;
          elevMap[y][x] -= edgeSeaBias * t * t;
        }
      }
    }
  }

  // STEP 3: 고도 → 지형 변환
  const map: TerrainType[][] = elevMap.map((row, y) =>
    row.map((elev, x) => {
      let type = elevToTerrain(elev, terrain);

      // 호수: 내륙 저지대 + 보조 노이즈
      if (lakeNoise && lakeNoiseThreshold !== undefined) {
        const margin = lakeEdgeMargin ?? 0;
        const distEdge = Math.min(x, width - 1 - x, y, height - 1 - y);
        if (distEdge >= margin && type !== TerrainType.SEA && type !== TerrainType.CLIFF) {
          if (lakeNoise(x, y) < lakeNoiseThreshold) type = TerrainType.SEA;
        }
      }
      return type;
    }),
  );

  // STEP 4: 생태 도시 배치 (평탄도 + 수변 스코어)
  const cities = placeEcologicalCities(map, elevMap, width, height, 3);

  // STEP 5: 계곡/평야 우선 A* + 랜덤 경유지로 구불구불한 길 라우팅
  for (let i = 0; i < cities.length; i++) {
    const from  = cities[i];
    const to    = cities[(i + 1) % cities.length];
    const viaPoints = getWaypoints(from, to, map, width, height);
    const stops = [from, ...viaPoints, to];

    // 세그먼트별로 A* 라우팅, GRASS·BEACH에만 PATH 페인팅
    for (let j = 0; j < stops.length - 1; j++) {
      const seg = findPath(map, elevMap, stops[j], stops[j + 1]);
      for (const p of seg) {
        const t = map[p.y][p.x];
        // SEA·CLIFF 위에는 길 불가, 나머지(GRASS·BEACH·FOREST)는 자연스러운 임도
        if (t !== TerrainType.SEA && t !== TerrainType.CLIFF) {
          map[p.y][p.x] = TerrainType.PATH;
        }
      }
    }
  }

  // STEP 6: 프롭(나무, 산 등) 오브젝트 생성
  const mapObjects: MapObjectData[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const type = map[y][x];
      const cx = x * T + T / 2;
      const cy = y * T + T / 2;
      
      if (type === TerrainType.FOREST) {
        // 숲 타일 당 1~3개의 나무 생성
        const count = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
          const offsetX = (Math.random() - 0.5) * (T * 0.6);
          const offsetY = (Math.random() - 0.5) * (T * 0.6);
          mapObjects.push({
            id: `tree_${x}_${y}_${i}`,
            type: 'TREE',
            lx: x, ly: y,
            px: cx + offsetX,
            py: cy + offsetY,
          });
        }
      } else if (type === TerrainType.CLIFF) {
        // 절벽 타일 당 높은 산(돌) 하나 생성
        mapObjects.push({
          id: `mountain_${x}_${y}`,
          type: 'MOUNTAIN',
          lx: x, ly: y,
          px: cx, py: cy,
        });
      }
    }
  }

  // 도시 타일 위에 집 오브젝트 생성 (STEP 4에서 만들어진 cities 배열 기반)
  for (let i = 0; i < cities.length; i++) {
    const c = cities[i];
    mapObjects.push({
      id: `house_${c.x}_${c.y}`,
      type: 'HOUSE',
      lx: c.x, ly: c.y,
      px: c.x * T + T / 2,
      py: c.y * T + T / 2,
    });
  }

  return { map, elevMap, cities, mapInfo: { label, terrainName: terrain.name, waterType: water.type, terrainProfile: terrain }, mapObjects };
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
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width * tileSize;
  canvas.height = height * tileSize;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return canvas;

  // 플랫/파스텔톤 팔레트
  const PALETTE: Record<number, number[]> = {
    [TerrainType.SEA]:    [107, 140, 206],
    [TerrainType.BEACH]:  [211, 196, 163],
    [TerrainType.GRASS]:  [172, 177, 123], // #acb17b
    [TerrainType.FOREST]: [141, 151,  97], // #8d9761
    [TerrainType.CLIFF]:  [136, 139, 119],
    [TerrainType.PATH]:   [210, 208, 196], // #d2d0c4
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

  return canvas;
}
