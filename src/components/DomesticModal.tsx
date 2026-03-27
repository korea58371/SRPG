// J:/AI/Game/SRPG/src/components/DomesticModal.tsx
// 전체 내정 메뉴: 영지를 선택하지 않고 사용하는 전략 레이어 행동 모음
// - 인재 등용: 재야 인재를 내 세력으로 등용
// - 징병: 영웅의 병력 수 증가
// - 군단 편제: 영웅의 병종 변경
// - 인사: 영웅을 다른 영지로 이동 배치

import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { PLAYER_FACTION } from '../constants/gameConfig';
import type { Character } from '../types/characterTypes';

export type DomesticMenuType = 'recruit' | 'conscript' | 'formation' | 'personnel' | null;

interface Props {
  menu: DomesticMenuType;
  onClose: () => void;
}

const TROOP_TYPES = ['INFANTRY', 'CAVALRY', 'ARCHER', 'SPEARMAN'] as const;
const TROOP_LABELS: Record<string, string> = {
  INFANTRY: '보병 🗡️',
  CAVALRY: '기병 🐎',
  ARCHER: '궁병 🏹',
  SPEARMAN: '창병 🔱',
};

export default function DomesticModal({ menu, onClose }: Props) {
  const characters = useAppStore(s => s.characters);
  const storeProvinces = useAppStore(s => s.provinces);
  const factionResources = useAppStore(s => s.factionResources);
  const recruitCharacter = useAppStore(s => s.recruitCharacter);
  const updateCharacterTroop = useAppStore(s => s.updateCharacterTroop);
  const moveCharacter = useAppStore(s => s.moveCharacter);

  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [selectedProvId, setSelectedProvId] = useState<string | null>(null);
  const [selectedTroop, setSelectedTroop] = useState<string>('INFANTRY');
  const [conscriptAmount, setConscriptAmount] = useState(100);

  if (!menu) return null;

  const playerChars = Object.values(characters).filter(
    c => c.factionId === PLAYER_FACTION && c.state === 'Factioned'
  );
  const freeAgents = Object.values(characters).filter(c => c.state === 'FreeAgent');
  const playerProvinces = Object.values(storeProvinces).filter(p => p.owner === PLAYER_FACTION);
  const resources = factionResources[PLAYER_FACTION];

  const TITLE: Record<NonNullable<DomesticMenuType>, string> = {
    recruit: '🧑‍💼 인재 등용',
    conscript: '📯 징병',
    formation: '⚙️ 군단 편제',
    personnel: '🏛️ 인사',
  };
  const DESC: Record<NonNullable<DomesticMenuType>, string> = {
    recruit: '재야의 인재를 내 세력으로 등용합니다.',
    conscript: '소속 영웅의 병력을 증가시킵니다.',
    formation: '소속 영웅의 병종을 변경합니다.',
    personnel: '영웅을 다른 영지로 이동 배치합니다.',
  };

  const handleRecruit = () => {
    if (!selectedCharId || !selectedProvId) return;
    recruitCharacter(selectedCharId, PLAYER_FACTION, selectedProvId);
    setSelectedCharId(null);
    setSelectedProvId(null);
  };

  const handleConscript = () => {
    if (!selectedCharId) return;
    const char = characters[selectedCharId];
    if (!char) return;
    const cost = conscriptAmount * 2; // 금 2 per 병력
    if (!resources || resources.gold < cost) {
      alert(`금이 부족합니다. 필요: ${cost}금`);
      return;
    }
    updateCharacterTroop(selectedCharId, char.troopType, (char.troopCount || 0) + conscriptAmount);
    setSelectedCharId(null);
  };

  const handleFormation = () => {
    if (!selectedCharId) return;
    const char = characters[selectedCharId];
    if (!char) return;
    updateCharacterTroop(selectedCharId, selectedTroop as any, char.troopCount || 0);
    setSelectedCharId(null);
  };

  const handlePersonnel = () => {
    if (!selectedCharId || !selectedProvId) return;
    moveCharacter(selectedCharId, selectedProvId);
    setSelectedCharId(null);
    setSelectedProvId(null);
  };

  const statBarStyle = (val: number, max = 100) => ({
    width: `${Math.min((val / max) * 100, 100)}%`,
  });

  const CharCard = ({ char, selected, onClick }: { char: Character; selected: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded border transition-all ${
        selected
          ? 'border-amber-500 bg-amber-900/30 text-white'
          : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
      }`}
    >
      <div className="flex justify-between items-start">
        <div>
          <span className="font-bold text-sm text-amber-200">{char.name}</span>
          {char.troopType && (
            <span className="ml-2 text-xs text-slate-400">
              {TROOP_LABELS[char.troopType] ?? char.troopType} {char.troopCount?.toLocaleString()}명
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500 text-right">
          <div>무{char.baseStats.strength} 지{char.baseStats.intelligence}</div>
          <div>정{char.baseStats.politics} 통{char.baseStats.charisma}</div>
        </div>
      </div>
      {/* 스탯 미니 바 */}
      <div className="mt-2 space-y-0.5">
        {[
          { label: '무', val: char.baseStats.strength, color: 'bg-red-500' },
          { label: '지', val: char.baseStats.intelligence, color: 'bg-blue-500' },
          { label: '정', val: char.baseStats.politics, color: 'bg-green-500' },
        ].map(({ label, val, color }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500 w-3">{label}</span>
            <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full ${color} rounded-full`} style={statBarStyle(val)} />
            </div>
          </div>
        ))}
      </div>
    </button>
  );

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-2 border-slate-700 rounded-xl shadow-2xl w-[680px] max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/80">
          <div>
            <h2 className="text-xl font-bold text-amber-400">{TITLE[menu]}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{DESC[menu]}</p>
          </div>
          <div className="flex items-center gap-4">
            {resources && (
              <div className="text-sm text-slate-300 flex gap-3">
                <span>💰 {resources.gold.toFixed(0)}금</span>
                <span>🌾 {resources.food.toFixed(0)}곡</span>
                <span>🪖 {resources.manpower}</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded border border-slate-600 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* ────── 인재 등용 ────── */}
          {menu === 'recruit' && (
            <div className="flex flex-1 overflow-hidden">
              {/* 재야 인재 목록 */}
              <div className="w-1/2 border-r border-slate-700 p-4 overflow-y-auto">
                <h3 className="text-xs font-bold text-slate-400 mb-3 tracking-widest">재야 인재 ({freeAgents.length}명)</h3>
                {freeAgents.length === 0 ? (
                  <p className="text-slate-500 text-sm">등용 가능한 인재가 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {freeAgents.map(char => (
                      <CharCard
                        key={char.id}
                        char={char}
                        selected={selectedCharId === char.id}
                        onClick={() => setSelectedCharId(char.id === selectedCharId ? null : char.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
              {/* 배속 영지 선택 + 확인 */}
              <div className="w-1/2 p-4 flex flex-col gap-3 overflow-y-auto">
                <h3 className="text-xs font-bold text-slate-400 mb-1 tracking-widest">배속 영지 선택</h3>
                <div className="space-y-1.5 flex-1">
                  {playerProvinces.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProvId(p.id === selectedProvId ? null : p.id)}
                      className={`w-full text-left px-3 py-2 rounded border text-sm transition-all ${
                        selectedProvId === p.id
                          ? 'border-amber-500 bg-amber-900/30 text-amber-200'
                          : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {p.isCapital ? '👑 ' : '🏘️ '}{p.name}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleRecruit}
                  disabled={!selectedCharId || !selectedProvId}
                  className={`w-full py-2.5 rounded font-bold border transition-all ${
                    selectedCharId && selectedProvId
                      ? 'bg-amber-700 hover:bg-amber-600 border-amber-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  등용 확정
                </button>
              </div>
            </div>
          )}

          {/* ────── 징병 ────── */}
          {menu === 'conscript' && (
            <div className="flex flex-1 overflow-hidden">
              <div className="w-1/2 border-r border-slate-700 p-4 overflow-y-auto">
                <h3 className="text-xs font-bold text-slate-400 mb-3 tracking-widest">소속 영웅</h3>
                <div className="space-y-2">
                  {playerChars.map(char => (
                    <CharCard
                      key={char.id}
                      char={char}
                      selected={selectedCharId === char.id}
                      onClick={() => setSelectedCharId(char.id === selectedCharId ? null : char.id)}
                    />
                  ))}
                </div>
              </div>
              <div className="w-1/2 p-4 flex flex-col gap-4">
                <h3 className="text-xs font-bold text-slate-400 tracking-widest">징병 설정</h3>
                {selectedCharId && (
                  <div className="bg-slate-800/80 p-3 rounded border border-slate-700 text-sm text-slate-300">
                    현재 병력: <span className="font-bold text-white">
                      {(characters[selectedCharId]?.troopCount || 0).toLocaleString()}명
                    </span>
                  </div>
                )}
                <div>
                  <label className="text-xs text-slate-400 mb-2 block">징병 수: <span className="text-amber-300 font-bold">{conscriptAmount}명</span></label>
                  <input
                    type="range"
                    min={50} max={1000} step={50}
                    value={conscriptAmount}
                    onChange={e => setConscriptAmount(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>50명</span><span>1000명</span>
                  </div>
                </div>
                <div className="bg-slate-800/50 p-3 rounded border border-slate-700 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">소요 금:</span>
                    <span className="text-yellow-400 font-bold">{conscriptAmount * 2}금</span>
                  </div>
                </div>
                <button
                  onClick={handleConscript}
                  disabled={!selectedCharId}
                  className={`mt-auto w-full py-2.5 rounded font-bold border transition-all ${
                    selectedCharId
                      ? 'bg-blue-800 hover:bg-blue-700 border-blue-600 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  징병 실행
                </button>
              </div>
            </div>
          )}

          {/* ────── 군단 편제 ────── */}
          {menu === 'formation' && (
            <div className="flex flex-1 overflow-hidden">
              <div className="w-1/2 border-r border-slate-700 p-4 overflow-y-auto">
                <h3 className="text-xs font-bold text-slate-400 mb-3 tracking-widest">편제 변경 대상</h3>
                <div className="space-y-2">
                  {playerChars.map(char => (
                    <CharCard
                      key={char.id}
                      char={char}
                      selected={selectedCharId === char.id}
                      onClick={() => {
                        setSelectedCharId(char.id === selectedCharId ? null : char.id);
                        setSelectedTroop(char.troopType ?? 'INFANTRY');
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="w-1/2 p-4 flex flex-col gap-3">
                <h3 className="text-xs font-bold text-slate-400 tracking-widest">병종 선택</h3>
                <div className="space-y-2 flex-1">
                  {TROOP_TYPES.map(type => (
                    <button
                      key={type}
                      onClick={() => setSelectedTroop(type)}
                      className={`w-full text-left px-4 py-3 rounded border text-sm font-bold transition-all ${
                        selectedTroop === type
                          ? 'border-sky-500 bg-sky-900/30 text-sky-200'
                          : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {TROOP_LABELS[type]}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleFormation}
                  disabled={!selectedCharId}
                  className={`w-full py-2.5 rounded font-bold border transition-all ${
                    selectedCharId
                      ? 'bg-sky-800 hover:bg-sky-700 border-sky-600 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  편제 확정
                </button>
              </div>
            </div>
          )}

          {/* ────── 인사 ────── */}
          {menu === 'personnel' && (
            <div className="flex flex-1 overflow-hidden">
              <div className="w-1/2 border-r border-slate-700 p-4 overflow-y-auto">
                <h3 className="text-xs font-bold text-slate-400 mb-3 tracking-widest">영웅 선택</h3>
                <div className="space-y-2">
                  {playerChars.map(char => {
                    const currentProv = char.locationProvinceId
                      ? storeProvinces[char.locationProvinceId]?.name ?? '?'
                      : '미배치';
                    return (
                      <div key={char.id}>
                        <CharCard
                          char={char}
                          selected={selectedCharId === char.id}
                          onClick={() => setSelectedCharId(char.id === selectedCharId ? null : char.id)}
                        />
                        <div className="text-[11px] text-slate-500 pl-1 mt-0.5">현재: {currentProv}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="w-1/2 p-4 flex flex-col gap-3 overflow-y-auto">
                <h3 className="text-xs font-bold text-slate-400 mb-1 tracking-widest">이동 목적지</h3>
                <div className="space-y-1.5 flex-1">
                  {playerProvinces.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProvId(p.id === selectedProvId ? null : p.id)}
                      className={`w-full text-left px-3 py-2 rounded border text-sm transition-all ${
                        selectedProvId === p.id
                          ? 'border-amber-500 bg-amber-900/30 text-amber-200'
                          : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {p.isCapital ? '👑 ' : '🏘️ '}{p.name}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handlePersonnel}
                  disabled={!selectedCharId || !selectedProvId}
                  className={`w-full py-2.5 rounded font-bold border transition-all ${
                    selectedCharId && selectedProvId
                      ? 'bg-violet-800 hover:bg-violet-700 border-violet-600 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  이동 명령
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
