import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Delaunay } from 'd3-delaunay';
import { generateProvinces } from '../utils/provinceGenerator';
import { useAppStore } from '../store/appStore';
import { useGameStore } from '../store/gameStore';
import type { Province } from '../types/appTypes';
import { FACTIONS, PLAYER_FACTION } from '../constants/gameConfig';
import { Stage, Container, Graphics as PixiGraphics, Text as PixiText, Sprite, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import HeroListModal from '../components/HeroListModal';
import DomesticModal, { type DomesticMenuType } from '../components/DomesticModal';
import ActionPanel from '../components/ActionPanel';
import SortieModal from '../components/SortieModal';

// 지형 스프라이트 매니페스트 (public/assets/ui/terrain/ 기반)
const TERRAIN_MANIFEST: Record<string, string[]> = {
  mountain_normal: ['mountain_normal_1.png', 'mountain_normal_2.png', 'mountain_normal_3.png', 'mountain_normal_4.png', 'mountain_normal_5.png'],
  mountain_rugged: ['mountain_rugged_1.png'],
  mountain_gentle: ['mountain_gentle_1.png'],
  hill: ['hill_1.png', 'hill_2.png'],
  tree_conifer: ['tree_conifer_1.png', 'tree_conifer_2.png', 'tree_conifer_3.png', 'tree_conifer_4.png', 'tree_conifer_5.png',
    'tree_conifer_6.png', 'tree_conifer_7.png', 'tree_conifer_8.png', 'tree_conifer_9.png', 'tree_conifer_10.png'],
  tree_deciduous: ['tree_deciduous_1.png', 'tree_deciduous_2.png', 'tree_deciduous_3.png', 'tree_deciduous_4.png', 'tree_deciduous_5.png', 'tree_deciduous_6.png'],
  castle: ['castle_1.png', 'castle_2.png'],
  fortress: ['fortress_1.png', 'fortress_2.png'],
  town_large: ['town_large_1.png'],
  town: ['town_1.png', 'town_2.png', 'town_3.png', 'town_4.png', 'town_5.png'],
  village: ['village_1.png', 'village_2.png', 'village_3.png'],
  ocean: ['ocean_1.png'],
};

// SVG를 파싱하여 WebGL이 그릴 숫자 쌍 배열을 얻는 극 초고속 함수
function parseSvgPathToPolygon(pathStr: string): number[] {
  const coordsStr = pathStr.replace(/[MZ]/g, '').replace(/L/g, ' ');
  const parts = coordsStr.split(/\s+/);
  const polygon: number[] = [];
  for (const part of parts) {
    if (!part) continue;
    const [x, y] = part.split(',');
    polygon.push(parseFloat(x), parseFloat(y));
  }
  return polygon;
}

// RGB 컬러 블렌딩 보조 함수 (세피아 틴트 믹스 용도)
function blendColors(c1: number, c2: number, ratio: number): number {
  const r1 = (c1 >> 16) & 0xff;
  const g1 = (c1 >> 8) & 0xff;
  const b1 = c1 & 0xff;
  const r2 = (c2 >> 16) & 0xff;
  const g2 = (c2 >> 8) & 0xff;
  const b2 = c2 & 0xff;
  const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
  const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
  const b = Math.round(b1 * (1 - ratio) + b2 * ratio);
  return (r << 16) | (g << 8) | b;
}



const SVG_W = 1440;
const SVG_H = 820;

type MapMode = 'faction' | 'terrain' | 'security' | 'resource';



export const StrategyMapScreen = () => {
  // ─── appStore 구독 ────────────────────────────────────────────────────────
  const worldSeed = useAppStore(s => s.worldSeed);
  const strategyTurn = useAppStore(s => s.strategyTurn);
  const storeProvinces = useAppStore(s => s.provinces);
  const selectedProvinceId = useAppStore(s => s.selectedProvinceId);
  const selectProvince = useAppStore(s => s.selectProvince);
  const endStrategyTurn = useAppStore(s => s.endStrategyTurn);
  const factionResources = useAppStore(s => s.factionResources);
  const remainingAP = useAppStore(s => s.remainingAP);

  // 플레이어 세력 자원
  const playerResources = factionResources[PLAYER_FACTION] ?? null;

  const [mapMode, setMapMode] = useState<MapMode>('faction');
  const [activeDomesticMenu, setActiveDomesticMenu] = useState<DomesticMenuType>(null);

  const openDomestic = (menu: DomesticMenuType) => setActiveDomesticMenu(menu);
  const closeDomestic = () => setActiveDomesticMenu(null);

  // 전략맵 널리실 화면 (PIXI Stage: 우측 ActionPanel 300px 제외)
  const MAP_PANEL_WIDTH = 300; // 우측 패널 너비
  const BOTTOM_BAR_HEIGHT = 52; // 하단 바 높이

  // 화면 크기
  const [dimensions, setDimensions] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setDimensions({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- 화면 줌/팬 핸들러 및 Tweening 상태 ---
  // PIXI Stage 크기: 우측 패널 제외
  const stageW = dimensions.w - MAP_PANEL_WIDTH;
  const stageH = dimensions.h - BOTTOM_BAR_HEIGHT;

  const initialFitScale = typeof window !== 'undefined'
    ? Math.max(stageW / SVG_W, stageH / SVG_H)
    : 1.0;
  const initialPosition = {
    x: typeof window !== 'undefined' ? (stageW - SVG_W * initialFitScale) / 2 : 0,
    y: typeof window !== 'undefined' ? (stageH - SVG_H * initialFitScale) / 2 : 0
  };

  const [scale, setScale] = useState(initialFitScale);
  const [position, setPosition] = useState(initialPosition);

  // 목표(Target) 위치로 부드럽게 쫓아가는 Lerp 애니메이션용 Ref (리렌더링 유발 X)
  const targetScaleRef = useRef(initialFitScale);
  const targetPositionRef = useRef(initialPosition);

  // 실제 PIXI Container를 직접 조작하는 Ref (React 렌더링 완전 바이패스)
  const pixiContainerRef = useRef<PIXI.Container | null>(null);

  // Tweening 로직과 드래그 거리 계산용 즉시 접근 가능 Ref
  const currentScaleRef = useRef(initialFitScale);
  const currentPositionRef = useRef(initialPosition);

  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const isDraggingMapRef = useRef(false);
  // dragStart를 ref로 관리: setState의 비동기 특성으로 인한 stale 값 문제 방지
  const dragStartRef = useRef({ x: 0, y: 0 });

  // 드래그/클릭 오인 방지용 ref
  const hasDragged = useRef(false);
  const pointerDownPos = useRef({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // ─── 플레이어 영지 중심 카메라 맞춤 ───────────────────────────────────────
  // worldSeed가 바뀔 때(새 게임) → 플레이어 소유 영지 bbox 계산 → 화면 맞춤
  useEffect(() => {
    if (!worldSeed || Object.keys(storeProvinces).length === 0) return;

    const playerProvs = Object.values(storeProvinces).filter(
      p => p.owner === PLAYER_FACTION
    );
    if (playerProvs.length === 0) return;

    // 1. 영지 seedX/Y (0~1 정규화) → 실제 SVG 픽셀 좌표로 변환
    const xs = playerProvs.map(p => p.seedX * SVG_W);
    const ys = playerProvs.map(p => p.seedY * SVG_H);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // 2. bbox 중심 (SVG 좌표계)
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    // 3. 영지 영역 크기에 여백(padding)을 고려한 배율 계산
    const PADDING = 80; // px (화면 여백)
    // 영지가 밀집되어 bbox가 너무 작을 때 최소 가시 영역 보장
    const MIN_BBOX = 200; // SVG 픽셀 기준 최소 bbox 크기
    const bboxW = Math.max(maxX - minX + PADDING * 2, MIN_BBOX);
    const bboxH = Math.max(maxY - minY + PADDING * 2, MIN_BBOX);
    const scaleX = dimensions.w / bboxW;
    const scaleY = dimensions.h / bboxH;

    // 맵 전체 맞춤 최소 배율 이하로는 내려가지 않음
    const minScale = Math.max(dimensions.w / SVG_W, dimensions.h / SVG_H);
    const targetScale = Math.max(minScale, Math.min(scaleX, scaleY, 6.0));

    // 4. 중심이 화면 정중앙에 오도록 position 계산
    const rawX = dimensions.w / 2 - cx * targetScale;
    const rawY = dimensions.h / 2 - cy * targetScale;

    // 5. 맵 바깥으로 벗어나지 않도록 클램핑
    const mapW = SVG_W * targetScale;
    const mapH = SVG_H * targetScale;
    const clampedX = mapW > dimensions.w ? Math.max(dimensions.w - mapW, Math.min(0, rawX)) : (dimensions.w - mapW) / 2;
    const clampedY = mapH > dimensions.h ? Math.max(dimensions.h - mapH, Math.min(0, rawY)) : (dimensions.h - mapH) / 2;

    // 6. 애니메이션 target 업데이트 → useTick Lerp가 부드럽게 이동
    targetScaleRef.current = targetScale;
    targetPositionRef.current = { x: clampedX, y: clampedY };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldSeed]);

  // 화면 밖으로 튕겨나가지 않도록 좌표를 클램프(Clamp)하는 보조 함수
  const getClampedPosition = useCallback((newX: number, newY: number, sc: number) => {
    const mapW = SVG_W * sc;
    const mapH = SVG_H * sc;
    let cx = newX, cy = newY;
    if (mapW > stageW) {
      cx = Math.max(stageW - mapW, Math.min(0, cx));
    } else {
      cx = (stageW - mapW) / 2;
    }
    if (mapH > stageH) {
      cy = Math.max(stageH - mapH, Math.min(0, cy));
    } else {
      cy = (stageH - mapH) / 2;
    }
    return { x: cx, y: cy };
  }, [stageW, stageH]);


  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomIn = e.deltaY < 0;
      const factor = zoomIn ? 1.25 : 0.8;

      const minScale = Math.max(stageW / SVG_W, stageH / SVG_H);
      const newTargetScale = Math.min(Math.max(targetScaleRef.current * factor, minScale), 8);

      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const localX = (cursorX - targetPositionRef.current.x) / targetScaleRef.current;
      const localY = (cursorY - targetPositionRef.current.y) / targetScaleRef.current;

      const newTargetX = cursorX - localX * newTargetScale;
      const newTargetY = cursorY - localY * newTargetScale;

      targetScaleRef.current = newTargetScale;
      targetPositionRef.current = getClampedPosition(newTargetX, newTargetY, newTargetScale);
    };

    const node = containerRef.current;
    if (node) {
      node.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (node) node.removeEventListener('wheel', handleWheel);
    };
  }, [dimensions, getClampedPosition]);

  // --- PIXI useTick: React 렌더링 없이 매 프레임 PIXI Container 직접 변형 ---
  const SceneController = () => {
    useTick((delta) => {
      const container = pixiContainerRef.current;
      if (!container) return;

      if (isDraggingMapRef.current) {
        container.x = currentPositionRef.current.x;
        container.y = currentPositionRef.current.y;
        container.scale.set(currentScaleRef.current);
      } else {
        // 레이트 독립적 Lerp 보간
        const lerpFactor = Math.min(1, 0.18 * delta);
        const ds = targetScaleRef.current - currentScaleRef.current;
        if (Math.abs(ds) > 0.0005) {
          currentScaleRef.current += ds * lerpFactor;
        } else {
          currentScaleRef.current = targetScaleRef.current;
        }

        const dpx = targetPositionRef.current.x - currentPositionRef.current.x;
        const dpy = targetPositionRef.current.y - currentPositionRef.current.y;
        if (Math.abs(dpx) > 0.05 || Math.abs(dpy) > 0.05) {
          currentPositionRef.current.x += dpx * lerpFactor;
          currentPositionRef.current.y += dpy * lerpFactor;
        } else {
          currentPositionRef.current.x = targetPositionRef.current.x;
          currentPositionRef.current.y = targetPositionRef.current.y;
        }

        container.x = currentPositionRef.current.x;
        container.y = currentPositionRef.current.y;
        container.scale.set(currentScaleRef.current);
      }

      // 텍스트 컴포넌트의 1/scale 보정을 위해 주기적 state 동기화
      if (Math.abs(currentScaleRef.current - scale) > 0.01) {
        setScale(currentScaleRef.current);
        setPosition({ x: currentPositionRef.current.x, y: currentPositionRef.current.y });
      }
    });
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDraggingMap(true);
    isDraggingMapRef.current = true;
    hasDragged.current = false;
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
    dragStartRef.current = { x: e.clientX, y: e.clientY }; // ref: 즉시 갱신
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // 1. 드래그 이동
    if (isDraggingMapRef.current) {
      const mdx = e.clientX - pointerDownPos.current.x;
      const mdy = e.clientY - pointerDownPos.current.y;

      if (mdx * mdx + mdy * mdy > 64) hasDragged.current = true; // 8px 이상 이동 시 드래그 판정

      // ref 기준으로 즉시 연산: React setState 비동기 지연 없음
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      const newPos = getClampedPosition(currentPositionRef.current.x + dx, currentPositionRef.current.y + dy, currentScaleRef.current);

      currentPositionRef.current = newPos;      // 내부 로직 즉시 갱신
      targetPositionRef.current = newPos;       // 미끄러짐(스냅) 방지
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      // 큌: 드래그 중 setPosition 호출 제거!
      // SceneController의 useTick이 매 프레임 PIXI Container를 직접 업데이트하므로 React 리렌더링 전혀 불필요

      return;
    }

    // 2. 호버 탐지 (Delaunay Raycasting, O(1) 수준 초고속)
    if (containerRef.current && delaunayFinder && parsedCells) {
      const rect = containerRef.current.getBoundingClientRect();
      // 항상 최신 캔버스 오프셋을 가진 참조 변수 사용
      const localX = (e.clientX - rect.left - currentPositionRef.current.x) / currentScaleRef.current;
      const localY = (e.clientY - rect.top - currentPositionRef.current.y) / currentScaleRef.current;

      const cellIndex = delaunayFinder.find(localX, localY);
      if (cellIndex !== undefined && cellIndex >= 0 && cellIndex < parsedCells.length) {
        const pCell = parsedCells[cellIndex];

        // 거리가 너무 먼 영역 밖의 호버 방지
        const dx = pCell.cx - localX;
        const dy = pCell.cy - localY;
        if (dx * dx + dy * dy > 2000) {
          if (hoveredProvinceId !== null) setHoveredProvinceId(null);
          return;
        }

        const provId = pCell.provinceId;
        if (provId !== hoveredProvinceId && provId) {
          setHoveredProvinceId(provId);
        } else if (!provId && hoveredProvinceId !== null) {
          setHoveredProvinceId(null);
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDraggingMap(false);
    isDraggingMapRef.current = false;
    setPosition({ x: currentPositionRef.current.x, y: currentPositionRef.current.y });
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // ─── 클릭 처리 (드래그와 구분) ────────────────────────────────────────────
  // hover state에 의존하지 않고 클릭 위치에서 직접 Delaunay로 province를 탐지
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (hasDragged.current) return;
    if (!containerRef.current || !delaunayFinder || !parsedCells) return;

    // 클릭 픽셀 → 맵 로컬 좌표 변환
    const rect = containerRef.current.getBoundingClientRect();
    const localX = (e.clientX - rect.left - currentPositionRef.current.x) / currentScaleRef.current;
    const localY = (e.clientY - rect.top - currentPositionRef.current.y) / currentScaleRef.current;

    const cellIndex = delaunayFinder.find(localX, localY);
    let clickedProvId: string | null = null;
    if (cellIndex !== undefined && cellIndex >= 0 && cellIndex < parsedCells.length) {
      const pCell = parsedCells[cellIndex];
      const dx = pCell.cx - localX;
      const dy = pCell.cy - localY;
      if (dx * dx + dy * dy <= 4000 && pCell.provinceId) {
        clickedProvId = pCell.provinceId;
      }
    }

    if (clickedProvId && clickedProvId !== selectedProvinceId) {
      selectProvince(clickedProvId);
    } else if (clickedProvId && clickedProvId === selectedProvinceId) {
      selectProvince(null); // 같은 영지 재클릭 시 선택 해제
    } else {
      selectProvince(null); // 바다/빈 영역 클릭
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (hasDragged.current) return;
    selectProvince(null);
  };


  // --- 데이터 생성 및 캐싱 ---
  const { boundaryEdges, terrainIcons, rivers, centers, factionCenters, provinces, parsedCells, delaunayFinder, coastlineEdges, fractalDict, provincePolygons } = useMemo(() => {
    if (!worldSeed) return { boundaryEdges: [], terrainIcons: [], rivers: [], centers: [], factionCenters: [], provinces: {}, parsedCells: null as any, delaunayFinder: null, coastlineEdges: [], fractalDict: new Map<string, number[]>(), provincePolygons: new Map<string, number[][]>() };
    const result = generateProvinces(SVG_W, SVG_H, worldSeed);

    // 각 셀의 중심을 계산하여 라벨 위치 도출
    const grouped: Record<string, { sx: number; sy: number; n: number; isCap: boolean; name: string }> = {};
    const factionGrouped: Record<string, { sx: number; sy: number; n: number }> = {};

    const parsedCache: { polygon: number[]; provinceId: string | null; isOcean: boolean, depth: number, faction: string | null, cx: number, cy: number }[] = [];
    const cellCenters: [number, number][] = [];

    for (let i = 0; i < result.allCells.length; i++) {
      const c = result.allCells[i];
      cellCenters.push([c.cx, c.cy]);

      const provObj = c.provinceId ? result.provinces[c.provinceId] : null;

      parsedCache.push({
        polygon: parseSvgPathToPolygon(c.path),
        provinceId: c.provinceId,
        isOcean: c.isOcean,
        depth: Math.max(0, Math.min(4, result.oceanDepth[i])),
        faction: provObj?.owner ?? null,
        cx: c.cx,
        cy: c.cy
      });

      if (!c.provinceId || !provObj) continue;
      if (!grouped[c.provinceId]) {
        grouped[c.provinceId] = { sx: 0, sy: 0, n: 0, isCap: provObj.isCapital, name: provObj.name };
      }
      grouped[c.provinceId].sx += c.cx;
      grouped[c.provinceId].sy += c.cy;
      grouped[c.provinceId].n++;

      if (provObj.owner && FACTIONS[provObj.owner]) {
        if (!factionGrouped[provObj.owner]) factionGrouped[provObj.owner] = { sx: 0, sy: 0, n: 0 };
        factionGrouped[provObj.owner].sx += c.cx;
        factionGrouped[provObj.owner].sy += c.cy;
        factionGrouped[provObj.owner].n++;
      }
    }

    const centers = Object.keys(grouped).map(id => ({
      id,
      name: grouped[id].name,
      isCap: grouped[id].isCap,
      x: grouped[id].sx / grouped[id].n,
      y: grouped[id].sy / grouped[id].n,
    }));

    const factionCenters = Object.keys(factionGrouped).map(fId => ({
      id: fId,
      name: FACTIONS[fId].name,
      x: factionGrouped[fId].sx / factionGrouped[fId].n,
      y: factionGrouped[fId].sy / factionGrouped[fId].n,
    }));

    const hitFinder = Delaunay.from(cellCenters);

    // 하이라이트를 프렉탈 노이즈 선과 정확히 일치시키기 위한 매핑 딕셔너리
    const fractalDict = new Map<string, number[]>();
    const pKey = (x: number, y: number) => `${Math.round(x * 10)},${Math.round(y * 10)}`;
    const addPath = (pts: Float32Array | number[]) => {
      if (pts.length >= 4) {
        const k1 = `${pKey(pts[0], pts[1])}->${pKey(pts[pts.length - 2], pts[pts.length - 1])}`;
        const k2 = `${pKey(pts[pts.length - 2], pts[pts.length - 1])}->${pKey(pts[0], pts[1])}`;
        fractalDict.set(k1, Array.from(pts));
        const rev = [];
        for (let i = pts.length - 2; i >= 0; i -= 2) rev.push(pts[i], pts[i + 1]);
        fractalDict.set(k2, rev);
      }
    };
    result.boundaryEdges.forEach(e => addPath(e.pts));
    result.coastlineEdges.forEach(e => addPath(e.pts));

    // ── Province merged polygon (마이크로셀 Directed Edge Cancellation) ────
    // 마이크로셀 내부 공유 edge를 상쇄하여 Province 외곽 polygon 생성
    const ptKey2 = (x: number, y: number) => `${Math.round(x * 10)},${Math.round(y * 10)}`;
    const provincePolygons = new Map<string, number[][]>();
    const provEdgeMap = new Map<string, Map<string, { x1: number; y1: number; x2: number; y2: number }>>();

    for (const cell of parsedCache) {
      if (!cell.provinceId) continue;
      // 내해 셀 포함: isOcean 제외 시 Province polygon 외곽이 내해 주변을 감싸버려
      // 경계선이 내해 안쪽에 생김. 포함 후 렌더링 시 beginHole()로만 구멍 처리함.
      if (!provEdgeMap.has(cell.provinceId)) provEdgeMap.set(cell.provinceId, new Map());
      const em = provEdgeMap.get(cell.provinceId)!;
      const poly = cell.polygon;
      for (let j = 0; j < poly.length; j += 2) {
        const x1 = poly[j], y1 = poly[j + 1];
        const nx = (j + 2) % poly.length;
        const x2 = poly[nx], y2 = poly[nx + 1];
        const k1 = ptKey2(x1, y1), k2 = ptKey2(x2, y2);
        const fwd = `${k1}->${k2}`, bwd = `${k2}->${k1}`;
        if (em.has(bwd)) { em.delete(bwd); } else { em.set(fwd, { x1, y1, x2, y2 }); }
      }
    }

    for (const [provId, em] of provEdgeMap) {
      const edges = Array.from(em.values());
      const polys: number[][] = [];
      while (edges.length > 0) {
        let chain = [edges[0].x1, edges[0].y1, edges[0].x2, edges[0].y2];
        let endK = ptKey2(edges[0].x2, edges[0].y2);
        let startK = ptKey2(edges[0].x1, edges[0].y1);
        edges.splice(0, 1);
        let found = true;
        while (found) {
          found = false;
          for (let i = 0; i < edges.length; i++) {
            const e = edges[i];
            const k1 = ptKey2(e.x1, e.y1), k2 = ptKey2(e.x2, e.y2);
            if (k1 === endK) { chain.push(e.x2, e.y2); endK = k2; edges.splice(i, 1); found = true; break; }
            else if (k2 === startK) { chain.unshift(e.x1, e.y1); startK = k1; edges.splice(i, 1); found = true; break; }
          }
        }
        if (chain.length >= 6) polys.push(chain);
      }
      if (polys.length > 0) provincePolygons.set(provId, polys);
    }
    // ──────────────────────────────────────────────────────────────────────


    return {
      boundaryEdges: result.boundaryEdges,
      terrainIcons: result.terrainIcons,
      rivers: result.rivers,
      provinces: result.provinces,
      centers,
      factionCenters,
      parsedCells: parsedCache,
      delaunayFinder: hitFinder,
      coastlineEdges: result.coastlineEdges,
      fractalDict,
      provincePolygons,
    };
  }, [worldSeed]);

  const [hoveredProvinceId, setHoveredProvinceId] = useState<string | null>(null);

  // storeProvinces를 우선 사용 (내정/전투 후 최신 상태 반영)
  // storeProvinces가 비어있으면 최초 worldSeed 생성 provinces 사용
  const activeProvinces: Record<string, Province> = Object.keys(storeProvinces).length > 0
    ? (storeProvinces as Record<string, Province>)
    : (provinces as Record<string, Province>);
  const selectedProvince = selectedProvinceId ? activeProvinces[selectedProvinceId] : null;

  // 선전포고 로직은 ActionPanel에서 담당

  // 지형 마름모 클리핑 커스텀 마스크 (바다 침범 방지)
  const [terrainMask, setTerrainMask] = useState<PIXI.Graphics | null>(null);
  const drawLandMaskForTerrain = useCallback((g: PIXI.Graphics) => {
    g.clear();
    if (!parsedCells) return;
    g.beginFill(0xffffff, 1);
    for (let i = 0; i < parsedCells.length; i++) {
      if (!parsedCells[i].isOcean) g.drawPolygon(parsedCells[i].polygon);
    }
    g.endFill();
  }, [parsedCells]);

  // 1. Base map draw (바다: 마이크로셀 / 육지: Province merged polygon — gap 원천 제거)
  const drawMapBase = useCallback((g: PIXI.Graphics) => {
    if (!parsedCells) return;
    g.clear();

    const selectedProv = selectedProvinceId ? activeProvinces[selectedProvinceId] : null;
    const isPlayerSelected = selectedProv && selectedProv.owner === PLAYER_FACTION;
    const interactableSet = new Set<string>();
    if (isPlayerSelected && selectedProv) {
      interactableSet.add(selectedProv.id);
      selectedProv.adjacentIds.forEach(id => interactableSet.add(id));
      if (selectedProv.isCoastal && selectedProv.navalAdjacentIds)
        selectedProv.navalAdjacentIds.forEach(id => interactableSet.add(id));
    }

    // ── 1. 바다 셀: depth 그라데이션 + 경계 소프트 블렌딩 ──────────────────
    // depth 0: 내해/미처리(심해색), depth 1: 연안(밝음), depth 2~4: 점점 심해
    const OCEAN_GRAD = [0x98886e, 0xcbbba4, 0xb3a48c, 0xa99a81, 0x98886e];

    // depth별 셀 인덱스 그룹화
    const oceanByDepth: number[][] = Array.from({ length: 5 }, () => []);
    for (let i = 0; i < parsedCells.length; i++) {
      if (!parsedCells[i].isOcean) continue;
      const d = Math.max(0, Math.min(4, parsedCells[i].depth));
      oceanByDepth[d].push(i);
    }

    // Pass 1: 심해(depth 4)→연안(depth 1) 순으로 fill (깊은 것 먼저)
    for (let depth = 4; depth >= 0; depth--) {
      g.lineStyle(0);
      for (const idx of oceanByDepth[depth]) {
        g.beginFill(OCEAN_GRAD[depth], 1);
        g.drawPolygon(parsedCells[idx].polygon);
        g.endFill();
      }
    }


    // ── 2. 육지: Province merged polygon fill ────────────────────────────
    // ── 내해 구멍 맵 사전 생성 (Province 내 isOcean 셀 → beginHole로 구멍 처리)
    const oceanHolesByProv = new Map<string, number[][]>();
    for (let i = 0; i < parsedCells.length; i++) {
      const hc = parsedCells[i];
      if (hc.isOcean && hc.provinceId) {
        if (!oceanHolesByProv.has(hc.provinceId)) oceanHolesByProv.set(hc.provinceId, []);
        oceanHolesByProv.get(hc.provinceId)!.push(hc.polygon);
      }
    }

    for (const [provId, polys] of provincePolygons) {
      const provObj = activeProvinces[provId];
      if (!provObj) continue;

      let color: number;
      if (mapMode === 'faction' && FACTIONS[provObj.owner]) {
        const base = FACTIONS[provObj.owner].color;
        color = provObj.owner === PLAYER_FACTION
          ? blendColors(base, 0xffffff, 0.15)
          : blendColors(base, 0x5a4d3c, 0.65);
      } else {
        color = mapMode === 'faction' ? 0xb5a088 : 0x9CA3AF;
      }
      let alpha = 0.85;

      // 딤 처리
      if (isPlayerSelected && !interactableSet.has(provId)) {
        const r = Math.floor(((color >> 16) & 0xff) * 0.25);
        const gv = Math.floor(((color >> 8) & 0xff) * 0.25);
        const b = Math.floor((color & 0xff) * 0.25);
        color = (r << 16) | (gv << 8) | b;
        alpha *= 0.9;
      }

      g.lineStyle(0);
      g.beginFill(color, alpha);
      for (const poly of polys) {
        g.drawPolygon(poly);
      }
      // 내해 셀을 구멍으로 뚫어 세력 색으로 칠해지는 현상 방지
      for (const hpoly of (oceanHolesByProv.get(provId) ?? [])) {
        g.beginHole();
        g.drawPolygon(hpoly);
        g.endHole();
      }
      g.endFill();
    }
  }, [parsedCells, provincePolygons, mapMode, selectedProvinceId, activeProvinces]);

  // 1-3. 바다 depth 등고선 경계선 (별도 레이어 alpha로 투명도 조절 → 내부 겹침 방지)
  const drawOceanDepthLines = useCallback((g: PIXI.Graphics) => {
    g.clear();
    if (!parsedCells.length) return;
    // BlurFilter → AlphaFilter 순서: 먼저 블러로 선을 번지게, 그 다음 alpha로 반투명화
    if (!g.filters || g.filters.length === 0) {
      g.filters = [new PIXI.filters.BlurFilter(3, 4), new PIXI.filters.AlphaFilter(0.5)];
    }
    const OCEAN_GRAD_L = [0x98886e, 0xcbbba4, 0xb3a48c, 0xa99a81, 0x98886e];

    // ① 엣지 맵 구성: 인접 셀의 depth가 다른 공유 엣지 수집
    type OceanEdgeDL = { x1: number; y1: number; x2: number; y2: number; dA: number; dB: number; k1: string; k2: string };
    const edgeMap = new Map<string, OceanEdgeDL>();
    const ptCoord = new Map<string, [number, number]>();
    const sdAdj = new Map<number, Map<string, string[]>>();

    for (let i = 0; i < parsedCells.length; i++) {
      const c = parsedCells[i];
      if (!c.isOcean) continue;
      const d = Math.max(0, Math.min(4, c.depth));
      const poly = c.polygon;
      const n = poly.length / 2;
      for (let j = 0; j < n; j++) {
        const x1 = Math.round(poly[j * 2] * 10) / 10;
        const y1 = Math.round(poly[j * 2 + 1] * 10) / 10;
        const x2 = Math.round(poly[((j + 1) % n) * 2] * 10) / 10;
        const y2 = Math.round(poly[((j + 1) % n) * 2 + 1] * 10) / 10;
        const k1 = `${x1},${y1}`, k2 = `${x2},${y2}`;
        const key = x1 < x2 || (x1 === x2 && y1 <= y2) ? `${k1}|${k2}` : `${k2}|${k1}`;
        ptCoord.set(k1, [x1, y1]); ptCoord.set(k2, [x2, y2]);
        const ex = edgeMap.get(key);
        if (ex) { ex.dB = d; }
        else { edgeMap.set(key, { x1, y1, x2, y2, dA: d, dB: -1, k1, k2 }); }
      }
    }
    // ② 경계 엣지만 shallowerDepth별 adjacency 등록
    for (const e of edgeMap.values()) {
      if (e.dB === -1 || e.dA === e.dB) continue;
      const sd = Math.min(e.dA, e.dB);
      if (!sdAdj.has(sd)) sdAdj.set(sd, new Map());
      const adj = sdAdj.get(sd)!;
      if (!adj.has(e.k1)) adj.set(e.k1, []);
      if (!adj.has(e.k2)) adj.set(e.k2, []);
      adj.get(e.k1)!.push(e.k2);
      adj.get(e.k2)!.push(e.k1);
    }

    // ③ 체인 DFS + Catmull-Rom bezier 렌더링 (alpha=1.0 → 레이어 alpha로 제어)
    const crDraw = (pts: [number, number][]) => {
      if (pts.length < 2) return;
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
        const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
        const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
        const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
        g.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1]);
      }
    };

    for (const [sd, adj] of sdAdj) {
      // alpha=1.0: 선 내부 겹침 없음, 레이어 Container alpha=0.5로 시각적 투명도 부여
      // CAP.BUTT: 분기점에서 체인 끝 캡을 그리지 않아 중첩 진해짐 방지
      g.lineStyle({
        width: 10, color: OCEAN_GRAD_L[sd], alpha: 1.0,
        alignment: 0.5, join: PIXI.LINE_JOIN.ROUND, cap: PIXI.LINE_CAP.BUTT
      });
      const visited = new Set<string>();
      const starts: string[] = [];
      for (const [k, nbs] of adj) { if (nbs.length === 1) starts.push(k); }
      for (const [k] of adj) { if (!starts.includes(k)) starts.push(k); }
      for (const startKey of starts) {
        if (visited.has(startKey)) continue;
        visited.add(startKey);
        const chain: [number, number][] = [ptCoord.get(startKey)!];
        let cur = startKey;
        let go = true;
        while (go) {
          go = false;
          for (const nb of adj.get(cur) ?? []) {
            if (!visited.has(nb)) {
              visited.add(nb); chain.push(ptCoord.get(nb)!); cur = nb; go = true; break;
            }
          }
        }
        crDraw(chain);
      }
    }
    g.lineStyle(0);
  }, [parsedCells]);

  // 1-5. 대륙 해안선
  const shadowLayersRef = useRef<{ mask: PIXI.Graphics, l1: PIXI.Graphics, l2: PIXI.Graphics, l3: PIXI.Graphics } | null>(null);

  const drawCoastlineShadow = useCallback((g: PIXI.Graphics) => {
    // 최초 1회 자식 객체 (마스크 및 3단계 그라데이션 레이어) 생성 및 캐싱
    if (!shadowLayersRef.current) {
      const mask = new PIXI.Graphics();
      const l1 = new PIXI.Graphics();
      const l2 = new PIXI.Graphics();
      const l3 = new PIXI.Graphics();

      // AlphaFilter를 개별 적용하여 자기교차(Self-intersection) 시 진한 점이 생기는 현상 방지
      l1.filters = [new PIXI.filters.AlphaFilter(0.06)]; // 가장 넓은 범위 (가장 흐림)
      l2.filters = [new PIXI.filters.AlphaFilter(0.10)]; // 중간 범위
      l3.filters = [new PIXI.filters.AlphaFilter(0.15)]; // 가장 좁은 해안가 범위 (가장 진함)

      l1.mask = mask;
      l2.mask = mask;
      l3.mask = mask;

      g.addChild(l1, l2, l3, mask);
      shadowLayersRef.current = { mask, l1, l2, l3 };
    }

    const { mask, l1, l2, l3 } = shadowLayersRef.current;
    mask.clear();
    l1.clear();
    l2.clear();
    l3.clear();

    if (coastlineEdges && coastlineEdges.length > 0 && parsedCells) {
      // 1. 확실한 육지 마스크 생성 (내해(Inland Sea) 마스킹 반전 방지용)
      mask.beginFill(0xffffff, 1.0);
      for (let i = 0; i < parsedCells.length; i++) {
        if (!parsedCells[i].isOcean) mask.drawPolygon(parsedCells[i].polygon);
      }
      mask.endFill();

      // 2. 그림자 3단계 렌더링 (센터 기준 양방향 팽창이므로 요구 폭의 2배 두께 설정)
      // coastlineEdges에 저장된 체인들을 따라 선을 그립니다.
      const drawShadowPolylines = (layer: PIXI.Graphics, width: number) => {
        layer.lineStyle({ width: width, color: 0x3d2b1f, alpha: 1.0, alignment: 0.5, join: PIXI.LINE_JOIN.ROUND, cap: PIXI.LINE_CAP.ROUND });
        for (let i = 0; i < coastlineEdges.length; i++) {
          const pts = coastlineEdges[i].pts;
          layer.moveTo(pts[0], pts[1]);
          for (let p = 2; p < pts.length; p += 2) layer.lineTo(pts[p], pts[p + 1]);
        }
      };

      // Step 1: 15px 안쪽으로 들어가는 가장 넓고 옅은 그림자 (폭 30px)
      drawShadowPolylines(l1, 30.0);

      // Step 2: 10px 안쪽으로 들어가는 중간 그림자 (폭 20px)
      drawShadowPolylines(l2, 20.0);

      // Step 3: 5px 안쪽으로 들어가는 가장 진한 해안 경계 그림자 (폭 10px)
      drawShadowPolylines(l3, 10.0);
    }
  }, [coastlineEdges, parsedCells]);

  // 2. 강 시스템 — 체인 폴리라인 렌더링 (진주목걸이 점겹침 방지 및 수량 기반 Tapering 처리)
  const drawRivers = useCallback((g: PIXI.Graphics) => {
    g.clear();
    for (let r = 0; r < rivers.length; r++) {
      if (!rivers[r].pts || rivers[r].pts.length < 4) continue;
      const pts = rivers[r].pts;

      // 상류(수량=1)일수록 얇아지고, 주변 물줄기가 합쳐져 수량(Flux)이 늘어난 하류일수록 최대폭(4.5)까지 굵어집니다.
      const fluxVal = rivers[r].flux || 1;
      // flux 값이 커짐에 따라 폭을 서서히 4.5까지 증가 (최소 1.5 수준)
      const currentWidth = Math.min(4.5, 0.5 + (Math.sqrt(fluxVal) * 1.5));

      // 최상류(RIVER_THRESHOLD를 갓 넘긴 대륙 깊숙한 작은 시냇물)일 경우, 
      // 시작점(pts[0])이 대륙 가장 안쪽이므로 두께를 0부터 시작하여 뾰족하게 Tapering(얇아짐) 효과 처리
      const isSourceTip = fluxVal <= 1.25;

      if (isSourceTip) {
        const numSegments = (pts.length - 2) / 2;
        for (let i = 2; i < pts.length; i += 2) {
          const progress = ((i - 2) / 2) / Math.max(1, numSegments);
          // 0에서 목표 두께로 서서히 굵어짐
          const w = currentWidth * progress * progress; // 가속도를 주어 더 뾰족하고 자연스럽게
          g.lineStyle({ width: w, color: 0x3b82f6, alpha: 1.0, join: PIXI.LINE_JOIN.ROUND, cap: PIXI.LINE_CAP.ROUND });
          g.moveTo(pts[i - 2], pts[i - 1]);
          g.lineTo(pts[i], pts[i + 1]);
        }
      } else {
        // 하류로 갈수록 렌더링 최적화를 위해 경로 내에서는 일관된 두께 유지
        g.lineStyle({ width: currentWidth, color: 0x3b82f6, alpha: 1.0, join: PIXI.LINE_JOIN.ROUND, cap: PIXI.LINE_CAP.ROUND });
        g.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) {
          g.lineTo(pts[i], pts[i + 1]);
        }
      }
    }
  }, [rivers]);

  // 3. 지형/세력 통합 경계선 렌더링 (투명도 중첩 누적 방지용)
  const drawCombinedBorders = useCallback((g: PIXI.Graphics) => {
    if (!boundaryEdges || !coastlineEdges) return;
    g.clear();

    // 딤 처리 기준 세트
    const selectedProv = selectedProvinceId ? activeProvinces[selectedProvinceId] : null;
    const isPlayerSelected = selectedProv && selectedProv.owner === PLAYER_FACTION;
    const interactableSet = new Set<string>();

    if (isPlayerSelected && selectedProv) {
      interactableSet.add(selectedProv.id);
      selectedProv.adjacentIds.forEach(id => interactableSet.add(id));
      if (selectedProv.isCoastal && selectedProv.navalAdjacentIds) {
        selectedProv.navalAdjacentIds.forEach(id => interactableSet.add(id));
      }
    }

    // 헥스 색상 분리 유틸
    const ch = (c: number) => ({ r: (c >> 16) & 0xff, g: (c >> 8) & 0xff, b: c & 0xff });
    const mc = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b;

    // 채도 감소: 원색과 회색(평균) 사이를 satFactor 비율로 혼합 (0=완전 회색, 1=원색)
    const desaturate = (c: { r: number, g: number, b: number }, satFactor: number) => {
      const gray = (c.r * 0.299 + c.g * 0.587 + c.b * 0.114); // 지각 밝기 기반 회색
      return {
        r: gray + (c.r - gray) * satFactor,
        g: gray + (c.g - gray) * satFactor,
        b: gray + (c.b - gray) * satFactor,
      };
    };

    // 두 세력 색상을 혼합 → 채도 낮춤 → 어둡게
    const makeBorderColor = (colorA: number, colorB: number, darken: number, satFactor = 0.35) => {
      const a = ch(colorA), b = ch(colorB);
      const mixed = { r: (a.r + b.r) / 2, g: (a.g + b.g) / 2, b: (a.b + b.b) / 2 };
      const desat = desaturate(mixed, satFactor);
      const r = Math.floor(desat.r * darken);
      const gv = Math.floor(desat.g * darken);
      const bl = Math.floor(desat.b * darken);
      return mc(r, gv, bl);
    };

    // Province → 세력 색상 조회
    const getFactionColor = (provId: string | undefined): number => {
      if (!provId) return 0x888888;
      const prov = activeProvinces[provId];
      return prov ? (FACTIONS[prov.owner]?.color ?? 0x888888) : 0x888888;
    };

    const dimFactor = 0.25; // 딤 처리 시 밝기


    // 1-1/1-2. 모든 Province 경계선 통합 렌더링
    // 규칙: neutral↔neutral 스킵 / 세력↔neutral 또는 세력↔세력(다른세력)은 두껍게(2px) / 같은세력 내부는 얇게(1px)
    boundaryEdges.forEach(e => {
      const ownerA = e.provIdA ? activeProvinces[e.provIdA]?.owner : null;
      const ownerB = e.provIdB ? activeProvinces[e.provIdB]?.owner : null;
      const isNeutralA = ownerA === 'neutral';
      const isNeutralB = ownerB === 'neutral';

      // 양쪽 모두 중립 → 경계선 불필요
      if (isNeutralA && isNeutralB) return;

      // 두꺼운 경계선: isFactionBoundary이거나 한쪽이 neutral(세력 ↔ 중립)
      const isThick = e.isFactionBoundary || isNeutralA || isNeutralB;

      const isDimmed = isPlayerSelected
        && !interactableSet.has(e.provIdA || '')
        && !interactableSet.has(e.provIdB || '');
      const darken = isDimmed ? dimFactor * (isThick ? 0.3 : 0.4) : (isThick ? 0.45 : 0.63);

      // 중립쪽 Province는 브라운 기반 색상으로 처리
      const colorA = isNeutralA ? 0xb5a088 : getFactionColor(e.provIdA ?? undefined);
      const colorB = isNeutralB ? 0xb5a088 : getFactionColor(e.provIdB ?? undefined);
      const color = makeBorderColor(colorA, colorB, darken);
      const width = isThick ? 2.0 : 1.0;

      g.lineStyle({ width, color, alpha: 1.0, join: PIXI.LINE_JOIN.ROUND, cap: PIXI.LINE_CAP.ROUND });
      g.moveTo(e.pts[0], e.pts[1]);
      for (let i = 2; i < e.pts.length; i += 2) g.lineTo(e.pts[i], e.pts[i + 1]);
    });

    // 1-3. 대륙 해안선
    g.lineStyle({ width: 2.0, color: 0x3d3027, alpha: 1.0, alignment: 0.5, join: PIXI.LINE_JOIN.ROUND, cap: PIXI.LINE_CAP.ROUND });
    for (let i = 0; i < coastlineEdges.length; i++) {
      const edge = coastlineEdges[i];
      g.moveTo(edge.pts[0], edge.pts[1]);
      for (let j = 2; j < edge.pts.length; j += 2) g.lineTo(edge.pts[j], edge.pts[j + 1]);
    }
  }, [boundaryEdges, coastlineEdges, selectedProvinceId, activeProvinces]);

  // 4. 호버 및 선택 영역 하이라이트 (Fill, Glow, Core 3단 분리)
  const drawHighlightsInner = useCallback((g: PIXI.Graphics, mode: 'fill' | 'glow' | 'core') => {
    g.clear();
    if (!parsedCells) return;

    const drawTargetProv = (targetId: string, color: number, alpha: number, lineWidth: number) => {
      if (mode === 'fill') {
        // 내부 채우기 (선 없이)
        g.lineStyle(0);
        g.beginFill(Math.min(color + 0x333333, 0xffffff), alpha * 0.4);
        for (let i = 0; i < parsedCells.length; i++) {
          if (parsedCells[i].provinceId === targetId) {
            g.drawPolygon(parsedCells[i].polygon);
          }
        }
        g.endFill();
      } else if ((mode === 'glow' || mode === 'core') && lineWidth > 0) {
        // 외곽선만 그리기 (Directed Edge Cancellation - 벌집 모양 제거)
        const edgeMap = new Map<string, string>();
        const edgeData = new Map<string, { x1: number, y1: number, x2: number, y2: number }>();
        const ptKey = (x: number, y: number) => `${Math.round(x * 10)},${Math.round(y * 10)}`;

        for (let i = 0; i < parsedCells.length; i++) {
          if (parsedCells[i].provinceId === targetId) {
            const poly = parsedCells[i].polygon;
            for (let j = 0; j < poly.length; j += 2) {
              const x1 = poly[j], y1 = poly[j + 1];
              const nx = (j + 2) % poly.length;
              const x2 = poly[nx], y2 = poly[nx + 1];

              const k1 = ptKey(x1, y1);
              const k2 = ptKey(x2, y2);
              const forwardKey = `${k1}->${k2}`;
              const backwardKey = `${k2}->${k1}`;

              // 맞닿은 내부 엣지는 서로 상쇄(Cancel)
              if (edgeMap.has(backwardKey)) {
                edgeMap.delete(backwardKey);
                edgeData.delete(backwardKey);
              } else {
                edgeMap.set(forwardKey, forwardKey);
                edgeData.set(forwardKey, { x1, y1, x2, y2 });
              }
            }
          }
        }

        // 엣지들을 연결하여 폴리라인을 묶고, 저장된 프렉탈 곡선을 가져와서 주입 (직선 벌집 오류 해결 및 자연스러운 노이즈 라인 복구)
        const paths: number[][] = [];
        const edges = Array.from(edgeData.values());

        while (edges.length > 0) {
          const firstExp = fractalDict.get(`${ptKey(edges[0].x1, edges[0].y1)}->${ptKey(edges[0].x2, edges[0].y2)}`) || [edges[0].x1, edges[0].y1, edges[0].x2, edges[0].y2];
          let currentPath = [...firstExp];
          let startK = ptKey(edges[0].x1, edges[0].y1);
          let endK = ptKey(edges[0].x2, edges[0].y2);
          edges.splice(0, 1);

          let added = true;
          while (added) {
            added = false;
            for (let i = 0; i < edges.length; i++) {
              const e = edges[i];
              const k1 = ptKey(e.x1, e.y1);
              const k2 = ptKey(e.x2, e.y2);
              if (k1 === endK) {
                const exp = fractalDict.get(`${k1}->${k2}`) || [e.x1, e.y1, e.x2, e.y2];
                currentPath.push(...exp.slice(2));
                endK = k2;
                edges.splice(i, 1);
                added = true; break;
              } else if (k2 === endK) {
                const exp = fractalDict.get(`${k2}->${k1}`) || [e.x2, e.y2, e.x1, e.y1];
                currentPath.push(...exp.slice(2));
                endK = k1;
                edges.splice(i, 1);
                added = true; break;
              } else if (k1 === startK) {
                const exp = fractalDict.get(`${k2}->${k1}`) || [e.x2, e.y2, e.x1, e.y1];
                currentPath.unshift(...exp.slice(0, exp.length - 2));
                startK = k2;
                edges.splice(i, 1);
                added = true; break;
              } else if (k2 === startK) {
                const exp = fractalDict.get(`${k1}->${k2}`) || [e.x1, e.y1, e.x2, e.y2];
                currentPath.unshift(...exp.slice(0, exp.length - 2));
                startK = k1;
                edges.splice(i, 1);
                added = true; break;
              }
            }
          }
          paths.push(currentPath);
        }

        if (mode === 'glow') {
          // 픽시 BlurFilter는 확대/축소 시 런타임 텍스처 해상도 변경으로 인해 덜덜 떨리는 현상(Jitter) 유발.
          // 이를 방지하고자, 순수 벡터 연산(다단계 두께와 투명도의 중첩)으로 글로우 아우라를 수학적 시뮬레이션함.
          const glowSteps = 4;
          for (let s = glowSteps; s >= 1; s--) {
            // 안쪽부터 3.5, 5.5, 7.5, 9.5 두께로 점점 퍼지며 알파값이 약하게 겹쳐지게 됨
            g.lineStyle({
              width: 1.5 + (s * 2),
              color: 0xfcd34d,
              alpha: 0.15,
              cap: PIXI.LINE_CAP.ROUND,
              join: PIXI.LINE_JOIN.ROUND
            });
            paths.forEach(path => {
              g.moveTo(path[0], path[1]);
              for (let i = 2; i < path.length; i += 2) g.lineTo(path[i], path[i + 1]);
            });
          }
        } else if (mode === 'core') {
          // 코어 효과 (대륙 해안선 두께 1.5와 완벽히 동일한, 완전 불투명 화이트)
          g.lineStyle({ width: 1.5, color: 0xffffff, alpha: 1.0, cap: PIXI.LINE_CAP.ROUND, join: PIXI.LINE_JOIN.ROUND });
          paths.forEach(path => {
            g.moveTo(path[0], path[1]);
            for (let i = 2; i < path.length; i += 2) g.lineTo(path[i], path[i + 1]);
          });
        }
      }
    };

    if (hoveredProvinceId && hoveredProvinceId !== selectedProvinceId) {
      if (mode === 'fill') drawTargetProv(hoveredProvinceId, 0xffffff, 0.4, 0);
    }

    if (selectedProvinceId) {
      const p = activeProvinces[selectedProvinceId];
      if (mode === 'fill') {
        drawTargetProv(selectedProvinceId, 0xfcd34d, 0.7, 0);
        // 플레이어 영지 선택 시, 이동/공격 가능한 인접 육로와 해로를 시각적으로 가이드
        if (p && p.owner === PLAYER_FACTION) {
          p.adjacentIds.forEach(adjId => drawTargetProv(adjId, 0xffffff, 0.15, 0));
          if (p.isCoastal) {
            (p.navalAdjacentIds || []).forEach(navId => drawTargetProv(navId, 0x3b82f6, 0.25, 0));
          }
        }
      }
      else if (mode === 'glow') drawTargetProv(selectedProvinceId, 0xfcd34d, 1.0, 0); // width는 glow 내부에서 1.5로 고정
      else if (mode === 'core') drawTargetProv(selectedProvinceId, 0xffffff, 1.0, 1.5);
    }
  }, [parsedCells, hoveredProvinceId, selectedProvinceId, activeProvinces]);

  // 해상 원정(도항) 시각화 화살표
  const drawExpeditionArrow = useCallback((g: PIXI.Graphics) => {
    g.clear();
    // 출발지: 현재 선택된 영지 (플레이어의 해안가 영지)
    // 도착지: 현재 호버 중인 영지 (바다 건너의 상륙 적합지)
    if (!selectedProvinceId || !hoveredProvinceId || selectedProvinceId === hoveredProvinceId) return;

    const pA = activeProvinces[selectedProvinceId];
    const pB = activeProvinces[hoveredProvinceId];

    // 플레이어 영지에서 시작해야 하며, 육로가 아닌 해상으로 인접한 경우에만 점선 화살표를 표시
    if (!pA || !pB || pA.owner !== PLAYER_FACTION || !pA.isCoastal || !pB.isCoastal) return;
    if (pA.adjacentIds.includes(pB.id)) return; // 육로 인접이면 화살표 패스
    if (!(pA.navalAdjacentIds || []).includes(pB.id)) return;

    // 두 점 사이의 곡선(원정 항로) 그리기
    const cA = centers.find(c => c.id === pA.id);
    const cB = centers.find(c => c.id === pB.id);
    if (!cA || !cB) return;

    const dx = cB.x - cA.x;
    const dy = cB.y - cA.y;

    // 바다를 횡단하는 둥근 궤적을 위해 약간 휜 제어점 배정
    const midX = (cA.x + cB.x) / 2 - dy * 0.15;
    const midY = (cA.y + cB.y) / 2 + dx * 0.15;

    // 해로 화살표 베이스 궤적
    g.lineStyle({ width: 4, color: 0x60a5fa, alpha: 0.8, cap: PIXI.LINE_CAP.ROUND });
    g.moveTo(cA.x, cA.y);
    g.quadraticCurveTo(midX, midY, cB.x, cB.y);

    // 뾰족한 화살표 머리
    const angle = Math.atan2(cB.y - midY, cB.x - midX);
    const headLen = 18;
    g.lineStyle({ width: 5, color: 0x60a5fa, alpha: 1.0, cap: PIXI.LINE_CAP.ROUND });
    g.moveTo(cB.x, cB.y);
    g.lineTo(cB.x - headLen * Math.cos(angle - Math.PI / 6), cB.y - headLen * Math.sin(angle - Math.PI / 6));
    g.moveTo(cB.x, cB.y);
    g.lineTo(cB.x - headLen * Math.cos(angle + Math.PI / 6), cB.y - headLen * Math.sin(angle + Math.PI / 6));

  }, [selectedProvinceId, hoveredProvinceId, activeProvinces, centers]);

  // PIXI.Graphics가 리렌더링마다 텍스쳐를 지우지 않도록 안정적인 useCallback 생성
  const drawHighlightsFill = useCallback((g: PIXI.Graphics) => drawHighlightsInner(g, 'fill'), [drawHighlightsInner]);
  const drawHighlightsGlow = useCallback((g: PIXI.Graphics) => drawHighlightsInner(g, 'glow'), [drawHighlightsInner]);
  const drawHighlightsCore = useCallback((g: PIXI.Graphics) => drawHighlightsInner(g, 'core'), [drawHighlightsInner]);

  // 5. 프레임 테두리 (Border)
  const drawBorders = useCallback((g: PIXI.Graphics) => {
    g.clear();
    g.lineStyle(6, 0x1e293b, 1);
    g.drawRect(0, 0, SVG_W, SVG_H);
  }, []);

  // 화면 맞춤사이즈 및 LOD 전환점
  const fitScale = typeof window !== 'undefined' ? Math.max(dimensions.w / SVG_W, dimensions.h / SVG_H) : 1;
  const LOD_THRESHOLD = fitScale * 2.8;

  // 맵 영역 바깥을 덮는 마스킹 레이어
  // position/scale을 실시사이 ref로 참조하여 SceneController의 주기적 state 동기화에만 어웈리도뷙 (pan/zoom 저 fps 연쇄 제거)
  const drawMask = useCallback((g: PIXI.Graphics) => {
    g.clear();
    const px = currentPositionRef.current.x;
    const py = currentPositionRef.current.y;
    const sc = currentScaleRef.current;
    const mapLeft = px;
    const mapTop = py;
    const mapRight = px + SVG_W * sc;
    const mapBottom = py + SVG_H * sc;
    const W = dimensions.w;
    const H = dimensions.h;
    g.beginFill(0x000000, 1);
    if (mapLeft > 0) g.drawRect(0, 0, mapLeft, H);
    if (mapRight < W) g.drawRect(mapRight, 0, W - mapRight, H);
    if (mapTop > 0) g.drawRect(mapLeft, 0, SVG_W * sc, mapTop);
    if (mapBottom < H) g.drawRect(mapLeft, mapBottom, SVG_W * sc, H - mapBottom);
    g.endFill();
  }, [dimensions]);

  // 통합 경계선 공용 알파 필터 (모든 선이 수학적으로 덮어쓴 후 렌더링되므로// removed combinedBordersFilter
  // LOD 페이드 인/아웃 알파 블렌딩 — 두 단계가 절대 동시에 보이지 않게 분리
  const FADE_RANGE = 0.25; // 좁은 페이드 구간 (겹침 방지)
  // lod1: scale < LOD_THRESHOLD 구간에서 보임 (threshold 근처에서 fade out)
  const lod1Alpha = Math.max(0, Math.min(1, (LOD_THRESHOLD - scale) / FADE_RANGE));
  // lod2: scale > LOD_THRESHOLD 구간에서 보임 (threshold 근처에서 fade in)
  const lod2Alpha = Math.max(0, Math.min(1, (scale - LOD_THRESHOLD) / FADE_RANGE));

  return (
    <div className="smap-root" style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* 상단 타이틀 바: absolute floating */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px', pointerEvents: 'none' }}>
        <h1 className="smap-title font-title text-xl font-bold text-white drop-shadow-md opacity-60">
          지방 행정 <span className="text-gray-300 ml-2 text-xs italic opacity-60">- WebGL Engine</span>
        </h1>

        {/* 우측 중앙 상단: 맵 모드 토글 바 */}
        <div className="flex bg-slate-800/80 p-1 rounded-md mt-2 ml-4 relative z-10 shadow-lg pointer-events-auto">
          {(['faction'] as MapMode[]).map(m => (
            <button key={m} onClick={() => setMapMode(m)}
              className={`px-3 py-1 text-sm font-bold rounded transition-colors mr-1 ${mapMode === m ? 'bg-amber-600 text-white shadow-inner' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/70'
                }`}
            >
              {m === 'faction' ? '세력권' : m === 'terrain' ? '지형도' : m === 'security' ? '치안도' : '자원도'}
            </button>
          ))}
        </div>
      </div>

      {/* 지도 (순수 PIXI WebGL 캔버스 렌더러 지원) */}
      <div
        ref={containerRef}
        className="smap-map-area"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          overflow: 'hidden',
          backgroundColor: '#98886e',
          cursor: isDraggingMap ? 'grabbing' : 'grab',
          touchAction: 'none',
          width: stageW,
          height: stageH,
        }}

        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={handleCanvasClick}
        onContextMenu={handleContextMenu}
      >
        <Stage
          width={stageW}
          height={stageH}
          options={{
            backgroundColor: 0x98886e,
            backgroundAlpha: 0, // 캔버스 투명 → CSS div의 배경색(#98886e)이 보임
            // Math.max(..., 2) 제거: HiDPI가 아닌 모니터에서 2x 강제 적용 제거 (렌더링 픽셀 수 절반으로 감소)
            resolution: typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1,
            autoDensity: true,
            antialias: false,
          }}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          {/* SceneController: React 리렌더링 없이 PIXI Container를 매 프레임 직접 조작 */}
          <SceneController />

          {/* 배경 레이어: 심해 색상으로 전체 화면 채움 (PIXI backgroundColor 우회) */}
          <PixiGraphics draw={(g) => {
            g.clear();
            g.beginFill(0x98886e, 1);
            g.drawRect(0, 0, stageW, stageH);
            g.endFill();
          }} zIndex={0} />

          {/* Main Transformation Container - ref로 직접 조작 (scale/position props 최소화) */}
          <Container ref={pixiContainerRef} sortableChildren={true}>

            {/* 1. Base Map - 강제 고정 */}
            <Container name="L1-BaseMap" zIndex={10}>
              <PixiGraphics draw={drawMapBase} />
            </Container>

            {/* 1-3. 바다 depth 경계선 (AlphaFilter로 자기교차 진해짐 방지) */}
            <Container name="L1b-OceanDepth" zIndex={12}>
              <PixiGraphics draw={drawOceanDepthLines} />
            </Container>

            {/* 1-5. 대륙별 내륙 방향 그라데이션 음영 (프렉탈 자기교차 대응, 스텐실 마스크 기법) */}
            <Container name="L2-Shadow" zIndex={20}>
              <PixiGraphics draw={drawCoastlineShadow} />
            </Container>

            {/* 2. Rivers (물줄기 위에 경계선이 올라가게 렌더링 계층 조절, 투명도 플래트닝 적용) */}
            <Container
              name="L3-Rivers"
              zIndex={30}
              filters={useMemo(() => [new PIXI.filters.AlphaFilter(0.4)], [])}
            >
              <PixiGraphics draw={drawRivers} />
            </Container>

            {/* 3.5. 호버/선택 채우기 (외곽선과 산맥 아래에 위치하여 선을 뿌옇게 만들지 않음) */}
            <Container name="L3.5-HighlightsFill" zIndex={35}>
              <PixiGraphics draw={drawHighlightsFill} />
            </Container>

            {/* 4. 통합된 경계선 (영지 + 세력 + 해안선). 단일 객체 방식으로 겹침 없이 Alpha 조절 */}
            <Container name="L4-Borders" zIndex={40}>
              <PixiGraphics draw={drawCombinedBorders} />
            </Container>

            {/* 6. Terrain Sprites (Y-Sorting 기반 오클루전. 그룹 전체를 Multiply + Opacity 조절로 은은하게 블렌딩) */}
            <Container
              name="L5-Terrain"
              zIndex={60}
              mask={terrainMask}
              filters={useMemo(() => {
                // 이전 형태(오클루전 완벽 가림 + 바닥 지형에 예쁘게 이염)를 복구하면서,
                // 너무 진하게(검게) 타는 것을 방지하기 위해 전체 오퍼시티를 70%로 줄였습니다.
                const f = new PIXI.filters.AlphaFilter(0.7);
                f.blendMode = PIXI.BLEND_MODES.MULTIPLY;
                f.padding = 64;
                return [f];
              }, [])}
            >
              <PixiGraphics draw={drawLandMaskForTerrain} ref={setTerrainMask} />
              {[...terrainIcons].sort((a, b) => a.y - b.y).map((ti, idx) => {
                const variants: string[] | undefined =
                  ti.type === 'peak' ? TERRAIN_MANIFEST.mountain_rugged :
                    ti.type === 'mountain' ? TERRAIN_MANIFEST.mountain_normal :
                  /* forest */             TERRAIN_MANIFEST.tree_conifer;
                if (!variants || variants.length === 0) return null;

                const variantFile = variants[Math.floor((ti.x * 7 + ti.y * 13) % variants.length)];
                const spriteSrc = `/assets/ui/terrain/${variantFile}`;

                // 화면 밖 컬링: 맵 좌표 → screen 좌표로 변환 후 판별
                const screenX = position.x + ti.x * scale;
                const screenY = position.y + ti.y * scale;
                const displaySize = Math.min(Math.max(ti.s, 8), 18);
                if (screenX < -displaySize || screenX > stageW + displaySize) return null;
                if (screenY < -displaySize || screenY > stageH + displaySize) return null;

                // 텍스트와 달리 맵 줌인/아웃 시 지형 오브젝트는 맵과 함께 크기가 변함 (기존 대비 80% 축소)
                const spriteScale = (displaySize / 64) * 0.8;

                return (
                  <Sprite
                    key={`ti-${idx}`}
                    image={spriteSrc}
                    x={ti.x}
                    y={ti.y}
                    anchor={0.5}
                    scale={spriteScale}
                  // 개별 스프라이트 블렌딩은 NORMAL(내부 오클루전) - 부모 그룹 필터에서 통째로 Multiply됨
                  />
                );
              })}
            </Container>

            {/* 7. 글로우 이펙트 (BlurFilter 대신 벡터 중첩 방식으로 변경하여 Jitter 완벽 방지) */}
            <Container
              name="L7-HighlightGlow"
              zIndex={70}
            >
              <PixiGraphics draw={drawHighlightsGlow} />
            </Container>

            {/* 8. 얇고 선명한 화이트 코어 (대륙 해안선과 동일 두께) */}
            <Container name="L8-HighlightCore" zIndex={75}>
              <PixiGraphics draw={drawHighlightsCore} />
            </Container>

            {/* 8.5 바다 건너 침공 원정 화살표 */}
            <Container name="L8.5-ExpeditionArrow" zIndex={78}>
              <PixiGraphics draw={drawExpeditionArrow} />
            </Container>



            {/* 9. LOD 1단계: 멀리서 줌 아웃 시 국가(세력) 거시 이름만 노출 */}
            <Container name="L9-Text-LOD1" zIndex={80}>
              {lod1Alpha > 0 && factionCenters.map((fc: any) => (
                <PixiText
                  key={`fc-${fc.id}-lod1`}
                  text={fc.name}
                  x={fc.x}
                  y={fc.y}
                  anchor={0.5}
                  scale={1 / scale}
                  alpha={lod1Alpha}
                  style={new PIXI.TextStyle({
                    fontFamily: 'NanumBarunGothic, sans-serif',
                    fontSize: 24,
                    fontWeight: '900',
                    fill: 0xffffff,
                    dropShadow: true, dropShadowColor: 0x000000, dropShadowDistance: 2, dropShadowAlpha: 1
                  })}
                />
              ))}
            </Container>

            {/* 8. LOD 2단계: 가까이서 줌 인 시 지역/마을/항구 명칭 노출 */}
            <Container name="L7-Text-LOD2" zIndex={80}>
              {lod2Alpha > 0 && centers.map(lg => (
                <Container key={`lb-${lg.id}`} position={[lg.x, lg.y]} scale={1 / scale} alpha={lod2Alpha}>
                  {lg.isCap && (
                    // 기존 크기에서 정확히 2배율로 확장된 수도 왕관 아이콘
                    <PixiGraphics draw={(g) => {
                      g.clear();
                      g.beginFill(0xec4899);
                      g.lineStyle(3.0, 0xffffff);
                      // 기존 폴리곤을 x2 스케일링
                      g.drawPolygon([-16, 12, -16, -4, -10, -10, -4, -4, 0, 2, 4, -4, 10, -10, 16, -4, 16, 12]);
                      g.endFill();
                      g.beginFill(0xfbbf24);
                      g.drawCircle(0, -14, 4);
                      g.endFill();
                    }} y={-28} />
                  )}
                  <PixiText
                    text={lg.name}
                    x={0}
                    y={0}
                    anchor={0.5}
                    style={new PIXI.TextStyle({
                      fontSize: lg.isCap ? 30 : 24,
                      fontWeight: lg.isCap ? '900' : '700',
                      fill: 0xffffff,
                      stroke: 0x000000,
                      strokeThickness: 5,
                      dropShadow: true, dropShadowColor: 0x000000, dropShadowAlpha: 0.6, dropShadowBlur: 4, dropShadowDistance: 2
                    })}
                  />
                </Container>
              ))}
            </Container>

            <PixiGraphics draw={drawBorders} />
          </Container>

          {/* 맵 바깥 영역 검은색 마스킹 */}
          <PixiGraphics draw={drawMask} />
        </Stage>

      </div>

      {/* ── 좌상단 세력 자원 HUD ── */}
      <div
        style={{
          position: 'absolute', top: 12, left: 12, zIndex: 25,
          background: 'rgba(8,9,24,0.82)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 6,
          padding: '8px 14px',
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        {playerResources && (
          <>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', fontFamily: 'sans-serif', marginBottom: 1 }}>GOLD</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24', fontFamily: 'sans-serif' }}>
                💰 {playerResources.gold.toLocaleString()}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', fontFamily: 'sans-serif', marginBottom: 1 }}>FOOD</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#86efac', fontFamily: 'sans-serif' }}>
                🌾 {playerResources.food.toLocaleString()}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', fontFamily: 'sans-serif', marginBottom: 1 }}>MANPOWER</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#93c5fd', fontFamily: 'sans-serif' }}>
                ⚒️ {playerResources.manpower.toLocaleString()}
              </div>
            </div>
          </>
        )}
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', fontFamily: 'sans-serif', marginBottom: 1 }}>TURN</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e0e7ff', fontFamily: 'sans-serif' }}>{strategyTurn}</div>
        </div>
      </div>

      {/* ── 우측 ActionPanel ── */}
      <ActionPanel onOpenDomesticModal={openDomestic} />

      {/* ── 하단 고정 바 (전국란스 스타일) ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0, left: 0,
          width: dimensions.w,
          height: BOTTOM_BAR_HEIGHT,
          background: 'rgba(6,7,18,0.95)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          zIndex: 25,
          backdropFilter: 'blur(8px)',
          pointerEvents: 'auto',
          gap: 8,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 좌측: 인물/부대/아이템 */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {([
            { icon: '📜', label: '인물록', onClick: () => useGameStore.getState().setHeroListModalOpen(true) },
            { icon: '📯', label: '징병', onClick: () => openDomestic('conscript') },
            { icon: '⚙️', label: '편제', onClick: () => openDomestic('formation') },
            { icon: '🏛️', label: '인사', onClick: () => openDomestic('personnel') },
          ] as const).map(({ icon, label, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 12px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 4,
                color: '#d1d5db',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "'Noto Sans KR', sans-serif",
                cursor: 'pointer',
                transition: 'background 0.13s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* 중앙: AP 게이지 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'sans-serif', letterSpacing: '0.05em' }}>행동력</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 14, height: 14,
                  borderRadius: '50%',
                  background: i < remainingAP
                    ? 'radial-gradient(circle at 40% 35%, #fbbf24, #d97706)'
                    : 'rgba(255,255,255,0.08)',
                  border: i < remainingAP
                    ? '1.5px solid rgba(251,191,36,0.6)'
                    : '1.5px solid rgba(255,255,255,0.06)',
                  boxShadow: i < remainingAP ? '0 0 5px rgba(251,191,36,0.4)' : 'none',
                  transition: 'all 0.2s',
                }}
              />
            ))}
          </div>
          <span style={{ fontSize: 10, color: remainingAP > 0 ? '#fbbf24' : '#6b7280', fontFamily: 'monospace', fontWeight: 700 }}>
            {remainingAP}/5
          </span>
        </div>

        {/* 우측: 선택 영지 빠른 정보 + 턴 종료 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {selectedProvince && (
            <div style={{
              display: 'flex', gap: 10, alignItems: 'center',
              padding: '4px 10px',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.06)',
              fontSize: 11,
              color: 'rgba(255,255,255,0.6)',
              fontFamily: 'sans-serif',
            }}>
              <span style={{ color: '#f0e8d8', fontWeight: 600 }}>{selectedProvince.name}</span>
              <span>🌾{selectedProvince.food}</span>
              <span>💰{selectedProvince.gold}</span>
              <span style={{ color: '#94a3b8' }}>치안 {selectedProvince.security}%</span>
              <button
                onClick={() => selectProvince(null)}
                style={{ color: '#6b7280', fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
              >✕</button>
            </div>
          )}
          <button
            onClick={() => endStrategyTurn()}
            style={{
              padding: '7px 20px',
              background: remainingAP > 0
                ? 'linear-gradient(135deg, #92400e, #b45309)'
                : 'linear-gradient(135deg, #3f6212, #4d7c0f)',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "'Noto Sans KR', sans-serif",
              cursor: 'pointer',
              letterSpacing: '0.03em',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.15)')}
            onMouseLeave={e => (e.currentTarget.style.filter = '')}
          >
            {remainingAP > 0 ? `⏭ 턴 종료` : `▶ 다음 턴`}
          </button>
        </div>
      </div>

      {/* ── 모달 ── */}
      <HeroListModal />
      <DomesticModal menu={activeDomesticMenu} onClose={closeDomestic} />
      <SortieModal />

    </div>
  );
};

export default StrategyMapScreen;
