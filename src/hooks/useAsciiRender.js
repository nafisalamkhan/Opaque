import { useState, useEffect, useRef, useCallback } from 'react';

const DENSITY = 'Ñ@#W$9876543210?!abc;:+=-,._ ';

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

export function useAsciiRender({
  videoRef,
  canvasRef,
  width,
  brightness,
  contrast,
  cameraActive,
  imageSource,
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
    const rows = Math.floor(cols * (srcH / srcW) * getCharAspect());

    canvas.width = cols;
    canvas.height = rows;

    ctx.drawImage(source, 0, 0, cols, rows);

    const imageData = ctx.getImageData(0, 0, cols, rows);
    const pixels = imageData.data;

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

        const luminance = (r * 0.299) + (g * 0.587) + (b * 0.114);
        const charIndex = Math.floor((luminance / 255) * (DENSITY.length - 1));
        text += DENSITY[charIndex];
        rowColors.push(`rgb(${r},${g},${b})`);
      }
      text += '\n';
      colors.push(rowColors);
    }

    setResult({ text, colors });
  }, [width, brightness, contrast, canvasRef]);

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
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [cameraActive, process, videoRef]);

  return result;
}
