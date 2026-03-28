// J:/AI/Game/SRPG/src/components/ActionMenu.tsx
// 이동 확정 후 행동 메뉴
// - ATTACK: enterAttackTargetMode → 공격 범위 내 적군 클릭으로 타겟 지정
// - 대기: 이동만 하고 행동 종료
// - 취소: 이동 확정 해제

import { useState, useEffect } from 'react';
import { useGameStore, tileToPixel, getAttackableTargets } from '../store/gameStore';
import type { ActionMenuType } from '../store/gameStore';
import { MOCK_SKILLS } from '../utils/skillTargeting';

function parseColoredDescription(desc: string) {
  const regex = /\[([tva]):([^\]]+)\]/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  let key = 0;
  
  while ((match = regex.exec(desc)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++} className="text-gray-300">{desc.substring(lastIndex, match.index)}</span>);
    }
    const type = match[1];
    const text = match[2];
    
    let colorClass = '';
    if (type === 't') colorClass = 'text-cyan-300 font-bold'; // 대상 (Target)
    if (type === 'v') colorClass = 'text-orange-400 font-bold bg-orange-900/40 px-0.5 rounded'; // 수치 (Value)
    if (type === 'a') colorClass = 'text-pink-400 font-bold'; // 속성 (Attribute)
    
    parts.push(<span key={key++} className={colorClass}>{text}</span>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < desc.length) {
    parts.push(<span key={key++} className="text-gray-300">{desc.substring(lastIndex)}</span>);
  }
  return <p className="text-[11px] leading-relaxed break-keep bg-gray-900/40 p-1.5 rounded-md border border-gray-700/50">{parts}</p>;
}

function MiniMapShape({ shape, radius, isRange }: { shape: string, radius: number, isRange: boolean }) {
  const SIZE = 9; 
  const center = 4;
  const tiles = new Set<string>();

  if (isRange) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= radius) tiles.add(`${center + dx},${center + dy}`);
      }
    }
  } else {
    if (shape === 'single') { tiles.add(`${center},${center}`); }
    else if (shape === 'cross') {
      tiles.add(`${center},${center}`);
      for(let i=1; i<=radius; i++) {
        tiles.add(`${center+i},${center}`); tiles.add(`${center-i},${center}`);
        tiles.add(`${center},${center+i}`); tiles.add(`${center},${center-i}`);
      }
    } else if (shape === 'radius') {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) + Math.abs(dy) <= radius) tiles.add(`${center + dx},${center + dy}`);
        }
      }
    } else if (shape === 'line' || shape === 'line_to_target') {
      for(let i=1; i<=radius; i++) tiles.add(`${center},${center-i}`);
    } else if (shape === 'cone') {
      for (let i = 1; i <= radius; i++) {
        const w = Math.floor(i / 2);
        for (let dx = -w; dx <= w; dx++) tiles.add(`${center + dx},${center - i}`);
      }
    } else if (shape === 'donut') {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const dist = Math.abs(dx) + Math.abs(dy);
          if (dist > 0 && dist <= radius) tiles.add(`${center + dx},${center + dy}`);
        }
      }
    }
  }

  const cells = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const isTarget = tiles.has(`${x},${y}`);
      const isCenter = x === center && y === center;
      let bgColor = 'bg-green-900/30';
      if (isCenter) bgColor = isRange ? 'bg-cyan-400' : 'bg-fuchsia-500';
      else if (isTarget) bgColor = isRange ? 'bg-yellow-400' : 'bg-red-500';
      
      cells.push(<div key={`${x}-${y}`} className={`w-[5px] h-[5px] rounded-sm ${bgColor}`} />);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center bg-black/40 p-1 rounded border border-gray-700 w-fit mx-auto mt-1">
      <div className="grid grid-cols-9 gap-[1px]">
        {cells}
      </div>
    </div>
  );
}

