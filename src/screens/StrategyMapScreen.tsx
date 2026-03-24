import { useMemo, useState, memo, useEffect, useCallback, useRef } from 'react';
import { Delaunay } from 'd3-delaunay';
import { generateProvinces, type MicroCell } from '../utils/provinceGenerator';
import { useAppStore } from '../store/appStore';
import type { Province } from '../types/appTypes';
import { FACTIONS } from '../constants/gameConfig';
import { Stage, Container, Graphics as PixiGraphics, Text as PixiText } from '@pixi/react';
import * as PIXI from 'pixi.js';

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

// 컬러 Hex 문자열을 Number 형식(0xRRGGBB)으로 변환
function colorToHex(color: string): number {
  if (color.startsWith('#')) return parseInt(color.slice(1), 16);
  if (color === 'red') return 0xff0000;
  if (color === 'yellow') return 0xffff00;
  return 0xffffff;
}

const COASTAL_COLOR = 0xaae6fa;
const OCEAN_COLORS = [0x91daef, 0x7ecfe8, 0x6cc5e1, 0x5abab9, 0x6ebeeb]; // 바다 심도별 (가장 깊은 0x6ebeeb 포함)

const SVG_W = 1440;
const SVG_H = 820;

type MapMode = 'faction' | 'terrain' | 'security' | 'resource';

// --- PIXI 스타일 상수 ---
const LABEL_TEXT_STYLE = new PIXI.TextStyle({
  fontFamily: ['Pretendard', 'sans-serif'],
  fontSize: 14,
  fontWeight: 'bold',
  fill: 0xffffff,
  stroke: 0x000000,
  strokeThickness: 3,
  align: 'center',
  dropShadow: true,
  dropShadowAlpha: 0.6,
  dropShadowBlur: 2,
  dropShadowDistance: 2,
});

const CENTER_LABEL_STYLE = new PIXI.TextStyle({
  ...LABEL_TEXT_STYLE,
  fontSize: 22,
});

