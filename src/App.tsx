import { Stage } from '@pixi/react';
import TerrainMap from './components/TerrainMap';
import UnitsLayer from './components/UnitsLayer';
import CloudShadow from './components/CloudShadow';
import './index.css';

function App() {
  return (
    <div className="w-full h-screen bg-black overflow-hidden relative font-sans">
      {/* WebGL Rendering Context */}
      <Stage 
        width={window.innerWidth} 
        height={window.innerHeight} 
        options={{ autoDensity: true, resolution: window.devicePixelRatio, backgroundColor: 0x111111 }}
      >
        <TerrainMap />
        <UnitsLayer />
        <CloudShadow />
      </Stage>
      
      {/* DOM 기반 UI 허드(HUD) 레이어 - 조작 방해 금지 */}
      <div className="absolute top-0 left-0 p-6 pointer-events-none">
        <h1 className="text-white text-4xl font-extrabold drop-shadow-lg mb-2">SRPG Prototype</h1>
        <p className="text-gray-300 text-md font-semibold drop-shadow-md bg-black/40 px-3 py-1 rounded inline-block">
          150+ GPU Accelerated Units • Y-Sort Rendering • Procedural Noise Gen
        </p>
      </div>
      <div className="absolute bottom-6 left-6 pointer-events-none text-white text-sm bg-black/60 px-4 py-2 rounded-lg border border-gray-700">
        <p><strong>PIXI.Sprite</strong> 기반 대규모 동시 연산</p>
        <p>A* 길찾기 알고리즘, 구름 섀도우 루프 이동</p>
      </div>
    </div>
  );
}

export default App;
