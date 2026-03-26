import React from 'react';
import { useGameStore, manhattan } from '../store/gameStore';
import { TerrainType } from '../types/gameTypes';
import { TERRAIN_BONUS, MAP_CONFIG, UNIT_RESISTANCES } from '../constants/gameConfig';
import { MOCK_SKILLS, isSkillTargetValid } from '../utils/skillTargeting';
import { calcBaseDamage } from '../engine/combatEngine';
import { getEffectiveStat } from '../engine/statEngine';

const terrainNameMap: Record<TerrainType, string> = {
  [TerrainType.GRASS]: '평지',
  [TerrainType.CLIFF]: '절벽',
  [TerrainType.PATH]: '길',
  [TerrainType.BEACH]: '모래사장',
  [TerrainType.SEA]: '바다',
  [TerrainType.FOREST]: '숲',
};

function DamagePreviewHpBar({ hp, maxHp, expectedDamage }: { hp: number; maxHp: number; expectedDamage?: number }) {
  const currentPct = Math.max(0, Math.min(1, hp / maxHp)) * 100;
  const dmg = expectedDamage ?? 0;
  const afterHp = Math.max(0, hp - dmg);
  const afterPct = Math.max(0, Math.min(1, afterHp / maxHp)) * 100;
  const dmgPct = currentPct - afterPct;

  const isLethal = dmg > 0 && afterHp <= 0;

  // 남은 HP에 따른 색상
  const color = afterPct > 60 ? '#22c55e' : afterPct > 30 ? '#f59e0b' : '#ef4444';

  return (
    <div className="w-full flex items-center gap-2 mt-1.5 mb-1 relative">
      <div className="flex-1 bg-gray-700 rounded-full h-1.5 relative min-w-[60px] overflow-hidden">
        {/* 남은 예상 HP */}
        <div className="absolute top-0 left-0 h-full transition-all duration-300" style={{ width: `${afterPct}%`, backgroundColor: color }} />
        {/* 깜빡이는 데미지 영역 (점등 효과) */}
        {dmgPct > 0 && (
          <div 
            className="absolute top-0 h-full bg-red-400 opacity-80 animate-pulse" 
            style={{ left: `${afterPct}%`, width: `${dmgPct}%` }} 
          />
        )}
      </div>
      <div className="text-[10px] text-gray-300 w-12 text-right relative">
        {afterHp} / {maxHp}
        {isLethal && <span className="absolute -top-3.5 -right-1 text-red-500 text-base animate-bounce drop-shadow-[0_0_2px_rgba(0,0,0,1)]">💀</span>}
      </div>
    </div>
  );
}

