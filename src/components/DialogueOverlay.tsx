// J:/AI/Game/SRPG/src/components/DialogueOverlay.tsx
// 전략맵/등용/인연 이벤트용 풀스크린 SRPG 대사창
// 화면 하단 반투명 패널 + 캐릭터 포트레이트 + 타이프라이터 텍스트

import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import type { DialogueLine, DialogueEmotion } from '../types/dialogueTypes';
import { useAppStore } from '../store/appStore';

// ─── 감정별 포트레이트 CSS 필터 ───────────────────────────────────────────────
function getEmotionFilter(emotion: DialogueEmotion | undefined): string {
  switch (emotion) {
    case 'happy':      return 'brightness(1.15) saturate(1.2)';
    case 'embarrassed':return 'sepia(0.3) saturate(1.1)';
    case 'serious':    return 'contrast(1.1) brightness(0.95)';
    case 'surprised':  return 'brightness(1.2) saturate(1.3)';
    case 'sad':        return 'brightness(0.85) saturate(0.7)';
    case 'angry':      return 'saturate(1.5) contrast(1.15) brightness(0.9)';
    default:           return 'none';
  }
}

// ─── 화자 결정 — NARRATOR라면 포트레이트 없음 ────────────────────────────────
function isNarrator(line: DialogueLine): boolean {
  return line.speakerId === 'NARRATOR';
}

// ─── 타이프라이터 훅 ──────────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 30) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    indexRef.current = 0;

    const interval = setInterval(() => {
      indexRef.current += 1;
      setDisplayed(text.slice(0, indexRef.current));
      if (indexRef.current >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  const skipToEnd = () => {
    setDisplayed(text);
    setDone(true);
    indexRef.current = text.length;
  };

  return { displayed, done, skipToEnd };
}

// ─── 색상 팔레트 (컨텍스트별) ────────────────────────────────────────────────
function getPanelStyle(context: string): React.CSSProperties {
  switch (context) {
    case 'RECRUITMENT':
      return { borderColor: '#a78bfa', boxShadow: '0 0 24px rgba(167,139,250,0.35)' };
    case 'AFFINITY':
      return { borderColor: '#f9a8d4', boxShadow: '0 0 24px rgba(249,168,212,0.35)' };
    case 'BATTLE':
      return { borderColor: '#fb923c', boxShadow: '0 0 24px rgba(251,146,60,0.25)' };
    default:
      return { borderColor: '#60a5fa', boxShadow: '0 0 24px rgba(96,165,250,0.25)' };
  }
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
const DialogueOverlay: React.FC = () => {
  const activeDialogue   = useGameStore((s) => s.activeDialogue);
  const currentLineIndex = useGameStore((s) => s.currentLineIndex);
  const advanceLine      = useGameStore((s) => s.advanceLine);
  const closeDialogue    = useGameStore((s) => s.closeDialogue);
  const characters       = useAppStore((s) => s.characters);

  if (!activeDialogue) return null;

  // 전투 중 대화는 BattleDialogueBubble이 처리
  if (activeDialogue.context === 'BATTLE') return null;

  const line = activeDialogue.lines[currentLineIndex];
  if (!line) return null;

  const narrator = isNarrator(line);
  const character = narrator ? null : characters[line.speakerId] ?? null;
  const speakerName = line.speakerName ?? character?.name ?? line.speakerId;
  const portraitUrl = character?.portraitUrl ?? null;
  const isLast = currentLineIndex >= activeDialogue.lines.length - 1;
  const panelStyle = getPanelStyle(activeDialogue.context);

  return (
    <div style={overlayStyle} onClick={advanceLine}>
      {/* 어두운 배경 오버레이 */}
      <div style={backdropStyle} />

      {/* 대사창 패널 */}
      <div style={{ ...panelContainerStyle, ...panelStyle }}>
        {/* 포트레이트 영역 */}
        {!narrator && (
          <div style={portraitAreaStyle}>
            {portraitUrl ? (
              <img
                src={portraitUrl}
                alt={speakerName}
                style={{
                  ...portraitImgStyle,
                  filter: getEmotionFilter(line.emotion),
                }}
              />
            ) : (
              <div style={portraitPlaceholderStyle}>
                <span style={portraitInitialStyle}>
                  {speakerName.charAt(0)}
                </span>
              </div>
            )}
            {/* 감정 오버레이 아이콘 */}
            <EmotionBadge emotion={line.emotion} />
          </div>
        )}

        {/* 텍스트 영역 */}
        <div style={textAreaStyle}>
          {/* 화자 이름 */}
          {!narrator && (
            <div style={speakerNameStyle}>{speakerName}</div>
          )}
          {/* NARRATOR라면 이탤릭 처리 */}
          <TypewriterText
            key={`${activeDialogue.id}-${currentLineIndex}`}
            text={line.text}
            italic={narrator}
            onAdvance={advanceLine}
          />

          {/* 진행 인디케이터 */}
          <div style={indicatorRowStyle}>
            <span style={progressStyle}>
              {currentLineIndex + 1} / {activeDialogue.lines.length}
            </span>
            <span style={advanceCueStyle}>
              {isLast ? '[ 완료 ]' : '[ 클릭하여 계속 ]'}
            </span>
          </div>
        </div>

        {/* 닫기 버튼 */}
        <button
          style={closeBtnStyle}
          onClick={(e) => { e.stopPropagation(); closeDialogue(); }}
          title="대화 닫기"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

// ─── 타이프라이터 텍스트 서브컴포넌트 ────────────────────────────────────────
interface TypewriterTextProps {
  text: string;
  italic?: boolean;
  onAdvance: () => void;
}
const TypewriterText: React.FC<TypewriterTextProps> = ({ text, italic, onAdvance }) => {
  const { displayed, done, skipToEnd } = useTypewriter(text, 28);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!done) { skipToEnd(); }
    else { onAdvance(); }
  };

  return (
    <p
      style={{
        ...dialogueTextStyle,
        fontStyle: italic ? 'italic' : 'normal',
        color: italic ? '#b0c4de' : '#f0e8d8',
      }}
      onClick={handleClick}
    >
      {displayed}
      {!done && <span style={cursorStyle}>|</span>}
    </p>
  );
};

// ─── 감정 배지 ───────────────────────────────────────────────────────────────
const EMOTION_ICON: Record<string, string> = {
  happy: '😊', embarrassed: '😳', serious: '😐',
  surprised: '😲', sad: '😢', angry: '😠',
};
const EmotionBadge: React.FC<{ emotion?: DialogueEmotion }> = ({ emotion }) => {
  if (!emotion || emotion === 'normal') return null;
  const icon = EMOTION_ICON[emotion];
  if (!icon) return null;
  return <div style={emotionBadgeStyle}>{icon}</div>;
};

// ─── 스타일 定义 ──────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  zIndex: 1000,
  padding: '0 0 24px 0',
  pointerEvents: 'auto',
};

const backdropStyle: React.CSSProperties = {
  position: 'absolute', inset: 0,
  background: 'rgba(0,0,0,0.45)',
  pointerEvents: 'none',
};

const panelContainerStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex', flexDirection: 'row', alignItems: 'flex-start',
  width: 'min(860px, 96vw)',
  minHeight: 160,
  background: 'linear-gradient(160deg, rgba(12,14,28,0.97) 0%, rgba(20,22,45,0.97) 100%)',
  border: '1.5px solid',
  borderRadius: 12,
  padding: '20px 20px 16px 20px',
  gap: 18,
  cursor: 'pointer',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
};

const portraitAreaStyle: React.CSSProperties = {
  position: 'relative',
  flexShrink: 0,
  width: 104, height: 104,
  borderRadius: 8,
  overflow: 'hidden',
  border: '1.5px solid rgba(255,255,255,0.12)',
  background: '#1a1b2e',
};

const portraitImgStyle: React.CSSProperties = {
  width: '100%', height: '100%',
  objectFit: 'cover',
  objectPosition: 'center top',
  transition: 'filter 0.4s ease',
};

const portraitPlaceholderStyle: React.CSSProperties = {
  width: '100%', height: '100%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(135deg, #1e3a5f, #2d1b4e)',
};

const portraitInitialStyle: React.CSSProperties = {
  fontSize: 40, fontWeight: 700,
  color: '#a5b4fc',
  fontFamily: 'serif',
  textShadow: '0 0 12px rgba(165,180,252,0.6)',
};

const emotionBadgeStyle: React.CSSProperties = {
  position: 'absolute', bottom: 4, right: 4,
  fontSize: 18, lineHeight: 1,
  filter: 'drop-shadow(0 1px 3px #000)',
};

const textAreaStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex', flexDirection: 'column',
  gap: 6,
};

const speakerNameStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 700,
  color: '#c4b5fd',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  fontFamily: "'Noto Sans KR', sans-serif",
  textShadow: '0 0 10px rgba(196,181,253,0.5)',
  marginBottom: 2,
};

const dialogueTextStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.75,
  fontFamily: "'Noto Serif KR', 'Noto Sans KR', serif",
  margin: 0,
  minHeight: 56,
};

const cursorStyle: React.CSSProperties = {
  display: 'inline-block',
  animation: 'dialogueCursorBlink 0.8s infinite',
  opacity: 0.85,
  marginLeft: 1,
};

const indicatorRowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginTop: 'auto', paddingTop: 8,
};

const progressStyle: React.CSSProperties = {
  fontSize: 11, color: 'rgba(255,255,255,0.3)',
  fontFamily: 'monospace',
};

const advanceCueStyle: React.CSSProperties = {
  fontSize: 11, color: 'rgba(255,255,255,0.4)',
  letterSpacing: '0.08em',
  animation: 'dialogueCuePulse 1.5s ease-in-out infinite',
};

const closeBtnStyle: React.CSSProperties = {
  position: 'absolute', top: 10, right: 12,
  background: 'none', border: 'none',
  color: 'rgba(255,255,255,0.35)', fontSize: 14,
  cursor: 'pointer', padding: '2px 4px',
  lineHeight: 1,
  transition: 'color 0.2s',
};

export default DialogueOverlay;