export const StrategyMapScreen = () => {
  const worldSeed = useAppStore(s => s.worldSeed);
  const userFaction = useAppStore(s => s.playerFaction);
  const factionResources = useAppStore(s => s.factionResources);

  const [mapMode, setMapMode] = useState<MapMode>('faction');

  // 화면 크기
  const [dimensions, setDimensions] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setDimensions({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- 화면 줌/팬 핸들러 ---
  const [scale, setScale] = useState(1.0);
  // 처음 지도를 중앙쯤에 두기 위해 보정
  const [position, setPosition] = useState({ x: (window.innerWidth - SVG_W) / 2, y: (window.innerHeight - SVG_H) / 2 });
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // 화면 밖으로 튕겨나가지 않도록 좌표를 클램프(Clamp)하는 보조 함수
  const getClampedPosition = (newX: number, newY: number, currentScale: number) => {
    const mapW = SVG_W * currentScale;
    const mapH = SVG_H * currentScale;

    let cx = newX;
    let cy = newY;

    // 가로 스크롤 한계 (맵이 화면보다 넓을 때만 작동, 작으면 무조건 중앙)
    if (mapW > dimensions.w) {
      cx = Math.max(dimensions.w - mapW, Math.min(0, cx));
    } else {
      cx = (dimensions.w - mapW) / 2;
    }

    // 세로 스크롤 한계
    if (mapH > dimensions.h) {
      cy = Math.max(dimensions.h - mapH, Math.min(0, cy));
    } else {
      cy = (dimensions.h - mapH) / 2;
    }

    return { x: cx, y: cy };
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomIn = e.deltaY < 0;
    const factor = zoomIn ? 1.25 : 0.8;

    // 화면 맞춤사이즈 이상으로(여백 생기지 않도록) 축소되는 것을 방지
    const minScale = Math.max(dimensions.w / SVG_W, dimensions.h / SVG_H);
    const newScale = Math.min(Math.max(scale * factor, minScale), 8);

    // 마우스 포인터를 향해 줌
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    // 현재 커서의 로컬 좌표
    const localX = (cursorX - position.x) / scale;
    const localY = (cursorY - position.y) / scale;

    // 새로운 위치 계산
    const newX = cursorX - localX * newScale;
    const newY = cursorY - localY * newScale;

    setScale(newScale);
    setPosition(getClampedPosition(newX, newY, newScale));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDraggingMap(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // 1. 드래그 이동 (영역 밖 클램핑 적용)
    if (isDraggingMap) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPosition(prev => getClampedPosition(prev.x + dx, prev.y + dy, scale));
      setDragStart({ x: e.clientX, y: e.clientY });
    }

    // 2. 호버 탐지 (Delaunay Raycasting, O(1) 수준 초고속)
    if (containerRef.current && delaunayFinder && parsedCells) {
      const rect = containerRef.current.getBoundingClientRect();
      const localX = (e.clientX - rect.left - position.x) / scale;
      const localY = (e.clientY - rect.top - position.y) / scale;

      // 마우스 좌표와 가장 가까운 셀 반환 (만도 초고속 색인)
      const cellIndex = delaunayFinder.find(localX, localY);
      if (cellIndex !== undefined && cellIndex >= 0 && cellIndex < parsedCells.length) {
        const pCell = parsedCells[cellIndex];

        // 거리가 너무 먼 영역 밖의 호버 방지 (선택)
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
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (isDraggingMap) return;
    if (hoveredProvinceId && hoveredProvinceId !== selectedProvinceId) {
      setSelectedProvinceId(hoveredProvinceId);
    } else if (hoveredProvinceId === selectedProvinceId) {
      setSelectedProvinceId(null);
    }
  };


  // --- 데이터 생성 및 캐싱 ---
  const { allCells, boundaryEdges, oceanDepth, terrainIcons, rivers, centers, provinces, parsedCells, delaunayFinder, coastlineEdges } = useMemo(() => {
    if (!worldSeed) return { allCells: [], boundaryEdges: [], oceanDepth: [], terrainIcons: [], rivers: [], centers: [], provinces: {}, parsedCells: null, delaunayFinder: null, coastlineEdges: [] };
    const result = generateProvinces(SVG_W, SVG_H, worldSeed);

    // 각 셀의 중심을 계산하여 중심 라벨 위치 도출
    const grouped: Record<string, { sx: number; sy: number; n: number; isCap: boolean; name: string }> = {};
    const parsedCache: { polygon: number[]; provinceId: string | null; isOcean: boolean, depth: number, faction: string | null, cx: number, cy: number }[] = [];
    const cellCenters: [number, number][] = [];

    for (let i = 0; i < result.allCells.length; i++) {
      const c = result.allCells[i];
      cellCenters.push([c.cx, c.cy]);

      // c.province 속성이 없을 수 있으므로 result.provinces 맵 사용
      const provObj = c.provinceId ? result.provinces[c.provinceId] : null;

      // 문자열 -> 숫자로 선제 파싱
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
    }

    const centers = Object.keys(grouped).map(id => ({
      id,
      name: grouped[id].name,
      isCap: grouped[id].isCap,
      x: grouped[id].sx / grouped[id].n,
      y: grouped[id].sy / grouped[id].n,
    }));

    // 초고속 호버링 탐색 트리 생성
    const hitFinder = Delaunay.from(cellCenters);

    return {
      allCells: result.allCells,
      boundaryEdges: result.boundaryEdges,
      oceanDepth: result.oceanDepth,
      terrainIcons: result.terrainIcons,
      rivers: result.rivers,
      provinces: result.provinces,
      centers,
      parsedCells: parsedCache,
      delaunayFinder: hitFinder,
      coastlineEdges: result.coastlineEdges,
    };
  }, [worldSeed]);

  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
  const [hoveredProvinceId, setHoveredProvinceId] = useState<string | null>(null);

  const selectedProvince = selectedProvinceId ? provinces[selectedProvinceId] : null;

  // --- PIXI 커스텀 렌더링 파이프라인 ---
  // 1. 단일 마그마 코어 드로우 콜 (지형, 바다) - `parsedCells` 캐싱 기반
  const drawMapBase = useCallback((g: PIXI.Graphics) => {
    if (!parsedCells) return;
    g.clear();

    const getFillColor = (idx: number, cell: typeof parsedCells[0]): number => {
      // 바다: BFS 거리 기반 (육지에 가까울수록 1, 멀어질수록 큰 값)
      if (cell.isOcean) {
        // BFS 큐가 닿지 않은 극외곽 심해는 가장 짙은 색으로 통일
        if (cell.depth === 0) return 0x6ebeeb;

        // 육지와 인접한 1단계 얕은 해안선
        if (cell.depth === 1) return COASTAL_COLOR;

        // 거리가 멀어질수록 심해 배열(OCEAN_COLORS)을 따라 점진적으로 어두워짐
        const colorIdx = Math.min(cell.depth - 2, OCEAN_COLORS.length - 1);
        return OCEAN_COLORS[colorIdx];
      }
      // Faction 모드
      if (mapMode === 'faction') {
        // 기존 FACTION_COLORS 하드코딩이 아닌 실제 게임 config 데이터 참조
        if (cell.faction && FACTIONS[cell.faction]) {
          return FACTIONS[cell.faction].color;
        }
        return 0xD1D5DB; // 회색 (미할당 육지)
      }
      return 0x9CA3AF; // 모든 모드 Fallback
    };

    // 거대한 폴리곤들 루프 (만 사천 번 그려도 Pixi 내부에선 버텍스 버퍼 연산으로 하나로 통합됨)
    for (let i = 0; i < parsedCells.length; i++) {
      const c = parsedCells[i];
      const color = getFillColor(i, c);

      // 모든 마이크로셀 윤곽선 제거 (깔끔한 솔리드 렌더링)
      g.lineStyle(0);

      if (c.isOcean) {
        g.beginFill(color, 1);
      } else {
        // 육지는 세력 모드 시 약간 투명하게 하여 지형이 은은하게 비치도록
        g.beginFill(color, mapMode === 'faction' && (!c.faction) ? 0.3 : 0.85);
      }

      g.drawPolygon(c.polygon);
      g.endFill();
    }
  }, [parsedCells, mapMode]);

  // 1-5. 대륙 해안선 (하이라이트를 덮기 위해 별도 레이어로 분리)
  const drawCoastlines = useCallback((g: PIXI.Graphics) => {
    g.clear();
    if (coastlineEdges && coastlineEdges.length > 0) {
      // 투명도 없는 굵고 선명한 짙은 고동색(Dark Brown) 잉크 스타일 적용
      g.lineStyle({ width: 1.5, color: 0x4a3b32, alpha: 1.0, join: PIXI.LINE_JOIN.ROUND, cap: PIXI.LINE_CAP.ROUND });
      for (let i = 0; i < coastlineEdges.length; i++) {
        const edge = coastlineEdges[i];
        g.moveTo(edge.x1, edge.y1);
        g.lineTo(edge.x2, edge.y2);
      }
    }
  }, [coastlineEdges]);

  // 2. 강 시스템
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

  // 3. 지형/세력 경계선 시스템
  const drawBoundaries = useCallback((g: PIXI.Graphics) => {
    if (!boundaryEdges) return;
    g.clear();
    boundaryEdges.forEach(e => {
      const isFact = e.isFactionBoundary;
      if (isFact) {
        // 국가간 경계선: 완전 불투명(1.0), 두께 1, 어두운 선(0x4a3b32), 부드러운 Miter/Cap (라운드)
        g.lineStyle({ width: 1, color: 0x4a3b32, alpha: 1.0, join: PIXI.LINE_JOIN.ROUND, cap: PIXI.LINE_CAP.ROUND });
      } else {
        // 내부 일반 영지 경계선: 얇고 투명한 검은색 라인
        g.lineStyle({ width: 1, color: 0x000000, alpha: 0.15, join: PIXI.LINE_JOIN.ROUND, cap: PIXI.LINE_CAP.ROUND });
      }
      g.moveTo(e.x1, e.y1);
      g.lineTo(e.x2, e.y2);
    });
  }, [boundaryEdges]);

  // 4. 호버 및 선택 영역 하이라이트 레이어 (O(1) 속도 최적화, 해당 폴리곤만 덮어씀)
  const drawHighlights = useCallback((g: PIXI.Graphics) => {
    g.clear();
    if (!parsedCells) return;

    const drawTargetProv = (targetId: string, color: number, alpha: number, lineWidth: number) => {
      g.lineStyle(lineWidth, color, alpha);
      g.beginFill(Math.min(color + 0x333333, 0xffffff), alpha * 0.4); // 약간 밝게 칠함

      // 해당 ProvinceID를 가진 셀들을 모두 덧그린다.
      for (let i = 0; i < parsedCells.length; i++) {
        if (parsedCells[i].provinceId === targetId) {
          g.drawPolygon(parsedCells[i].polygon);
        }
      }
      g.endFill();
    };

    if (hoveredProvinceId && hoveredProvinceId !== selectedProvinceId) {
      drawTargetProv(hoveredProvinceId, 0xffffff, 0.4, 0); // 얇은 흰색 필터
    }

    if (selectedProvinceId) {
      drawTargetProv(selectedProvinceId, 0xfcd34d, 0.6, 4); // 굵은 노란색 외곽선
    }
  }, [parsedCells, hoveredProvinceId, selectedProvinceId]);

  // 5. 프레임 테두리 (Border)
  const drawBorders = useCallback((g: PIXI.Graphics) => {
    g.clear();
    g.lineStyle(6, 0x1e293b, 1);
    g.drawRect(0, 0, SVG_W, SVG_H);
  }, []);


  return (
    <div className="smap-container">
      <div className="smap-header-bar flex items-center justify-between pointer-events-none relative z-10 px-4">
        <h1 className="smap-title font-title text-2xl font-bold text-white drop-shadow-md">
          지방 행정 <span className="text-gray-300 ml-2 text-sm italic opacity-80">- WebGL Engine</span>
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
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#0a192f', // 배경 빈공간 색
          cursor: isDraggingMap ? 'grabbing' : 'grab',
          touchAction: 'none', // 크롬 터치 스크롤 방지
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
            backgroundColor: 0x6ebeeb, // 맵 외곽 넓은 심해를 은은한 심연의 파스텔톤으로 변경
            resolution: typeof window !== 'undefined' ? Math.max(window.devicePixelRatio || 1, 2) : 2, // 해상도 하한선을 2배율(레티나)로 강제 지정하여 글씨 깨짐 방지
            autoDensity: true,
            antialias: false,
          }}
          onWheel={handleWheel}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          {/* Main Transformation Container */}
          {/* 이벤트 감지를 자체적으로 하진 않고 div 영역에 위임하여 처리 */}
          <Container scale={scale} position={[position.x, position.y]}>

            {/* 1. Base Map (지형 및 바다 데이터 일괄 그래픽스) */}
            <PixiGraphics draw={drawMapBase} />

            {/* 2. Rivers */}
            <PixiGraphics draw={drawRivers} />

            {/* 3. Boundaries */}
            <PixiGraphics draw={drawBoundaries} />

            {/* 3. 상호작용 하이라이트 오버레이 (Hover, Select) */}
            <PixiGraphics draw={drawHighlights} />

            {/* 4. 대륙 해안선 (강조선이 하이라이트보다 위에 오도록(z-index) 가장 나중에 그리기) */}
            <PixiGraphics draw={drawCoastlines} />

            {/* 5. Terrain Icons (라벨용 텍스트 대체 / 추후 스프라이트 교체 가능) */}
            {terrainIcons.map((ti, idx) => (
              <PixiText
                key={`ti-${idx}`}
                text={ti.type === 'peak' ? '⛰️' : ti.type === 'mountain' ? '⛰️' : '🌲'}
                x={ti.x}
                y={ti.y}
                anchor={0.5}
                style={new PIXI.TextStyle({
                  fontSize: Math.max(ti.s * 0.8, 10), // 지형 아이콘(텍스트) 크게 나오는 것 방지
                  fill: ti.type === 'forest' ? 0x22c55e : 0xd1d5db,
                  dropShadow: true, dropShadowAlpha: 0.8, dropShadowDistance: 1.5
                })}
              />
            ))}

            {/* 6. Text Labels */}
            {centers.map(lg => (
              <Container key={`lb-${lg.id}`} position={[lg.x, lg.y]}>
                {lg.isCap && (
                  <PixiGraphics draw={(g) => {
                    g.clear();
                    // 자가 심볼 그리기
                    g.beginFill(0xec4899); // 핑크
                    g.lineStyle(1.5, 0xffffff);
                    // 간이 크라운 아이콘
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
                  style={lg.isCap ? CENTER_LABEL_STYLE : LABEL_TEXT_STYLE}
                />
              </Container>
            ))}

            <PixiGraphics draw={drawBorders} />
          </Container>
        </Stage>

        {/* Clicks을 탐지하는 투명 레이어 (Pixi 위에 배치) React 이벤트 버블링 용이 */}
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
              <div className="bg-red-900/80 text-red-200 text-xs px-2 py-1 rounded font-bold border border-red-700/50 shadow-sm">
                세력 수도
              </div>
            )}
            <button onClick={() => setSelectedProvinceId(null)} className="text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 px-2 rounded-sm border border-slate-600">
              ✕
            </button>
          </div>

          <div className="space-y-4 text-sm mt-2 font-mono">
            {/* 스탯 표시 */}
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
