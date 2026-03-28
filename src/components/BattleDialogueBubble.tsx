// J:/AI/Game/SRPG/src/components/BattleDialogueBubble.tsx
// 전투 전용 소형 토큰 + 말풍선 오버레이
// 발화 유닛의 화면 픽셀 좌표 위에 말풍선이 고정, 유저 클릭으로만 진행

import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useAppStore } from '../store/appStore';
import type { DialogueEmotion } from '../types/dialogueTypes';

// ─── 타이프라이터 훅 (인라인, Overlay와 분리) ─────────────────────────────────
function useBattleTypewriter(text: string, speed = 22) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const idx = useRef(0);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    idx.current = 0;

    const t = setInterval(() => {
      idx.current += 1;
      setDisplayed(text.slice(0, idx.current));
      if (idx.current >= text.length) { clearInterval(t); setDone(true); }
    }, speed);

    return () => clearInterval(t);
  }, [text, speed]);

  const skip = () => { setDisplayed(text); setDone(true); idx.current = text.length; };
  return { displayed, done, skip };
}

// ─── 감정별 말풍선 테두리 색 ─────────────────────────────────────────────────
function getBubbleBorderColor(emotion?: DialogueEmotion): string {
  switch (emotion) {
    case 'happy':       return '#86efac';
    case 'embarrassed': return '#f9a8d4';
    case 'serious':     return '#93c5fd';
    case 'surprised':   return '#fde68a';
    case 'sad':         return '#a5b4fc';
    case 'angry':       return '#fca5a5';
    default:            return 'rgba(255,255,255,0.35)';
  }
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
const BattleDialogueBubble: React.FC = () => {
  const activeDialogue   = useGameStore((s) => s.activeDialogue);
  const currentLineIndex = useGameStore((s) => s.currentLineIndex);
  const bubbleAnchor     = useGameStore((s) => s.bubbleAnchor);
  const advanceLine      = useGameStore((s) => s.advanceLine);
  const closeDialogue    = useGameStore((s) => s.closeDialogue);
  const characters       = useAppStore((s) => s.characters);

  // 전투 컨텍스트만 담당
  if (!activeDialogue || activeDialogue.context !== 'BATTLE') return null;
  if (!bubbleAnchor) return null;

  const line = activeDialogue.lines[currentLineIndex];
  if (!line) return null;

  const isNarrator = line.speakerId === 'NARRATOR';
  const character  = isNarrator ? null : characters[line.speakerId] ?? null;
  const speakerName = line.speakerName ?? character?.name ?? line.speakerId;
  const portraitUrl = character?.portraitUrl ?? null;
  const isLast     = currentLineIndex >= activeDialogue.lines.length - 1;
  const borderColor = getBubbleBorderColor(line.emotion);

  // 말풍선 위치: 유닛 포트레이트 토큰 바로 위에 붙임
  // bubbleAnchor = 유닛 화면 픽셀 중심 좌표
  const BUBBLE_WIDTH  = 260;
  const BUBBLE_OFFSET = 56; // 토큰 위 여백 (px)

  const bubbleLeft = bubbleAnchor.x - BUBBLE_WIDTH / 2;
  const bubbleTop  = bubbleAnchor.y - BUBBLE_OFFSET;

  return (
    <div style={rootStyle} onClick={advanceLine}>
      {/* 말풍선 본체 */}
      <div
        style={{
          ...bubbleStyle,
          left: bubbleLeft,
          top: bubbleTop,
          borderColor,
        }}
      >
        {/* 화자 이름 + 포트레이트 minitoken */}
        <div style={bubbleHeaderStyle}>
          {portraitUrl ? (
            <img src={portraitUrl} alt={speakerName} style={miniTokenImgStyle} />
          ) : (
            <div style={{ ...miniTokenStyle, borderColor }}>
              <span style={miniTokenInitialStyle}>
                {isNarrator ? '✦' : speakerName.charAt(0)}
              </span>
            </div>
          )}
          <span style={bubbleSpeakerStyle}>{isNarrator ? 'NARRATOR' : speakerName}</span>

          {/* 닫기 버튼 */}
          <button
            style={bubbleCloseBtnStyle}
            onClick={(e) => { e.stopPropagation(); closeDialogue(); }}
          >
            ✕
          </button>
        </div>

        {/* 대사 텍스트 */}
        <BubbleText
          key={`bubble-${activeDialogue.id}-${currentLineIndex}`}
          text={line.text}
          isNarrator={isNarrator}
          onAdvance={advanceLine}
        />

        {/* 진행 큐 */}
        <div style={bubbleFooterStyle}>
          <span style={bubbleProgressStyle}>
            {currentLineIndex + 1}/{activeDialogue.lines.length}
          </span>
          <span style={{ ...bubbleCueStyle, color: isLast ? '#86efac' : 'rgba(255,255,255,0.5)' }}>
            {isLast ? '▪ 완료' : '▸ 클릭'}
          </span>
        </div>

        {/* 말풍선 꼬리 (아래 방향) */}
        <div style={tailStyle} />
      </div>
    </div>
  );
};

// ─── 타이프라이터 서브컴포넌트 ───────────────────────────────────────────────
interface BubbleTextProps {
  text: string;
  isNarrator: boolean;
  onAdvance: () => void;
}
const BubbleText: React.FC<BubbleTextProps> = ({ text, isNarrator, onAdvance }) => {
  const { displayed, done, skip } = useBattleTypewriter(text);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!done) skip();
    else onAdvance();
  };

  return (
    <p
      style={{
        ...bubbleTextStyle,
        fontStyle: isNarrator ? 'italic' : 'normal',
        color: isNarrator ? '#b0c4de' : '#f0e8d8',
      }}
      onClick={handleClick}
    >
      {displayed}
      {!done && <span style={blinkCursorStyle}>▌</span>}
    </p>
  );
};

