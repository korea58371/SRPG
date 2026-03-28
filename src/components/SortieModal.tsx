import { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { PLAYER_FACTION } from '../constants/gameConfig';

export default function SortieModal() {
  const pendingDeployment = useAppStore(s => s.pendingDeployment);
  const cancelDeployment = useAppStore(s => s.cancelDeployment);
  const confirmDeployment = useAppStore(s => s.confirmDeployment);
  const characters = useAppStore(s => s.characters);
  const provinces = useAppStore(s => s.provinces);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  useEffect(() => {
    // 모달이 열릴 때 선택 초기화
    if (pendingDeployment) {
      setSelectedIds([]);
    }
  }, [pendingDeployment]);

  if (!pendingDeployment) return null;

  const attacker = provinces[pendingDeployment.attackerProvinceId];
  const defender = provinces[pendingDeployment.defenderProvinceId];

  // 해당 영지에 있는 아군 영웅들
  const availableHeroes = Object.values(characters).filter(c => 
    c.factionId === PLAYER_FACTION &&
    c.state === 'Factioned' &&
    c.locationProvinceId === attacker.id
  );

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
    // 출격 확정 (AP 소모 및 전투 진입은 store에서 처리)
    confirmDeployment(selectedIds);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 20
    }}>
      <div style={{
        background: '#1e293b', width: 600, maxWidth: '100%',
        borderRadius: 12, border: '1px solid #334155',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        animation: 'fadeSlideIn 0.2s ease',
        overflow: 'hidden'
      }}>
        {/* 헤더 */}
        <div style={{
          padding: '16px 24px', background: 'linear-gradient(to right, #3f2b4f, #1e293b)',
          borderBottom: '1px solid #334155', position: 'relative'
        }}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#f8fafc', fontWeight: 700 }}>⚔️ 출격 준비</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
            {attacker.name} ➡️ {defender.name} 침공
          </p>
          <button onClick={cancelDeployment} style={{
            position: 'absolute', top: 16, right: 20,
            background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer'
          }}>✕</button>
        </div>

        {/* 바디: 부대 선택 */}
        <div style={{ padding: 24, flex: 1, overflowY: 'auto', maxHeight: '60vh' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>출전 가능한 영웅 (최대 5명)</span>
            <span style={{ color: selectedIds.length > 0 ? '#4ade80' : '#f87171', fontSize: 14, fontWeight: 600 }}>
              선택됨: {selectedIds.length} / 5
            </span>
          </div>

          {availableHeroes.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 0', background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
              이 영지에 배속된 아군 영웅이 없습니다.<br/>
              (영웅 없이 일반 부대만으로 전투를 진행할 수 있습니다)
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {availableHeroes.map(char => {
                const isSelected = selectedIds.includes(char.id);
                const typeLabel = char.troopType === 'CAVALRY' ? '기병 🐎' :
                                  char.troopType === 'ARCHER' ? '궁병 🏹' :
                                  char.troopType === 'SPEARMAN' ? '창병 🔱' : '보병 🗡️';

                return (
                  <div key={char.id} onClick={() => toggleSelection(char.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: 12, borderRadius: 8, cursor: 'pointer',
                    background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.03)',
                    border: isSelected ? '1px solid #6366f1' : '1px solid #334155',
                    transition: 'all 0.2s',
                  }}>
                    {/* 체크박스/순서표시 */}
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: isSelected ? '#6366f1' : '#334155',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 12, fontWeight: 700
                    }}>
                      {isSelected ? '✓' : ''}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: 15 }}>{char.name}</div>
                      <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{typeLabel}</span>
                        <span style={{ color: '#e2e8f0' }}>병력: {char.troopCount ?? 0}</span>
                      </div>
                      {/* 스탯 바 요약 */}
                      <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 11 }}>
                        <span style={{ color: '#ef4444' }}>무 {char.baseStats.strength}</span>
                        <span style={{ color: '#3b82f6' }}>지 {char.baseStats.intelligence}</span>
                        <span style={{ color: '#eab308' }}>통 {char.baseStats.charisma}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #334155',
          display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'rgba(0,0,0,0.2)'
        }}>
          <button
            onClick={cancelDeployment}
            style={{
              padding: '10px 20px', borderRadius: 6, border: 'none',
              background: '#334155', color: '#cbd5e1', fontWeight: 600, cursor: 'pointer', flex: 1
            }}
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            style={{
              padding: '10px 20px', borderRadius: 6, border: 'none',
              background: '#ef4444', color: '#fff', fontWeight: 600, cursor: 'pointer', flex: 1,
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
            }}
          >
            출격 확정 (AP 2 소모)
          </button>
        </div>
      </div>
    </div>
  );
}
