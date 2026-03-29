// J:/AI/Game/SRPG/src/utils/provinceGenerator.ts
// 판 구조론 기반 지형 생성 시스템
//
// 파이프라인:
//   1. 지각판 (5~7개) 생성 + 방향 벡터
//   2. 판 경계 유형 판별 (수렴/발산/변환)
//   3. 고도 맵: 판 경계 스트레스 + FBM 노이즈
//   4. 습도 맵: 독립 노이즈 (숲 vs 황무지 구분)
//   5. 지형 타입 분류 (7가지)
//   6. 마이크로셀(600개) + Lloyd 완화 → Province 그룹화
//   7. 지형 연동 Province 이름 자동 부여

import { Delaunay } from 'd3-delaunay';
import type { Province } from '../types/appTypes';
import type { FactionId } from '../types/gameTypes';
import { FACTIONS } from '../constants/gameConfig';

// ─── 지형 타입 ────────────────────────────────────────────────────────────────
export type TerrainType =
  | 'peak'        // 화산/최고봉 (h ≥ 0.82)
  | 'mountain'    // 산악     (h 0.65~0.82)
  | 'hill'        // 구릉/고원 (h 0.50~0.65)
  | 'forest'      // 활엽수림  (온대 + 습윤)
  | 'taiga'       // 침엽수림  (냉대/한대 + 습윤)
  | 'plains'      // 평야     (온대 + 보통)
  | 'savanna'     // 사바나   (열대 + 보통)
  | 'desert'      // 사막/황야 (열/온대 + 건조)
  | 'tundra'      // 툰드라   (한대 + 건조)
  | 'ice'         // 빙하/만년설 (극지방)
  | 'coastal'     // 해안     (h 0.08~0.20)
  | 'ocean';      // 바다     (h < 0.08)

// 지형별 이름 풀
const TERRAIN_NAMES: Record<Exclude<TerrainType, 'ocean'>, string[][]> = {
  peak: [
    ['철봉 요새', '비룡의 둥지', '구름 위 성채', '천공 요새', '숨겨진 뾰족산'],
    ['화염 봉우리', '검은 용암산', '암흑 요새', '폭풍 봉우리', '재앙의 화산'],
    ['중앙 봉우리', '안개 봉우리', '고산 요새', '구름 철봉', '고요한 вър'],
  ],
  mountain: [
    ['금강 산맥', '은빛 장벽', '바람맞이 산맥', '서쪽 요새', '철옹 산맥'],
    ['붉은 산맥', '피의 산맥', '동방 요새', '암흑 산맥', '용암 지대'],
    ['경계 산맥', '단층 산맥', '안개 산맥', '분계 요새', '그림자 산맥'],
  ],
  hill: [
    ['서방 구릉', '낙조 고원', '은빛 대지', '바람 구릉', '고요한 고원'],
    ['황토 구릉', '붉은 고지', '동쪽 대지', '메마른 언덕', '울퉁불퉁한 대지'],
    ['경계 고원', '안개 고원', '중앙 구릉', '떠도는 땅', '회색 고지'],
  ],
  forest: [
    ['서쪽 숲', '은백 삼림', '낙엽 숲', '요정의 숲', '청송 숲'],
    ['어둠 숲', '독거미 수풀', '맹수 삼림', '동방 삼림', '핏빛 숲'],
    ['중앙 숲', '안개 숲', '경계 삼림', '은둔 숲', '이끼 숲'],
  ],
  taiga: [
    ['북방 침엽수림', '검은 숲', '서리송림', '얼어붙은 수해', '만년송 숲'],
    ['냉혹한 숲', '회색 침엽수림', '백설 삼림', '겨울수풀', '사령의 숲'],
    ['경계의 눈숲', '고요한 침엽수림', '안개 낀 설림', '푸른바늘 숲', '눈꽃 숲'],
  ],
  plains: [
    ['가을 보리밭', '풍요의 대지', '광활 평야', '서방 들판', '황금초원'],
    ['동쪽 평원', '붉은 평야', '거친 들판', '전쟁의 평원', '핏빛 대지'],
    ['중앙 평원', '안개 평원', '경계 들판', '바람 평야', '회색 들판'],
  ],
  savanna: [
    ['마른 풀밭', '가젤의 들판', '사자 평원', '뜨거운 초원', '노란 대지'],
    ['용골 사바나', '메마른 사냥터', '붉은 열대 초원', '태양의 들판', '갈라진 흙먼지'],
    ['얼룩 평원', '모래 섞인 초원', '야생의 평원', '먼지바람 대지', '고요한 사바나'],
  ],
  desert: [
    ['황금 모래언덕', '하얀 소금사막', '망각의 사막', '바람의 황무지', '오아시스 상단'],
    ['죽음의 사막', '붉은 모래폭풍', '저주받은 사구', '작열하는 잿빛 사막', '독사 사막'],
    ['갈라진 대지', '끝없는 모래바다', '미라의 황야', '모래 무덤', '신기루 사막'],
  ],
  tundra: [
    ['동토의 대지', '창백한 툰드라', '서리낀 이끼밭', '북풍의 거친 땅', '창빙의 벌판'],
    ['마수 툰드라', '붉은 눈의 황야', '시체꽃 피는 동토', '혹한의 불모지', '죽음의 한파'],
    ['고요한 동토', '경계의 툰드라', '눈보라 치는 무덤', '얼어붙은 황무지', '백색 불모지'],
  ],
  ice: [
    ['만년설', '순백의 빙하', '빙룡의 안식처', '영구 결빙지', '하얀 지옥'],
    ['칼날 얼음산', '피로 물든 빙하', '부서진 빙붕', '가라앉는 거대 얼음', '절망의 크레바스'],
    ['망각의 눈밭', '어둠 속 빙하', '거인의 발자국', '얼음 장벽', '푸른 눈동자'],
  ],
  coastal: [
    ['서해안 영지', '백사 항구', '찰랑이는 해안', '백설 포구', '은빛 물결'],
    ['동방 항구', '검은 항구', '해적단 둥지', '적조 포구', '붉은 산호 해안'],
    ['버려진 해안', '안개 곶', '잿빛 해변', '경계 반도', '황량한 백사장'],
  ],
};


// ─── 파라미터 ─────────────────────────────────────────────────────────────────
const MICRO_CELLS    = 12000;  // 마이크로셀 (12000개: Azgaar 스타일의 날카로운 프랙탈을 위한 초고해상도 배정)
const PLATE_COUNT    = 15;     // 지각판 개수 스케일 업 (기존 6개 -> 15개)
const OCEAN_H        = 0.36;   // 바다 임계값 — 낮출수록 육지 비중 증가
const LAND_H_COASTAL = 0.48;   // 해안 상한
const LAND_H_PLAINS  = 0.58;   // 평야 상한
const LAND_H_HIGH    = 0.70;   // 고원 상한
const LAND_H_MOUNT   = 0.82;   // 산악 상한

// ─── 시드 기반 LCG ─────────────────────────────────────────────────────────────
function makePRNG(seed: number) {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  };
}