export default function HoverInfoPanel() {
  const hoveredMapTile = useGameStore(s => s.hoveredMapTile);
  const mapData = useGameStore(s => s.mapData);
  const units = useGameStore(s => s.units);
  const attackTargetMode = useGameStore(s => s.attackTargetMode);
  const skillTargetMode = useGameStore(s => s.skillTargetMode);
  const selectedUnitId = useGameStore(s => s.selectedUnitId);
  const selectedSkillId = useGameStore(s => s.selectedSkillId);
  const confirmedDestination = useGameStore(s => s.confirmedDestination);

  if (!hoveredMapTile || !mapData) return null;

  const { lx, ly } = hoveredMapTile;
  if (ly < 0 || ly >= MAP_CONFIG.HEIGHT || lx < 0 || lx >= MAP_CONFIG.WIDTH) return null;

  const terrainType = mapData[ly]?.[lx];
  if (terrainType === undefined) return null;

  const terrainInfo = TERRAIN_BONUS[terrainType];
  const tName = terrainNameMap[terrainType] || '미지';

  // 해당 타일에 있는 유닛 탐색 (DEAD 제외)
  const hoveredUnit = Object.values(units).find(u => u.logicalX === lx && u.logicalY === ly && u.state !== 'DEAD');

  let damagePreview: React.ReactNode = null;
  let expectedAmount: number | undefined;

  if (hoveredUnit && selectedUnitId) {
    const attacker = units[selectedUnitId];
    if (attacker) {
      if (attackTargetMode) {
        // 일반 공격 예측
        const dest = confirmedDestination;
        if (dest) {
          const isEnemy = hoveredUnit.factionId !== attacker.factionId;
          const dist = manhattan(dest.lx, dest.ly, lx, ly);
          // +1은 기본 attackRange 보정 (대각선 타격 등 허용거리)
          if (isEnemy && dist <= attacker.attackRange + 1) { 
            const { base: baseDmgRaw, isWeak, isResist } = calcBaseDamage(attacker, hoveredUnit, units);
            const baseDmg = Math.round(baseDmgRaw);
            expectedAmount = baseDmg;
            const minDmg = Math.max(1, Math.round(baseDmg * 0.9));
            const maxDmg = Math.max(1, Math.round(baseDmg * 1.1));
            damagePreview = (
              <div className="mt-1 text-red-300 text-sm border-t border-gray-600 pt-1">
                <p className="font-bold mb-0.5">⚔️ 예상 데미지</p>
                <div className="flex justify-between items-center text-xs">
                  <span>
                    {minDmg} ~ {maxDmg}
                    {isWeak && <span className="ml-1 text-red-400 font-bold text-[10px]">(약점)</span>}
                    {isResist && <span className="ml-1 text-gray-400 font-bold text-[10px]">(저항)</span>}
                  </span>
                </div>
              </div>
            );
          }
        }
      } else if (skillTargetMode && selectedSkillId) {
        // 스킬 공격 예측
        const skill = MOCK_SKILLS[selectedSkillId];
        const dest = confirmedDestination || { lx: attacker.logicalX, ly: attacker.logicalY };
        
        // 시전 가능 사거리 내인지 체크
        const validation = isSkillTargetValid(skill, dest, { lx, ly }, attacker.factionId, units, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT, mapData || undefined);
        
        // 타겟 적합성 판별
        const isEnemy = hoveredUnit.factionId !== attacker.factionId;
        const validTarget = skill.targetType === 'any' || (skill.targetType === 'enemy' && isEnemy) || (skill.targetType === 'ally' && !isEnemy);

        if (skill && validation.valid && validTarget) {
          const dmgEffect = skill.effects.find(e => e.type === 'damage');
          if (dmgEffect) {
            const attackElement = dmgEffect.element || 'none';
            const resistMap = UNIT_RESISTANCES[hoveredUnit.unitType];
            const elementalMult = (resistMap && attackElement in resistMap) 
              ? (resistMap[attackElement as keyof typeof resistMap] || 1.0) 
              : 1.0;
            const isWeak = elementalMult > 1.0;
            const isResist = elementalMult < 1.0;
            const atk = getEffectiveStat(attacker, 'attack');
            const def = getEffectiveStat(hoveredUnit, 'defense');
            const rawDmg = Math.max(1, (atk * (dmgEffect.value || 1) * elementalMult) - (def * 0.5));
            const dmg = Math.round(rawDmg);
            expectedAmount = dmg;
            damagePreview = (
              <div className="mt-1 text-purple-300 text-sm border-t border-gray-600 pt-1">
                <p className="font-bold mb-0.5">✨ 스킬 데미지</p>
                <p className="text-xs">
                  {dmg} (확정)
                  {isWeak && <span className="ml-1 text-red-400 font-bold text-[10px]">(약점)</span>}
                  {isResist && <span className="ml-1 text-gray-400 font-bold text-[10px]">(저항)</span>}
                </p>
              </div>
            );
          } else if (skill.effects.some(e => e.type === 'heal')) {
            const healEffect = skill.effects.find(e => e.type === 'heal')!;
            const atkOrInt = attacker.generalIntelligence ? (attacker.generalIntelligence * 10) : getEffectiveStat(attacker, 'attack');
            const rawHeal = Math.max(1, atkOrInt * (healEffect.value || 1));
            const healAmt = Math.round(rawHeal);
            
            damagePreview = (
              <div className="mt-1 text-green-300 text-sm border-t border-gray-600 pt-1">
                <p className="font-bold mb-0.5">✨ 예상 개별 회복</p>
                <p className="text-xs">+{healAmt} HP</p>
              </div>
            );
          } else {
            const otherEffects = skill.effects.map(e => e.type === 'push' ? '넉백' : e.type === 'pull' ? '당기기' : e.type === 'dash' ? '돌진' : e.type).join(', ');
            damagePreview = (
              <div className="mt-1 text-blue-300 text-sm border-t border-gray-600 pt-1">
                <p className="font-bold mb-0.5">✨ 예상 효과</p>
                <p className="text-xs">{otherEffects}</p>
              </div>
            );
          }
        }
      }
    }
  }

  return (
    <div className="absolute bottom-4 right-4 bg-gray-900 bg-opacity-90 border-2 border-slate-700 text-white p-3 rounded-lg shadow-xl shadow-black/50 pointer-events-none z-50 w-52 flex flex-col gap-1 transition-opacity duration-200">
      <div className="flex justify-between items-center border-b border-gray-600 pb-1 mb-1">
        <h3 className="font-bold text-md text-amber-400">지형 정보</h3>
        <span className="text-xs text-gray-400">({lx}, {ly})</span>
      </div>
      <p className="text-sm font-semibold">{tName}</p>
      <div className="text-xs text-gray-300 flex flex-col gap-0.5">
        <p>방어력: <span className={terrainInfo.defenseMod > 0 ? "text-green-400" : (terrainInfo.defenseMod < 0 ? "text-red-400" : "")}>{terrainInfo.defenseMod > 0 ? '+' : ''}{Math.round(terrainInfo.defenseMod * 100)}%</span></p>
        <p>이동 코스트: {terrainInfo.moveCost >= 90 ? <span className="text-red-500">불가</span> : <span>x{terrainInfo.moveCost}</span>}</p>
      </div>

      {hoveredUnit && (
        <div className="mt-1 text-xs border-t border-gray-600 pt-2">
          <div className="flex justify-between items-center mb-0.5">
            <span className="font-bold text-blue-300">대상: {hoveredUnit.unitType}</span>
            <span className="text-gray-400">🛡 방어: {getEffectiveStat(hoveredUnit, 'defense')}</span>
          </div>
          <p className="text-[10px] text-gray-400 mb-0.5">
            <span className="text-blue-300">MP: {hoveredUnit.mp}/{hoveredUnit.maxMp}</span> | <span className="text-orange-400">분노: {Math.round(hoveredUnit.rage)}/100</span>
          </p>
          <DamagePreviewHpBar hp={hoveredUnit.hp} maxHp={hoveredUnit.maxHp} expectedDamage={expectedAmount} />
          
          {hoveredUnit.buffs && hoveredUnit.buffs.length > 0 && (
            <div className="mt-1 pt-1 border-t border-gray-700 flex flex-wrap gap-1">
              {hoveredUnit.buffs.map(b => (
                <span key={b.id} className={`text-[9px] px-1 rounded border text-white ${b.type.includes('down') || b.type === 'poison' ? 'bg-red-900/80 border-red-700' : 'bg-cyan-900/80 border-cyan-700'}`}>
                  {b.type}({b.duration}T)
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {damagePreview}
    </div>
  );
}