export default function ActionMenu({ camera }: { camera: { x: number; y: number; scale: number } }) {
  const [view, setView] = useState<'main' | 'skills'>('main');
  const confirmedDest       = useGameStore(s => s.confirmedDestination);
  const selectedUnitId      = useGameStore(s => s.selectedUnitId);
  const executeAction       = useGameStore(s => s.executeAction);
  const enterAttackMode     = useGameStore(s => s.enterAttackTargetMode);
  const attackTargetMode    = useGameStore(s => s.attackTargetMode);
  const skillTargetMode     = useGameStore(s => s.skillTargetMode);
  const units               = useGameStore(s => s.units);

  // 선택이 풀리거나 다른 유닛 선택, 이동을 취소했을 때 메뉴뷰를 main으로 리셋
  useEffect(() => {
    setView('main');
  }, [confirmedDest, selectedUnitId]);

  const isMoveAnimating = useGameStore(s => s.isMoveAnimating);
  
  if (isMoveAnimating) return null; // 걷는 도중엔 메뉴 안 보임
  if (attackTargetMode || skillTargetMode) return null; // 공격 혹은 스킬 선택 모드일 때는 ActionMenu가 숨겨짐

  if (!confirmedDest || !selectedUnitId) return null;

  const attacker = units[selectedUnitId];
  if (!attacker) return null;

  const targets = getAttackableTargets(attacker, units, confirmedDest.lx, confirmedDest.ly);
  const canAttack = targets.length > 0;

  const px = tileToPixel(confirmedDest.lx);
  const py = tileToPixel(confirmedDest.ly);
  const angle = Math.PI / 4;
  const rx = px * Math.cos(angle) - py * Math.sin(angle);
  const ry = px * Math.sin(angle) + py * Math.cos(angle);
  const screenX = camera.x + rx * 1 * camera.scale;
  const screenY = camera.y + ry * 0.5 * camera.scale;

  const menuW = view === 'main' ? 140 : 260; // 폭 소폭 증가
  const menuH = view === 'main' ? 140 : 360; // 높이 대폭 증가
  const MARGIN = 10;
  
  // 유닛의 우측 상단 쯤에 표시
  let left = screenX + 16 * camera.scale;
  let top  = screenY - 16 * camera.scale - menuH / 2;
  
  if (left + menuW > window.innerWidth - MARGIN) left = screenX - menuW - 16 * camera.scale;
  if (top < MARGIN) top = MARGIN;
  if (top + menuH > window.innerHeight - MARGIN) top = window.innerHeight - menuH - MARGIN;

  if (view === 'skills') {
    return (
      <div 
        className="absolute z-50 pointer-events-auto" 
        style={{ left, top }}
        onWheel={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <div className="bg-gray-900/95 border border-purple-500 rounded-xl p-3 shadow-2xl backdrop-blur-sm w-[260px]">
          <div className="flex justify-between items-center mb-3 border-b border-gray-600 pb-2">
            <p className="text-purple-300 text-sm font-bold tracking-wider">✨ 스킬 선택</p>
            <button className="text-gray-400 hover:text-white pointer-events-auto cursor-pointer" onClick={() => setView('main')}>✕</button>
          </div>
          
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
            {(!attacker.skills || attacker.skills.length === 0) ? (
              <p className="text-gray-500 text-xs text-center py-4">사용 가능한 스킬이 없습니다.</p>
            ) : (
              (() => {
                // [Migration Patch] 기존 로컬 세이브(새 게임을 눌러도 gameStore 캐시가 남은 경우)에
                // mock-heal 데이터가 없으면 즉시 동적으로 포함시킵니다.
                const mergedSkills = [...attacker.skills];
                if (!mergedSkills.includes('mock-heal')) mergedSkills.push('mock-heal');
                if (attacker.isHero && !mergedSkills.includes('mock-aoe-heal')) mergedSkills.push('mock-aoe-heal');
                
                return mergedSkills.map(skillId => {
                  const skill = MOCK_SKILLS[skillId];
                  if (!skill) return null;
                
                // 코스트 텍스트 포맷
                const costStr = skill.cost.map(c => `${c.type.toUpperCase()} ${c.amount}`).join(', ') || '비용 없음';
                
                // 사용 가능 여부 (자원 량 체크)
                const canUse = skill.cost.every(c => {
                  if (c.type === 'mp') return attacker.mp >= c.amount;
                  if (c.type === 'rage') return attacker.rage >= c.amount;
                  return true;
                });

                // aoeShape 한글화 매핑
                const shapeMap: Record<string, string> = { cross: '십자', cone: '부채꼴', radius: '방사형', line: '직선', single: '단일', donut: '도넛', line_to_target: '관통' };
                const shapeStr = shapeMap[skill.aoeShape] || skill.aoeShape;

                return (
                  <button
                    key={skillId}
                    className={`text-left p-2 rounded border transition-all cursor-pointer pointer-events-auto flex flex-col gap-1.5 ${
                      canUse ? 'bg-gray-800 border-gray-600 hover:bg-purple-900/50 hover:border-purple-400' 
                             : 'bg-gray-800/50 border-gray-700 opacity-60 cursor-not-allowed'
                    }`}
                    disabled={!canUse}
                    onClick={() => {
                      if (canUse) {
                        useGameStore.getState().enterSkillTargetMode(skill.id);
                        setView('main'); // 클릭 시 창 닫기
                      }
                    }}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white text-sm font-bold">{skill.name}</span>
                      <span className={`text-[10px] font-bold ${canUse ? 'text-blue-300' : 'text-red-400'}`}>{costStr}</span>
                    </div>
                    {parseColoredDescription(skill.description)}
                    <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[10px] font-medium bg-gray-900/60 p-1.5 rounded mt-0.5">
                      <div className="text-indigo-300 text-center flex flex-col items-center justify-between">
                        <span className="mb-0.5">🎯 사거리: 방사형({skill.range}칸)</span>
                        <MiniMapShape shape="radius" radius={skill.range} isRange={true} />
                      </div>
                      <div className="text-emerald-300 text-center flex flex-col items-center justify-between">
                        <span className="mb-0.5">💥 타격범위: {shapeStr}({skill.aoeRadius}칸)</span>
                        <MiniMapShape shape={skill.aoeShape} radius={skill.aoeRadius} isRange={false} />
                      </div>
                    </div>
                  </button>
                );
              })
            })()
            )}
          </div>
        </div>
      </div>
    );
  }

  type BtnDef = { label: string; icon: string; cls: string; action: () => void; disabled?: boolean };
  const buttons: BtnDef[] = [
    {
      label: canAttack ? `공격 (${targets.length}기)` : '공격',
      icon: '⚔️',
      cls: canAttack
        ? 'bg-red-700 hover:bg-red-600'
        : 'bg-gray-700 opacity-40 cursor-not-allowed',
      action: () => { if (canAttack) enterAttackMode(); },
      disabled: !canAttack,
    },
    {
      label: `스킬 (${attacker.skills?.length || 0})`,
      icon: '✨',
      cls: (attacker.skills && attacker.skills.length > 0) ? 'bg-purple-700 hover:bg-purple-600' : 'bg-gray-700 opacity-40 cursor-not-allowed',
      disabled: !attacker.skills || attacker.skills.length === 0,
      action: () => setView('skills'),
    },
    {
      label: '대기',
      icon: '⏳',
      cls: 'bg-gray-600 hover:bg-gray-500',
      action: () => executeAction('WAIT' as ActionMenuType),
    },
    {
      label: '취소',
      icon: '✕',
      cls: 'bg-gray-800 hover:bg-gray-700 border border-gray-600',
      action: () => executeAction('CANCEL' as ActionMenuType),
    },
  ];

  return (
    <div 
      className="absolute z-50 pointer-events-auto" 
      style={{ left, top }}
      onWheel={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div className="bg-gray-900/95 border border-gray-500 rounded-xl p-2 shadow-2xl backdrop-blur-sm min-w-[130px]">
        <p className="text-gray-300 text-xs font-bold mb-2 text-center tracking-wider">행동 선택</p>
        {buttons.map(({ label, icon, cls, action, disabled }) => (
          <button
            key={label}
            className={`w-full ${cls} text-white text-xs font-bold py-2 px-3 rounded-lg mb-1 flex items-center gap-2 transition-all cursor-pointer`}
            disabled={disabled}
            onClick={action}
          >
            <span>{icon}</span><span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
