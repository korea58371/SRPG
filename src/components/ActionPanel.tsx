// J:/AI/Game/SRPG/src/components/ActionPanel.tsx
// 전국란스 스타일 우측 고정 행동 패널
// 탭 5개 (추천/인재/군사/내정/외교) + 행동 리스트

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppStore }  from '../store/appStore';
import { useGameStore } from '../store/gameStore';
import { buildActionItems, ACTION_TABS } from '../data/strategyActions';
import { ALL_DIALOGUE_EVENTS } from '../data/dialogueEvents';
import { PLAYER_FACTION } from '../constants/gameConfig';
import type { ActionTab, StrategyActionItem } from '../types/appTypes';
import type { DomesticMenuType } from './DomesticModal';

// ─── AP 코인 아이콘 컴포넌트 ─────────────────────────────────────────────────
const APCoin: React.FC<{ count: number; dim?: boolean }> = ({ count, dim }) => {
  if (count === 0) return null;
  return (
    <div style={apCoinWrapStyle}>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} style={{ ...apCoinStyle, opacity: dim ? 0.35 : 1 }}>⬡</span>
      ))}
    </div>
  );
};

// ─── 행동 아이템 행 ──────────────────────────────────────────────────────────
const ActionRow: React.FC<{ item: StrategyActionItem; remainingAP: number }> = ({ item, remainingAP }) => {
  const [hovered, setHovered] = useState(false);
  const canExecute = item.isAvailable && remainingAP >= item.cost;

  const handleClick = () => {
    if (!canExecute) return;
    item.onExecute();
  };

  return (
    <button
      style={{
        ...actionRowStyle,
        background: hovered && canExecute
          ? item.danger
            ? 'rgba(239,68,68,0.15)'
            : 'rgba(255,255,255,0.07)'
          : 'transparent',
        opacity: canExecute ? 1 : 0.42,
        cursor: canExecute ? 'pointer' : 'not-allowed',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
    >
      {/* 아이콘 */}
      <span style={actionIconStyle}>{item.icon}</span>

      {/* 텍스트 영역 */}
      <div style={actionTextAreaStyle}>
        <span style={{
          ...actionLabelStyle,
          color: item.danger
            ? (canExecute ? '#fca5a5' : '#6b7280')
            : (canExecute ? '#f0e8d8' : '#6b7280'),
        }}>
          {item.label}
        </span>
        {item.subLabel && (
          <span style={actionSubLabelStyle}>{item.subLabel}</span>
        )}
      </div>

      {/* AP 코인 */}
      <APCoin count={item.cost} dim={!canExecute} />
    </button>
  );
};

// ─── 메인 ActionPanel ────────────────────────────────────────────────────────
interface ActionPanelProps {
  onOpenDomesticModal: (menu: DomesticMenuType) => void;
}

const ActionPanel: React.FC<ActionPanelProps> = ({ onOpenDomesticModal }) => {
  const selectedProvinceId = useAppStore(s => s.selectedProvinceId);
  const allProvinces       = useAppStore(s => s.provinces);
  const characters         = useAppStore(s => s.characters);
  const remainingAP        = useAppStore(s => s.remainingAP);
  const declareWar         = useAppStore(s => s.declareWar);
  const executeDomestic    = useAppStore(s => s.executeDomestic);
  const recruitCharacter   = useAppStore(s => s.recruitCharacter);
  const consumeAP          = useAppStore(s => s.consumeAP);

  const [activeTab, setActiveTab] = useState<ActionTab>('recommend');
  const [toastMsg, setToastMsg] = useState<{ name: string; icon: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerDialogue = useGameStore(s => s.triggerDialogue);
  const playedEventIds  = useGameStore(s => s.playedEventIds);

  // 토스트 자동 해제
  useEffect(() => {
    if (toastMsg) {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToastMsg(null), 3000);
    }
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, [toastMsg]);

  const selectedProvince = selectedProvinceId ? allProvinces[selectedProvinceId] : null;

  // 선택 영지 바뀌면 추천 탭으로 초기화
  React.useEffect(() => {
    setActiveTab('recommend');
  }, [selectedProvinceId]);

  // 행동 리스트 생성
  // NOTE: consumeAP, recruitCharacter 등 store 함수를 deps에 포함해야 stale closure 방지
  const allItems = useMemo(() => buildActionItems({
    selectedProvince,
    allProvinces,
    characters,
    playerFactionId: PLAYER_FACTION,
    remainingAP,
    onDeclareWar: (attackerId, defenderId) => {
      declareWar(attackerId, defenderId);
    },
    onExecuteDomestic: (provinceId) => {
      if (consumeAP(1)) executeDomestic(provinceId);
    },
    onRecruitCharacter: (charId) => {
      // 수도 우선, 없으면 첫 번째 플레이어 영지
      const playerProvs = Object.values(allProvinces).filter(p => p.owner === PLAYER_FACTION);
      const targetProv = playerProvs.find(p => p.isCapital) ?? playerProvs[0];
      if (!targetProv) return;
      if (consumeAP(1)) {
        recruitCharacter(charId, PLAYER_FACTION, targetProv.id);
        // 등용 성공 후 이벤트 트리거
        const charData = characters[charId];
        const recruitEvent = ALL_DIALOGUE_EVENTS.find(ev =>
          ev.context === 'RECRUITMENT' &&
          ev.trigger.condition &&
          // IS_CHARACTER 조건 포함 여부 간이 체크 (once && played 체크)
          !playedEventIds.has(ev.id) &&
          // 케어풀하게: 이벤트 id에 charId가 포함된 것을 우선 매핑
          ev.id.startsWith(charId)
        );
        if (recruitEvent) {
          triggerDialogue(recruitEvent);
        } else {
          // 대화 이벤트 없는 캐릭터: 토스트로 피드백
          setToastMsg({
            name: charData?.name ?? charId,
            icon: charData?.troopType === 'CAVALRY' ? '🐴'
                : charData?.troopType === 'ARCHER'  ? '🏹'
                : charData?.troopType === 'GENERAL' ? '👑'
                : '⚔️',
          });
        }
      }
    },
    onOpenDomesticModal: (menu) => {
      onOpenDomesticModal(menu as DomesticMenuType);
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [selectedProvince, allProvinces, characters, remainingAP,
        consumeAP, declareWar, executeDomestic, recruitCharacter, onOpenDomesticModal,
        triggerDialogue, playedEventIds]);

  const tabItems = allItems.filter(i => i.tab === activeTab);

  // 탭별 배지 수 (가용 행동 수)
  const tabCounts = useMemo(() => {
    const counts: Partial<Record<ActionTab, number>> = {};
    ACTION_TABS.forEach(t => {
      counts[t.id] = allItems.filter(i => i.tab === t.id && i.isAvailable).length;
    });
    return counts;
  }, [allItems]);

  return (
    <div style={panelStyle} onClick={e => e.stopPropagation()}>
      {/* ── 탭 헤더 ── */}

      {/* ── 합류 토스트 알림 ── */}
      {toastMsg && (
        <div style={{
          position: 'absolute',
          top: 52, left: 8, right: 8,
          background: 'linear-gradient(135deg, rgba(16,36,20,0.97), rgba(20,50,25,0.97))',
          border: '1px solid rgba(134,239,172,0.35)',
          borderRadius: 6,
          padding: '10px 14px',
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          animation: 'fadeSlideIn 0.25s ease',
        }}>
          <span style={{ fontSize: 20 }}>{toastMsg.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#86efac', fontFamily: "'Noto Sans KR', sans-serif" }}>
              {toastMsg.name}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              아군에 합류했습니다.
            </div>
          </div>
          <button
            onClick={() => setToastMsg(null)}
            style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
          >✕</button>
        </div>
      )}

      <div style={tabRowStyle}>
        {ACTION_TABS.map(tab => {
          const count = tabCounts[tab.id] ?? 0;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              style={{
                ...tabBtnStyle,
                background: isActive
                  ? 'rgba(255,255,255,0.12)'
                  : 'transparent',
                borderBottom: isActive
                  ? '2px solid #c4b5fd'
                  : '2px solid transparent',
                color: isActive ? '#e0e7ff' : '#94a3b8',
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {count > 0 && (
                <span style={{
                  ...tabBadgeStyle,
                  background: isActive ? '#7c3aed' : '#374151',
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── 선택 영지 정보 헤더 ── */}
      {selectedProvince ? (
        <div style={provinceHeaderStyle}>
          {/* 이전 영지 (단순 인덱스 기반 순회, 또는 인접 영석 기반) */}
          <button 
            style={navArrowStyle}
            onClick={(e) => {
              e.stopPropagation();
              const allIds = Object.keys(allProvinces);
              const currentIndex = allIds.indexOf(selectedProvince.id);
              const prevIndex = (currentIndex - 1 + allIds.length) % allIds.length;
              useAppStore.getState().selectProvince(allIds[prevIndex]);
            }}
          >
             ◀ 
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' }}>
            <span style={provinceCapIconStyle}>
              {selectedProvince.isCapital ? '👑' : '🏰'}
            </span>
            <div style={{ textAlign: 'center' }}>
              <div style={provinceNameStyle}>{selectedProvince.name}</div>
              <div style={provinceOwnerStyle}>
                {selectedProvince.owner === PLAYER_FACTION
                  ? '아군 영토'
                  : `적 세력`}
              </div>
            </div>
          </div>

          <button 
            style={navArrowStyle}
            onClick={(e) => {
              e.stopPropagation();
              const allIds = Object.keys(allProvinces);
              const currentIndex = allIds.indexOf(selectedProvince.id);
              const nextIndex = (currentIndex + 1) % allIds.length;
              useAppStore.getState().selectProvince(allIds[nextIndex]);
            }}
          >
             ▶ 
          </button>
        </div>
      ) : (
        <div style={noSelectStyle}>
          <span style={{ fontSize: 18, opacity: 0.4 }}>🗺</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
            영지를 선택하세요
          </span>
        </div>
      )}

      {/* ── 행동 리스트 ── */}
      <div style={actionListStyle}>
        {tabItems.length === 0 ? (
          <div style={emptyStyle}>
            {activeTab === 'recommend'
              ? '현재 추천 행동이 없습니다'
              : `${ACTION_TABS.find(t => t.id === activeTab)?.label ?? '이 탭의'} 행동이 없습니다`}
          </div>
        ) : (
          tabItems.map(item => (
            <ActionRow key={item.id} item={item} remainingAP={remainingAP} />
          ))
        )}
      </div>
    </div>
  );
};

// ─── 스타일 ──────────────────────────────────────────────────────────────────
const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  width: 300,
  height: '100%',
  background: 'rgba(8,9,24,0.93)',
  borderLeft: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 20,
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  pointerEvents: 'auto',
};

const tabRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
  borderBottom: '1px solid rgba(255,255,255,0.07)',
  flexShrink: 0,
};

const tabBtnStyle: React.CSSProperties = {
  position: 'relative',
  padding: '10px 0 8px',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: "'Noto Sans KR', sans-serif",
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.15s',
  letterSpacing: '0.02em',
};

const tabBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  top: 4,
  right: 2,
  minWidth: 14,
  height: 14,
  borderRadius: 7,
  fontSize: 9,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#e0e7ff',
  padding: '0 3px',
};

const provinceHeaderStyle: React.CSSProperties = {
  padding: '10px 12px 8px',
  borderBottom: '1px solid rgba(255,255,255,0.07)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexShrink: 0,
};

const provinceCapIconStyle: React.CSSProperties = {
  fontSize: 16,
  lineHeight: 1,
};

const provinceNameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: '#f0e8d8',
  fontFamily: "'Noto Sans KR', sans-serif",
};

const provinceOwnerStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'rgba(255,255,255,0.4)',
  marginTop: 1,
};


const navArrowStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'rgba(255,255,255,0.4)',
  fontSize: 18,
  cursor: 'pointer',
  padding: '4px 8px',
  transition: 'color 0.2s',
};

// :hover 처리는 inline style로 완벽히 할 수 없어 간단히 구현.
// 원한다면 CSS 클래스나 onMouseEnter 등을 쓸 수 있음.

const noSelectStyle: React.CSSProperties = {
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  borderBottom: '1px solid rgba(255,255,255,0.07)',
  flexShrink: 0,
};

const actionListStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
};

const actionRowStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '9px 12px',
  textAlign: 'left',
  border: 'none',
  transition: 'background 0.1s',
};

const actionIconStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1,
  flexShrink: 0,
  width: 20,
  textAlign: 'center',
};

const actionTextAreaStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
};

const actionLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "'Noto Sans KR', sans-serif",
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  lineHeight: 1.3,
};

const actionSubLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'rgba(255,255,255,0.35)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const apCoinWrapStyle: React.CSSProperties = {
  display: 'flex',
  gap: 2,
  flexShrink: 0,
};

const apCoinStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#fbbf24',
  lineHeight: 1,
};

const emptyStyle: React.CSSProperties = {
  padding: '24px 16px',
  textAlign: 'center',
  color: 'rgba(255,255,255,0.25)',
  fontSize: 12,
  fontFamily: "'Noto Sans KR', sans-serif",
};

export default ActionPanel;
