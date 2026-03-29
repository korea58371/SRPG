import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { useGameStore } from '../store/gameStore';
import { FACTIONS, BASE_YEAR } from '../constants/gameConfig';
import HeroStatRadar from './ui/HeroStatRadar';
import type { CharacterBaseStats } from '../types/characterTypes';
import { MOCK_SKILLS } from '../utils/skillTargeting';

const parseDetailedString = (desc: string) => {
  const parts = desc.split(/(\[[tva]:[^\]]+\])/);
  return parts.map((part, index) => {
    if (part.startsWith('[t:')) return <span key={index} className="text-[#3c6b4d] font-bold">{part.slice(3, -1)}</span>;
    if (part.startsWith('[v:')) return <span key={index} className="text-[#986430] font-bold">{part.slice(3, -1)}</span>;
    if (part.startsWith('[a:')) return <span key={index} className="text-[#8c2a2a] font-bold">{part.slice(3, -1)}</span>;
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
};

const STAT_DESCRIPTIONS: Record<keyof CharacterBaseStats, { label: string, desc: string }> = {
  power: { label: '힘', desc: "무력 계통. 개인 물리 공격력 및 타격 계수입니다." },
  agility: { label: '민첩', desc: "무력 계통. 기동성, 전투 행동 순서와 회피율에 관여합니다." },
  dexterity: { label: '기술', desc: "무력 계통. 명중률, 치명타 확률, 무기 스킬 위력에 관여합니다." },
  constitution: { label: '체력', desc: "무력 계통. 개인 최대 HP이며 장기전 페널티 감소에 관여합니다." },
  magic: { label: '마력', desc: "무력 계통. 마법 공격력과 최대 MP를 결정합니다." },
  toughness: { label: '방어', desc: "무력 계통. 물리적 데미지를 경감시키고 부상 상태 발생을 방지합니다." },

  command: { label: '지휘', desc: "전술적 두뇌. 전투 시 부대 운용 효율과 스킬 발동, 진형 유지력을 담당합니다." },
  leadership: { label: '통솔', desc: "조직 장악력. 많은 병력을 통제해 부대 능력치 배율을 높이고 사기를 다집니다." },
  
  intelligence: { label: '지력', desc: "전장 지략. 전술 스킬 데미지 증가 및 전장 속임수, 적 계략에 대한 방어력입니다." },
  politics: { label: '정치', desc: "내정 역량. 영지 개발도, 턴당 자원 생산 효율 개진, 외교적 이점과 협상력에 관여합니다." },
  charm: { label: '매력', desc: "인간적 구심점. 무장 등용 및 충성도 관리 성공률, 부대 기본 사기치를 높입니다." },
};

const STAT_CATEGORIES = [
  {
    title: '무력 계통',
    keys: ['power', 'agility', 'dexterity', 'constitution', 'magic', 'toughness'] as const
  },
  {
    title: '지휘 계통',
    keys: ['command', 'leadership'] as const
  },
  {
    title: '정신 및 내정 계통',
    keys: ['intelligence', 'politics', 'charm'] as const
  }
];

export default function HeroListModal() {
  const open    = useGameStore(s => s.heroListModalOpen);
  const setOpen = useGameStore(s => s.setHeroListModalOpen);
  
  const characters = useAppStore(s => s.characters);
  const strategyTurn = useAppStore(s => s.strategyTurn);
  const charList = useMemo(() => Object.values(characters), [characters]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stats' | 'skills' | 'traits' | 'info'>('stats');
  
  const [tooltipState, setTooltipState] = useState<{ visible: boolean, x: number, y: number, key: keyof typeof STAT_DESCRIPTIONS | null }>({
    visible: false, x: 0, y: 0, key: null
  });

  const handleMouseMove = (e: React.MouseEvent, key: keyof typeof STAT_DESCRIPTIONS) => {
    setTooltipState({ visible: true, x: e.clientX, y: e.clientY, key });
  };
  const handleMouseLeave = () => {
    setTooltipState(s => ({ ...s, visible: false, key: null }));
  };

  if (!open) return null;

  const currentSelection = selectedId ?? charList[0]?.id;
  const selectedChar = characters[currentSelection];

  // Colors based on reference exactly: 
  // Background: very clean pale #f5f0e1
  // Borders: soft subtle brown #d4cab5
  // Text: dark espresso #2b2013

  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-[200] pointer-events-auto backdrop-blur-[2px] p-8">
      
      {/* Container - Fixed width/height, sleek shadow, more rounded corners */}
      <div className="bg-[#f5f0e1] border-2 border-[#2b2013] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] w-[1100px] max-w-[95vw] h-[750px] max-h-[90vh] flex flex-col relative overflow-hidden text-[#2b2013]">
        
        {/* Inner subtle frame like a document border */}
        <div className="absolute inset-1.5 border border-[#d4cab5] rounded-xl pointer-events-none"></div>

        {/* Header - Simple and thin */}
        <div className="flex justify-between items-center px-6 py-3 border-b border-[#d4cab5] z-10">
          <h2 className="text-[19px] tracking-widest font-title ml-2 mt-1 leading-none">인물록</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-[12px] mr-2 font-bold bg-[#faf6ec] border border-[#d4cab5] hover:border-[#2b2013] hover:bg-[#2b2013] hover:text-[#f5f0e1] transition-colors rounded-lg px-4 py-1.5"
          >
            닫기
          </button>
        </div>

        {/* Content Body */}
        <div className="flex flex-1 overflow-hidden z-10 w-full">
          
          {/* Left Pane: Sidebar. Darkened significantly for high contrast */}
          <div className="w-[280px] border-r border-[#d4cab5] flex flex-col bg-[#e6dbca] overflow-y-auto custom-scrollbar">
            <div className="py-2">
              {charList.map(char => {
                const factionName = char.factionId ? FACTIONS[char.factionId]?.name || '미소속' : '재야';
                const factionColor = char.factionId ? FACTIONS[char.factionId]?.color : 0x2b2013;
                const hexColor = factionColor ? `#${factionColor.toString(16).padStart(6, '0')}` : '#2b2013';
                const isSelected = char.id === currentSelection;

                return (
                  <button
                    key={char.id}
                    onClick={() => setSelectedId(char.id)}
                    className={`w-full text-left px-6 py-3.5 flex items-center gap-4 transition-all border-b border-[#d8ceba] ${
                      isSelected 
                        ? 'bg-[#f5f0e1] text-[#2b2013] border-l-[6px] border-l-[#2b2013] shadow-sm relative z-10' 
                        : 'hover:bg-[#dacdb2] text-[#6b5847] border-l-[6px] border-l-transparent'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full shrink-0 relative overflow-hidden bg-[#e6dbca]"
                         style={{ border: `1.5px solid ${hexColor}` }}>
                      <img 
                        src="/assets/characters/heroes/char_001/bust.png" 
                        alt={char.name}
                        className="w-full h-full object-cover relative z-10 sepia-[20%] contrast-[1.1]"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      {/* Placeholder Fallback */}
                      <div className="absolute inset-0 flex items-center justify-center font-bold font-title text-[15px] bg-[#f5f0e1] mt-0.5" style={{ color: hexColor }}>
                        <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundColor: hexColor }}></div>
                        <span>{char.name.charAt(0)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <div className="font-title text-[18px] leading-tight mt-0.5 tracking-wide">{char.name}</div>
                      <div className="text-[11px] opacity-80 mt-1 tracking-wider font-semibold">{factionName}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Pane */}
          <div className="flex-1 flex flex-col bg-[#f5f0e1] overflow-hidden">
            {selectedChar ? (() => {
               const char = selectedChar;
               const factionName = char.factionId ? FACTIONS[char.factionId]?.name || '미소속 지역' : '재야';
               const factionColor = char.factionId ? FACTIONS[char.factionId]?.color : 0x2b2013;
               const hexColor = `#${factionColor.toString(16).padStart(6, '0')}`;
   
               const stateLabel =
                 char.state === 'Factioned'   ? '임관' :
                 char.state === 'FreeAgent'   ? '재야' :
                 char.state === 'Undiscovered'? '미발견' :
                 char.state === 'Dead'        ? '사망' : char.state;

               return (
                 <div className="flex flex-col h-full">
                   {/* Profile Header Block */}
                   <div className="flex gap-6 items-center px-10 py-6">
                      {/* Avatar block with Image */}
                      <div className="w-[88px] h-[88px] rounded-full relative bg-[#f5f0e1] shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]"
                           style={{ border: `2px solid ${hexColor}` }}>
                        <img 
                          src="/assets/characters/heroes/char_001/bust.png" 
                          alt={char.name}
                          className="w-full h-full rounded-full object-cover relative z-10 sepia-[20%] contrast-[1.1]"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        {/* Placeholder Fallback */}
                        <div className="absolute inset-0 rounded-full flex items-center justify-center font-title mt-1" style={{ color: hexColor }}>
                          <span className="text-[36px]">{char.name.charAt(0)}</span>
                          <div className="absolute inset-0 rounded-full opacity-[0.05]" style={{ backgroundColor: hexColor }}></div>
                        </div>

                        {/* Status Label directly overlapping edge */}
                        <div className="absolute -bottom-1 -right-1 bg-[#2b2013] text-[#f5f0e1] text-[10px] font-bold px-2 py-0.5 rounded-sm z-20 shadow-sm border border-[#d4cab5]">
                          {stateLabel}
                        </div>
                      </div>
                      
                      <div className="flex flex-col justify-center h-full gap-2 pt-1">
                        <div className="text-[32px] font-title leading-none tracking-wide">{char.name}</div>
                        <div className="flex gap-2 text-[11px] font-bold text-[#554737] mt-1.5">
                          <span className="px-2.5 py-1 border border-[#d4cab5] rounded-sm bg-[#faf6ec]">{factionName}</span>
                          <span className="px-2.5 py-1 border border-[#d4cab5] rounded-sm bg-[#faf6ec]">
                            충성도 <span className="text-[#2b2013]">{char.loyalty}</span>
                          </span>
                          <span className="px-2.5 py-1 border border-[#d4cab5] rounded-sm bg-[#faf6ec]">
                            나이 {Math.floor(BASE_YEAR + (strategyTurn - 1) / 12) - (char.birthYear || 1980)}
                          </span>
                          <span className="px-2.5 py-1 border border-[#d4cab5] rounded-sm bg-[#faf6ec]">
                            수명 {char.lifespan} (+{char.lifespanBonus})
                          </span>
                        </div>
                      </div>
                   </div>

                   {/* Tabs: Elegant, thin, underlining */}
                   <div className="flex border-y border-[#d4cab5] bg-[#faf6ec] px-10">
                     <button 
                        onClick={() => setActiveTab('stats')} 
                        className={`py-3 px-6 text-[13px] font-bold tracking-widest transition-colors outline-none border-b-2 -mb-[1px] ${activeTab === 'stats' ? 'text-[#2b2013] border-[#2b2013]' : 'text-[#857b6b] border-transparent hover:text-[#554737]'}`}
                      >상세 스탯</button>
                     <button 
                        onClick={() => setActiveTab('skills')} 
                        className={`py-3 px-6 text-[13px] font-bold tracking-widest transition-colors outline-none border-b-2 -mb-[1px] ${activeTab === 'skills' ? 'text-[#2b2013] border-[#2b2013]' : 'text-[#857b6b] border-transparent hover:text-[#554737]'}`}
                      >보유 기술</button>
                     <button 
                        onClick={() => setActiveTab('traits')} 
                        className={`py-3 px-6 text-[13px] font-bold tracking-widest transition-colors outline-none border-b-2 -mb-[1px] ${activeTab === 'traits' ? 'text-[#2b2013] border-[#2b2013]' : 'text-[#857b6b] border-transparent hover:text-[#554737]'}`}
                      >고유 특성</button>
                     <button 
                        onClick={() => setActiveTab('info')} 
                        className={`py-3 px-6 text-[13px] font-bold tracking-widest transition-colors outline-none border-b-2 -mb-[1px] ${activeTab === 'info' ? 'text-[#2b2013] border-[#2b2013]' : 'text-[#857b6b] border-transparent hover:text-[#554737]'}`}
                      >인물 정보</button>
                   </div>

                   {/* Content Area */}
                   <div className="flex-1 overflow-y-auto custom-scrollbar">
                     
                     {/* STATS VIEW */}
                     {activeTab === 'stats' && (
                       <div className="flex flex-col lg:flex-row h-full">
                         {/* Radar */}
                         <div className="w-[380px] shrink-0 flex items-center justify-center p-8 lg:border-r border-[#d4cab5] bg-[#faf6ec]/50">
                           <HeroStatRadar 
                             stats={char.baseStats} 
                             color={hexColor} 
                             size={260} 
                             textColor="#2b2013" 
                             gridColor="rgba(43, 32, 19, 0.15)"
                           />
                         </div>

                         {/* Ledger Stats List */}
                         <div className="flex-1 flex flex-col p-10 gap-10 bg-[#f5f0e1]">
                           {STAT_CATEGORIES.map(category => (
                             <div key={category.title} className="flex flex-col">
                                <h3 className="text-[12px] tracking-[0.2em] text-[#554737] font-bold border-b border-[#2b2013] pb-1.5 mb-4">
                                  {category.title}
                                </h3>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
                                  {category.keys.map(key => {
                                    const info = STAT_DESCRIPTIONS[key];
                                    return (
                                      <div 
                                        key={key} 
                                        onMouseMove={(e) => handleMouseMove(e, key)}
                                        onMouseLeave={handleMouseLeave}
                                        className="flex items-center justify-between border-b border-[#d4cab5] pb-1 cursor-crosshair group"
                                      >
                                       <span className="text-[12px] font-semibold text-[#857b6b] group-hover:text-[#2b2013] transition-colors">{info.label}</span>
                                       <span className="text-[15px] font-bold font-serif text-[#2b2013] leading-none">{char.baseStats[key] ?? 0}</span>
                                     </div>
                                    );
                                  })}
                                </div>
                             </div>
                           ))}
                         </div>
                       </div>
                     )}

                     {/* SKILLS VIEW */}
                     {activeTab === 'skills' && (
                       <div className="p-10 flex flex-col gap-3">
                           {(!char.skills || char.skills.length === 0) ? (
                             <div className="text-[#857b6b] text-[14px] font-bold tracking-widest w-full text-center py-10">습득한 기술이 없습니다.</div>
                           ) : char.skills.map(s => {
                             const skillData = Object.values(MOCK_SKILLS).find(sk => sk.name === s);
                             return (
                               <div key={s} className="bg-[#faf6ec] border border-[#d4cab5] rounded-sm p-5 flex flex-col md:flex-row shadow-sm">
                                 <div className="md:w-1/4 flex flex-col gap-2 border-r border-[#d4cab5] pr-4">
                                    <span className="text-[#2b2013] font-bold text-[15px] font-serif tracking-wide">{s}</span>
                                    <div className="flex flex-wrap gap-1">
                                      {skillData ? (
                                        <>
                                         <span className="border border-[#d4cab5] text-[#554737] bg-[#f5f0e1] text-[10px] px-1.5 py-0.5 rounded-sm font-semibold">사거리 {skillData.range}</span>
                                         {skillData.cost.map((c, idx) => (
                                           <span key={idx} className="border border-[#2b2013] bg-[#2b2013] text-[#f5f0e1] text-[10px] px-1.5 py-0.5 rounded-sm font-semibold uppercase">
                                             {c.type} -{c.amount}
                                           </span>
                                         ))}
                                        </>
                                      ) : (
                                        <span className="border border-[#d4cab5] text-[#554737] bg-[#f5f0e1] text-[10px] px-1.5 py-0.5 rounded-sm font-semibold">전투 기술</span>
                                      )}
                                    </div>
                                 </div>
                                 <div className="md:w-3/4 md:pl-6 pt-3 md:pt-0 flex items-center">
                                   <p className="text-[#2b2013] text-[13px] leading-relaxed break-keep">
                                     {skillData?.description ? parseDetailedString(skillData.description) : '상세 정보가 서술되지 않았습니다.'}
                                   </p>
                                 </div>
                               </div>
                             );
                           })}
                       </div>
                     )}

                     {/* TRAITS VIEW */}
                     {activeTab === 'traits' && (
                       <div className="p-10 flex flex-col gap-3">
                           {(!char.traits || char.traits.length === 0) ? (
                             <div className="text-[#857b6b] text-[14px] font-bold tracking-widest w-full text-center py-10">발현된 특성이 없습니다.</div>
                           ) : char.traits.map(t => (
                             <div key={t.id} className="bg-[#faf6ec] border border-[#d4cab5] rounded-sm p-5 flex flex-col md:flex-row shadow-sm">
                               <div className="md:w-1/4 flex flex-col gap-2 border-r border-[#d4cab5] pr-4">
                                 <span className="text-[#4a3952] font-bold text-[15px] font-serif tracking-wide">{t.name}</span>
                                 <div><span className="border border-[#d4cab5] text-[#554737] bg-[#f5f0e1] text-[10px] px-1.5 py-0.5 rounded-sm font-semibold">고유 특성</span></div>
                               </div>
                               <div className="md:w-3/4 md:pl-6 pt-3 md:pt-0 flex items-center">
                                 <p className="text-[#2b2013] text-[13px] leading-relaxed break-keep">
                                   {t.description}
                                 </p>
                               </div>
                             </div>
                           ))}
                       </div>
                     )}

                     {/* INFO VIEW */}
                     {activeTab === 'info' && (
                       <div className="p-10 flex flex-col gap-10">
                           {/* Biography */}
                           <div>
                             <h3 className="text-[12px] tracking-[0.2em] text-[#554737] font-bold border-b border-[#2b2013] pb-1.5 mb-4">
                               기록 및 열전
                             </h3>
                             <p className="text-[13px] text-[#2b2013] leading-[2] break-keep bg-[#faf6ec] p-6 rounded-sm border border-[#d4cab5] shadow-sm">
                               {char.description || "당대에 알려진 뚜렷한 행적이 기록되지 않았습니다."}
                             </p>
                           </div>
                           
                           {/* Relationships */}
                           <div>
                             <h3 className="text-[12px] tracking-[0.2em] text-[#554737] font-bold border-b border-[#2b2013] pb-1.5 mb-4">
                               대인 관계
                             </h3>
                             <div className="bg-[#faf6ec] p-6 border border-[#d4cab5] rounded-sm shadow-sm flex items-center">
                               {char.relationships && Object.keys(char.relationships).length > 0 ? (
                                  <div className="flex flex-col">
                                    <span className="text-[#2b2013] font-bold text-[13px] mb-1">
                                      기록된 연관 인물: <strong className="text-[16px] font-serif ml-1">{Object.keys(char.relationships).length}</strong> 명
                                    </span>
                                    <div className="text-[11px] text-[#857b6b] font-medium">인관 관계도는 별도의 연대기 화면에서 다루어집니다.</div>
                                  </div>
                               ) : (
                                 <span className="text-[#857b6b] font-bold text-[13px] w-full block text-center py-2 tracking-widest">기록된 연관 인물이 없습니다.</span>
                               )}
                             </div>
                           </div>
                       </div>
                     )}

                   </div>
                 </div>
               );
            })() : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border border-[#d4cab5] rounded-full flex items-center justify-center"></div>
                <p className="text-[#857b6b] font-semibold text-[13px] tracking-widest">열람할 인물을 선택하십시오</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Scope Tooltip Parchment Theme - Clean & Elegant */}
      {tooltipState.visible && tooltipState.key && (
        <div 
          className="fixed z-[1000] bg-[#f5f0e1] border border-[#2b2013] p-4 w-[260px] pointer-events-none transform -translate-x-1/2 -translate-y-[110%] transition-opacity duration-150 shadow-lg rounded-sm"
          style={{ left: tooltipState.x, top: tooltipState.y }}
        >
           <h4 className="text-[13px] font-bold text-[#2b2013] border-b border-[#d4cab5] pb-2 mb-2 tracking-widest font-serif">
             {STAT_DESCRIPTIONS[tooltipState.key].label}
           </h4>
           <p className="text-[12px] text-[#554737] leading-[1.6] break-keep font-medium">
             {STAT_DESCRIPTIONS[tooltipState.key].desc}
           </p>
           {/* Triangle Pointer */}
           <div className="absolute left-1/2 -translate-x-1/2 -bottom-[5px] w-0 h-0 border-l-[5px] border-l-transparent border-t-[5px] border-t-[#2b2013] border-r-[5px] border-r-transparent"></div>
           <div className="absolute left-1/2 -translate-x-1/2 -bottom-[4px] w-0 h-0 border-l-[5px] border-l-transparent border-t-[5px] border-t-[#f5f0e1] border-r-[5px] border-r-transparent"></div>
        </div>
      )}
    </div>
  );
}
