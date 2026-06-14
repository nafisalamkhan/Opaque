import { useState, useEffect, useRef, useCallback } from 'react';

const DENSITY_PROFILES = {
  standard: '?@#W$9876543210?!abc;:+=-,._ ',
  blocks: '█▓▒░ ',
  detailed: '@%#*+=-:. ',
  minimal: '■□ ',
};

export { DENSITY_PROFILES };

let charAspect = null;

function getCharAspect() {
  if (charAspect !== null) return charAspect;
  try {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = '10px VT323, "Courier New", monospace';
    charAspect = ctx.measureText('@').width / 12;
  } catch {
    charAspect = 0.5;
  }
  return charAspect;
}

export function getCharWidth(fontSize) {
  try {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = `${fontSize}px VT323, "Courier New", monospace`;
    return ctx.measureText('@').width;
  } catch {
    return fontSize * 0.6;
  }
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function applyBC(value, brightness, contrast) {
  let v = value / 255;
  v += brightness;
  const factor = (259 * (contrast * 127 + 255)) / (255 * (259 - contrast * 127));
  v = factor * (v - 0.5) + 0.5;
  return clamp(Math.round(v * 255), 0, 255);
}

function blendChannel(f, b, mode) {
  switch (mode) {
    case 'multiply': return (f * b) / 255;
    case 'screen': return 255 - ((255 - f) * (255 - b)) / 255;
    case 'overlay':
      return b < 128 ? (2 * f * b) / 255 : 255 - (2 * (255 - f) * (255 - b)) / 255;
    case 'darken': return Math.min(f, b);
    case 'lighten': return Math.max(f, b);
    case 'color-dodge': return Math.min(255, (b * 255) / (255 - f || 1));
    case 'color-burn': return 255 - Math.min(255, ((255 - b) * 255) / (f || 1));
    case 'soft-light': {
      const d = f / 255;
      return clamp(b + (2 * d - 1) * (b < 128 ? b : 255 - b), 0, 255);
    }
    case 'hard-light':
      return f < 128 ? (2 * f * b) / 255 : 255 - (2 * (255 - f) * (255 - b)) / 255;
    default: return f;
  }
}

export function useAsciiRender({
  videoRef,
  canvasRef,
  width = 120,
  brightness = 0,
  contrast = 0,
  gamma = 1,
  invertL = false,
  cameraActive = false,
  imageSource = null,
  densityRamp = '@%#*+=-:. ',
  densityBias = 1,
  heightScale = 1,
  pixelate = 0,
  mixMode = 'mono',
  background = 'solid',
  blendMode = 'normal',
}) {
  const [result, setResult] = useState({ text: '', colors: [] });
  const animFrameRef = useRef(null);
  const imageRef = useRef(null);

  useEffect(() => {
    imageRef.current = imageSource;
  }, [imageSource]);

  const process = useCallback((source) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const srcW = source.videoWidth || source.naturalWidth || source.width;
    const srcH = source.videoHeight || source.naturalHeight || source.height;
    if (!srcW || !srcH) return;

    const cols = width;
    const rows = Math.max(1, Math.floor(cols * (srcH / srcW) * getCharAspect() * heightScale));

    if (pixelate > 0) {
      const blockSize = Math.max(1, Math.round(pixelate * 8));
      const smallCols = Math.max(1, Math.ceil(cols / blockSize));
      const smallRows = Math.max(1, Math.ceil(rows / blockSize));
      const offscreen = document.createElement('canvas');
      offscreen.width = smallCols;
      offscreen.height = smallRows;
      const offCtx = offscreen.getContext('2d');
      offCtx.drawImage(source, 0, 0, smallCols, smallRows);
      canvas.width = cols;
      canvas.height = rows;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(offscreen, 0, 0, cols, rows);
    } else {
      canvas.width = cols;
      canvas.height = rows;
      ctx.drawImage(source, 0, 0, cols, rows);
    }

    const imageData = ctx.getImageData(0, 0, cols, rows);
    const pixels = imageData.data;

    const density = densityRamp || DENSITY_PROFILES.standard;

    let text = '';
    const colors = [];

    for (let y = 0; y < rows; y++) {
      const rowColors = [];
      for (let x = 0; x < cols; x++) {
        const idx = (y * cols + x) * 4;
        let r = pixels[idx];
        let g = pixels[idx + 1];
        let b = pixels[idx + 2];

        r = applyBC(r, brightness, contrast);
        g = applyBC(g, brightness, contrast);
        b = applyBC(b, brightness, contrast);

        if (gamma !== 1) {
          r = clamp(Math.round(Math.pow(r / 255, gamma) * 255), 0, 255);
          g = clamp(Math.round(Math.pow(g / 255, gamma) * 255), 0, 255);
          b = clamp(Math.round(Math.pow(b / 255, gamma) * 255), 0, 255);
        }

        if (invertL) {
          r = 255 - r;
          g = 255 - g;
          b = 255 - b;
        }

        const luminance = (r * 0.299) + (g * 0.587) + (b * 0.114);
        const norm = luminance / 255;
        const biased = Math.pow(norm, densityBias);
        const charIndex = Math.min(Math.floor(biased * (density.length - 1)), density.length - 1);
        text += density[charIndex];

        let fr, fg, fb;
        if (mixMode === 'mono') {
          fr = 0; fg = 255; fb = 65;
        } else {
          fr = r; fg = g; fb = b;
        }

        if (background === 'solid' && blendMode !== 'normal') {
          const bl = blendChannel(fr, 0, blendMode);
          const blg = blendChannel(fg, 0, blendMode);
          const blb = blendChannel(fb, 0, blendMode);
          fr = Math.round(bl);
          fg = Math.round(blg);
          fb = Math.round(blb);
        }

        const alpha = background === 'transparent' ? 0 : 255;
        rowColors.push(alpha < 255 ? `rgba(${fr},${fg},${fb},${alpha})` : `rgb(${fr},${fg},${fb})`);
      }
      text += '\n';
      colors.push(rowColors);
    }

    setResult({ text, colors });
  }, [width, brightness, contrast, gamma, invertL, canvasRef, densityRamp, densityBias, heightScale, pixelate, mixMode, background, blendMode]);

  useEffect(() => {
    if (imageSource) {
      process(imageSource);
    }
  }, [imageSource, process]);

  useEffect(() => {
    if (!cameraActive || !videoRef.current) return;
    let running = true;
    function frame() {
      if (!running) return;
      if (videoRef.current?.readyState >= 2) {
        process(videoRef.current);
      }
      animFrameRef.current = requestAnimationFrame(frame);
    }
    animFrameRef.current = requestAnimationFrame(frame);
    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [cameraActive, process, videoRef]);

  return result;
}