// ─── 2D Perlin-like 노이즈 ────────────────────────────────────────────────────
function makeNoise2D(seed: number) {
  const p = new Uint8Array(512);
  const r = makePRNG(seed ^ 0xdeadbeef);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 256; i++) p[i + 256] = p[i];
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp  = (a: number, b: number, t: number) => a + t * (b - a);
  const grad  = (h: number, x: number, y: number) => {
    const v = h & 3;
    return ((v & 1) ? -(v < 2 ? x : y) : (v < 2 ? x : y))
         + ((v & 2) ? -(v < 2 ? y : x) : (v < 2 ? y : x));
  };
  return (x: number, y: number): number => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const a = p[X] + Y, b = p[X + 1] + Y;
    return lerp(
      lerp(grad(p[a],   xf,   yf),   grad(p[b],   xf-1, yf),   u),
      lerp(grad(p[a+1], xf,   yf-1), grad(p[b+1], xf-1, yf-1), u),
      v
    );
  };
}

// ─── FBM (Fractal Brownian Motion) ────────────────────────────────────────────
function fbm(
  noise: ReturnType<typeof makeNoise2D>,
  x: number, y: number,
  octaves = 5,
  lacunarity = 2.1,
  gain = 0.5,
): number {
  let v = 0, amp = 0.5, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    v   += noise(x * freq, y * freq) * amp;
    max += amp;
    amp  *= gain;
    freq *= lacunarity;
  }
  return v / max; // -1 ~ 1 정규화
}

// ─── 거리² ────────────────────────────────────────────────────────────────────
function dist2(ax: number, ay: number, bx: number, by: number) {
  return (ax - bx) ** 2 + (ay - by) ** 2;
}

