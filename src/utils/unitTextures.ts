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
