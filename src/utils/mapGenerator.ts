import { createNoise2D } from 'simplex-noise';
import { TerrainType } from '../types/gameTypes';
import { MAP_CONFIG } from '../constants/gameConfig';

// mapGenerator 내부 전용 좌표 타입 (TilePos와 별개로 x,y 사용)
interface Point { x: number; y: number; }

// A* 패스파인딩 알고리즘
export function findPath(map: TerrainType[][], start: Point, end: Point): Point[] {
  const height = map.length;
  const width = map[0].length;
  
  const getCost = (p: Point) => {
    const type = map[p.y][p.x];
    if (type === TerrainType.CLIFF) return 10; // 험지
    if (type === TerrainType.SEA) return 100; // 바다 (이동 거의 불가)
    if (type === TerrainType.PATH) return 1;  // 길 (제일 빠름)
    return 3; // 기본 초원/해변
  };

  const heuristic = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  
  const openSet = new Set<string>();
  const closedSet = new Set<string>();
  const cameFrom = new Map<string, Point>();
  
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  const toKey = (p: Point) => `${p.x},${p.y}`;
  const startKey = toKey(start);
  
  openSet.add(startKey);
  gScore.set(startKey, 0);
  fScore.set(startKey, heuristic(start, end));

  const getMinFScoreNode = () => {
    let minKey = '';
    let minVal = Infinity;
    for (const key of openSet) {
      const val = fScore.get(key) ?? Infinity;
      if (val < minVal) {
        minVal = val;
        minKey = key;
      }
    }
    return minKey;
  };

  while (openSet.size > 0) {
    const currentKey = getMinFScoreNode();
    const [cx, cy] = currentKey.split(',').map(Number);
    
    if (cx === end.x && cy === end.y) {
      // Reconstruct path
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
      { x: cx, y: cy + 1 }, { x: cx, y: cy - 1 }
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

export function generateMapData(width: number, height: number): { map: TerrainType[][], cities: Point[] } {
  const noise2D = createNoise2D();
  const map: TerrainType[][] = [];

  // Perlin Noise 기반 지형 생성
  for (let y = 0; y < height; y++) {
    const row: TerrainType[] = [];
    for (let x = 0; x < width; x++) {
      const nx = x / MAP_CONFIG.NOISE_SCALE;
      const ny = y / MAP_CONFIG.NOISE_SCALE;
      const value = noise2D(nx, ny);
      
      let type: TerrainType = TerrainType.SEA;
      if (value > 0.6) type = TerrainType.CLIFF;
      else if (value > -0.2) type = TerrainType.GRASS;
      else if (value > -0.4) type = TerrainType.BEACH;
      row.push(type);
    }
    map.push(row);
  }

  // 임의의 도시(거점) 3개 생성 (초원 영역에)
  const cities: Point[] = [];
  while (cities.length < 3) {
    const rx = Math.floor(Math.random() * width);
    const ry = Math.floor(Math.random() * height);
    if (map[ry][rx] === TerrainType.GRASS) {
      cities.push({ x: rx, y: ry });
    }
  }

  // 도시들을 잇는 Path 생성 로직 (A*)
  for (let i = 0; i < cities.length; i++) {
    const start = cities[i];
    const end = cities[(i + 1) % cities.length];
    const path = findPath(map, start, end);
    
    for (const p of path) {
      if (map[p.y][p.x] !== TerrainType.SEA && map[p.y][p.x] !== TerrainType.CLIFF) {
        map[p.y][p.x] = TerrainType.PATH;
      }
    }
  }

  return { map, cities };
}
