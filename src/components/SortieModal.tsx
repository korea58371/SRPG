import { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { PLAYER_FACTION, FACTIONS, BASE_STATS } from '../constants/gameConfig';

export default function SortieModal() {
  const pendingDeployment = useAppStore(s => s.pendingDeployment);
  const cancelDeployment = useAppStore(s => s.cancelDeployment);
  const confirmDeployment = useAppStore(s => s.confirmDeployment);
  const quickRecruit = useAppStore(s => s.quickRecruit);
  const characters = useAppStore(s => s.characters);
  const provinces = useAppStore(s => s.provinces);
  const factionResources = useAppStore(s => s.factionResources);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  useEffect(() => {
    // 모달이 열릴 때 가용 영웅 중 최대 5명 자동 선택
    if (pendingDeployment) {
      const attackerProv = provinces[pendingDeployment.attackerProvinceId];
      if (attackerProv) {
        const available = Object.values(characters).filter(c => 
          c.factionId === PLAYER_FACTION &&
          c.state === 'Factioned' &&
          c.locationProvinceId === attackerProv.id
        );
        const initialIds = available.slice(0, 5).map(h => h.id);
        setSelectedIds(initialIds);
      }
    }
  }, [pendingDeployment, characters, provinces]);

  if (!pendingDeployment) return null;

  const attacker = provinces[pendingDeployment.attackerProvinceId];
  const defender = provinces[pendingDeployment.defenderProvinceId];

  // 해당 영지에 있는 아군 영웅들
  const availableHeroes = Object.values(characters).filter(c => 
    c.factionId === PLAYER_FACTION &&
    c.state === 'Factioned' &&
    c.locationProvinceId === attacker.id
  );

  // 대상 영지에 수비 중인 적군 영웅들
  const enemyHeroes = Object.values(characters).filter(c =>
    c.factionId === defender.owner &&
    c.state === 'Factioned' &&
    c.locationProvinceId === defender.id
  );

  // 대상 영지의 정규 수비군 10부대 (UI 시각화용)
  // 실제 전투(gameStateSlice)에서는 랜덤 생성되나, 출격 전에는 대략적인 구성(보/창/기/궁)을 보여줌
  const genericGarrison = Array.from({ length: 10 }).map((_, i) => {
    const type = i < 3 ? 'INFANTRY' : i < 6 ? 'SPEARMAN' : i < 8 ? 'CAVALRY' : 'ARCHER';
    return {
      id: `garrison_${i}`,
      name: `정규 수비군`,
      troopType: type,
      troopCount: BASE_STATS[type].hp, // 전투 모듈과 동일 기준
      baseStats: { power: 0, toughness: 0, constitution: 0, agility: 0, command: 0, leadership: 0, intelligence: 0, politics: 0, charm: 0 },
      isGeneric: true
    };
  });

  const toggleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(x => x !== id));
    } else {
      if (selectedIds.length >= 5) {
        alert('최대 5명의 영웅만 출격할 수 있습니다.');
        return;
      }
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const handleConfirm = () => {
    if (selectedIds.length === 0) {
      alert('최소 1명 이상의 영웅을 배속하여 출격해야 합니다.');
      return;
    }
    // 출격 확정 (AP 소모 및 전투 진입은 store에서 처리)
    confirmDeployment(selectedIds);
  };

  const attackerFaction = FACTIONS[PLAYER_FACTION];
  const defenderFaction = FACTIONS[defender.owner] || { name: '중립/도적군', color: 0x94a3b8 };

  const getHexColor = (num: number) => `#${num.toString(16).padStart(6, '0')}`;
  const attackerColor = getHexColor(attackerFaction.color);
  const defenderColor = getHexColor(defenderFaction.color);

  const getTroopIcon = (type: string | null) => {
    if (type === 'CAVALRY') return '🐎 기병';
    if (type === 'ARCHER') return '🏹 궁병';
    if (type === 'SPEARMAN') return '🔱 창병';
    if (type === 'INFANTRY') return '🗡️ 보병';
    return '👑 지휘관';
  };

  const renderCombatPower = (char: any) => {
    const type = char.troopType ?? 'GENERAL';
    const st = BASE_STATS[type] || BASE_STATS.INFANTRY;
    
    // 전투 엔진과 동일한 산식 적용
    const isHero = char.id.startsWith('char_');
    const isGeneric = char.isGeneric;
    
    // 일반군(isGeneric)은 무/지 보정 없이 기본 스탯 사용
    const hp = isGeneric ? st.hp : Math.floor((char.troopCount ?? st.hp) * 1.5);
    const atk = isGeneric ? st.attack : Math.floor(st.attack * (isHero ? 1.5 : 1) * (1 + (char.baseStats?.strength || 0) / 40));
    const def = isGeneric ? st.defense : Math.floor(st.defense * (1 + (char.baseStats?.intelligence || 0) / 40));

    return (
      <div className="flex gap-4 mt-2 text-[11px] font-mono text-slate-400 bg-black/20 p-1.5 rounded border border-slate-700/50">
        <span className="flex items-center gap-1" title="실제 부대 체력">
          ❤️ <span className="text-pink-400 font-bold">{hp}</span>
        </span>
        <span className="flex items-center gap-1" title="실제 부대 공격력">
          ⚔️ <span className="text-orange-400 font-bold">{atk}</span>
        </span>
        <span className="flex items-center gap-1" title="실제 부대 방어력">
          🛡️ <span className="text-blue-400 font-bold">{def}</span>
        </span>
      </div>
    );
  };

  const currentGold = factionResources[PLAYER_FACTION]?.gold || 0;

  // 병력 합계 계산
  const getTroopTotal = (charList: any[]) => charList.reduce((sum, c) => {
    const st = BASE_STATS[c.troopType || 'GENERAL'] || BASE_STATS.INFANTRY;
    return sum + (c.troopCount ?? st.hp);
  }, 0);

  const selectedHeroesList = selectedIds.map(id => characters[id]).filter(Boolean);
  const attackerTotalTroops = getTroopTotal(selectedHeroesList);
  const defenderTotalTroops = getTroopTotal(enemyHeroes) + getTroopTotal(genericGarrison);

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[9999] p-6 backdrop-blur-sm pointer-events-auto">
      <div 
        className="w-[1100px] max-w-full h-[750px] bg-slate-900 border border-slate-700 rounded-xl flex flex-col overflow-hidden"
        style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.6)', animation: 'fadeSlideIn 0.2s ease' }}
      >
        {/* 헤더 */}
        <div 
          className="relative px-6 py-4 border-b border-slate-700 flex justify-between items-center shrink-0"
          style={{
            background: `linear-gradient(to right, ${attackerColor}40, #0f172a 50%, ${defenderColor}40)`
          }}
        >
          <div>
            <h2 className="text-2xl font-bold font-title text-slate-100 drop-shadow">⚔️ 출격 작전 지휘소</h2>
            <p className="text-sm text-slate-400 mt-1 font-mono">
              <span className="font-bold" style={{color: attackerColor}}>{attacker.name}</span> 병력을 이끌고 <span className="font-bold" style={{color: defenderColor}}>{defender.name}</span>(으)로 진군합니다.
            </p>
          </div>
          <button 
            onClick={cancelDeployment} 
            className="text-slate-500 hover:text-white transition-colors text-3xl font-light w-10 h-10 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* 본문 (VS 분할 구도) */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* 아군 측 (왼쪽) */}
          <div className="flex-1 flex flex-col bg-gradient-to-br from-slate-900 to-slate-800/50 p-6 relative">
            <div className="flex justify-between items-end mb-4 border-b border-slate-700 pb-2 shrink-0">
              <div>
                <div className="text-xs font-bold text-slate-500 mb-1 tracking-widest flex items-center gap-2">
                  <span>ATTACKER</span>
                  <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] shadow-inner">보유 자금: {currentGold}G</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <h3 className="text-xl font-bold" style={{color: attackerColor}}>{attackerFaction.name}</h3>
                  <span className="text-sm font-bold text-white bg-slate-800/80 px-2.5 py-0.5 rounded border border-slate-700">
                    총 병력: <span className="text-emerald-400">{attackerTotalTroops.toLocaleString()}</span>명
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-slate-300">출전 가능한 영웅</div>
                <div className={`text-sm font-bold ${selectedIds.length > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  선택됨: {selectedIds.length} / 5
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
              {availableHeroes.length === 0 ? (
                <div className="text-center py-10 bg-black/20 rounded-lg border border-slate-800 text-slate-500 font-bold">
                  이 영지에 배속된 아군 영웅이 없어 출격할 수 없습니다.<br/>
                  <span className="text-xs font-normal mt-2 block opacity-70">(내정 메뉴의 '영웅 이동'을 통해 전선으로 영웅을 배치하세요)</span>
                </div>
              ) : (
                availableHeroes.map(char => {
                  const isSelected = selectedIds.includes(char.id);
                  return (
                    <div 
                      key={char.id} 
                      onClick={() => toggleSelection(char.id)}
                      className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-all border ${
                        isSelected 
                          ? 'bg-blue-900/30 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
                          : 'bg-white/5 border-slate-700 hover:bg-white/10'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isSelected ? 'bg-blue-500 text-white' : 'bg-slate-700 text-transparent'
                      }`}>
                        ✓
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-100 font-bold text-base">{char.name}</span>
                          <span className="text-xs text-blue-300 bg-blue-900/40 px-2 py-0.5 rounded border border-blue-800/50">
                            {getTroopIcon(char.troopType)} {char.troopCount}명
                          </span>
                        </div>
                        {renderCombatPower(char)}
                      </div>
                      
                      {/* 긴급 모병 버튼 */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); quickRecruit(char.id); }}
                        className="ml-2 px-3 py-1.5 rounded bg-amber-900/40 hover:bg-amber-600/50 border border-amber-600/50 text-amber-200 text-[11px] font-bold transition-colors shrink-0 flex flex-col items-center"
                        title="50G를 소모하여 바로 100명의 병력을 징집합니다."
                      >
                        <span>➕ 모병</span>
                        <span className="text-[9px] text-amber-500/80">(50G)</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 중앙 VS 디바이더 */}
          <div className="w-16 shrink-0 bg-slate-900 border-x border-slate-800 flex flex-col items-center justify-center relative shadow-inner z-10">
            <div className="absolute top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-blue-500 to-transparent opacity-40 -ml-2"></div>
            <div className="absolute top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-red-500 to-transparent opacity-40 ml-2"></div>
            
            <div className="w-14 h-14 rounded-full bg-slate-950 border-2 border-slate-700 flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.8)] relative z-20">
              <span className="font-title text-xl font-black italic text-transparent bg-clip-text bg-gradient-to-br from-slate-200 to-slate-600">
                VS
              </span>
            </div>
          </div>

          {/* 적군 측 (오른쪽) */}
          <div className="flex-1 flex flex-col bg-gradient-to-bl from-slate-900 to-slate-800/50 p-6 relative">
            <div className="flex justify-between items-end mb-4 border-b border-slate-700 pb-2 shrink-0">
              <div>
                <div className="text-xs font-bold text-slate-500 mb-1 tracking-widest">DEFENDER</div>
                <div className="flex items-baseline gap-3">
                  <h3 className="text-xl font-bold" style={{color: defenderColor}}>{defenderFaction.name}</h3>
                  <span className="text-sm font-bold text-white bg-slate-800/80 px-2.5 py-0.5 rounded border border-slate-700">
                    총 병력: <span className="text-orange-400">{defenderTotalTroops.toLocaleString()}</span>명
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-slate-300">수비 거점 정보</div>
                <div className="text-sm font-bold text-slate-400">
                  <span className="text-xs mr-1 text-slate-500">방어도</span>
                  <span className={`${defender.security > 70 ? 'text-emerald-400' : 'text-orange-400'}`}>
                    {defender.security}
                  </span>
                  <span className="text-slate-500 text-xs">/100</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
              {/* 거점 기본 수비군 (전투엔진 하드코딩 반영) */}
              <div className="bg-red-950/20 border border-red-900/30 p-4 rounded-lg flex items-center gap-4">
                <div className="text-3xl filter drop-shadow opacity-90">🛡️</div>
                <div>
                  <div className="text-red-400 font-bold text-sm">거점 정규 수비군 대기 중</div>
                  <div className="text-xs text-slate-400 mt-1 leading-relaxed">
                    이 거점에는 전투 시 약 10부대 규모의 기본 수비군 로스터가 스폰되어 맹렬히 방어합니다.
                  </div>
                </div>
              </div>

              {/* 영지 내 배치된 적장 목록 */}
              {enemyHeroes.length > 0 && (
                <div className="mt-4 mb-2 text-sm font-bold text-slate-400 border-b border-slate-800 pb-1 flex justify-between items-center">
                  <span>감지된 네임드 지휘관 (영웅)</span>
                  <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">{enemyHeroes.length}명</span>
                </div>
              )}
              
              {enemyHeroes.map(char => (
                <div key={char.id} className="flex items-center gap-4 p-3 rounded-lg bg-orange-900/10 border border-orange-500/30 opacity-100 shadow-[0_0_15px_rgba(234,88,12,0.1)]">
                  <div className="w-10 h-10 rounded-full shrink-0 bg-slate-800 border-2 flex items-center justify-center font-bold relative overflow-hidden text-lg" style={{ borderColor: defenderColor, color: defenderColor }}>
                    {char.name.charAt(0)}
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent"></div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="text-orange-200 font-bold text-base">{char.name}</span>
                      <span className="text-xs text-red-300 bg-red-900/40 px-2 py-0.5 rounded border border-red-800/50">
                        {getTroopIcon(char.troopType)} {char.troopCount}명
                      </span>
                    </div>
                    {renderCombatPower(char)}
                  </div>
                </div>
              ))}

              {/* 거점 기본 수비군 10부대 목록 */}
              <div className="mt-6 mb-2 text-sm font-bold text-slate-400 border-b border-slate-800 pb-1 flex justify-between items-center">
                <span>거점 정규 방어군</span>
                <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">10부대</span>
              </div>

              {genericGarrison.map((char, idx) => (
                <div key={char.id} className="flex items-center gap-4 p-2.5 rounded-lg bg-white/5 border border-slate-700/50 opacity-80">
                  <div className="w-8 h-8 rounded shrink-0 bg-slate-800 border border-slate-600 flex items-center justify-center text-xs opacity-50" style={{ color: defenderColor }}>
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300 font-bold text-sm">{char.name}</span>
                      <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        {getTroopIcon(char.troopType)} {char.troopCount}명
                      </span>
                    </div>
                    {renderCombatPower(char)}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* 푸터 (액션 영역) */}
        <div className="px-6 py-4 border-t border-slate-700 bg-black/40 flex justify-end gap-3 backdrop-blur-md shrink-0">
          <button
            onClick={cancelDeployment}
            className="px-6 py-2 rounded-lg font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-600"
          >
            부대 해산 (취소)
          </button>
          
          {selectedIds.length === 0 ? (
            <div className="px-8 py-2 rounded-lg font-bold text-slate-500 bg-slate-800 border border-slate-700 flex items-center cursor-not-allowed">
              영웅을 선택하세요
            </div>
          ) : (
            <button
              onClick={handleConfirm}
              className="px-8 py-2 rounded-lg font-bold text-white bg-red-600 hover:bg-red-500 transition-all border border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
            >
              진군 개시 (AP 2 소모)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