// ─── 내적 ────────────────────────────────────────────────────────────────────
function dot(ax: number, ay: number, bx: number, by: number) {
  return ax * bx + ay * by;
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. 지형 왜곡 함수 (Fractal Edge)
// ──────────────────────────────────────────────────────────────────────────────
function fractalizeEdge(
  x1: number, y1: number,
  x2: number, y2: number,
  noiseFunc: (x: number, y: number) => number,
  magnitude: number = 2.5
): number[] {
  // 항상 동일한 중간점을 얻기 위해 시작/끝점의 순서를 일관되게 고정 (해시 대신 좌표 비교)
  const isReversed = x1 > x2 || (x1 === x2 && y1 > y2);
  const px1 = isReversed ? x2 : x1;
  const py1 = isReversed ? y2 : y1;
  const px2 = isReversed ? x1 : x2;
  const py2 = isReversed ? y1 : y2;

  const dx = px2 - px1;
  const dy = py2 - py1;
  const length = Math.sqrt(dx * dx + dy * dy);

  // 무조건 3개 이상의 세그먼트로 분할하여 짧은 엣지에서도 왜곡이 발생하도록 함 (1.5픽셀 단위)
  // 단, Delaunay circumcenter가 무한대 근처로 튀는 경우에 대비해 최대 분할 수를 200으로 제한합니다.
  const rawSegments = Math.floor(length / 1.5);
  const segments = Math.min(Math.max(3, rawSegments), 200);
  const pts: number[] = [px1, py1];

  if (segments > 1) {
    const nx = -dy / length;
    const ny = dx / length;

    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      let ix = px1 + dx * t;
      let iy = py1 + dy * t;

      // 주파수를 높여 더 자글자글한 자연스러운 굴곡 형성
      const nv = fbm(noiseFunc, ix * 0.25, iy * 0.25, 3);
      
      const taper = Math.sin(t * Math.PI);
      
      ix += nx * nv * magnitude * taper;
      iy += ny * nv * magnitude * taper;

      pts.push(ix, iy);
    }
  }
  pts.push(px2, py2);

  // 원래 방향으로 다시 뒤집어서 반환
  if (isReversed) {
    const rev: number[] = [];
    for (let i = pts.length - 2; i >= 0; i -= 2) {
      rev.push(pts[i], pts[i + 1]);
    }
    return rev;
  }
  return pts;
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. 지각판 시뮬레이션
// ──────────────────────────────────────────────────────────────────────────────
interface Plate {
  cx: number; cy: number; // 중심 (0~1 정규화)
  vx: number; vy: number; // 이동 방향 벡터 (단위 벡터)
  isOceanic: boolean;     // true = 해양판 (낮은 기저 고도)
}

function generatePlates(rand: () => number): Plate[] {
  const plates: Plate[] = [];
  for (let i = 0; i < PLATE_COUNT; i++) {
    const angle = rand() * Math.PI * 2;
    const speed = 0.3 + rand() * 0.7;
    plates.push({
      cx: 0.1 + rand() * 0.8,
      cy: 0.1 + rand() * 0.8,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      isOceanic: rand() < 0.35,  // 35% 확률로 해양판
    });
  }
  return plates;
}

/** 주어진 좌표가 속한 지각판 인덱스 반환 */
function getPlateIndex(px: number, py: number, plates: Plate[]): number {
  let minD = Infinity, idx = 0;
  for (let i = 0; i < plates.length; i++) {
    const d = dist2(px, py, plates[i].cx, plates[i].cy);
    if (d < minD) { minD = d; idx = i; }
  }
  return idx;
}

/** 판 경계 스트레스 계산 (0~1, 높을수록 산맥 형성) */
function plateBoundaryStress(
  px: number, py: number,
  plates: Plate[],
): number {
  // 1, 2번째 가까운 판 찾기
  let d1 = Infinity, d2 = Infinity, i1 = 0, i2 = 1;
  for (let i = 0; i < plates.length; i++) {
    const d = dist2(px, py, plates[i].cx, plates[i].cy);
    if (d < d1) { d2 = d1; i2 = i1; d1 = d; i1 = i; }
    else if (d < d2) { d2 = d; i2 = i; }
  }

  // 두 판 간 거리 (경계에 가까울수록 높음)
  const totalD = Math.sqrt(d1) + Math.sqrt(d2);
  const proximity = 1.0 - Math.abs(Math.sqrt(d1) - Math.sqrt(d2)) / totalD;

  // 두 판의 충돌 방향 판별
  const p1 = plates[i1], p2 = plates[i2];
  // 판1→판2 방향 단위 벡터
  const dx = p2.cx - p1.cx, dy = p2.cy - p1.cy;
  const len = Math.sqrt(dx * dx + dy * dy) + 1e-9;
  const nx = dx / len, ny = dy / len;
  // 상대 속도의 수렴 성분 (양수 = 수렴, 음수 = 발산)
  const relVx = p1.vx - p2.vx, relVy = p1.vy - p2.vy;
  const convergence = dot(relVx, relVy, nx, ny); // -1 ~ 1

  // 수렴 경계 → 높은 스트레스 (산맥)
  // 발산 경계 → 낮은 스트레스 (계곡)
  const stress = proximity * Math.max(0, convergence) * 2.5;
  return Math.min(1, stress);
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. 고도 맵 생성
// ──────────────────────────────────────────────────────────────────────────────
function computeHeight(
  nx: number, ny: number,
  plates: Plate[],
  heightNoise: ReturnType<typeof makeNoise2D>,
): number {
  const cx = nx - 0.5, cy = ny - 0.5;
  
  // 1. 대륙 윤곽용 거대 도메인 워핑 (Domain Warping)
  // 지도의 전체 형태(대륙의 윤곽) 자체가 구불구불한 덩어리가 되도록 좌표를 먼저 심하게 왜곡합니다.
  const outlineWarpX = fbm(heightNoise, nx * 2.1, ny * 2.1, 4) * 0.35;
  const outlineWarpY = fbm(heightNoise, nx * 2.1 + 7.3, ny * 2.1 + 2.4, 4) * 0.35;
  
  // 중심으로부터의 거리 (마스크용)
  const wx = cx + outlineWarpX;
  const wy = cy + outlineWarpY;
  const d = Math.sqrt(wx * wx + wy * wy) * 2.0; 
  
  // 외곽으로 갈수록 고도가 깎이는 양 (급격한 추락 방지, 노이즈와 결합해 섬/반도 형성)
  const borderDrop = Math.pow(Math.max(0, d - 0.28), 2) * 1.1; // 외곽 바다: 시작 거리 줄이고 계수 강화

  // 2. 대륙 단위 형성을 위한 초저주파 노이즈 (거대 대륙 및 부속 섬 분리)
  const continentNoise = fbm(heightNoise, nx * 2.0, ny * 2.0, 4); // -1 ~ 1
  
  // 3. 해안선을 찢어지게 만드는 프랙탈 노이즈 (피오르드,리아스식 해안)
  // 12000셀로 정밀도가 상향되었으므로 주파수와 진폭을 올려 훨씬 날카로운 프랙탈을 생성합니다.
  const macroStr = fbm(heightNoise, nx * 8.0, ny * 8.0, 6) * 0.70; // 해안선 프랙탈 노이즈 진폭 강화 → 불규칙 해안

  // 4. 지각판(산맥) 기계적 스트레스 (Domain Warping 추가 적용)
  const warpX = fbm(heightNoise, nx * 3.5, ny * 3.5, 3) * 0.2;
  const warpY = fbm(heightNoise, nx * 3.5 + 5.2, ny * 3.5 + 1.3, 3) * 0.2;
  const px = nx + warpX;
  const py = ny + warpY;

  const plateIdx = getPlateIndex(px, py, plates);
  const plate = plates[plateIdx];
  const stress = plateBoundaryStress(px, py, plates);
  const tectonicH = stress * 0.35; // 산맥 형성 비중 완화

  // 5. 미세 지형 노이즈 디테일 (자글자글한 점보딩 섬과 거친 지표면)
  const detailStr = fbm(heightNoise, nx * 12.0, ny * 12.0, 6) * 0.15;

  // 해양판은 고도를 낮추고 대륙판은 높임
  const basalH = plate.isOceanic ? 0.0 : 0.45; // 대륙판 기본 고도 상향 → 육지 비중 확대

  // 6. 전체 합성 고도 계산 (합산 후 borderDrop으로 해안선 깎기)
  let raw = basalH + (continentNoise * 0.3) + macroStr + tectonicH + detailStr - borderDrop;
  
  return Math.max(0, Math.min(1, raw));
}

// ──────────────────────────────────────────────────────────────────────────────
// 3. 지형 타입 분류
// ──────────────────────────────────────────────────────────────────────────────
function classifyTerrain(h: number, moisture: number, temp: number): TerrainType {
  if (h < OCEAN_H)        return 'ocean';
  if (h < LAND_H_COASTAL) return 'coastal';
  
  // 산맥지대
  if (h > LAND_H_MOUNT) return (temp < 0.35) ? 'ice' : 'peak';
  if (h > LAND_H_HIGH)  return 'mountain';
  
  // 구릉지대 (Hill)
  if (h > LAND_H_PLAINS) {
    if (temp < 0.3) return 'tundra';
    return 'hill';
  }

  // 평지/저지대 (Plains & Forests)
  if (temp < 0.35) { // 한대/냉대
    if (moisture > 0.45) return 'taiga';
    return 'tundra';
  } else if (temp < 0.7) { // 온대
    if (moisture > 0.55) return 'forest';
    if (moisture < 0.35) return 'desert';
    return 'plains';
  } else { // 열대
    if (moisture > 0.6) return 'forest'; // 정글을 숲으로 묶어 처리
    if (moisture < 0.4) return 'desert';
    return 'savanna';
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 4. 지형 연동 이름 부여
// ──────────────────────────────────────────────────────────────────────────────
function getTerrainName(
  terrain: TerrainType,
  faction: FactionId,
  isCoastal: boolean, // Province가 바다에 접해 있으면 해안 이름 우선
  nameIdx: number,    // 이름 풀 인덱스 (중복 방지)
): string {
  // 해안 Province는 해안 이름 우선 (단 화산, 빙하 등 특수지형 제외)
  const effectiveTerrain = (isCoastal && !['peak', 'mountain', 'ice'].includes(terrain))
    ? 'coastal'
    : terrain;

  const factionPool =
    faction === 'western_empire'   ? 0 :
    faction === 'eastern_alliance' ? 1 : 2;

  const pool = TERRAIN_NAMES[effectiveTerrain as Exclude<TerrainType, 'ocean'>]?.[factionPool] ?? [];
  return pool[nameIdx % pool.length] ?? `지역-${nameIdx}`;
}

// ─── 타입 정의 ────────────────────────────────────────────────────────────────
export interface MicroCell {
  idx:        number;
  path:       string;
  cx:         number;
  cy:         number;
  isOcean:    boolean;
  terrain:    TerrainType;
  provinceId: string | null;
  province:   Province | null;
}

export interface BoundaryEdge {
  pts: number[];
  isFactionBoundary: boolean;
  provIdA: string | null;
  provIdB: string | null;
}

export type TerrainIconType = 'mountain' | 'peak' | 'forest';
export interface TerrainIcon {
  type: TerrainIconType;
  x: number;
  y: number;
  s: number; // size
}

export interface RiverSegment {
  x1: number; y1: number;
  x2: number; y2: number;
  flux: number; // 강폭 결정을 위한 수량
  pts: number[]; // 유기적 렌더링을 위한 곡선 폴리라인
}

export interface ProvinceWithCells {
  provinces:     Record<string, Province>;
  allCells:      MicroCell[];
  boundaryEdges: BoundaryEdge[];
  oceanDepth:    number[];
  terrainIcons:  TerrainIcon[];
  rivers: RiverSegment[];    // 맵 전역에 흐르는 강 줄기들
  coastlineEdges: { pts: number[] }[];
  coastlinePolygons: number[][];
}

// ──────────────────────────────────────────────────────────────────────────────
// 메인
// ──────────────────────────────────────────────────────────────────────────────
export function generateProvinces(
  svgW: number,
  svgH: number,
  seed: number = Date.now(),
): ProvinceWithCells {
  const rand        = makePRNG(seed);
  const heightNoise = makeNoise2D(seed ^ 0xcafebabe);
  const moistNoise  = makeNoise2D(seed ^ 0xdeadc0de);

  // ── 1. 지각판 생성 ────────────────────────────────────────────────────────
  const plates = generatePlates(rand);

  // ── 2. 마이크로셀 포인트 생성 ─────────────────────────────────────────────
  const microPts: [number, number][] = [];
  for (let i = 0; i < MICRO_CELLS; i++) {
    microPts.push([
      (0.02 + rand() * 0.96) * svgW,
      (0.02 + rand() * 0.96) * svgH,
    ]);
  }

  // ── 3. Lloyd 완화 (2회) ──────────────────────────────────────────────────
  for (let iter = 0; iter < 2; iter++) {
    const del = Delaunay.from(microPts);
    const vor = del.voronoi([0, 0, svgW, svgH]);
    for (let i = 0; i < MICRO_CELLS; i++) {
      const cell = vor.cellPolygon(i);
      if (!cell || cell.length < 3) continue;
      let sx = 0, sy = 0, n = 0;
      for (const [px, py] of cell) { sx += px; sy += py; n++; }
      microPts[i] = [sx / n, sy / n];
    }
  }

  // ── 4. Voronoi 최종 계산 ─────────────────────────────────────────────────
  const delaunay = Delaunay.from(microPts);
  const voronoi  = delaunay.voronoi([0, 0, svgW, svgH]);

  // ── 5. 각 마이크로셀 고도 + 기온 + 습도 + 지형 ──────────────────────────
  const cellHeights: number[] = [];
  const cellMoistures: number[] = [];
  const cellTemperatures: number[] = [];
  const cellTerrains: TerrainType[] = [];

  for (let i = 0; i < MICRO_CELLS; i++) {
    const nx = microPts[i][0] / svgW;
    const ny = microPts[i][1] / svgH;
    const h  = computeHeight(nx, ny, plates, heightNoise);
    
    // 온도: 위도 기반(중앙이 높음 1.0, 극지방 0.0) + 노이즈 편차
    const baseTemp = 1.0 - Math.pow(Math.abs(ny - 0.5) * 2.0, 1.5);
    const tempNoise = (fbm(heightNoise, nx * 3.0, ny * 3.0, 3) + 1) * 0.5;
    const temp = Math.max(0, Math.min(1, baseTemp * 0.8 + tempNoise * 0.2));

    // 습도: 독립 노이즈 0~1 정규화
    const m  = (fbm(moistNoise, nx * 4, ny * 4) + 1) * 0.5;

    cellHeights.push(h);
    cellMoistures.push(m);
    cellTemperatures.push(temp);
    cellTerrains.push(classifyTerrain(h, m, temp));
  }

  const isLand  = cellTerrains.map(t => t !== 'ocean');
  const landIdxs = microPts.map((_, i) => i).filter(i => isLand[i]);

  // ── 6. Voronoi 이웃 구조 빌드 (Basin 탐지 + Dijkstra 공용) ────────────────
  const { halfedges, triangles } = delaunay;
  const cellNeighbors: number[][] = Array.from({ length: MICRO_CELLS }, () => []);
  for (let e = 0; e < halfedges.length; e++) {
    const opp = halfedges[e];
    if (opp < e || opp === -1) continue;
    const a = triangles[e], b = triangles[opp];
    if (a < MICRO_CELLS && b < MICRO_CELLS) {
      cellNeighbors[a].push(b);
      cellNeighbors[b].push(a);
    }
  }

  // ── 6. 세력별 씨드 영역 할당 (K-Means++ 방식 다중 거점 분할) ──────────────────
  const factionKeys = Object.keys(FACTIONS);
  const K = factionKeys.length; // 15개 세력 등 동적 구성

  // K-Means++ 중심점 초기화: 대륙에서 서로 가장 멀리 떨어지도록 K개의 거점(센터) 선택
  const caps: number[] = [];
  caps.push(landIdxs[Math.floor(rand() * landIdxs.length)]); // 첫 점 무작위
  
  for (let i = 1; i < K; i++) {
    let maxDist = -1;
    let nextCap = landIdxs[0];
    for (const idx of landIdxs) {
      // 현재 육지 점이 이미 선택된 거점들까지 갖는 최소 거리 計算
      let minDist = Infinity;
      for (const cap of caps) {
        const d = dist2(microPts[cap][0], microPts[cap][1], microPts[idx][0], microPts[idx][1]);
        if (d < minDist) minDist = d;
      }
      if (minDist > maxDist) {
        maxDist = minDist;
        nextCap = idx;
      }
    }
    caps.push(nextCap);
  }

  // 생성된 거점들을 서(x낮음) -> 동(x높음) 순서로 임의 정렬하여 세력 키 순서와 할당
  caps.sort((a, b) => microPts[a][0] - microPts[b][0]);

  const factionCells: Record<FactionId, number[]> = {};
  factionKeys.forEach(fId => factionCells[fId] = []);

  // ── 6-d. 다익스트라(Region Growing)를 통한 유기적 세력 영토 분할 ────────────────
  // 기존의 유클리드 거리(`dist2`) 방식은 거시적 경계선이 완전한 일직선(Voronoi 엣지)으로 형성되는 문제가 있어,
  // 지형 코스트와 랜덤 노이즈를 포함한 확장(Dijkstra) 방식으로 세력 권역을 자연스럽게 쪼갭니다.
  function factionExpandCost(ha: number, hb: number): number {
    const h = Math.max(ha, hb);
    if (h > LAND_H_MOUNT)  return 15.0; // 산맥은 확장을 매우 더디게 함
    if (h > LAND_H_HIGH)   return 5.0;
    if (h > LAND_H_PLAINS) return 2.0;
    return 1.0;
  }

  const cellToCap = new Array<number | null>(MICRO_CELLS).fill(null);
  const capDist    = new Float64Array(MICRO_CELLS).fill(Infinity);
  // [cost, cellIdx, capIndex]
  const capQ: [number, number, number][] = [];

  for (let c = 0; c < K; c++) {
    const mi = caps[c];
    capDist[mi] = 0;
    cellToCap[mi] = c;
    capQ.push([0, mi, c]);
  }
  
  while (capQ.length > 0) {
    const [cost, ci, capIdx] = capQ.shift()!;
    if (cost > capDist[ci]) continue;

    for (const nb of cellNeighbors[ci]) {
      if (!isLand[nb]) continue;
      // 노이즈(0.6 ~ 1.4)를 각 스텝마다 추가하여 일직선 경계선이 형성되는 것을 원천 차단
      const noise = 0.6 + rand() * 0.8;
      const stepCost = factionExpandCost(cellHeights[ci], cellHeights[nb]) * noise;
      const newCost = cost + stepCost;

      if (newCost < capDist[nb]) {
        capDist[nb] = newCost;
        cellToCap[nb] = capIdx;
        let lo = 0, hi = capQ.length;
        while (lo < hi) { const m = (lo + hi) >> 1; capQ[m][0] < newCost ? (lo = m+1) : (hi = m); }
        capQ.splice(lo, 0, [newCost, nb, capIdx]);
      }
    }
  }

  // 모든 육지 셀 편입
  for (const idx of landIdxs) {
    if (cellToCap[idx] !== null) {
      factionCells[factionKeys[cellToCap[idx]]].push(idx);
    } else {
      // 고립된 섬이나 육지가 남은 경우 (가장 가까운 유클리드 거리 강제 배정)
      let minDist = Infinity;
      let closestIdx = 0;
      for (let c = 0; c < K; c++) {
        const d = dist2(microPts[caps[c]][0], microPts[caps[c]][1], microPts[idx][0], microPts[idx][1]);
        if (d < minDist) { minDist = d; closestIdx = c; }
      }
      factionCells[factionKeys[closestIdx]].push(idx);
    }
  }


  // ── 6-e. 각 세력 유역 내에서 Province 씨드 선택 ──────────────────────────
  // 씨드 선택 기준: Farthest Point Sampling(지형 가중치 포함)으로 최대한 고르게 흩뿌림
  type SeedInfo = { mi: number; px: number; py: number; faction: FactionId; order: number };

  function pickSeedsFromCells(
    cells: number[],
    count: number,
    faction: FactionId,
  ): SeedInfo[] {
    const result: SeedInfo[] = [];
    if (cells.length === 0) return result;
    
    // 지형 우선도에 따른 기본 가중치 상수 (낮을수록 선호됨 - 거리 계산 시 페널티로 작용)
    const getTerrainCost = (mi: number): number => {
      const t = cellTerrains[mi];
      if (t === 'plains' || t === 'hill') return 1.0;
      if (t === 'forest' || t === 'savanna' || t === 'coastal') return 1.5;
      return 3.0; // 산악, 빙하, 사막 등 험지
    };

    // 첫 번째 씨드: 세력 영역의 무게 중심에 가장 가까우면서 지형 조건이 좋은 곳 선택
    let bestFirst = cells[0];
    let bestFirstScore = Infinity;
    
    let cx = 0, cy = 0;
    for (const mi of cells) {
      cx += microPts[mi][0];
      cy += microPts[mi][1];
    }
    cx /= cells.length;
    cy /= cells.length;

    for (const mi of cells) {
      const dCenter = Math.sqrt(dist2(microPts[mi][0], microPts[mi][1], cx, cy));
      // 무게 중심에서의 거리 + 지형 페널티 + 고도 페널티
      const score = (getTerrainCost(mi) * 500) + (cellHeights[mi] * 200) + dCenter;
      if (score < bestFirstScore) {
        bestFirstScore = score;
        bestFirst = mi;
      }
    }
    
    result.push({ mi: bestFirst, px: microPts[bestFirst][0], py: microPts[bestFirst][1], faction, order: 0 });

    // 나머지 count - 1 개 씨드를 FPS 기반으로 가장 멀리 떨어진 위치에 다단계 배치
    for (let i = 1; i < count; i++) {
      let bestMi = -1;
      let maxScore = -Infinity;
      
      for (const mi of cells) {
        // 이미 선택된 셀 제외
        let isAlreadyPicked = false;
        let minDist2 = Infinity;
        const px = microPts[mi][0];
        const py = microPts[mi][1];
        
        for (const r of result) {
          if (r.mi === mi) {
            isAlreadyPicked = true;
            break;
          }
          const d2 = dist2(px, py, r.px, r.py);
          if (d2 < minDist2) minDist2 = d2;
        }
        if (isAlreadyPicked) continue;
        
        // 거리 점수 (멀수록 높음)를 지형 코스트로 나눔 => 평야에 이점이 주어지되, 거리가 가장 중요함
        const score = Math.sqrt(minDist2) / getTerrainCost(mi);
        if (score > maxScore) {
          maxScore = score;
          bestMi = mi;
        }
      }
      
      if (bestMi !== -1) {
        result.push({ mi: bestMi, px: microPts[bestMi][0], py: microPts[bestMi][1], faction, order: result.length });
      } else {
        break;
      }
    }
    
    return result;
  }

  // 총 씨드 목표치(예: 112개)를 세력별로 균등 배분
  const TOTAL_SEEDS = 112; 
  const seedPerFaction = Math.floor(TOTAL_SEEDS / K);
  const remainder = TOTAL_SEEDS % K;

  const seeds: SeedInfo[] = [];
  factionKeys.forEach((fId, index) => {
    // 나머지 수 만큼 1개씩 추가 배정
    const count = seedPerFaction + (index < remainder ? 1 : 0);
    // 각 세력 구역 내에서 씨드 추출
    seeds.push(...pickSeedsFromCells(factionCells[fId], count, fId));
  });

  const provinceIds = seeds.map((_, i) => `prov-${i}`);

  // ── 7. 지형 비용 기반 다중 소스 Dijkstra → Province 할당 ──────────────────
  // cellNeighbors / halfedges / triangles 는 Step 6에서 이미 선언됨 — 재사용

  // 7-b. 엣지 비용: 두 셀 중 높은 쪽 기준
  function edgeCost(ha: number, hb: number): number {
    const h = Math.max(ha, hb);
    let base = 1.0;
    if (h > LAND_H_MOUNT)  base = 5.0;  // 봉우리: 장벽 (25→5, 크기 균등화)
    else if (h > LAND_H_HIGH)   base = 3.0;  // 산악
    else if (h > LAND_H_PLAINS) base = 1.8;  // 고원

    // 자연스러운 영토 경계를 위해 이동 비용에 랜덤 노이즈 부여 (직선 형성 방지)
    const noise = 0.75 + rand() * 0.5;
    return base * noise;
  }

  // 7-c. 다중 소스 Dijkstra (binary-sorted array 방식)
  const microToProv = new Array<number | null>(MICRO_CELLS).fill(null);
  const costDist    = new Float64Array(MICRO_CELLS).fill(Infinity);

  // [cost, cellIdx, seedIdx] 형태의 정렬된 큐
  type PQItem = [number, number, number];
  const pq: PQItem[] = [];

  // 씨드 초기화
  for (let si = 0; si < seeds.length; si++) {
    const mi = seeds[si].mi;
    if (isLand[mi]) {
      costDist[mi]  = 0;
      microToProv[mi] = si;
      pq.push([0, mi, si]);
    }
  }
  pq.sort((a, b) => a[0] - b[0]);

  // Dijkstra 메인 루프
  while (pq.length > 0) {
    const [cost, ci, si] = pq.shift()!;
    if (cost > costDist[ci]) continue; // 더 짧은 경로가 이미 처리됨
    for (const nb of cellNeighbors[ci]) {
      if (!isLand[nb]) continue;
      const newCost = cost + edgeCost(cellHeights[ci], cellHeights[nb]);
      if (newCost < costDist[nb]) {
        costDist[nb]    = newCost;
        microToProv[nb] = si;
        // 이진 탐색 삽입 (정렬 유지)
        let lo = 0, hi = pq.length;
        while (lo < hi) { const m = (lo + hi) >> 1; pq[m][0] < newCost ? (lo = m+1) : (hi = m); }
        pq.splice(lo, 0, [newCost, nb, si]);
      }
    }
  }

  // ── 7-c. 소규모 섬(연결 컴포넌트) Province 단일 병합 ─────────────────────
  // 문제: 작은 섬 하나에 복수의 Province 씨드가 배정되어 마이크로셀 1~2개짜리
  //       극소 영지가 발생함. 섬의 셀 수가 임계치 미만이면 무조건 1개 Province로 합침.
  const SMALL_ISLAND_THRESHOLD = 80; // 이 셀 수 미만의 섬은 단일 Province로 병합

  // BFS로 육지 연결 컴포넌트(섬/대륙) 탐색
  const landCompId = new Int32Array(MICRO_CELLS).fill(-1);
  const landCompCells: number[][] = [];
  for (let i = 0; i < MICRO_CELLS; i++) {
    if (!isLand[i] || landCompId[i] !== -1) continue;
    const comp: number[] = [];
    const bfsQ: number[] = [i];
    landCompId[i] = landCompCells.length;
    let bfsHead = 0;
    while (bfsHead < bfsQ.length) {
      const ci = bfsQ[bfsHead++];
      comp.push(ci);
      for (const nb of cellNeighbors[ci]) {
        if (isLand[nb] && landCompId[nb] === -1) {
          landCompId[nb] = landCompCells.length;
          bfsQ.push(nb);
        }
      }
    }
    landCompCells.push(comp);
  }

  // 소규모 섬의 Province를 단일 Province로 강제 병합
  const mergedSeeds = new Set<number>(); // 흡수되어 사라질 seed 인덱스 집합
  for (const comp of landCompCells) {
    if (comp.length >= SMALL_ISLAND_THRESHOLD) continue; // 충분히 큰 섬/대륙 → 스킵

    // 이 섬에 속한 Province seed별 보유 셀 수 집계
    const seedCellCnt = new Map<number, number>();
    for (const ci of comp) {
      const si = microToProv[ci];
      if (si !== null) seedCellCnt.set(si, (seedCellCnt.get(si) ?? 0) + 1);
    }
    if (seedCellCnt.size <= 1) continue; // 이미 단일 Province → 스킵

    // 가장 많은 셀을 가진 seed를 survivor(대표)로 선택 (수도 씨드가 있으면 우선)
    let survivorSI = -1;
    let maxCnt = -1;
    for (const [si, cnt] of seedCellCnt) {
      // 첫 번째 씨드(수도 후보)를 우선 선택하되, 더 큰 쪽이 있으면 교체
      if (cnt > maxCnt) { maxCnt = cnt; survivorSI = si; }
    }
    if (survivorSI === -1) continue;

    // 섬 내 모든 셀을 survivor Province로 재할당
    for (const ci of comp) {
      microToProv[ci] = survivorSI;
    }
    // 흡수된 나머지 seed들을 병합 목록에 추가
    for (const [si] of seedCellCnt) {
      if (si !== survivorSI) mergedSeeds.add(si);
    }
  }

  // ── 8. Province 인접성 계산 ──────────────────────────────────────────────
  // mergedSeeds에 포함된 Province는 더 이상 존재하지 않으므로 provinceIds 조회 시 안전하게 처리
  const provAdjacency = new Map<string, Set<string>>();
  provinceIds.forEach((id, si) => { if (!mergedSeeds.has(si)) provAdjacency.set(id, new Set()); });

  // Province가 바다에 접해 있는지 (인접 마이크로셀 중 바다가 있으면)
  const provIsCoastal = new Set<string>();

  // halfedges / triangles 는 7번 스텝에서 이미 선언됨 — 재사용
  for (let e = 0; e < halfedges.length; e++) {
    const opp = halfedges[e];
    if (opp < e) continue;
    const a = triangles[e], b = triangles[opp];
    const pa = microToProv[a], pb = microToProv[b];
    // 육지-바다 접촉 → 해안 Province 마킹 (병합된 Province는 스킵)
    if (pa !== null && !mergedSeeds.has(pa) && !isLand[b]) provIsCoastal.add(provinceIds[pa]);
    if (pb !== null && !mergedSeeds.has(pb) && !isLand[a]) provIsCoastal.add(provinceIds[pb]);
    // Province-Province 인접 (병합된 Province는 존재하지 않으므로 스킵)
    if (pa === null || pb === null || pa === pb) continue;
    if (mergedSeeds.has(pa) || mergedSeeds.has(pb)) continue;
    const idA = provinceIds[pa], idB = provinceIds[pb];
    // provAdjacency에 등록된 경우에만 안전하게 추가
    provAdjacency.get(idA)?.add(idB);
    provAdjacency.get(idB)?.add(idA);
  }

  // ── 9. Province 지형 타입 (씨드 셀 기준) ─────────────────────────────────
  const seedTerrainOf = seeds.map(s => cellTerrains[s.mi]);

  // ── 10. Province 객체 생성 ───────────────────────────────────────────────
  const provinces: Record<string, Province> = {};
  // 세력별 이름 사용 카운터 (지형별)
  const nameCounters: Record<string, number> = {};

  const factionCapSet = new Set<string>();

  seeds.forEach((s, si) => {
    if (mergedSeeds.has(si)) return; // 병합(흡수)된 Province는 객체 생성 스킵
    const id      = provinceIds[si];
    const faction = s.faction;
    const terrain = seedTerrainOf[si];
    const isCoast = provIsCoastal.has(id);

    // 본거지 여부 및 이름
    let isCapital = false;
    let name: string;

    // 각 세력의 첫 번째 영토를 본거지(수도)로 지정
    if (!factionCapSet.has(faction)) {
      isCapital = true;
      factionCapSet.add(faction);
      // FACTIONS 객체에 등록된 이름을 활용하여 수도 이름 부여
      name = `${FACTIONS[faction]?.name.split(' ')[0]} 수도`; // 예: 아스칼론 수도
    } else {
      // 지형 연동 이름
      const counterKey = `${faction}-${isCoast ? 'coastal' : terrain}`;
      const idx = nameCounters[counterKey] ?? 0;
      nameCounters[counterKey] = idx + 1;
      name = getTerrainName(terrain, faction, isCoast, idx);
    }

    provinces[id] = {
      id,
      name,
      owner:       faction,
      isCapital,
      adjacentIds: Array.from(provAdjacency.get(id) ?? []),
      isCoastal:   isCoast,
      navalAdjacentIds: [], // 추후 해상 인접 계산을 통해 채워짐
      baseGoldProduction: Math.floor(rand() * 20) + 10,
      baseFoodProduction: Math.floor(rand() * 30) + 20,
      baseRecruitment: Math.floor(rand() * 10) + 5,
      security: 100,
      food:        Math.floor(rand() * 50) + 20,
      gold:        Math.floor(rand() * 40) + 10,
      seedX:       s.px / svgW,
      seedY:       s.py / svgH,
      terrainType: terrain,
      temperature: cellTemperatures[s.mi],
      moisture:    cellMoistures[s.mi],
    };
  });

  // ── 10-b. 일부 Province를 중립(빈 땅)으로 전환 ────────────────────────────
  // 수도는 유지, 산악/험지는 높은 확률, 일반 영지는 낮은 확률로 neutral 처리
  // 단, 세력 영토의 연결성이 끊기는 Province는 neutral 전환 금지

  // 세력별 수도 Province ID
  const factionCapProv: Record<string, string> = {};
  Object.entries(provinces).forEach(([id, p]) => {
    if (p.isCapital) factionCapProv[p.owner] = id;
  });

  // BFS: Province excludeId를 제거했을 때 faction 영토가 여전히 연결되어 있는지 확인
  const isFactionConnected = (faction: string, excludeId: string): boolean => {
    const capId = factionCapProv[faction];
    if (!capId || capId === excludeId) return false; // 수도가 제거되면 항상 분단
    const factionIds = Object.keys(provinces).filter(id => provinces[id].owner === faction && id !== excludeId);
    if (factionIds.length <= 1) return true; // 1개 이하면 분단 없음
    const visited = new Set<string>([capId]);
    const queue = [capId];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const adjId of provinces[cur].adjacentIds) {
        if (!visited.has(adjId) && provinces[adjId]?.owner === faction && adjId !== excludeId) {
          visited.add(adjId);
          queue.push(adjId);
        }
      }
    }
    return factionIds.every(id => visited.has(id));
  };

  Object.keys(provinces).forEach(id => {
    const p = provinces[id];
    if (p.isCapital) return;
    const isRough = p.terrainType === 'peak' || p.terrainType === 'mountain' || p.terrainType === 'ice';
    const neutralChance = isRough ? 0.60 : 0.20;
    if (rand() < neutralChance && isFactionConnected(p.owner, id)) {
      provinces[id] = { ...p, owner: 'neutral' as any };
    }
  });
  // ──────────────────────────────────────────────────────────────────────────

  // ── 11. allCells 구성 ────────────────────────────────────────────────────
  const vCellPolygons: ([number, number][] | null)[] = [];
  const allCells: MicroCell[] = [];
  for (let i = 0; i < MICRO_CELLS; i++) {
    const cell = voronoi.cellPolygon(i);
    vCellPolygons.push(cell);
    if (!cell || cell.length < 3) continue;

    // SVG path 문자열로 변환 (기존의 직선 다각형 유지)
    // 배경 채색은 PIXI.js 삼각화(earcut) 오류를 방지하기 위해 단순한 다각형으로 칠하고, 그 위의 윤곽선들만 프랙탈로 덧입힙니다.
    const path = 'M' + cell.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + 'Z';

    const si   = microToProv[i];
    const pid  = si !== null ? provinceIds[si] : null;
    allCells.push({
      idx:        i,
      path,
      cx:         microPts[i][0],
      cy:         microPts[i][1],
      isOcean:    !isLand[i],
      terrain:    cellTerrains[i],
      provinceId: pid,
      province:   pid ? provinces[pid] : null,
    });
  }

  // ── 12. Province 경계 및 해안선 엣지 계산 ─────────────────────────────
  const boundaryEdges: BoundaryEdge[] = [];
  const coastlineEdges: { pts: number[] }[] = [];
  const cc = voronoi.circumcenters;
  // 방향성 해안선 엣지. 육지를 항상 진행 방향의 왼쪽에 위치시키기 위함.
  interface DirectedEdge {
    t1: number;
    t2: number;
    pts: number[];
  }
  const directedCoastEdges: DirectedEdge[] = [];

  for (let e = 0; e < halfedges.length; e++) {
    const opp = halfedges[e];
    if (opp === -1 || opp < e) continue;
    const cellA = triangles[e], cellB = triangles[opp];
    
    const landA = isLand[cellA];
    const landB = isLand[cellB];
    const t1 = Math.floor(e / 3), t2 = Math.floor(opp / 3);
    const x1 = cc[2*t1], y1 = cc[2*t1+1], x2 = cc[2*t2], y2 = cc[2*t2+1];
    
    if (landA !== landB) {
      if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2)) {
        const edgePts = fractalizeEdge(x1, y1, x2, y2, heightNoise, 2.0);
        coastlineEdges.push({ pts: edgePts }); // 기존 렌더링 호환성 유지용 (잉크선)

        // 법선을 구해서 육지가 무조건 왼쪽에 오도록(반시계) 선분의 방향(start->end)을 강제합니다.
        let finalPts = edgePts;
        let finalT1 = t1;
        let finalT2 = t2;
        
        let dx = x2 - x1, dy = y2 - y1;
        let nx = -dy, ny = dx; // 진행 방향의 '왼쪽' 직교 벡터
        const landIdx = landA ? cellA : cellB;
        let cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
        let vx = microPts[landIdx][0] - cx, vy = microPts[landIdx][1] - cy;
        
        // 내적(Dot Product)이 음수이면 육지가 오른쪽에 있으므로 선분을 뒤집습니다.
        if (nx * vx + ny * vy < 0) {
          finalPts = [];
          for (let i = edgePts.length - 2; i >= 0; i -= 2) {
            finalPts.push(edgePts[i], edgePts[i+1]);
          }
          finalT1 = t2;
          finalT2 = t1;
        }
        
        directedCoastEdges.push({ t1: finalT1, t2: finalT2, pts: finalPts });
      }
    }

    const provA = microToProv[cellA], provB = microToProv[cellB];
    if (provA === provB) continue;
    if (provA === null && provB === null) continue;
    if (provA === null || provB === null) continue; 
    if (isNaN(x1)||isNaN(y1)||isNaN(x2)||isNaN(y2)) continue;
    const fA = seeds[provA].faction, fB = seeds[provB].faction;
    
    const edgePts = fractalizeEdge(x1, y1, x2, y2, heightNoise, 3.5);
    boundaryEdges.push({
      pts: edgePts,
      isFactionBoundary: fA !== fB,
      provIdA: provinceIds[provA],
      provIdB: provinceIds[provB],
    });
  }

  // 12-b. 해안선 파편들을 연속된 폴리곤(대륙 외곽선)으로 병합
  const coastlinePolygons: number[][] = [];
  const nextEdgeMap = new Map<number, DirectedEdge>();
  const inDegree = new Map<number, number>();
  
  for (const de of directedCoastEdges) {
    nextEdgeMap.set(de.t1, de);
    inDegree.set(de.t2, (inDegree.get(de.t2) || 0) + 1);
  }

  const visited = new Set<DirectedEdge>();

  // 1. 단절된 경로(맵 테두리에서 시작되는 대륙) 처리
  for (const de of directedCoastEdges) {
    if (visited.has(de)) continue;
    if (!inDegree.has(de.t1)) {
      const poly: number[] = [];
      let current: DirectedEdge | undefined = de;
      while (current && !visited.has(current)) {
        visited.add(current);
        if (poly.length === 0) poly.push(...current.pts);
        else {
          for (let i = 2; i < current.pts.length; i++) poly.push(current.pts[i]);
        }
        current = nextEdgeMap.get(current.t2);
      }
      coastlinePolygons.push(poly);
    }
  }

  // 2. 완전히 닫힌 루프(섬, 단일 대륙 등) 처리
  for (const de of directedCoastEdges) {
    if (visited.has(de)) continue;
    const poly: number[] = [];
    let current: DirectedEdge | undefined = de;
    while (current && !visited.has(current)) {
      visited.add(current);
      if (poly.length === 0) poly.push(...current.pts);
      else {
        for (let i = 2; i < current.pts.length; i++) poly.push(current.pts[i]);
      }
      current = nextEdgeMap.get(current.t2);
    }
    coastlinePolygons.push(poly);
  }

  // ── 13. 바다 깊이 BFS (해안 거리 1~4단계) ──────────────────────────────
  // 육지에서 시작해 바다 쪽으로 BFS → 거리 1=얕은 해안, 4+=심해
  const oceanDepth = new Int32Array(MICRO_CELLS).fill(0); // 0=육지, 1~4=깊이
  {
    const q: number[] = [];
    for (const i of landIdxs) { oceanDepth[i] = 0; q.push(i); }
    let qi = 0;
    while (qi < q.length) {
      const ci = q[qi++];
      for (const nb of cellNeighbors[ci]) {
        if (isLand[nb]) continue;              // 육지는 스킵
        if (oceanDepth[nb] !== 0) continue;   // 이미 처리
        oceanDepth[nb] = Math.min(oceanDepth[ci] + 1, 5);
        if (oceanDepth[nb] < 5) q.push(nb);   // 5 이상은 심해로 고정
      }
    }
  }

  // ── 14. 지형 아이콘 좌표 생성 (산 / 숲) ─────────────────────────────────
  // Poisson-disc 변형: 셀 중심 + 주변 오프셋으로 1~2개씩 배치
  const terrainIcons: TerrainIcon[] = [];
  {
    const MIN_ICON_DIST2 = 16 * 16; // 아이콘 간 최소 거리²
    const placed: { x: number; y: number }[] = [];

    function tryPlace(x: number, y: number, type: TerrainIconType, s: number) {
      if (x < 4 || y < 4 || x > svgW - 4 || y > svgH - 4) return;
      const tooClose = placed.some(p => (p.x - x) ** 2 + (p.y - y) ** 2 < MIN_ICON_DIST2);
      if (!tooClose) {
        placed.push({ x, y });
        terrainIcons.push({ type, x, y, s });
      }
    }

    for (let i = 0; i < MICRO_CELLS; i++) {
      const t = cellTerrains[i];
      if (t !== 'peak' && t !== 'mountain' && t !== 'forest') continue;
      const [cx, cy] = microPts[i];
      const cell = vCellPolygons[i];
      if (!cell || cell.length < 3) continue;

      // 셀 크기 추정 (bbox)
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [px, py] of cell) {
        if (px < minX) minX = px; if (px > maxX) maxX = px;
        if (py < minY) minY = py; if (py > maxY) maxY = py;
      }
      const w = maxX - minX, h = maxY - minY;
      const cellR = Math.min(w, h) * 0.4; // 셀 유효 반경

      if (t === 'peak') {
        const s = Math.min(cellR * 1.8, 22);
        tryPlace(cx, cy, 'peak', s);
        // 큰 셀이면 오프셋 추가 배치
        if (cellR > 14) {
          tryPlace(cx - cellR * 0.5, cy + cellR * 0.3, 'peak', s * 0.7);
          tryPlace(cx + cellR * 0.5, cy + cellR * 0.3, 'peak', s * 0.7);
        }
      } else if (t === 'mountain') {
        const s = Math.min(cellR * 1.4, 16);
        tryPlace(cx, cy, 'mountain', s);
        if (cellR > 12) tryPlace(cx + cellR * 0.55, cy - cellR * 0.1, 'mountain', s * 0.75);
      } else { // forest
        const s = Math.min(cellR * 1.1, 11);
        // 숲은 격자 형태로 여러 개 배치
        tryPlace(cx, cy - cellR * 0.2, 'forest', s);
        if (cellR > 10) {
          tryPlace(cx - cellR * 0.55, cy + cellR * 0.25, 'forest', s * 0.85);
          tryPlace(cx + cellR * 0.55, cy + cellR * 0.25, 'forest', s * 0.85);
        }
      }
    }
  }

  // ── 15. 강(River) 시스템 생성 ──────────────────────────────────────────────
  // 고도(cellHeights)를 기준으로 가장 낮은 인접 셀을 추적하여 배수(Drainage) 로직 형성
  const downhill = new Int32Array(MICRO_CELLS).fill(-1);
  for (let i = 0; i < MICRO_CELLS; i++) {
    if (!isLand[i]) continue;
    let minH = cellHeights[i];
    let minNb = -1;
    for (const nb of cellNeighbors[i]) {
      if (cellHeights[nb] < minH) {
        minH = cellHeights[nb];
        minNb = nb;
      }
    }
    downhill[i] = minNb;
  }

  // 육지 셀 고도 내림차순 정렬 (높은 곳 -> 낮은 곳으로 수분 이동)
  const sortedLand = Array.from(landIdxs).sort((a, b) => cellHeights[b] - cellHeights[a]);

  // Flux(수량) 누적: 기본 강수량 1에서 시작하여 시냇물들이 뭉쳐 강이 됨
  const flux = new Float64Array(MICRO_CELLS).fill(1);
  for (const i of sortedLand) {
    const nb = downhill[i];
    if (nb !== -1) {
      flux[nb] += flux[i];
    }
  }

  // 일정 수량 이상 모이면 강(River) 세그먼트로 등록
  const RIVER_THRESHOLD = 10; // 낮을수록 상류 구간도 포함됨 (너무 높으면 하류/해안만 보임)
  const rivers: RiverSegment[] = [];
  for (const i of landIdxs) {
    if (flux[i] >= RIVER_THRESHOLD) {
      const nb = downhill[i];
      if (nb !== -1) {
        const lx1 = microPts[i][0], ly1 = microPts[i][1];
        const lx2 = microPts[nb][0], ly2 = microPts[nb][1];
        const rEndX = isLand[nb] ? lx2 : (lx1 + lx2) / 2;
        const rEndY = isLand[nb] ? ly2 : (ly1 + ly2) / 2;
        const rPts = fractalizeEdge(lx1, ly1, rEndX, rEndY, heightNoise, 3.5);

        rivers.push({
          x1: lx1, y1: ly1,
          x2: rEndX,
          y2: rEndY,
          flux: flux[i] / RIVER_THRESHOLD,
          pts: rPts,
        });
      }
    }
  }

  // ── 16. 해상 인접(Naval Adjacency) 스캔 ────────────────────────────────
  // 해안가(isCoastal) 영지들 간에 일정 해상 거리 이하라면 원정 상륙이 가능하도록 서로를 연결
  // 너무 멀리 떨어진 신대륙까지 바로 가면 밸런스/시각 붕괴 우려가 있으므로, 근해(12% 거리)로 축소
  const NAVAL_RANGE_SQR = 0.12 * 0.12; 
  const coastalProvIds = Object.keys(provinces).filter(pid => provinces[pid].isCoastal);

  for (let i = 0; i < coastalProvIds.length; i++) {
    const pA = provinces[coastalProvIds[i]];
    for (let j = i + 1; j < coastalProvIds.length; j++) {
      const pB = provinces[coastalProvIds[j]];
      // 같은 팩션이든 아니든 유클리드 거리상 가깝다면 도항 루트 오픈
      const distSqr = (pA.seedX - pB.seedX) ** 2 + (pA.seedY - pB.seedY) ** 2;
      if (distSqr <= NAVAL_RANGE_SQR) {
        pA.navalAdjacentIds.push(pB.id);
        pB.navalAdjacentIds.push(pA.id);
      }
    }
  }

  return {
    provinces,
    allCells,
    boundaryEdges,
    oceanDepth: Array.from(oceanDepth),
    terrainIcons,
    rivers,
    coastlineEdges,
    coastlinePolygons,
  };
}
