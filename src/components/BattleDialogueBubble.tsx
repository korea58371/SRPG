// J:/AI/Game/SRPG/src/components/BattleDialogueBubble.tsx
// 전투 전용 말풍선 - FFT(파이널 판타지 택틱스) 스타일 리디자인
// - 포트레이트 왼쪽 크게 배치 + 반투명 다크 배경
// - 감정별 보더 글로우 + 슬라이드인 애니메이션
// - 화면 경계 자동 clamp (말풍선이 화면 밖으로 나가지 않음)
// - Space / Enter 키보드 진행 지원

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { useAppStore } from '../store/appStore';
import type { DialogueEmotion } from '../types/dialogueTypes';
import { getCharacterImageUrl } from '../utils/characterAssets';

// ─── 타이프라이터 훅 ──────────────────────────────────────────────────────────
function useBattleTypewriter(text: string, speed = 20) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const idx = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    idx.current = 0;

    timerRef.current = setInterval(() => {
      idx.current += 1;
      setDisplayed(text.slice(0, idx.current));
      if (idx.current >= text.length) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        setDone(true);
      }
    }, speed);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [text, speed]);

  const skip = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setDisplayed(text);
    setDone(true);
    idx.current = text.length;
  }, [text]);

  return { displayed, done, skip };
}

// ─── 감정별 색상 ─────────────────────────────────────────────────────────────
function getEmotionColors(emotion?: DialogueEmotion): { border: string; glow: string; nameColor: string } {
  switch (emotion) {
    case 'happy':       return { border: '#86efac', glow: 'rgba(134,239,172,0.25)', nameColor: '#86efac' };
    case 'embarrassed': return { border: '#f9a8d4', glow: 'rgba(249,168,212,0.25)', nameColor: '#f9a8d4' };
    case 'serious':     return { border: '#93c5fd', glow: 'rgba(147,197,253,0.25)', nameColor: '#93c5fd' };
    case 'surprised':   return { border: '#fde68a', glow: 'rgba(253,230,138,0.30)', nameColor: '#fde68a' };
    case 'sad':         return { border: '#a5b4fc', glow: 'rgba(165,180,252,0.25)', nameColor: '#a5b4fc' };
    case 'angry':       return { border: '#fca5a5', glow: 'rgba(252,165,165,0.30)', nameColor: '#fca5a5' };
    default:            return { border: 'rgba(200,185,160,0.6)', glow: 'rgba(200,185,160,0.10)', nameColor: '#c4b5fd' };
  }
}

// ─── 말풍선 레이아웃 상수 ────────────────────────────────────────────────────
const BUBBLE_W       = 300;
const BUBBLE_H_MIN   = 110;
const PORTRAIT_SIZE  = 72;
const MARGIN         = 16;

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
const BattleDialogueBubble: React.FC = () => {
  const activeDialogue   = useGameStore(s => s.activeDialogue);
  const currentLineIndex = useGameStore(s => s.currentLineIndex);
  const bubbleAnchor     = useGameStore(s => s.bubbleAnchor);
  const advanceLine      = useGameStore(s => s.advanceLine);
  const closeDialogue    = useGameStore(s => s.closeDialogue);
  const characters       = useAppStore(s => s.characters);

  // 전투 컨텍스트만 담당
  if (!activeDialogue || activeDialogue.context !== 'BATTLE') return null;
  if (!bubbleAnchor) return null;

  const line = activeDialogue.lines[currentLineIndex];
  if (!line) return null;

  const character   = characters[line.speakerId] ?? null;
  const speakerName = line.speakerName ?? character?.name ?? line.speakerId;
  const portraitUrl = character ? getCharacterImageUrl(character.id, 'bust') : null;
  const isLast      = currentLineIndex >= activeDialogue.lines.length - 1;
  const { border, glow, nameColor } = getEmotionColors(line.emotion);

  // ─── 화면 경계 clamp ──────────────────────────────────────────────────
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const TAIL_H = 10;

  // 기본 위치: 앵커 위쪽 (translateY(-100%) 효과를 직접 계산)
  let rawLeft = bubbleAnchor.x - BUBBLE_W / 2;
  let rawTop  = bubbleAnchor.y - BUBBLE_H_MIN - TAIL_H - MARGIN;

  // 좌우 clamp
  const clampedLeft = Math.max(MARGIN, Math.min(vw - BUBBLE_W - MARGIN, rawLeft));
  // 위쪽에 공간 없으면 아래로 뒤집기
  const flipDown    = rawTop < MARGIN;
  const clampedTop  = flipDown
    ? bubbleAnchor.y + TAIL_H + MARGIN
    : Math.max(MARGIN, Math.min(vh - BUBBLE_H_MIN - MARGIN, rawTop));

  return (
    <>
      {/* 전역 CSS 키프레임 (처음 한 번만 주입) */}
      <style>{`
        @keyframes bdbSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes bdbCursorBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes bdbCuePulse {
          0%, 100% { opacity: 0.45; }
          50%       { opacity: 1;    }
        }
        @keyframes bdbPortraitPop {
          from { transform: scale(0.85); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
      `}</style>

      {/* 클릭 투과 루트 레이어 */}
      <div style={rootStyle}>
        {/* 말풍선 본체 */}
        <div
          key={`bubble-${activeDialogue.id}-${currentLineIndex}`}
          style={{
            ...bubbleStyle,
            left: clampedLeft,
            top: clampedTop,
            borderColor: border,
            boxShadow: `0 0 0 1px ${border}33, 0 6px 30px rgba(0,0,0,0.65), inset 0 0 20px ${glow}`,
          }}
          onClick={advanceLine}
        >
          {/* ── 포트레이트 + 대사 영역 ── */}
          <div style={contentRowStyle}>
            {/* 포트레이트 */}
            <div style={{ ...portraitFrameStyle, borderColor: border, boxShadow: `0 0 10px ${glow}` }}>
              {portraitUrl ? (
                <img
                  src={portraitUrl}
                  alt={speakerName}
                  style={portraitImgStyle}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div style={{ ...portraitFallbackStyle, color: nameColor }}>
                  {speakerName.charAt(0)}
                </div>
              )}
            </div>

            {/* 텍스트 영역 */}
            <div style={textColStyle}>
              {/* 화자 이름 + 닫기 */}
              <div style={headerStyle}>
                <span style={{ ...speakerNameStyle, color: nameColor }}>
                  {speakerName}
                </span>
                <button
                  style={closeBtnStyle}
                  onClick={e => { e.stopPropagation(); closeDialogue(); }}
                  title="닫기 (ESC)"
                >✕</button>
              </div>

              {/* 대사 타이프라이터 */}
              <BubbleText
                key={`btext-${activeDialogue.id}-${currentLineIndex}`}
                text={line.text}
                onAdvance={advanceLine}
              />
            </div>
          </div>

          {/* ── 하단 진행 표시줄 ── */}
          <div style={footerStyle}>
            <span style={progressStyle}>
              {currentLineIndex + 1} / {activeDialogue.lines.length}
            </span>
            <span style={{ ...cueStyle, color: isLast ? '#86efac' : 'rgba(255,255,255,0.45)' }}>
              {isLast ? '▪ 완료' : '▸ 클릭 또는 Space'}
            </span>
          </div>

          {/* ── 말풍선 꼬리 (위/아래 방향 자동) ── */}
          <div style={flipDown ? tailUpStyle : { ...tailDownStyle, borderTopColor: 'rgba(10,11,24,0.97)' }} />
        </div>
      </div>
    </>
  );
};

