import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../store/gameStore';
import { PLAYER_FACTION } from '../constants/gameConfig';
import type { Unit } from '../types/gameTypes';

export default function UnitListModal() {
  const { unitListModalOpen, setUnitListModalOpen, units, selectUnit } = useGameStore(useShallow(s => ({
    unitListModalOpen: s.unitListModalOpen,
    setUnitListModalOpen: s.setUnitListModalOpen,
    units: s.units,
    selectUnit: s.selectUnit
  })));

  if (!unitListModalOpen) return null;

  const playerUnits = Object.values(units).filter(u => u.factionId === PLAYER_FACTION);
  const enemyUnits = Object.values(units).filter(u => u.factionId !== PLAYER_FACTION);

  // 시야 또는 거리 기반 정렬 생략 (기본 스피드 혹은 ID 순, 여기선 편의상 ID 순)
  
  const getUnitName = (u: Unit) => {
    if (u.name) return u.name;
    const names: Record<string, string> = { INFANTRY: '보병', SPEARMAN: '창병', CAVALRY: '기병', ARCHER: '궁병', GENERAL: '장군' };
    return (u.isHero ? '지휘관' : names[u.unitType] || '유닛') + `_${u.id.slice(-4)}`;
  };

  const renderUnitRow = (u: Unit) => {
    const unitName = getUnitName(u);
    return (
    <div 
      key={u.id}
      className={`flex items-center justify-between p-2 rounded mb-2 border ${u.state === 'DEAD' ? 'bg-neutral-800 border-neutral-700 opacity-50' : 'bg-neutral-900 border-neutral-700 hover:border-neutral-500 cursor-pointer'} transition-colors`}
      onClick={() => {
        if (u.state !== 'DEAD') {
          selectUnit(u.id);
          setUnitListModalOpen(false);
        }
      }}
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${u.factionId === PLAYER_FACTION ? 'bg-blue-900 text-blue-200' : 'bg-red-900 text-red-200'}`}>
          {unitName.charAt(0)}
        </div>
        <div className="flex flex-col">
          <span className="text-gray-100 font-bold text-sm tracking-wide">
            {unitName} {u.state === 'DEAD' && <span className="text-red-500 text-xs ml-1">(사망)</span>}
          </span>
          <span className="text-gray-400 text-xs font-mono">
            {u.unitType} | CT 스피드 {u.speed}
          </span>
        </div>
      </div>
      
      <div className="flex flex-col items-end gap-1 font-mono text-xs">
        <div className="flex items-center gap-2">
          <span className="text-red-400 w-10 text-right">HP</span>
          <div className="w-20 bg-neutral-950 h-3 rounded overflow-hidden shadow-inner border border-neutral-800">
            <div className="bg-red-500 h-full origin-left transition-all" style={{ width: `${Math.max(0, (u.hp / u.maxHp) * 100)}%` }} />
          </div>
          <span className="text-gray-300 w-12 text-right">{u.hp}/{u.maxHp}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-blue-400 w-10 text-right">MP</span>
          <div className="w-20 bg-neutral-950 h-3 rounded overflow-hidden shadow-inner border border-neutral-800">
            <div className="bg-blue-500 h-full origin-left transition-all" style={{ width: `${Math.max(0, (u.mp / Math.max(1, u.maxMp)) * 100)}%` }} />
          </div>
          <span className="text-gray-300 w-12 text-right">{Math.floor(u.mp)}/{u.maxMp}</span>
        </div>
      </div>
    </div>
    );
  };

  return (
    <div className="absolute inset-0 z-[130] bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto"
         onClick={() => setUnitListModalOpen(false)}
         onWheel={e => e.stopPropagation()}
         onContextMenu={e => e.preventDefault()}>
      <div 
        className="bg-neutral-900 border-2 border-neutral-700 rounded-lg shadow-2xl w-[90%] max-w-[500px] h-[80vh] flex flex-col pointer-events-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-4 py-3 border-b border-neutral-700 bg-neutral-950 rounded-t-lg">
          <h2 className="text-lg font-bold text-neutral-200 tracking-wide">🗺️ 전장 내 유닛 목록</h2>
          <button 
            className="text-neutral-500 hover:text-white transition-colors"
            onClick={() => setUnitListModalOpen(false)}
          >
            ✕
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <h3 className="text-blue-400 font-bold mb-3 border-b border-neutral-700 pb-1 flex justify-between">
            <span>아군 부대</span>
            <span className="text-xs font-normal opacity-80 mt-1">{playerUnits.filter(u => u.state !== 'DEAD').length} 명 생존</span>
          </h3>
          <div className="mb-6">
            {playerUnits.map(renderUnitRow)}
            {playerUnits.length === 0 && <div className="text-neutral-500 text-sm italic">배치된 아군이 없습니다.</div>}
          </div>

          <h3 className="text-red-400 font-bold mb-3 border-b border-neutral-700 pb-1 flex justify-between">
            <span>적군 부대</span>
            <span className="text-xs font-normal opacity-80 mt-1">{enemyUnits.filter(u => u.state !== 'DEAD').length} 명 생존</span>
          </h3>
          <div>
            {enemyUnits.map(renderUnitRow)}
            {enemyUnits.length === 0 && <div className="text-neutral-500 text-sm italic">배치된 적군이 없습니다.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
