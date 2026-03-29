import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Container, Graphics as PixiGraphics, Text as PixiText, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useAppStore } from '../store/appStore';
import { generateProvinces, type ProvinceWithCells } from '../utils/provinceGenerator';
import { FACTIONS, MAP_CONFIG } from '../constants/gameConfig';
import type { Province } from '../types/appTypes';
import TacticalMapPreview from '../components/TacticalMapPreview';
import type { GeographyConfig } from '../utils/mapGenerator';

function parseSvgPathToPolygon(pathStr: string): number[] {
  const coordsStr = pathStr.replace(/[MZ]/g, '').replace(/L/g, ' ');
  const parts = coordsStr.trim().split(/\s+/);
  const polygon: number[] = [];
  for (const part of parts) {
    if (!part) continue;
    const [x, y] = part.split(',');
    polygon.push(parseFloat(x), parseFloat(y));
  }
  return polygon;
}

const SVG_W = 1440;
const SVG_H = 820;

export const ScenarioEditorScreen = () => {
  const goTo = useAppStore(s => s.goTo);
  
  const [seedInput, setSeedInput] = useState<string>(Date.now().toString());
  const [seed, setSeed] = useState<number>(Date.now());
  const [mapData, setMapData] = useState<ProvinceWithCells | null>(null);
  
  const [paintFaction, setPaintFaction] = useState<string>(Object.keys(FACTIONS)[0]);
  const [previewProvince, setPreviewProvince] = useState<Province | null>(null);

  const [editorMode, setEditorMode] = useState<'PAINT' | 'SELECT'>('PAINT');
  const [selectedProvId, setSelectedProvId] = useState<string | null>(null);
  
  // Undo Stack
  const [undoStack, setUndoStack] = useState<Record<string, string>[]>([]);
  const isPaintingRef = useRef(false);
  const paintSnapshotRef = useRef<Record<string, string> | null>(null);

  const [dimensions, setDimensions] = useState({ w: window.innerWidth, h: window.innerHeight });
  const MAP_PANEL_WIDTH = 350;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack]);

  useEffect(() => {
    const handleResize = () => setDimensions({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setMapData(generateProvinces(SVG_W, SVG_H, seed));
  }, [seed]);

  const handleCreate = () => {
    const numSeed = parseInt(seedInput);
    if (!isNaN(numSeed)) setSeed(numSeed);
  };

  const handleExport = () => {
    if (!mapData) return;
    const exportData = {
      seed,
      factions: Object.entries(mapData.provinces).reduce((acc, [id, p]) => {
        acc[id] = p.owner;
        return acc;
      }, {} as Record<string, string>)
    };
    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2))
      .then(() => alert('시나리오 설정이 클립보드에 복사되었습니다. (JSON)'))
      .catch(e => console.error(e));
  };

  const takeSnapshot = () => {
    if (!mapData) return;
    const snapshot = Object.entries(mapData.provinces).reduce((acc, [id, p]) => {
      acc[id] = p.owner;
      return acc;
    }, {} as Record<string, string>);
    paintSnapshotRef.current = snapshot;
  };

  const commitSnapshot = () => {
    if (!paintSnapshotRef.current || !mapData) return;
    // Check if anything changed
    let changed = false;
    for (const [id, owner] of Object.entries(paintSnapshotRef.current)) {
      if (mapData.provinces[id].owner !== owner) changed = true;
    }
    if (changed) {
      setUndoStack(prev => [...prev.slice(-19), paintSnapshotRef.current!]); // Max 20
    }
    paintSnapshotRef.current = null;
  };

  const handleUndo = () => {
    setUndoStack(prev => {
      if (prev.length === 0 || !mapData) return prev;
      const lastSnapshot = prev[prev.length - 1];
      const updatedMap = { ...mapData };
      for (const [id, owner] of Object.entries(lastSnapshot)) {
        if (updatedMap.provinces[id]) updatedMap.provinces[id].owner = owner as any;
      }
      setMapData(updatedMap);
      return prev.slice(0, prev.length - 1);
    });
  };

  const computeGeographyConfig = (prov: Province): GeographyConfig | undefined => {
        if (!mapData) return undefined;
        
        let profile: 'plains' | 'highlands' | 'mixed' | 'desert' | 'snow' = 'mixed';
        if (['peak', 'mountain', 'hill'].includes(prov.terrainType)) profile = 'highlands';
        else if (['plains', 'savanna'].includes(prov.terrainType)) profile = 'plains';
        else if (prov.terrainType === 'desert') profile = 'desert';
        else if (['tundra', 'ice'].includes(prov.terrainType)) profile = 'snow';
        
        const currentMap = mapData!;
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
    };

  const getDirString = (dx: number, dy: number) => {
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (angle >= -22.5 && angle < 22.5) return '동쪽';
    if (angle >= 22.5 && angle < 67.5) return '남동쪽';
    if (angle >= 67.5 && angle < 112.5) return '남쪽';
    if (angle >= 112.5 && angle < 157.5) return '남서쪽';
    if (angle >= 157.5 || angle < -157.5) return '서쪽';
    if (angle >= -157.5 && angle < -112.5) return '북서쪽';
    if (angle >= -112.5 && angle < -67.5) return '북쪽';
    if (angle >= -67.5 && angle < -22.5) return '북동쪽';
    return '?';
  };

  const selectedProv = selectedProvId && mapData ? mapData.provinces[selectedProvId] : null;
  const TERRAIN_LABEL_MAP: Record<string, string> = {
    ocean: '해양', coastal: '해안', plains: '평야', forest: '삼림', 
    mountain: '산악', peak: '화산봉/최고봉', desert: '사막', taiga: '타이가',
    savanna: '사바나', tundra: '툰드라', ice: '빙하', hill: '구릉'
  };

  let terrainStats: { name: string, pct: number }[] = [];
  let connectionStats: { name: string, dir: string, isNaval: boolean }[] = [];
  if (selectedProv && mapData) {
     const cells = mapData.allCells.filter(c => c.provinceId === selectedProv.id);
     const counts: Record<string, number> = {};
     cells.forEach(c => { counts[c.terrain] = (counts[c.terrain] || 0) + 1; });
     const total = cells.length;
     terrainStats = Object.entries(counts)
       .map(([k, v]) => ({ name: TERRAIN_LABEL_MAP[k] || k, pct: Math.round((v / total) * 100) }))
       .sort((a,b) => b.pct - a.pct); // 높은 비율순 정렬
     
     const allAdjs = [
       ...selectedProv.adjacentIds.map(id => ({ id, isNaval: false })), 
       ...(selectedProv.navalAdjacentIds || []).map(id => ({ id, isNaval: true }))
     ];
     connectionStats = allAdjs.map(adj => {
        const target = mapData.provinces[adj.id];
        if (!target) return null;
        const dx = target.seedX - selectedProv.seedX;
        const dy = target.seedY - selectedProv.seedY;
        return { name: target.name, dir: getDirString(dx, dy), isNaval: adj.isNaval };
     }).filter(Boolean) as any;
  }

  // --- PIXI 드래그/줌 기본 로직 ---
  const stageW = dimensions.w - MAP_PANEL_WIDTH;
  const stageH = dimensions.h;

  const initialFitScale = Math.max(stageW / SVG_W, stageH / SVG_H);
  const initialPosition = { x: (stageW - SVG_W * initialFitScale) / 2, y: (stageH - SVG_H * initialFitScale) / 2 };

  const targetScaleRef = useRef(initialFitScale);
  const targetPositionRef = useRef(initialPosition);
  const pixiContainerRef = useRef<PIXI.Container | null>(null);
  const currentScaleRef = useRef(initialFitScale);
  const currentPositionRef = useRef(initialPosition);
  
  const [scale, setScale] = useState(initialFitScale);

  const isDraggingMapRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);
  const pointerDownPos = useRef({ x: 0, y: 0 });

  const getClampedPosition = useCallback((newX: number, newY: number, sc: number) => {
    const mapW = SVG_W * sc;
    const mapH = SVG_H * sc;
    let cx = newX, cy = newY;
    if (mapW > stageW) cx = Math.max(stageW - mapW, Math.min(0, cx));
    else cx = (stageW - mapW) / 2;
    if (mapH > stageH) cy = Math.max(stageH - mapH, Math.min(0, cy));
    else cy = (stageH - mapH) / 2;
    return { x: cx, y: cy };
  }, [stageH, stageW]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!pixiContainerRef.current) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const zoomFactor = 1.2;
    const direction = e.deltaY < 0 ? 1 : -1;
    let newScale = currentScaleRef.current * (direction > 0 ? zoomFactor : 1 / zoomFactor);
    const minScale = Math.max(stageW / SVG_W, stageH / SVG_H);
    const maxScale = 5.0;
    newScale = Math.max(minScale, Math.min(newScale, maxScale));
    
    const worldX = (mx - currentPositionRef.current.x) / currentScaleRef.current;
    const worldY = (my - currentPositionRef.current.y) / currentScaleRef.current;
    const rawX = mx - worldX * newScale;
    const rawY = my - worldY * newScale;
    
    const clamped = getClampedPosition(rawX, rawY, newScale);
    targetScaleRef.current = newScale;
    targetPositionRef.current = clamped;
  }, [getClampedPosition, stageH, stageW]);

  const onPointerDown = useCallback((e: PIXI.FederatedPointerEvent) => {
    // If painting with left click
    if (editorMode === 'PAINT' && e.button !== 2) {
      isPaintingRef.current = true;
      takeSnapshot();
    } else {
      isDraggingMapRef.current = true;
      dragStartRef.current = { x: e.global.x - currentPositionRef.current.x, y: e.global.y - currentPositionRef.current.y };
      hasDragged.current = false;
      pointerDownPos.current = { x: e.global.x, y: e.global.y };
    }
  }, [editorMode, mapData]);

  const onPointerMove = useCallback((e: PIXI.FederatedPointerEvent) => {
    if (isDraggingMapRef.current) {
      const dx = e.global.x - pointerDownPos.current.x;
      const dy = e.global.y - pointerDownPos.current.y;
      if (dx * dx + dy * dy > 25) hasDragged.current = true;
      
      if (hasDragged.current) {
        const rawX = e.global.x - dragStartRef.current.x;
        const rawY = e.global.y - dragStartRef.current.y;
        const clamped = getClampedPosition(rawX, rawY, currentScaleRef.current);
        targetPositionRef.current = clamped;
      }
    }
  }, [getClampedPosition]);

  const onPointerUp = useCallback(() => {
    if (isPaintingRef.current) {
      isPaintingRef.current = false;
      commitSnapshot();
    }
    isDraggingMapRef.current = false;
  }, [mapData]);



  // Province Click handling
  const handleProvinceClick = useCallback((id: string) => {
    if (hasDragged.current || !mapData) return;
    if (editorMode === 'SELECT') {
      setSelectedProvId(id);
    } else {
      // Paint mode single click case
      const updatedMap = { ...mapData };
      if (updatedMap.provinces && updatedMap.provinces[id]) {
          updatedMap.provinces[id].owner = paintFaction;
          setMapData(updatedMap);
      }
    }
  }, [mapData, paintFaction, editorMode]);

  const handleProvinceHoverPaint = useCallback((id: string) => {
    if (editorMode === 'PAINT' && isPaintingRef.current && mapData) {
      if (mapData.provinces[id].owner !== paintFaction) {
        const updatedMap = { ...mapData };
        updatedMap.provinces[id].owner = paintFaction;
        setMapData(updatedMap);
      }
    }
  }, [mapData, paintFaction, editorMode]);

  const handleProvinceRightClick = useCallback((e: PIXI.FederatedPointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!mapData) return;
    setPreviewProvince(mapData.provinces[id] || null);
  }, [mapData]);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'sans-serif' }}>
      {/* 1. Left Map Preview */}
      <div 
        style={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}
        onWheel={onWheel}
        onPointerLeave={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Stage width={stageW} height={stageH} options={{ backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: window.devicePixelRatio || 1 }}>
          {/* Lerp Updater */}
          <TweenUpdater 
            targetScale={targetScaleRef} 
            targetPos={targetPositionRef}
            currentScale={currentScaleRef}
            currentPos={currentPositionRef}
            onUpdate={(s, p) => {
              if (pixiContainerRef.current) {
                pixiContainerRef.current.scale.set(s);
                pixiContainerRef.current.position.set(p.x, p.y);
              }
              setScale(s); // Update scale state to trigger text rescaling
            }}
          />

          <Container
            ref={pixiContainerRef}
            interactive={true}
            onpointerdown={onPointerDown}
            onpointermove={onPointerMove}
            onpointerup={onPointerUp}
            onpointerupoutside={onPointerUp}
          >
            {mapData && (
              <>
                {/* 1) Provinces */}
                <PixiGraphics
                  draw={(g) => {
                    g.clear();
                    
                    const TERRAIN_COLORS: Record<string, number> = {
                      ocean: 0x1e3a8a,      // #1e3a8a
                      coast: 0x3b82f6,      // #3b82f6
                      plain: 0x65a30d,      // #65a30d
                      forest: 0x14532d,     // #14532d
                      mountain: 0x78716c,   // #78716c
                      high_mountain: 0xf5f5f4 // #f5f5f4
                    };

                    // 1) Base Terrain (iterate all parsed cells)
                    g.lineStyle(0);
                    for (const cell of mapData.allCells) {
                        g.beginFill(TERRAIN_COLORS[cell.terrain] || 0x000000, 1.0);
                        if ((cell as any).path) g.drawPolygon(parseSvgPathToPolygon((cell as any).path));
                        g.endFill();
                    }

                    // 2) Faction Overlay (iterate all cells grouped by owned province)
                    for (const [id, prov] of Object.entries(mapData.provinces)) {
                        if (!prov.owner || prov.owner === 'neutral') continue;
                        const ownerColor = FACTIONS[prov.owner]?.color || '#ffffff';
                        const colNum = typeof ownerColor === 'string' ? parseInt(ownerColor.replace('#', ''), 16) : ownerColor;
                        
                        g.beginFill(colNum, 0.4);
                        for (const cell of mapData.allCells) {
                            if (cell.provinceId === id) {
                                if ((cell as any).path) g.drawPolygon(parseSvgPathToPolygon((cell as any).path));
                            }
                        }
                        g.endFill();
                    }

                    // 3) Boundaries
                    for (const edge of mapData.boundaryEdges) {
                        const width = edge.isFactionBoundary ? 4 : 2;
                        // Use alpha: 1.0 and solid dark colors instead of opacity, to prevent joint overlapping artifacts
                        const color = edge.isFactionBoundary ? 0x000000 : 0x1e293b;
                        g.lineStyle({
                          width, 
                          color, 
                          alpha: 1.0, 
                          join: PIXI.LINE_JOIN.ROUND, 
                          cap: PIXI.LINE_CAP.ROUND
                        });
                        g.moveTo(edge.pts[0], edge.pts[1]);
                        for (let j = 2; j < edge.pts.length; j += 2) {
                            g.lineTo(edge.pts[j], edge.pts[j + 1]);
                        }
                    }
                    
                    // 4) Coastlines
                    g.lineStyle({
                      width: 3.5, 
                      color: 0x3d3027, 
                      alpha: 1.0, 
                      join: PIXI.LINE_JOIN.ROUND, 
                      cap: PIXI.LINE_CAP.ROUND
                    });
                    for (const edge of mapData.coastlineEdges) {
                        g.moveTo(edge.pts[0], edge.pts[1]);
                        for (let j=2; j<edge.pts.length; j+=2) g.lineTo(edge.pts[j], edge.pts[j+1]);
                    }
                  }}
                />

                {/* 2) Province Interactions & Texts */}
                {Object.values(mapData.provinces).map(prov => {
                   // Calculate the center pixel from the normalized 0..1 seed
                   const centerX = prov.seedX * 1440;
                   const centerY = prov.seedY * 820;
                   return (
                     <React.Fragment key={prov.id}>
                        <PixiGraphics 
                           interactive={true}
                           cursor="pointer"
                           onpointerdown={(e) => { e.stopPropagation(); onPointerDown(e); handleProvinceHoverPaint(prov.id); }}
                           onpointerup={(e) => { 
                             e.stopPropagation(); 
                             onPointerUp(); 
                             if (e.button === 2 || e.nativeEvent?.button === 2) handleProvinceRightClick(e, prov.id);
                             else if (e.button === 0) handleProvinceClick(prov.id); 
                           }}
                           onpointerover={() => handleProvinceHoverPaint(prov.id)}
                           onpointermove={(e) => { e.stopPropagation(); onPointerMove(e); handleProvinceHoverPaint(prov.id); }}
                           rightclick={(e) => { e.stopPropagation(); handleProvinceRightClick(e, prov.id); }}
                           draw={g => {
                               g.clear();
                               g.beginFill(0xFFFFFF, 0.001); // Hitbox
                               // Iterate through all cells to build a precise clickable region
                               for (const cell of mapData.allCells) {
                                   if (cell.provinceId === prov.id && (cell as any).path) {
                                       g.drawPolygon(parseSvgPathToPolygon((cell as any).path));
                                   }
                               }
                               g.endFill();
                               if (selectedProvId === prov.id) {
                                   const edgeMap = new Map<string, boolean>();
                                   const edgeData = new Map<string, number[]>();
                                   const ptKey = (x: number, y: number) => `${Math.round(x * 10)},${Math.round(y * 10)}`;

                                   for (const cell of mapData.allCells) {
                                     if (cell.provinceId === prov.id && (cell as any).path) {
                                        const poly = parseSvgPathToPolygon((cell as any).path);
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
                                                edgeMap.set(forwardKey, true);
                                                edgeData.set(forwardKey, [x1, y1, x2, y2]);
                                            }
                                        }
                                     }
                                   }

                                   // 외곽선만 그리기
                                   g.lineStyle({ width: 4.5, color: 0xfce7f3, alpha: 0.9, join: PIXI.LINE_JOIN.ROUND, cap: PIXI.LINE_CAP.ROUND });
                                   for (const [_, pts] of edgeData) {
                                       g.moveTo(pts[0], pts[1]);
                                       g.lineTo(pts[2], pts[3]);
                                   }
                                   
                                   // 내부 오버레이 채우기도 살짝 더해줍니다
                                   g.lineStyle(0);
                                   g.beginFill(0xfce7f3, 0.25);
                                   for (const cell of mapData.allCells) {
                                       if (cell.provinceId === prov.id && (cell as any).path) g.drawPolygon(parseSvgPathToPolygon((cell as any).path));
                                   }
                                   g.endFill();
                               }
                           }}
                        />
                        {/* 텍스트 라벨 렌더링 */}
                        <PixiText
                           text={prov.name}
                           x={centerX}
                           y={centerY}
                           anchor={0.5}
                           scale={1 / scale}
                           interactive={false}
                           // @ts-ignore - eventMode might not be fully typed in some older Pixi/React versions
                           eventMode="none"
                           style={new PIXI.TextStyle({
                             fontFamily: 'NanumBarunGothic, sans-serif',
                             fontSize: 14,
                             fontWeight: 'bold',
                             fill: 0xffffff,
                             stroke: 0x000000,
                             strokeThickness: 3,
                             letterSpacing: 1
                           })}
                        />
                     </React.Fragment>
                   );
                })}
              </>
            )}
          </Container>
        </Stage>
      </div>

      {/* 2. Right Toolkit Panel */}
      <div style={{ width: MAP_PANEL_WIDTH, background: '#1e293b', borderLeft: '1px solid #334155', display: 'flex', flexDirection: 'column', height: '100%' }}>
        
        {/* Top Header / Mode Toggles */}
        <div style={{ padding: '20px', borderBottom: '1px solid #334155', background: '#0f172a' }}>
          <h2 style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>에디터 모드</span>
            <button 
              onClick={handleUndo} 
              disabled={undoStack.length === 0}
              style={{ padding: '6px 12px', background: undoStack.length > 0 ? '#3b82f6' : '#334155', color: 'white', border: 'none', borderRadius: '4px', cursor: undoStack.length > 0 ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 'bold' }}>
              ↩ 실행 취소 (Ctrl+Z)
            </button>
          </h2>
          <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid #475569' }}>
            <button
              onClick={() => setEditorMode('PAINT')}
              style={{ flex: 1, padding: '10px', background: editorMode === 'PAINT' ? '#10b981' : '#1e293b', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
            >
              🖌️ 붓 (페인트)
            </button>
            <button
              onClick={() => setEditorMode('SELECT')}
              style={{ flex: 1, padding: '10px', background: editorMode === 'SELECT' ? '#3b82f6' : '#1e293b', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
            >
              🔍 인스펙터 (선택)
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: '20px', flexGrow: 1, overflowY: 'auto' }}>
          
          {editorMode === 'PAINT' && (
            <>
              <div style={{ marginBottom: '30px' }}>
                <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: '#94a3b8' }}>페인트 세력 선택</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {Object.entries(FACTIONS).map(([fId, faction]) => (
                    <div 
                      key={fId}
                      onClick={() => setPaintFaction(fId)}
                      style={{ 
                        padding: '10px', border: `2px solid ${paintFaction === fId ? '#3b82f6' : '#334155'}`,  
                        borderRadius: '6px', background: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                      }}>
                        <span style={{ width: '16px', height: '16px', borderRadius: '3px', background: faction.color, display: 'inline-block' }} />
                        <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{faction.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: '#94a3b8' }}>월드 시드 (Seed)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      value={seedInput}
                      onChange={e => setSeedInput(e.target.value)}
                      style={{ flex: 1, padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '4px' }}
                    />
                    <button 
                      onClick={handleCreate}
                      style={{ padding: '8px 16px', background: '#475569', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      맵 생성
                    </button>
                </div>
              </div>
            </>
          )}

          {editorMode === 'SELECT' && selectedProv && (
            <div style={{ background: '#0f172a', borderRadius: '8px', padding: '16px', border: '1px solid #334155' }}>
              <h3 style={{ margin: '0 0 5px 0', fontSize: '20px', display: 'flex', justifyContent: 'space-between' }}>
                {selectedProv.name}
              </h3>
              <div style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '20px' }}>
                소유 세력: {FACTIONS[selectedProv.owner]?.name || '중립'}
              </div>

              {/* 지형 정보 */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px', fontWeight: 'bold' }}>생태학적 정보 (지형 구성)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {terrainStats.map(ts => (
                    <div key={ts.name} style={{ background: '#1e293b', padding: '4px 8px', borderRadius: '4px', fontSize: '13px' }}>
                      <span style={{ color: '#cbd5e1' }}>{ts.name}</span> <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{ts.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 길 정보 */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px', fontWeight: 'bold' }}>인접 영토 (길 {connectionStats.length}갈래)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {connectionStats.map((conn, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', background: '#1e293b', padding: '6px 10px', borderRadius: '4px', fontSize: '13px' }}>
                      <span style={{ color: '#cbd5e1', width: '50px' }}>{conn.dir}</span>
                      <span style={{ flex: 1, color: conn.isNaval ? '#60a5fa' : '#f8fafc', fontWeight: 'bold' }}>{conn.name}</span>
                      {conn.isNaval && <span style={{ fontSize: '11px', background: '#1e3a8a', padding: '2px 6px', borderRadius: '8px', color: '#bfdbfe' }}>해로</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* 액션 버튼들 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '30px' }}>
                <button 
                  onClick={() => {
                    const updatedMap = { ...mapData! };
                    updatedMap.provinces[selectedProv.id].owner = paintFaction;
                    setMapData(updatedMap);
                  }}
                  style={{ padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <span style={{ width: '12px', height: '12px', background: FACTIONS[paintFaction]?.color, borderRadius: '2px' }}/>
                  [{FACTIONS[paintFaction]?.name}] 세력에 추가
                </button>
                <button 
                  onClick={() => setPreviewProvince(selectedProv)}
                  style={{ padding: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  🔍 전장 맵 표시
                </button>
              </div>
            </div>
          )}

          {editorMode === 'SELECT' && !selectedProv && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <div style={{ fontSize: '30px', marginBottom: '10px' }}>👆</div>
              <div>맵에서 영지를 좌클릭하여<br/>지리 정보를 확인하세요.</div>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div style={{ padding: '20px', borderTop: '1px solid #334155', background: '#0f172a' }}>
          <div style={{ display: 'flex', flexFlow: 'column', gap: 10 }}>
            <button 
              onClick={handleExport}
              style={{ padding: '12px', background: 'transparent', color: '#10b981', border: '1px solid #10b981', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              💾 시나리오 JSON 복사
            </button>
             <button 
               onClick={() => {
                 if (window.confirm('저장하지 않은 데이터는 지워집니다. 돌아가시겠습니까?')) {
                   goTo('TITLE');
                 }
               }}
               style={{ padding: '12px', background: '#475569', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
             >
               ⬅ 타이틀로 돌아가기
             </button>
             <div style={{ padding: '10px', fontSize: '13px', color: '#94a3b8', lineHeight: '1.4' }}>
                <ul style={{ paddingLeft: '20px', margin: 0 }}>
                  <li>마우스 휠: 줌 인/아웃</li>
                  <li>좌클릭 드래그: 맵 이동</li>
                  <li>좌클릭: 선택된 세력 페인트</li>
                  <li>우클릭: 해당 영지의 상세 전장(Tactical Map) 미리보기</li>
                </ul>
             </div>
          </div>
        </div>
      </div>
      
      {previewProvince && (
        <TacticalMapPreview 
          province={previewProvince} 
          config={computeGeographyConfig(previewProvince)}
          onClose={() => setPreviewProvince(null)} 
        />
      )}
    </div>
  );
};

// Lerp Updater component
function TweenUpdater({
  targetScale, targetPos, currentScale, currentPos, onUpdate
}: {
  targetScale: React.MutableRefObject<number>,
  targetPos: React.MutableRefObject<{x: number, y: number}>,
  currentScale: React.MutableRefObject<number>,
  currentPos: React.MutableRefObject<{x: number, y: number}>,
  onUpdate: (s: number, p: {x: number, y: number}) => void
}) {
  useTick((delta) => {
    let s = currentScale.current;
    let px = currentPos.current.x;
    let py = currentPos.current.y;
    
    // Lerp factor
    const lerp = 0.2 * delta;
    
    if (Math.abs(targetScale.current - s) > 0.001) s += (targetScale.current - s) * lerp;
    else s = targetScale.current;
    
    if (Math.abs(targetPos.current.x - px) > 0.1) px += (targetPos.current.x - px) * lerp;
    else px = targetPos.current.x;
    
    if (Math.abs(targetPos.current.y - py) > 0.1) py += (targetPos.current.y - py) * lerp;
    else py = targetPos.current.y;
    
    if (s !== currentScale.current || px !== currentPos.current.x || py !== currentPos.current.y) {
      currentScale.current = s;
      currentPos.current = {x: px, y: py};
      onUpdate(s, {x: px, y: py});
    }
  });
  return null;
}
