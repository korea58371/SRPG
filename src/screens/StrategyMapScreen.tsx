import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Delaunay } from 'd3-delaunay';
import { generateProvinces } from '../utils/provinceGenerator';
import { useAppStore } from '../store/appStore';
import { FACTIONS } from '../constants/gameConfig';
import { Stage, Container, Graphics as PixiGraphics, Text as PixiText, Sprite } from '@pixi/react';
import * as PIXI from 'pixi.js';

// 지형 스프라이트 매니페스트 (public/assets/ui/terrain/ 기반)
const TERRAIN_MANIFEST: Record<string, string[]> = {
  mountain_normal:  ['mountain_normal_1.png','mountain_normal_2.png','mountain_normal_3.png','mountain_normal_4.png','mountain_normal_5.png'],
  mountain_rugged:  ['mountain_rugged_1.png'],
  mountain_gentle:  ['mountain_gentle_1.png'],
  hill:             ['hill_1.png','hill_2.png'],
  tree_conifer:     ['tree_conifer_1.png','tree_conifer_2.png','tree_conifer_3.png','tree_conifer_4.png','tree_conifer_5.png',
                     'tree_conifer_6.png','tree_conifer_7.png','tree_conifer_8.png','tree_conifer_9.png','tree_conifer_10.png'],
  tree_deciduous:   ['tree_deciduous_1.png','tree_deciduous_2.png','tree_deciduous_3.png','tree_deciduous_4.png','tree_deciduous_5.png','tree_deciduous_6.png'],
  castle:           ['castle_1.png','castle_2.png'],
  fortress:         ['fortress_1.png','fortress_2.png'],
  town_large:       ['town_large_1.png'],
  town:             ['town_1.png','town_2.png','town_3.png','town_4.png','town_5.png'],
  village:          ['village_1.png','village_2.png','village_3.png'],
  ocean:            ['ocean_1.png'],
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

// RGB 컬러 블렌딩 보조 함수 (파치먼트 틴트 믹스 용도)
function blendColors(c1: number, c2: number, ratio: number): number {
  const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
  const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  return (r << 16) | (g << 8) | b;
}

// 파치먼트(양피지) 기조 팔레트
const PARCHMENT_BASE  = 0xcbbba4; // 기본 모래/파치먼트
const PARCHMENT_DARK  = 0xa5967d; // 어두운 경계 느낌
const COASTAL_COLOR   = 0xd4c5ae; // 얕은 해안선 (밝은 모래색)
const OCEAN_COLORS    = [0xcbbba4, 0xbdad96, 0xb0a08a, 0xa3937e, 0xa3957f]; // 심도별 (심해 중간값 베이지)


const SVG_W = 1440;
const SVG_H = 820;

type MapMode = 'faction';

export const StrategyMapScreen = () => {
  const worldSeed  = useAppStore(s => s.worldSeed);

  const [mapMode] = useState<MapMode>('faction');

  // 화면 크기
  const [dimensions, setDimensions] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const handleResize = () => setDimensions({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- 카메라 Tween 상태 ---
  // initialFitScale: 긴 폭 기준 100% 맞춤
  const initialFitScale = typeof window !== 'undefined'
    ? Math.max(window.innerWidth / SVG_W, window.innerHeight / SVG_H)
    : 1.0;

  const [scale, setScale]               = useState(initialFitScale);
  const [targetScale, setTargetScale]   = useState(initialFitScale);
  const [position, setPosition]         = useState(() => {
    const s = initialFitScale;
    return {
      x: (window.innerWidth  - SVG_W * s) / 2,
      y: (window.innerHeight - SVG_H * s) / 2,
    };
  });
  const [targetPosition, setTargetPosition] = useState(() => {
    const s = initialFitScale;
    return {
      x: (window.innerWidth  - SVG_W * s) / 2,
      y: (window.innerHeight - SVG_H * s) / 2,
    };
  });
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const [dragStart, setDragStart]         = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // 화면 밖으로 튕겨나가지 않도록 좌표를 클램핑하는 보조 함수
  const getClampedPosition = useCallback((newX: number, newY: number, currentScale: number) => {
    const mapW = SVG_W * currentScale;
    const mapH = SVG_H * currentScale;
    const { w, h } = dimensions;
    const cx = mapW > w ? Math.max(w - mapW, Math.min(0, newX)) : (w - mapW) / 2;
    const cy = mapH > h ? Math.max(h - mapH, Math.min(0, newY)) : (h - mapH) / 2;
    return { x: cx, y: cy };
  }, [dimensions]);

  // Lerp Tweening 애니메이션 루프
  useEffect(() => {
    let frameId: number;
    const LERP = 0.18;
    const animate = () => {
      if (!isDraggingMap) {
        setScale(prev => {
          const diff = targetScale - prev;
          return Math.abs(diff) < 0.0005 ? targetScale : prev + diff * LERP;
        });
        setPosition(prev => {
          const dx = targetPosition.x - prev.x;
          const dy = targetPosition.y - prev.y;
          if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) return targetPosition;
          return getClampedPosition(prev.x + dx * LERP, prev.y + dy * LERP, scale);
        });
      }
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [targetScale, targetPosition, isDraggingMap, scale, getClampedPosition]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomIn = e.deltaY < 0;
    const factor = zoomIn ? 1.25 : 0.8;

    // 긴 폭 기준 맞춤 스케일 이하로 축소되는 것을 방지
    const minScale = Math.max(dimensions.w / SVG_W, dimensions.h / SVG_H);
    const newTargetScale = Math.min(Math.max(targetScale * factor, minScale), 8);

    // 마우스 포인터를 향해 줌
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    const localX = (cursorX - position.x) / scale;
    const localY = (cursorY - position.y) / scale;
    const newX = cursorX - localX * newTargetScale;
    const newY = cursorY - localY * newTargetScale;

    setTargetScale(newTargetScale);
    setTargetPosition(getClampedPosition(newX, newY, newTargetScale));
  }, [targetScale, position, scale, dimensions, getClampedPosition]);

  // 선택/호버 state는 event handler에서 참조하므로 먼저 선언
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
  const [hoveredProvinceId, setHoveredProvinceId]   = useState<string | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setIsDraggingMap(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingMap) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      const newPos = getClampedPosition(position.x + dx, position.y + dy, scale);
      setPosition(newPos);
      setTargetPosition(newPos);
      setDragStart({ x: e.clientX, y: e.clientY });
    }

    // 호버 탐지 (Delaunay Raycasting)
    if (containerRef.current && delaunayFinder && parsedCells) {
      const rect = containerRef.current.getBoundingClientRect();
      const localX = (e.clientX - rect.left - position.x) / scale;
      const localY = (e.clientY - rect.top  - position.y) / scale;
      const cellIndex = delaunayFinder.find(localX, localY);
      if (cellIndex !== undefined && cellIndex >= 0 && cellIndex < parsedCells.length) {
        const pCell = parsedCells[cellIndex];
        const dx2 = pCell.cx - localX, dy2 = pCell.cy - localY;
        if (dx2 * dx2 + dy2 * dy2 > 2000) {
          if (hoveredProvinceId !== null) setHoveredProvinceId(null);
          return;
        }
        const provId = pCell.provinceId;
        if (provId !== hoveredProvinceId && provId) setHoveredProvinceId(provId);
        else if (!provId && hoveredProvinceId !== null) setHoveredProvinceId(null);
      }
    }
  }, [isDraggingMap, dragStart, position, scale, getClampedPosition]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setIsDraggingMap(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (isDraggingMap) return;
    if (hoveredProvinceId && hoveredProvinceId !== selectedProvinceId) {
      setSelectedProvinceId(hoveredProvinceId);
    } else if (hoveredProvinceId === selectedProvinceId) {
      setSelectedProvinceId(null);
    }
  }, [isDraggingMap, hoveredProvinceId, selectedProvinceId]);

  // --- 데이터 생성 및 캐싱 ---
  const { boundaryEdges, terrainIcons, rivers, centers, factionCenters, provinces, parsedCells, delaunayFinder, coastlineEdges } = useMemo(() => {
    if (!worldSeed) return { allCells: [], boundaryEdges: [], oceanDepth: [], terrainIcons: [], rivers: [], centers: [], factionCenters: [], provinces: {}, parsedCells: null, delaunayFinder: null, coastlineEdges: [] };
    const result = generateProvinces(SVG_W, SVG_H, worldSeed);

    const grouped: Record<string, { sx: number; sy: number; n: number; isCap: boolean; name: string }> = {};
    const parsedCache: { polygon: number[]; provinceId: string | null; isOcean: boolean; depth: number; faction: string | null; cx: number; cy: number }[] = [];
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
        cy: c.cy,
      });
      if (!c.provinceId || !provObj) continue;
      if (!grouped[c.provinceId]) {
        grouped[c.provinceId] = { sx: 0, sy: 0, n: 0, isCap: provObj.isCapital, name: provObj.name };
      }
      grouped[c.provinceId].sx += c.cx;
      grouped[c.provinceId].sy += c.cy;
      grouped[c.provinceId].n++;
    }

    const centers = Object.keys(grouped).map(id => ({
      id,
      name: grouped[id].name,
      isCap: grouped[id].isCap,
      x: grouped[id].sx / grouped[id].n,
      y: grouped[id].sy / grouped[id].n,
    }));

    // 세력별 셀 목록 수집
    const factionCells: Record<string, Array<{ cx: number; cy: number }>> = {};
    for (let i = 0; i < result.allCells.length; i++) {
      const c = result.allCells[i];
      if (c.isOcean || !c.provinceId) continue;
      const prov = result.provinces[c.provinceId];
      if (!prov || !FACTIONS[prov.owner]) continue;
      if (!factionCells[prov.owner]) factionCells[prov.owner] = [];
      factionCells[prov.owner].push({ cx: c.cx, cy: c.cy });
    }

    // 세력별 가장 큰 연결 클러스터 중심 계산 (바다 건너 영토 제외)
    // 25px 그리드로 버킷화 → BFS로 연결 컴포넌트 탐색 → 최대 클러스터 사용
    const GRID = 25;
    const factionCenters = Object.entries(factionCells)
      .filter(([id]) => FACTIONS[id])
      .map(([id, cells]) => {
        // 그리드 키 → 셀 인덱스 목록
        const gridMap = new Map<string, number[]>();
        for (let i = 0; i < cells.length; i++) {
          const key = `${Math.round(cells[i].cx / GRID)},${Math.round(cells[i].cy / GRID)}`;
          if (!gridMap.has(key)) gridMap.set(key, []);
          gridMap.get(key)!.push(i);
        }

        const visited = new Set<string>();
        let bestCluster: { cx: number; cy: number }[] = cells;
        let bestSize = 0;

        for (const startKey of gridMap.keys()) {
          if (visited.has(startKey)) continue;
          const clusterKeys: string[] = [];
          const queue = [startKey];
          visited.add(startKey);
          let qi = 0;
          while (qi < queue.length) {
            const k = queue[qi++];
            clusterKeys.push(k);
            const [gx, gy] = k.split(',').map(Number);
            for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]) {
              const nk = `${gx + dx},${gy + dy}`;
              if (gridMap.has(nk) && !visited.has(nk)) { visited.add(nk); queue.push(nk); }
            }
          }
          const clusterCells = clusterKeys.flatMap(k => (gridMap.get(k) ?? []).map(i => cells[i]));
          if (clusterCells.length > bestSize) { bestSize = clusterCells.length; bestCluster = clusterCells; }
        }

        const sx = bestCluster.reduce((a, c) => a + c.cx, 0);
        const sy = bestCluster.reduce((a, c) => a + c.cy, 0);
        return { id, name: FACTIONS[id].name, x: sx / bestCluster.length, y: sy / bestCluster.length };
      });


    const hitFinder = Delaunay.from(cellCenters);
    return {
      allCells: result.allCells,
      boundaryEdges: result.boundaryEdges,
      oceanDepth: result.oceanDepth,
      terrainIcons: result.terrainIcons,
      rivers: result.rivers,
      provinces: result.provinces,
      centers,
      factionCenters,
      parsedCells: parsedCache,
      delaunayFinder: hitFinder,
      coastlineEdges: result.coastlineEdges,
    };
  }, [worldSeed]);

  const selectedProvince = selectedProvinceId ? (provinces as any)[selectedProvinceId] : null;


  // --- PIXI 커스텀 렌더링 파이프라인 ---
  const drawMapBase = useCallback((g: PIXI.Graphics) => {
    if (!parsedCells) return;
    g.clear();

    const getFillColor = (idx: number, cell: typeof parsedCells[0]): number => {
      if (cell.isOcean) {
        if (cell.depth === 0) return OCEAN_COLORS[4];
        if (cell.depth === 1) return COASTAL_COLOR;
        return OCEAN_COLORS[Math.min(cell.depth - 2, OCEAN_COLORS.length - 1)];
      }
      if (mapMode === 'faction' && cell.faction && FACTIONS[cell.faction]) {
        // 세력 색 × PARCHMENT_DARK(어두운 파치먼트)로 혼합 → 더 짙고 어두운 영토 색
        return blendColors(FACTIONS[cell.faction].color, PARCHMENT_DARK, 0.53);
      }
      return PARCHMENT_BASE;
    };

    for (let i = 0; i < parsedCells.length; i++) {
      const c = parsedCells[i];
      const color = getFillColor(i, c);
      g.lineStyle(0);
      g.beginFill(color, c.isOcean ? 1 : 0.92);
      g.drawPolygon(c.polygon);
      g.endFill();
    }
  }, [parsedCells, mapMode]);

  const drawCoastlines = useCallback((g: PIXI.Graphics) => {
    g.clear();
    if (coastlineEdges && coastlineEdges.length > 0) {
      g.lineStyle({ width: 1.5, color: 0x4a3b32, alpha: 1.0, join: PIXI.LINE_JOIN.ROUND, cap: PIXI.LINE_CAP.ROUND });
      for (const edge of coastlineEdges) {
        g.moveTo(edge.x1, edge.y1);
        g.lineTo(edge.x2, edge.y2);
      }
    }
  }, [coastlineEdges]);

  const drawRivers = useCallback((g: PIXI.Graphics) => {
    if (!rivers) return;
    g.clear();
    rivers.forEach(r => {
      const w = Math.max(0.5, Math.min(r.flux * 3 + 0.5, 4));
      g.lineStyle(w, 0x3b82f6, 0.8);
      g.moveTo(r.x1, r.y1);
      g.lineTo(r.x2, r.y2);
    });
  }, [rivers]);

  const drawBoundaries = useCallback((g: PIXI.Graphics) => {
    if (!boundaryEdges) return;
    g.clear();
    boundaryEdges.forEach(e => {
      if (e.isFactionBoundary) {
        g.lineStyle({ width: 1.5, color: 0x3a2d22, alpha: 1.0, join: PIXI.LINE_JOIN.ROUND, cap: PIXI.LINE_CAP.ROUND });
      } else {
        g.lineStyle({ width: 1, color: 0x000000, alpha: 0.12, join: PIXI.LINE_JOIN.ROUND, cap: PIXI.LINE_CAP.ROUND });
      }
      g.moveTo(e.x1, e.y1);
      g.lineTo(e.x2, e.y2);
    });
  }, [boundaryEdges]);

  const drawHighlights = useCallback((g: PIXI.Graphics) => {
    g.clear();
    if (!parsedCells) return;
    const drawTargetProv = (targetId: string, color: number, alpha: number, lineWidth: number) => {
      g.lineStyle(lineWidth, color, alpha);
      g.beginFill(Math.min(color + 0x333333, 0xffffff), alpha * 0.4);
      for (let i = 0; i < parsedCells.length; i++) {
        if (parsedCells[i].provinceId === targetId) g.drawPolygon(parsedCells[i].polygon);
      }
      g.endFill();
    };
    if (hoveredProvinceId && hoveredProvinceId !== selectedProvinceId) {
      drawTargetProv(hoveredProvinceId, 0xffffff, 0.4, 0);
    }
    if (selectedProvinceId) {
      drawTargetProv(selectedProvinceId, 0xfcd34d, 0.6, 4);
    }
  }, [parsedCells, hoveredProvinceId, selectedProvinceId]);

  const drawBorders = useCallback((g: PIXI.Graphics) => {
    g.clear();
    g.lineStyle(6, 0x2c1e14, 1);
    g.drawRect(0, 0, SVG_W, SVG_H);
  }, []);

  // 맵 영역 바깥 마스킹 레이어 (Container 밖 화면 좌표 기준)
  const drawMask = useCallback((g: PIXI.Graphics) => {
    g.clear();
    const mapLeft   = position.x;
    const mapTop    = position.y;
    const mapRight  = position.x + SVG_W * scale;
    const mapBottom = position.y + SVG_H * scale;
    const W = dimensions.w;
    const H = dimensions.h;
    g.beginFill(0x000000, 1);
    if (mapLeft > 0)   g.drawRect(0, 0, mapLeft, H);
    if (mapRight < W)  g.drawRect(mapRight, 0, W - mapRight, H);
    if (mapTop > 0)    g.drawRect(mapLeft, 0, SVG_W * scale, mapTop);
    if (mapBottom < H) g.drawRect(mapLeft, mapBottom, SVG_W * scale, H - mapBottom);
    g.endFill();
  }, [position, scale, dimensions]);

  // --- LOD 계산 ---
  // LOD_SWITCH: 이 배율에서 세력명(lod1) ↔ 지역명(lod2) 교차
  // fitScale = 화면에 맵이 꽉 들어차는 최소 배율
  const fitScale    = Math.max(dimensions.w / SVG_W, dimensions.h / SVG_H);
  const LOD_SWITCH  = fitScale * 2.0;  // fitScale의 2배 확대 시점에서 교차
  const FADE_HALF   = fitScale * 0.4;  // 교차 전후 ±0.4배 구간에서 페이드

  // lod1Alpha: fitScale에서 1.0, LOD_SWITCH+FADE_HALF 이상에서 0.0
  const lod1Alpha = Math.max(0, Math.min(1, (LOD_SWITCH + FADE_HALF - scale) / (FADE_HALF * 2)));
  // lod2Alpha: LOD_SWITCH-FADE_HALF 이하에서 0.0, LOD_SWITCH+FADE_HALF 이상에서 1.0
  const lod2Alpha = Math.max(0, Math.min(1, (scale - (LOD_SWITCH - FADE_HALF)) / (FADE_HALF * 2)));



  return (
    <div className="smap-container">
      <div className="smap-header-bar flex items-center justify-between pointer-events-none relative z-10 px-4">
        <h1 className="smap-title font-title text-2xl font-bold text-white drop-shadow-md">
          지방 행정 <span className="text-gray-300 ml-2 text-sm italic opacity-80">- WebGL Engine</span>
        </h1>
      </div>

      {/* 지도 (순수 PIXI WebGL 캔버스 렌더러) */}
      <div
        ref={containerRef}
        className="smap-map-area"
        style={{
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#c2ae95', // 파치먼트 외곽 배경
          cursor: isDraggingMap ? 'grabbing' : 'grab',
          touchAction: 'none',
          width: '100%',
          height: '100vh',
        }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <Stage
          width={dimensions.w}
          height={dimensions.h}
          options={{
            backgroundColor: 0xa3957f, // 맵 외곽 심해 (중간 베이지)
            resolution: typeof window !== 'undefined' ? Math.max(window.devicePixelRatio || 1, 2) : 2,
            autoDensity: true,
            antialias: false,
          }}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          {/* Main Transformation Container (지도 맵 좌표계) */}
          <Container scale={scale} position={[position.x, position.y]}>
            {/* 1. Base Map */}
            <PixiGraphics draw={drawMapBase} />
            {/* 2. Rivers */}
            <PixiGraphics draw={drawRivers} />
            {/* 3. Boundaries */}
            <PixiGraphics draw={drawBoundaries} />
            {/* 4. Highlights */}
            <PixiGraphics draw={drawHighlights} />
            {/* 5. Coastlines (최상단 레이어로 하이라이트를 덮어야 함) */}
            <PixiGraphics draw={drawCoastlines} />


            <PixiGraphics draw={drawBorders} />
          </Container>

          {/* 5. Terrain Sprites — Container 밖, Stage 안 (screen 좌표계)
              위치: 맵 좌표 → 화면 좌표 직접 변환하여 줌/팬 추적, 크기는 항상 고정 */}
          {terrainIcons.map((ti, idx) => {
            const variants: string[] | undefined =
              ti.type === 'peak'     ? TERRAIN_MANIFEST.mountain_rugged :
              ti.type === 'mountain' ? TERRAIN_MANIFEST.mountain_normal  :
              /* forest */             TERRAIN_MANIFEST.tree_conifer;
            if (!variants || variants.length === 0) return null;

            const variantFile = variants[Math.floor((ti.x * 7 + ti.y * 13) % variants.length)];
            const spriteSrc = `/assets/ui/terrain/${variantFile}`;

            // 맵 좌표 → 화면 좌표 변환 (Container transform 없이 직접)
            const screenX = position.x + ti.x * scale;
            const screenY = position.y + ti.y * scale;

            // 화면 밖 컬링
            const displaySize = Math.min(Math.max(ti.s, 8), 18);
            if (screenX < -displaySize * 2 || screenX > dimensions.w + displaySize * 2) return null;
            if (screenY < -displaySize * 2 || screenY > dimensions.h + displaySize * 2) return null;

            // 화면 고정 크기 스케일 (Container 스케일과 완전히 분리)
            const spriteScale = displaySize / 64;
            return (
              <Sprite
                key={`ti-${idx}`}
                image={spriteSrc}
                x={screenX}
                y={screenY}
                anchor={0.5}
                scale={{ x: spriteScale, y: spriteScale }}
                blendMode={PIXI.BLEND_MODES.MULTIPLY}
              />
            );
          })}

          {/* 6. LOD 1: 줌아웃 시 국가(세력) 이름 — Terrain Sprites 위 레이어 */}
          {lod1Alpha > 0 && factionCenters.map((fc: any) => {
            const sx = position.x + fc.x * scale;
            const sy = position.y + fc.y * scale;
            if (sx < -120 || sx > dimensions.w + 120) return null;
            if (sy < -60  || sy > dimensions.h + 60)  return null;
            return (
              <PixiText
                key={`fc-${fc.id}-lod1`}
                text={fc.name}
                x={sx}
                y={sy}
                anchor={0.5}
                alpha={lod1Alpha}
                style={new PIXI.TextStyle({
                  fontFamily: 'NanumBarunGothic, sans-serif',
                  fontSize: 22,
                  fontWeight: '900',
                  fill: 0xffffff,
                  dropShadow: true, dropShadowColor: 0x2c1e14, dropShadowDistance: 2, dropShadowAlpha: 1,
                })}
              />
            );
          })}

          {/* 7. LOD 2: 줌인 시 영지/마을 명칭 — Terrain Sprites 위 레이어 */}
          {lod2Alpha > 0 && centers.map(lg => {
            const sx = position.x + lg.x * scale;
            const sy = position.y + lg.y * scale;
            if (sx < -120 || sx > dimensions.w + 120) return null;
            if (sy < -60  || sy > dimensions.h + 60)  return null;
            return (
              <Container key={`lb-${lg.id}`} position={[sx, sy]} alpha={lod2Alpha}>
                {lg.isCap && (
                  <PixiGraphics draw={(g) => {
                    g.clear();
                    g.beginFill(0xec4899);
                    g.lineStyle(1.5, 0xffffff);
                    g.drawPolygon([-8, 6, -8, -2, -5, -5, -2, -2, 0, 1, 2, -2, 5, -5, 8, -2, 8, 6]);
                    g.endFill();
                    g.beginFill(0xfbbf24);
                    g.drawCircle(0, -7, 2);
                    g.endFill();
                  }} y={-14} />
                )}
                <PixiText
                  text={lg.name}
                  x={0}
                  y={0}
                  anchor={0.5}
                  style={new PIXI.TextStyle({
                    fontSize: lg.isCap ? 15 : 12,
                    fontWeight: lg.isCap ? '900' : '700',
                    fill: 0xffffff,
                    stroke: 0x2c1e14,
                    strokeThickness: 3,
                    dropShadow: true, dropShadowColor: 0x2c1e14, dropShadowAlpha: 0.8, dropShadowBlur: 2, dropShadowDistance: 1,
                  })}
                />
              </Container>
            );
          })}

          {/* 맵 외곽 블랙 마스킹 */}
          <PixiGraphics draw={drawMask} />
        </Stage>

        {/* 클릭 감지 투명 레이어 */}
        <div
          className="absolute inset-0 z-0 pointer-events-auto"
          onClick={handleCanvasClick}
          style={{ opacity: 0 }}
          onPointerMove={handlePointerMove}
        />
      </div>

      {/* Province 상세 패널 */}
      {selectedProvince && (
        <div className="smap-panel absolute top-[10%] left-6 w-80 bg-slate-900 border-2 border-slate-700 shadow-2xl rounded p-4 text-white z-20 transition-all smap-enter-anim pointer-events-auto">
          <div className="flex justify-between items-start mb-4 border-b border-slate-700 pb-2">
            <div>
              <h2 className="text-xl font-bold font-title text-amber-500 shadow-amber-900/50 drop-shadow-sm">{selectedProvince.name}</h2>
              <div className="text-sm font-semibold text-slate-400 mt-1">{FACTIONS[selectedProvince.owner]?.name || '중립 영토'}</div>
            </div>
            {selectedProvince.isCapital && (
              <div className="bg-red-900/80 text-red-200 text-xs px-2 py-1 rounded font-bold border border-red-700/50 shadow-sm">세력 수도</div>
            )}
            <button onClick={() => setSelectedProvinceId(null)} className="text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 px-2 rounded-sm border border-slate-600">✕</button>
          </div>

          <div className="space-y-4 text-sm mt-2 font-mono">
            <div className="grid grid-cols-2 gap-3 bg-slate-800/50 p-3 rounded border border-slate-700">
              <div><span className="text-slate-500 text-xs block mb-1">치안도</span><span className="font-bold text-emerald-400">{selectedProvince.security}%</span></div>
              <div><span className="text-slate-500 text-xs block mb-1">지배력</span><span className="font-bold text-blue-400">안정</span></div>
            </div>
            <div className="space-y-2 pt-2 border-t border-slate-700/50">
              <div className="flex justify-between"><span className="text-slate-400 font-bold">턴 당 금:</span><span className="text-yellow-400 font-bold">+{selectedProvince.baseGoldProduction}</span></div>
              <div className="flex justify-between"><span className="text-slate-400 font-bold">턴 당 군량:</span><span className="text-orange-400 font-bold">+{selectedProvince.baseFoodProduction}</span></div>
              <div className="flex justify-between"><span className="text-slate-400 font-bold">기본 징병력:</span><span className="text-blue-400 font-bold">{selectedProvince.baseRecruitment}</span></div>
            </div>
            <button className="w-full mt-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-500 text-white rounded font-bold transition-colors shadow-inner flex items-center justify-center gap-2">
              <span className="text-amber-500 drop-shadow-md">⚔️</span> 관리 명령 하달
            </button>
          </div>
        </div>
      )}

      {/* 우측 하단 종료 버튼 */}
      <button className="absolute bottom-6 right-6 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold border-2 border-slate-600 shadow-xl z-30 smap-btn-anim transition-all">
        전략 맵 닫기
      </button>
    </div>
  );
};

export default StrategyMapScreen;
