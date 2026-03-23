import { createNoise2D } from 'simplex-noise';
import { TerrainType } from '../types/gameTypes';

// mapGenerator 내부 전용 좌표 타입
interface Point { x: number; y: number; }

// ─── 바이옴 정의 ─────────────────────────────────────────────────────────────
export interface BiomeConfig {
  name: string;
  label: string;      // 한국어 표시명
  noiseScale: number; // 클수록 지형이 넓고 완만
  cliffMin: number;   // 이 값 초과 → CLIFF
  forestMin: number;  // 이 값 초과 (≤cliffMin) → FOREST
  grassMin: number;   // 이 값 초과 (≤forestMin) → GRASS
  beachMin: number;   // 이 값 초과 (≤grassMin) → BEACH
  // 미만 → SEA
  lakeNoiseThreshold?: number; // 이 값 미만의 보조 노이즈 → SEA (호수)
}

export const BIOMES: BiomeConfig[] = [
  {
    name: 'coastal',
    label: '해안 지형',
    noiseScale: 10,
    cliffMin:   0.70,
    forestMin:  0.50,
    grassMin:   0.10,
    beachMin:  -0.10,
    // SEA 비율 ~55% → 섬들이 흩어진 느낌
  },
  {
    name: 'lakeland',
    label: '호수 지형',
    noiseScale: 14,
    cliffMin:   0.55,
    forestMin:  0.15,
    grassMin:  -0.55,
    beachMin:  -0.75,
    lakeNoiseThreshold: -0.35, // 보조 노이즈로 내륙 호수 생성
  },
  {
    name: 'inland',
    label: '내륙 지형',
    noiseScale: 20,
    cliffMin:   0.55,
    forestMin:  0.20,
    grassMin:  -0.70,
    beachMin:  -0.90,
    // SEA 거의 없음 → 완전 내륙
  },
  {
    name: 'forested',
    label: '삼림 지형',
    noiseScale: 13,
    cliffMin:   0.65,
    forestMin: -0.10, // 숲 구간 매우 넓음
    grassMin:  -0.30,
    beachMin:  -0.50,
  },
  {
    name: 'plains',
    label: '평원 지형',
    noiseScale: 22,
    cliffMin:   0.80, // 절벽 거의 없음
    forestMin:  0.55, // 숲도 거의 없음
    grassMin:  -0.50, // 초원이 압도적
    beachMin:  -0.70,
  },
];

// ─── A* 패스파인딩 ────────────────────────────────────────────────────────────
export function findPath(map: TerrainType[][], start: Point, end: Point): Point[] {
  const height = map.length;
  const width  = map[0].length;

  const getCost = (p: Point) => {
    const type = map[p.y][p.x];
    if (type === TerrainType.CLIFF)  return 10;
    if (type === TerrainType.SEA)    return 100;
    if (type === TerrainType.PATH)   return 1;
    if (type === TerrainType.FOREST) return 5;
    return 3;
  };

  const heuristic = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

  const openSet   = new Set<string>();
  const closedSet = new Set<string>();
  const cameFrom  = new Map<string, Point>();
  const gScore    = new Map<string, number>();
  const fScore    = new Map<string, number>();
  const toKey     = (p: Point) => `${p.x},${p.y}`;
  const startKey  = toKey(start);

  openSet.add(startKey);
  gScore.set(startKey, 0);
  fScore.set(startKey, heuristic(start, end));

  const getMinFScoreNode = () => {
    let minKey = '', minVal = Infinity;
    for (const key of openSet) {
      const val = fScore.get(key) ?? Infinity;
      if (val < minVal) { minVal = val; minKey = key; }
    }
    return minKey;
  };

  while (openSet.size > 0) {
    const currentKey = getMinFScoreNode();
    const [cx, cy]   = currentKey.split(',').map(Number);

    if (cx === end.x && cy === end.y) {
      const path: Point[] = [];
      let curr = currentKey;
      while (cameFrom.has(curr)) {
        const [px, py] = curr.split(',').map(Number);
        path.unshift({ x: px, y: py });
        curr = toKey(cameFrom.get(curr)!);
      }
      return path;
    }

    openSet.delete(currentKey);
    closedSet.add(currentKey);

    const neighbors = [
      { x: cx + 1, y: cy }, { x: cx - 1, y: cy },
      { x: cx, y: cy + 1 }, { x: cx, y: cy - 1 },
    ];

    for (const n of neighbors) {
      if (n.x < 0 || n.x >= width || n.y < 0 || n.y >= height) continue;
      const nKey = toKey(n);
      if (closedSet.has(nKey)) continue;

      const tentativeG = (gScore.get(currentKey) ?? Infinity) + getCost(n);
      if (!openSet.has(nKey)) openSet.add(nKey);
      else if (tentativeG >= (gScore.get(nKey) ?? Infinity)) continue;

      cameFrom.set(nKey, { x: cx, y: cy });
      gScore.set(nKey, tentativeG);
      fScore.set(nKey, tentativeG + heuristic(n, end));
    }
  }
  return [];
}

