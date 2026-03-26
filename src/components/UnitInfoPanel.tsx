// J:/AI/Game/SRPG/src/components/UnitInfoPanel.tsx
// 하단 컴팩트 유닛 정보 바
// - 기본: 얇은 하단 바 (아이콘 + 이름 + HP 바 + 주요 수치)
// - 클릭 시 상세 펼침 (공격/방어/이동/사거리)
// - pointer-events-none으로 타일 클릭 방해 없음 (토글 버튼만 pointer-events-auto)

import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { FACTIONS, PLAYER_FACTION } from '../constants/gameConfig';
import { UNIT_ICONS } from '../utils/unitTextures';
import { getEffectiveStat } from '../engine/statEngine';

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

function MpBar({ mp, maxMp }: { mp: number; maxMp: number }) {
  const pct = Math.max(0, Math.min(1, mp / maxMp)) * 100;
  return (
    <div className="flex-1 bg-gray-700 rounded-full h-1 relative min-w-[60px] overflow-hidden">
      <div className="absolute top-0 left-0 h-full bg-blue-400 transition-all duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

function RageBar({ rage, maxRage = 100 }: { rage: number; maxRage?: number }) {
  const pct = Math.max(0, Math.min(1, rage / maxRage)) * 100;
  return (
    <div className="flex-1 bg-gray-700 rounded-full h-1 relative min-w-[60px] overflow-hidden">
      <div className="absolute top-0 left-0 h-full bg-orange-500 transition-all duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function UnitInfoPanel() {
  const [expanded, setExpanded] = useState(false);

  const selectedUnitId = useGameStore(s => s.selectedUnitId);
  const hoveredUnitId  = useGameStore(s => s.hoveredUnitId);
  const activeUnitId   = useGameStore(s => s.activeUnitId);
  const units          = useGameStore(s => s.units);

  const displayId = selectedUnitId ?? hoveredUnitId;
  if (!displayId) return null;

  const unit = units[displayId];
  if (!unit || unit.state === 'DEAD') return null;

  const faction   = FACTIONS[unit.factionId];
  const isPlayer  = unit.factionId === PLAYER_FACTION;
  const icon      = UNIT_ICONS[unit.unitType] ?? '?';
  const name      = UNIT_TYPE_KR[unit.unitType] ?? unit.unitType;
  // 번호 형태의 색상을 CSS HEX로 변환
  const hexColor  = typeof faction.color === 'number' ? '#' + faction.color.toString(16).padStart(6, '0') : '#fff';
  const accentCls = isPlayer ? 'text-blue-300' : 'text-red-300';

  return (
    <div className="absolute bottom-16 left-4 z-40 pointer-events-none select-none">
      <div className={`bg-gray-900/95 border rounded-xl shadow-2xl backdrop-blur-sm overflow-hidden`}
           style={{ minWidth: 240, maxWidth: 300, borderColor: hexColor }}>

        {/* ─ 컴팩트 바 (항상 표시) ─ */}
        <div className="flex items-center gap-3 px-3 py-2">
          <span className="text-lg leading-none">{icon}</span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-white text-xs font-bold truncate">{name}</span>
              <span className={`text-[10px] ${accentCls} shrink-0`}>{faction.name}</span>
            </div>
            <div className="flex flex-col gap-1 mt-1">
              <div className="flex items-center gap-2">
                <HpBar hp={unit.hp} maxHp={unit.maxHp} />
                <span className="text-[10px] text-gray-300 shrink-0 w-12 text-right">{unit.hp}/{unit.maxHp}</span>
              </div>
              <div className="flex items-center gap-2">
                <MpBar mp={unit.mp} maxMp={unit.maxMp} />
                <span className="text-[10px] text-blue-300 shrink-0 w-12 text-right">{unit.mp}/{unit.maxMp}</span>
              </div>
              <div className="flex items-center gap-2">
                <RageBar rage={unit.rage} />
                <span className="text-[10px] text-orange-400 shrink-0 w-12 text-right">{Math.round(unit.rage)}/100</span>
              </div>
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
                { label: '공격', value: getEffectiveStat(unit, 'attack'),  icon: '⚔' },
                { label: '방어', value: getEffectiveStat(unit, 'defense'), icon: '🛡' },
                { label: '이동', value: getEffectiveStat(unit, 'speed'),   icon: '👟' },
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
              {activeUnitId === displayId && <span className="text-[10px] bg-yellow-700/60 text-yellow-300 rounded px-1.5 py-0.5">⚡ 행동 중</span>}
              {unit.isHero   && <span className="text-[10px] bg-yellow-900/50 text-yellow-400 rounded px-1.5 py-0.5">{unit.unitType === 'GENERAL' ? '👑 장수' : '👑 지휘관'}</span>}
              {selectedUnitId === displayId && <span className={`text-[10px] bg-blue-900/50 ${accentCls} rounded px-1.5 py-0.5`}>선택됨</span>}
              {/* 장수 능력치 표시 */}
              {unit.unitType === 'GENERAL' && (
                <div className="flex gap-1 flex-wrap mt-1">
                  <span className="text-[9px] bg-orange-900/40 text-orange-300 rounded px-1 py-0.5">武{unit.generalStrength}</span>
                  <span className="text-[9px] bg-purple-900/40 text-purple-300 rounded px-1 py-0.5">知{unit.generalIntelligence}</span>
                  <span className="text-[9px] bg-green-900/40 text-green-300 rounded px-1 py-0.5">政{unit.generalPolitics}</span>
                  <span className="text-[9px] bg-blue-900/40 text-blue-300 rounded px-1 py-0.5">統{unit.generalCharisma}타일</span>
                </div>
              )}
              {/* 활성화된 상태 이상 뱃지 (Buffs/Debuffs) */}
              {unit.buffs && unit.buffs.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-1">
                  {unit.buffs.map(b => (
                    <span key={b.id} className={`text-[9px] rounded px-1 py-0.5 text-white ${b.type.includes('down') || b.type === 'poison' || b.type === 'stun' ? 'bg-red-900/60 border border-red-700' : 'bg-cyan-900/60 border border-cyan-700'}`}>
                      {b.type}({b.duration}T)
                    </span>
                  ))}
                </div>
              )}
            </div>
            {/* 장수 내정 특성 표시 */}
            {(unit.raceEffects || unit.classEffects) && (
              <div className="mt-2 text-[10px] bg-gray-800/80 rounded p-2 text-gray-300">
                <div className="text-yellow-400 mb-1 font-bold">🏛️ 내정 효과</div>
                {unit.raceEffects?.productionBonus && <div>생산 보너스: {unit.raceEffects.productionBonus > 0 ? '+' : ''}{unit.raceEffects.productionBonus}%</div>}
                {unit.raceEffects?.securityBonus && <div>치안 보너스: {unit.raceEffects.securityBonus > 0 ? '+' : ''}{unit.raceEffects.securityBonus}</div>}
                {unit.raceEffects?.recruitmentBonus && <div>모병 보너스: {unit.raceEffects.recruitmentBonus > 0 ? '+' : ''}{unit.raceEffects.recruitmentBonus}%</div>}
                {unit.classEffects?.productionBonus && <div>생산 (직업): {unit.classEffects.productionBonus > 0 ? '+' : ''}{unit.classEffects.productionBonus}%</div>}
                {unit.classEffects?.securityBonus && <div>치안 (직업): {unit.classEffects.securityBonus > 0 ? '+' : ''}{unit.classEffects.securityBonus}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