// ─── 스타일 ──────────────────────────────────────────────────────────────────
const rootStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  zIndex: 900,
  pointerEvents: 'none', // 말풍선 외 영역은 이벤트 투과
};

const bubbleStyle: React.CSSProperties = {
  position: 'absolute',
  width: 260,
  background: 'linear-gradient(145deg, rgba(10,11,24,0.97) 0%, rgba(18,20,42,0.97) 100%)',
  border: '1.5px solid',
  borderRadius: 10,
  padding: '10px 12px 8px',
  pointerEvents: 'auto',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
  cursor: 'pointer',
  transform: 'translateY(-100%)', // 앵커 위에 위치
};

const bubbleHeaderStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 7,
  marginBottom: 6,
};

const miniTokenStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: '50%',
  border: '1.5px solid',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(255,255,255,0.07)',
  flexShrink: 0,
};

const miniTokenImgStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: '50%',
  objectFit: 'cover', objectPosition: 'center top',
  flexShrink: 0,
  border: '1.5px solid rgba(255,255,255,0.2)',
};

const miniTokenInitialStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: '#e0e7ff',
};

const bubbleSpeakerStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#c4b5fd',
  letterSpacing: '0.08em', flex: 1,
  textTransform: 'uppercase',
  fontFamily: "'Noto Sans KR', sans-serif",
};

const bubbleCloseBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none',
  color: 'rgba(255,255,255,0.3)', fontSize: 11,
  cursor: 'pointer', padding: '1px 3px',
  lineHeight: 1,
  marginLeft: 'auto',
};

const bubbleTextStyle: React.CSSProperties = {
  fontSize: 13, lineHeight: 1.7,
  fontFamily: "'Noto Serif KR', 'Noto Sans KR', serif",
  margin: '0 0 4px 0',
  minHeight: 40,
  wordBreak: 'keep-all',
};

const blinkCursorStyle: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 10,
  animation: 'dialogueCursorBlink 0.7s infinite',
  opacity: 0.8,
  marginLeft: 1,
};

const bubbleFooterStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  paddingTop: 4,
  borderTop: '1px solid rgba(255,255,255,0.07)',
};

const bubbleProgressStyle: React.CSSProperties = {
  fontSize: 10, color: 'rgba(255,255,255,0.25)',
  fontFamily: 'monospace',
};

const bubbleCueStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.05em',
  animation: 'dialogueCuePulse 1.4s ease-in-out infinite',
};

// 말풍선 아래쪽 꼬리 (포트레이트 토큰 방향)
const tailStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: -9, left: '50%',
  transform: 'translateX(-50%)',
  width: 0, height: 0,
  borderLeft: '8px solid transparent',
  borderRight: '8px solid transparent',
  borderTop: '9px solid rgba(10,11,24,0.97)',
};

export default BattleDialogueBubble;
