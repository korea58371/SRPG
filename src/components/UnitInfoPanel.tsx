// J:/AI/Game/SRPG/src/components/UnitInfoPanel.tsx
// 하단 컴팩트 유닛 정보 바
// - 기본: 얇은 하단 바 (아이콘 + 이름 + HP 바 + 주요 수치)
// - 클릭 시 상세 펼침 (공격/방어/이동/사거리)
// - pointer-events-none으로 타일 클릭 방해 없음 (토글 버튼만 pointer-events-auto)

import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { FACTIONS } from '../constants/gameConfig';
import { UNIT_ICONS } from '../utils/unitTextures';

const UNIT_TYPE_KR: Record<string, string> = {
  INFANTRY: '보병',
  SPEARMAN: '창병',
  CAVALRY:  '기병',
  ARCHER:   '궁병',
};

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = Math.max(0, Math.min(1, hp / maxHp)) * 100;
  const color = pct > 60 ? '#22c55e' : pct > 30 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex-1 bg-gray-700 rounded-full h-1.5 min-w-[60px]">
      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

export default function UnitInfoPanel() {
  const [expanded, setExpanded] = useState(false);

  const selectedUnitId = useGameStore(s => s.selectedUnitId);
  const hoveredUnitId  = useGameStore(s => s.hoveredUnitId);
  const units          = useGameStore(s => s.units);

  const displayId = selectedUnitId ?? hoveredUnitId;
  if (!displayId) return null;

  const unit = units[displayId];
  if (!unit || unit.state === 'DEAD') return null;

  const faction   = FACTIONS[unit.factionId];
  const isPlayer  = unit.factionId === 'western_empire';
  const icon      = UNIT_ICONS[unit.unitType] ?? '?';
  const name      = UNIT_TYPE_KR[unit.unitType] ?? unit.unitType;
  const borderCls = isPlayer ? 'border-blue-500' : 'border-red-500';
  const accentCls = isPlayer ? 'text-blue-300' : 'text-red-300';

  return (
    <div className="absolute bottom-16 left-4 z-40 pointer-events-none select-none">
      <div className={`bg-gray-900/95 border ${borderCls} rounded-xl shadow-2xl backdrop-blur-sm overflow-hidden`}
           style={{ minWidth: 240, maxWidth: 300 }}>

        {/* ─ 컴팩트 바 (항상 표시) ─ */}
        <div className="flex items-center gap-3 px-3 py-2">
          <span className="text-lg leading-none">{icon}</span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-white text-xs font-bold truncate">{name}</span>
              <span className={`text-[10px] ${accentCls} shrink-0`}>{faction.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <HpBar hp={unit.hp} maxHp={unit.maxHp} />
              <span className="text-[10px] text-gray-300 shrink-0">{unit.hp}/{unit.maxHp}</span>
            </div>
          </div>

          {/* 펼치기 토글 버튼 (유일하게 pointer-events-auto) */}
          <button
            className="pointer-events-auto text-gray-400 hover:text-white transition-colors text-xs px-1 cursor-pointer"
            onClick={() => setExpanded(v => !v)}
            title="상세 정보"
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>

        {/* ─ 상세 펼침 ─ */}
        {expanded && (
          <div className="border-t border-gray-700 px-3 py-2">
            <div className="grid grid-cols-4 gap-1 text-center">
              {[
                { label: '공격', value: Math.round(unit.attack),  icon: '⚔' },
                { label: '방어', value: Math.round(unit.defense), icon: '🛡' },
                { label: '이동', value: unit.speed,               icon: '👟' },
                { label: '사거리', value: unit.attackRange,       icon: '🎯' },
              ].map(({ label, value, icon: ico }) => (
                <div key={label} className="bg-gray-800/60 rounded py-1">
                  <div className="text-[10px]">{ico}</div>
                  <div className="text-white text-sm font-bold">{value}</div>
                  <div className="text-gray-400 text-[9px]">{label}</div>
                </div>
              ))}
            </div>

            {/* 상태 배지 */}
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {unit.hasActed && <span className="text-[10px] bg-gray-700 text-gray-400 rounded px-1.5 py-0.5">행동완료</span>}
              {unit.isHero   && <span className="text-[10px] bg-yellow-900/50 text-yellow-400 rounded px-1.5 py-0.5">👑 지휘관</span>}
              {selectedUnitId === displayId && <span className={`text-[10px] bg-blue-900/50 ${accentCls} rounded px-1.5 py-0.5`}>선택됨</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
