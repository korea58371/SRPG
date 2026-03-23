// J:/AI/Game/SRPG/src/components/ActionMenu.tsx
// 이동 확정 후 행동 메뉴
// - ATTACK: enterAttackTargetMode → 공격 범위 내 적군 클릭으로 타겟 지정
// - 대기: 이동만 하고 행동 종료
// - 취소: 이동 확정 해제

import { useGameStore, tileToPixel, getAttackableTargets } from '../store/gameStore';
import type { ActionMenuType } from '../store/gameStore';

export default function ActionMenu() {
  const confirmedDest       = useGameStore(s => s.confirmedDestination);
  const selectedUnitId      = useGameStore(s => s.selectedUnitId);
  const executeAction       = useGameStore(s => s.executeAction);
  const enterAttackMode     = useGameStore(s => s.enterAttackTargetMode);
  const attackTargetMode    = useGameStore(s => s.attackTargetMode);
  const units               = useGameStore(s => s.units);
  const cancelConfirmed     = useGameStore(s => s.cancelConfirmedMove);

  // 공격 타겟 선택 모드일 때는 안내 메시지만 표시
  if (attackTargetMode && confirmedDest) {
    const px = tileToPixel(confirmedDest.lx);
    const py = tileToPixel(confirmedDest.ly);
    return (
      <div className="absolute z-50 pointer-events-auto" style={{ left: px + 24, top: py - 40 }}>
        <div className="bg-red-900/90 border border-red-500 rounded-xl px-4 py-2 text-xs font-bold text-red-200 shadow-xl backdrop-blur-sm flex items-center gap-2">
          <span>⚔️</span>
          <span>공격할 적군을 클릭하세요</span>
          <button
            className="ml-2 text-gray-300 hover:text-white cursor-pointer"
            onClick={cancelConfirmed}
          >✕</button>
        </div>
      </div>
    );
  }

  if (!confirmedDest || !selectedUnitId) return null;

  const attacker = units[selectedUnitId];
  if (!attacker) return null;

  const targets = getAttackableTargets(attacker, units, confirmedDest.lx, confirmedDest.ly);
  const canAttack = targets.length > 0;

  const px = tileToPixel(confirmedDest.lx);
  const py = tileToPixel(confirmedDest.ly);
  const menuW = 140;
  const menuH = 130;
  const MARGIN = 10;
  let left = px + 24;
  let top  = py - menuH / 2;
  if (left + menuW > window.innerWidth - MARGIN) left = px - menuW - 24;
  if (top < MARGIN) top = MARGIN;
  if (top + menuH > window.innerHeight - MARGIN) top = window.innerHeight - menuH - MARGIN;

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
    <div className="absolute z-50 pointer-events-auto" style={{ left, top }}>
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
