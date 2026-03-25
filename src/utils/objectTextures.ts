import * as PIXI from 'pixi.js';

let treeTexture: PIXI.Texture | null = null;
let mountainTexture: PIXI.Texture | null = null;
let cityTexture: PIXI.Texture | null = null;

export const getTreeTexture = (): PIXI.Texture => {
  if (treeTexture) return treeTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 30;
  canvas.height = 50;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (ctx) {
    // 나무 기둥 (침엽수 느낌) - 지정해주신 기본 색상보다 살짝 어두운 톤
    ctx.fillStyle = '#26300c';
    ctx.fillRect(5, 20, 20, 30);
    // 상단 윗면 (빛 받는 곳) - 지정해주신 기본 색상
    ctx.fillStyle = '#3a4913';
    ctx.fillRect(5, 0, 20, 20);
    // 가장 상단 (하이라이트) - 더 밝은 톤
    ctx.fillStyle = '#4f631a';
    ctx.fillRect(10, -5, 10, 10);
  }
  treeTexture = PIXI.Texture.from(canvas);
  return treeTexture;
};

export const getMountainTexture = (): PIXI.Texture => {
  if (mountainTexture) return mountainTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 40;
  canvas.height = 80;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (ctx) {
    // 바위 단층
    ctx.fillStyle = '#7a7e76';
    ctx.fillRect(0, 20, 40, 60);
    // 위쪽 평평한 면 (하이라이트)
    ctx.fillStyle = '#9da398';
    ctx.fillRect(0, 0, 40, 20);
  }
  mountainTexture = PIXI.Texture.from(canvas);
  return mountainTexture;
};

export const getCityTexture = (): PIXI.Texture => {
  if (cityTexture) return cityTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 30;
  canvas.height = 30;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (ctx) {
    // 건물 벽
    ctx.fillStyle = '#ebd6b3';
    ctx.fillRect(5, 15, 20, 15);
    // 지붕
    ctx.fillStyle = '#b36140';
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(25, 15);
    ctx.lineTo(5, 15);
    ctx.fill();
  }
  cityTexture = PIXI.Texture.from(canvas);
  return cityTexture;
};
