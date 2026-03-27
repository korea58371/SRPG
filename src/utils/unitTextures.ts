// J:/AI/Game/SRPG/src/utils/unitTextures.ts
// HTMLCanvas를 이용해 병종별 아이콘 PIXI 텍스처 생성 (이모지 기반)
// 외부 이미지 파일 없이 런타임에 캔버스로 합성

import * as PIXI from 'pixi.js';

export const UNIT_ICONS: Record<string, string> = {
  INFANTRY: '⚔',   // 교차 칼
  SPEARMAN: '🗡',  // 창/단검
  CAVALRY:  '🐴',  // 말
  ARCHER:   '🏹',  // 활 화살
};

const cache = new Map<string, PIXI.Texture>();

export function getUnitTypeTexture(unitType: string): PIXI.Texture {
  if (cache.has(unitType)) return cache.get(unitType)!;

  const SIZE = 48;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  // 배경 투명하게
  ctx.clearRect(0, 0, SIZE, SIZE);

  // 이모지 렌더링
  ctx.font = `${SIZE * 0.72}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(UNIT_ICONS[unitType] ?? '?', SIZE / 2, SIZE / 2 + 1);

  const texture = PIXI.Texture.from(canvas);
  texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
  cache.set(unitType, texture);
  return texture;
}

// ─── 포트레이트 폴백 텍스처 ──────────────────────────────────────────────
// portraitUrl 없을 때 사용: 세력 컬러 배경 + 유닛 이니셜 아바타
const portraitCache = new Map<string, PIXI.Texture>();

export function getPortraitFallbackTexture(cacheKey: string, factionColor: number, initial: string): PIXI.Texture {
  if (portraitCache.has(cacheKey)) return portraitCache.get(cacheKey)!;

  const SIZE = 64;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  // 세력 컬러 배경 (원형)
  const r = (factionColor >> 16) & 0xff;
  const g = (factionColor >> 8) & 0xff;
  const b = factionColor & 0xff;
  const hex = `rgb(${r},${g},${b})`;

  // 그라데이션 배경
  const grad = ctx.createRadialGradient(SIZE * 0.4, SIZE * 0.35, 0, SIZE / 2, SIZE / 2, SIZE * 0.6);
  grad.addColorStop(0, hex);
  grad.addColorStop(1, `rgba(${r * 0.4},${g * 0.4},${b * 0.4},1)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // 이니셜 텍스트
  ctx.font = `bold ${SIZE * 0.45}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 4;
  ctx.fillText(initial.toUpperCase().slice(0, 2), SIZE / 2, SIZE / 2 + 2);

  const texture = PIXI.Texture.from(canvas);
  texture.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
  portraitCache.set(cacheKey, texture);
  return texture;
}