// ─── 맵 생성 (바이옴 랜덤 선택) ──────────────────────────────────────────────
export function generateMapData(
  width: number,
  height: number,
  biome?: BiomeConfig, // 외부에서 지정 가능, 미지정 시 랜덤
): { map: TerrainType[][]; cities: Point[]; biome: BiomeConfig } {
  const selectedBiome = biome ?? BIOMES[Math.floor(Math.random() * BIOMES.length)];
  const {
    noiseScale,
    cliffMin, forestMin, grassMin, beachMin,
    lakeNoiseThreshold,
  } = selectedBiome;

  const noise2D      = createNoise2D();
  const lakeNoise2D  = lakeNoiseThreshold !== undefined ? createNoise2D() : null;
  const map: TerrainType[][] = [];

  for (let y = 0; y < height; y++) {
    const row: TerrainType[] = [];
    for (let x = 0; x < width; x++) {
      const nx    = x / noiseScale;
      const ny    = y / noiseScale;
      const value = noise2D(nx, ny);

      let type: TerrainType;
      if      (value > cliffMin)  type = TerrainType.CLIFF;
      else if (value > forestMin) type = TerrainType.FOREST;
      else if (value > grassMin)  type = TerrainType.GRASS;
      else if (value > beachMin)  type = TerrainType.BEACH;
      else                        type = TerrainType.SEA;

      // 보조 노이즈로 내륙 호수 생성 (lakeland 바이옴)
      if (lakeNoise2D && lakeNoiseThreshold !== undefined) {
        const lakeVal = lakeNoise2D(nx * 1.8, ny * 1.8); // 더 작은 스케일
        if (lakeVal < lakeNoiseThreshold && type !== TerrainType.CLIFF) {
          type = TerrainType.SEA;
        }
      }

      row.push(type);
    }
    map.push(row);
  }

  // ── 거점(city) 3개: GRASS 타일에만 배치 ───────────────────────────────────
  const cities: Point[] = [];
  let attempts = 0;
  while (cities.length < 3 && attempts < 5000) {
    attempts++;
    const rx = Math.floor(Math.random() * width);
    const ry = Math.floor(Math.random() * height);
    if (map[ry][rx] === TerrainType.GRASS) {
      cities.push({ x: rx, y: ry });
    }
  }

  // ── 도시 간 A* 경로를 PATH 타일로 변환 ────────────────────────────────────
  for (let i = 0; i < cities.length; i++) {
    const path = findPath(map, cities[i], cities[(i + 1) % cities.length]);
    for (const p of path) {
      if (map[p.y][p.x] !== TerrainType.SEA && map[p.y][p.x] !== TerrainType.CLIFF) {
        map[p.y][p.x] = TerrainType.PATH;
      }
    }
  }

  return { map, cities, biome: selectedBiome };
}
