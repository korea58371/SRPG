// J:/AI/Game/SRPG/src/components/HeroListModal.tsx
// [수정] useGameStore → useAppStore (characters는 appStore로 이관됨)

import { useAppStore } from '../store/appStore';
import { useGameStore } from '../store/gameStore';
import { FACTIONS } from '../constants/gameConfig';

export default function HeroListModal() {
  const open    = useGameStore(s => s.heroListModalOpen);
  const setOpen = useGameStore(s => s.setHeroListModalOpen);

  // [변경] characters를 appStore에서 구독
  const characters = useAppStore(s => s.characters);

  if (!open) return null;

  const charList = Object.values(characters);

  return (
    <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-[200] pointer-events-auto backdrop-blur-sm">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-xl w-[800px] h-[600px] shadow-2xl flex flex-col pt-2 pb-4 px-6 overflow-hidden">

        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-700 py-4">
          <h2 className="text-2xl font-bold font-title text-amber-500 drop-shadow-md">세계관 인물록</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded font-bold border border-slate-600 transition-colors"
          >
            닫기
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto mt-4 pr-2 space-y-3 custom-scrollbar">
          {charList.map(char => {
            const factionName = char.factionId ? FACTIONS[char.factionId]?.name || '알 수 없는 세력' : '재야';
            const factionColor = char.factionId ? FACTIONS[char.factionId]?.color : 0xaaaaaa;
            const hexColor = factionColor ? `#${factionColor.toString(16).padStart(6, '0')}` : '#aaaaaa';

            const stateLabel =
              char.state === 'Factioned'   ? '임관(소속)' :
              char.state === 'FreeAgent'   ? '재야' :
              char.state === 'Undiscovered'? '미발견' :
              char.state === 'Dead'        ? '사망' : char.state;

            return (
              <div key={char.id} className="bg-slate-800 p-4 rounded-lg flex items-start gap-4 border border-slate-700">
                {/* Portrait Placeholder */}
                <div
                  className="w-16 h-16 rounded-full flex shrink-0 items-center justify-center font-bold text-xl shadow-inner border-2"
                  style={{ backgroundColor: `${hexColor}40`, borderColor: hexColor, color: hexColor }}
                >
                  {char.name.charAt(0)}
                </div>

                {/* Info */}
                <div className="flex-1 text-sm font-mono flex flex-col justify-between">
                  <div className="flex justify-between">
                    <span className="text-lg font-bold text-white">{char.name}</span>
                    <span
                      className="font-bold px-2 py-0.5 rounded text-xs"
                      style={{ backgroundColor: `${hexColor}20`, color: hexColor, border: `1px solid ${hexColor}80` }}
                    >
                      {factionName}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-4 gap-2 text-slate-300">
                    <div>
                      <span className="text-slate-500 text-xs block mb-0.5 font-bold">신분</span>
                      <span className="font-bold">{stateLabel}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs block mb-0.5 font-bold">수명</span>
                      {char.lifespan}세 (+{char.lifespanBonus})
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs block mb-0.5 font-bold">충성도</span>
                      <span className="text-emerald-400 font-bold">{char.loyalty}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs block mb-0.5 font-bold">생년</span>
                      {char.birthYear}년
                    </div>
                  </div>

                  {/* 부대 편제 정보 */}
                  {char.troopType && (
                    <div className="mt-2 text-xs text-slate-400 flex gap-3">
                      <span>병종: <span className="text-sky-300 font-bold">{char.troopType}</span></span>
                      <span>병력: <span className="text-blue-300 font-bold">{char.troopCount}명</span></span>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="mt-3 flex gap-3 text-xs bg-slate-900/50 p-2 rounded justify-between font-bold border border-slate-700/50">
                    <div><span className="text-slate-500 mr-1">체력</span><span className="text-red-300">{char.baseStats.hp}</span></div>
                    <div><span className="text-slate-500 mr-1">무력</span><span className="text-orange-300">{char.baseStats.strength}</span></div>
                    <div><span className="text-slate-500 mr-1">지력</span><span className="text-blue-300">{char.baseStats.intelligence}</span></div>
                    <div><span className="text-slate-500 mr-1">정치</span><span className="text-emerald-300">{char.baseStats.politics}</span></div>
                    <div><span className="text-slate-500 mr-1">통솔</span><span className="text-purple-300">{char.baseStats.charisma}</span></div>
                    <div><span className="text-slate-500 mr-1">속도</span><span className="text-sky-300">{char.baseStats.speed}</span></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