// ─── 타이프라이터 서브컴포넌트 ──────────────────────────────────────────────
interface BubbleTextProps {
  text: string;
  onAdvance: () => void;
}
const BubbleText: React.FC<BubbleTextProps> = ({ text, onAdvance }) => {
  const { displayed, done, skip } = useBattleTypewriter(text);

  // 키보드 지원 (Space / Enter)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (!done) skip();
        else onAdvance();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [done, skip, onAdvance]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!done) skip();
    else onAdvance();
  };

  return (
    <p style={textStyle} onClick={handleClick}>
      {displayed}
      {!done && <span style={cursorStyle}>▌</span>}
    </p>
  );
};

// ─── 스타일 ──────────────────────────────────────────────────────────────────
const rootStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 920,
  pointerEvents: 'none',
};

const bubbleStyle: React.CSSProperties = {
  position: 'absolute',
  width: BUBBLE_W,
  minHeight: BUBBLE_H_MIN,
  background: 'linear-gradient(160deg, rgba(8,9,20,0.97) 0%, rgba(15,17,38,0.97) 100%)',
  border: '1.5px solid',
  borderRadius: 12,
  padding: '10px 12px 8px',
  pointerEvents: 'auto',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  cursor: 'pointer',
  animation: 'bdbSlideIn 0.18s ease-out both',
  userSelect: 'none',
};

const contentRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'flex-start',
};

const portraitFrameStyle: React.CSSProperties = {
  width: PORTRAIT_SIZE,
  height: PORTRAIT_SIZE,
  borderRadius: 8,
  border: '2px solid',
  overflow: 'hidden',
  flexShrink: 0,
  background: 'rgba(255,255,255,0.05)',
  animation: 'bdbPortraitPop 0.22s ease-out both',
};

const portraitImgStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'center top',
};

const portraitFallbackStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 28,
  fontWeight: 800,
  fontFamily: "'Noto Sans KR', sans-serif",
  background: 'rgba(255,255,255,0.05)',
};

const textColStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 0,
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 2,
};

const speakerNameStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.1em',
  fontFamily: "'Noto Sans KR', sans-serif",
  textTransform: 'uppercase' as const,
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'rgba(255,255,255,0.28)',
  fontSize: 11,
  cursor: 'pointer',
  padding: '1px 3px',
  lineHeight: 1,
  flexShrink: 0,
};

const textStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.75,
  fontFamily: "'Noto Serif KR', 'Noto Sans KR', serif",
  color: '#f0e8d8',
  margin: '0 0 2px 0',
  minHeight: 38,
  wordBreak: 'keep-all',
};

const cursorStyle: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 10,
  animation: 'bdbCursorBlink 0.65s infinite',
  opacity: 0.9,
  marginLeft: 1,
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 6,
  paddingTop: 5,
  borderTop: '1px solid rgba(255,255,255,0.07)',
};

const progressStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'rgba(255,255,255,0.22)',
  fontFamily: 'monospace',
};

const cueStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.05em',
  animation: 'bdbCuePulse 1.4s ease-in-out infinite',
};

// 꼬리: 아래 방향 (말풍선이 앵커 위쪽에 있을 때)
const tailDownStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: -10,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 0,
  height: 0,
  borderLeft: '9px solid transparent',
  borderRight: '9px solid transparent',
  borderTop: '10px solid',
};

// 꼬리: 위 방향 (말풍선이 앵커 아래쪽에 있을 때)
const tailUpStyle: React.CSSProperties = {
  position: 'absolute',
  top: -10,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 0,
  height: 0,
  borderLeft: '9px solid transparent',
  borderRight: '9px solid transparent',
  borderBottom: '10px solid rgba(8,9,20,0.97)',
};

export default BattleDialogueBubble;
