import { useEffect, useRef, useState } from 'react';
import { generateMapData, generateMapTexture, generateFogTexture } from '../utils/mapGenerator';
import type { GeographyConfig } from '../utils/mapGenerator';
import { MAP_CONFIG } from '../constants/gameConfig';
import type { Province } from '../types/appTypes';

interface TacticalMapPreviewProps {
  province: Province;
  config?: GeographyConfig;
  onClose: () => void;
}

export default function TacticalMapPreview({ province, config, onClose }: TacticalMapPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fogCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [mapInfo, setMapInfo] = useState<{
    width: number;
    height: number;
    label: string;
    mapObjectsCount: number;
  } | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);

  // Pan and Zoom states
  const [scale, setScale] = useState(0.8);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging.current) {
      setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    }
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const handleWheel = (e: React.WheelEvent) => {
    const zoomFactor = 1.1;
    const direction = e.deltaY < 0 ? 1 : -1;
    let newScale = scale * (direction > 0 ? zoomFactor : 1/zoomFactor);
    newScale = Math.max(0.2, Math.min(newScale, 5));
    
    // Zoom around center of the viewport
    setScale(newScale);
  };

  useEffect(() => {
    // 1. Generate map
    const w = MAP_CONFIG.WIDTH;
    const h = MAP_CONFIG.HEIGHT;
    
    const result = generateMapData(w, h, config);
    
    setMapInfo({
      width: w,
      height: h,
      label: result.mapInfo.label,
      mapObjectsCount: result.mapObjects.length,
    });

    // 2. Render Textures (스폰 존 포함)
    const tSize = MAP_CONFIG.TILE_SIZE;
    const texCanvas = generateMapTexture(w, h, tSize, result.map, result.spawnZones);
    const fogCanvas = generateFogTexture(w, h, tSize);

    // 3. Draw to our refs
    if (canvasRef.current) {
       const ctx = canvasRef.current.getContext('2d');
       if (ctx) {
           canvasRef.current.width = texCanvas.width;
           canvasRef.current.height = texCanvas.height;
           ctx.drawImage(texCanvas, 0, 0);
       }
    }

    if (fogCanvasRef.current) {
       const ctx = fogCanvasRef.current.getContext('2d');
       if (ctx) {
           fogCanvasRef.current.width = fogCanvas.width;
           fogCanvasRef.current.height = fogCanvas.height;
           ctx.drawImage(fogCanvas, 0, 0);
       }
    }

  }, [province, refreshKey, config]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose} onContextMenu={e => e.preventDefault()}>
      <div 
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ width: '80%', height: '85%' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center z-10">
          <div>
             <div className="flex items-center gap-3">
               <h2 className="text-xl font-bold text-slate-100">{province.name} 전장 시뮬레이터</h2>
               <button onClick={() => setRefreshKey(k => k+1)} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-sm text-white font-bold transition-colors">
                 🔄 전장 재생성
               </button>
             </div>
             <p className="text-sm text-slate-400 mt-1">
               {mapInfo ? `${mapInfo.label} (오브젝트: ${mapInfo.mapObjectsCount}개)` : '생성 중...'}
             </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-3xl font-bold leading-none">&times;</button>
        </div>

        {/* Viewport */}
        <div 
          className="flex-1 overflow-hidden bg-slate-950 relative cursor-move"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
        >
          <div 
            className="absolute left-1/2 top-1/2 shadow-2xl border-4 border-slate-800 bg-black cursor-move"
            style={{ 
              transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px)) scale(${scale}) rotateX(60deg) rotateZ(-45deg)`,
              transformStyle: 'preserve-3d',
              transformOrigin: 'center center',
              width: MAP_CONFIG.WIDTH * MAP_CONFIG.TILE_SIZE,
              height: MAP_CONFIG.HEIGHT * MAP_CONFIG.TILE_SIZE,
              imageRendering: 'pixelated',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
            }}
          >
             <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
             <canvas ref={fogCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none mix-blend-multiply opacity-50" />
          </div>
        </div>
        
        {/* Helper footer */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 text-center text-slate-500 text-sm">
           실제 전투 시 이 지형과 배열이 영구적으로 할당됩니다. (개발 테스트용)
        </div>
      </div>
    </div>
  );
}
