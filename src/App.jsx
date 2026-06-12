import { useState, useRef, useCallback } from 'react';
import { useAsciiRender, getCharWidth } from './hooks/useAsciiRender';
import './App.css';

const MODES = [
  { key: 'classic', label: 'Green' },
  { key: 'monochrome', label: 'Mono' },
  { key: 'truecolor', label: 'RGB' },
];

function renderTrueColorHtml(lines, colors) {
  let html = '';
  for (let y = 0; y < lines.length; y++) {
    const line = lines[y];
    const rowColors = colors[y] || [];
    let i = 0;
    while (i < line.length) {
      const color = rowColors[i] || '#00FF41';
      let j = i + 1;
      while (j < line.length && rowColors[j] === color) j++;
      const chars = line.slice(i, j)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      html += `<span style="color:${color}">${chars}</span>`;
      i = j;
    }
    if (y < lines.length - 1) html += '\n';
  }
  return html;
}

function App() {
  const [colorMode, setColorMode] = useState('classic');
  const [resolution, setResolution] = useState(100);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [showControls, setShowControls] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const preRef = useRef(null);
  const fileInputRef = useRef(null);

  const { text, colors } = useAsciiRender({
    videoRef,
    canvasRef,
    width: resolution,
    brightness,
    contrast,
    cameraActive,
    imageSource: uploadedImage,
  });

  const loadImage = useCallback((file) => {
    if (!file || !file.type.match(/image\/(jpeg|png|webp)/)) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => setUploadedImage(img);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileChange = useCallback((e) => {
    loadImage(e.target.files[0]);
    e.target.value = '';
  }, [loadImage]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadImage(file);
  }, [loadImage]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleCameraToggle = useCallback(async () => {
    if (cameraActive) {
      const stream = videoRef.current?.srcObject;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      videoRef.current.srcObject = null;
      setCameraActive(false);
      setCameraError(null);
      return;
    }

    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setUploadedImage(null);
      }
    } catch (err) {
      setCameraError('Camera access denied or unavailable.');
    }
  }, [cameraActive]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }, [text]);

  const handleSave = useCallback(() => {
    const lines = text.split('\n').filter((l) => l.length > 0);
    if (!lines.length) return;

    const fontSize = 32;
    const charW = getCharWidth(fontSize);
    const charH = fontSize * 1.2;
    const cols = lines[0].length;
    const rows = lines.length;

    const c = document.createElement('canvas');
    c.width = Math.ceil(cols * charW);
    c.height = Math.ceil(rows * charH);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.font = `${fontSize}px VT323, 'Courier New', monospace`;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < lines[y].length; x++) {
        if (colorMode === 'truecolor' && colors[y]) {
          ctx.fillStyle = colors[y][x] || '#00FF41';
        } else if (colorMode === 'classic') {
          ctx.fillStyle = '#00FF41';
        } else {
          ctx.fillStyle = '#FFFFFF';
        }
        ctx.fillText(lines[y][x], x * charW, (y + 1) * charH);
      }
    }

    const link = document.createElement('a');
    link.download = 'opaque-ascii.png';
    link.href = c.toDataURL('image/png');
    link.click();
  }, [text, colors, colorMode]);

  const hasContent = !!(uploadedImage || cameraActive);
  const lines = text.split('\n');
  const trueColorHtml = colorMode === 'truecolor' && hasContent
    ? renderTrueColorHtml(lines, colors)
    : '';

  return (
    <div
      className={`app ${dragOver ? 'drag-over' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <header className="header">
        <h1 className="logo">Opaque</h1>
        <button
          className="toggle-panel"
          onClick={() => setShowControls((s) => !s)}
        >
          [{showControls ? 'Hide' : 'Show'} Controls]
        </button>
      </header>

      <main className="stage">
        {!hasContent ? (
          <div className="placeholder">
            <pre className="placeholder-text">
{`  ___  _   _  ____  _   _  _____ 
 / _ \\| | | |/ ___|| | | | ____|
| | | | | | |\\___ \\| | | |  _|  
| |_| | |_| | ___) | |_| | |___ 
 \\___/ \\___/ |____/ \\___/|_____|
                                
    [ Upload Image ]
   [ Enable Camera ]
`}
            </pre>
          </div>
        ) : (
          <pre
            ref={preRef}
            className={`ascii-output ${colorMode}`}
            tabIndex={0}
          >
            {colorMode === 'truecolor' ? (
              <span dangerouslySetInnerHTML={{ __html: trueColorHtml }} />
            ) : (
              text
            )}
          </pre>
        )}
      </main>

      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
      />

      {showControls && (
        <aside className="panel">
          <div className="panel-group">
            <label className="panel-label">Input</label>
            <div className="panel-row">
              <button onClick={() => fileInputRef.current.click()}>
                Upload
              </button>
              <button onClick={handleCameraToggle}>
                {cameraActive ? 'Stop Cam' : 'Camera'}
              </button>
            </div>
            {cameraError && <div className="error">{cameraError}</div>}
          </div>

          <div className="panel-group">
            <label className="panel-label">
              Resolution: {resolution}
            </label>
            <input
              type="range"
              className="slider"
              min={80}
              max={350}
              value={resolution}
              onChange={(e) => setResolution(Number(e.target.value))}
            />
          </div>

          <div className="panel-group">
            <label className="panel-label">Color</label>
            <div className="panel-row">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  className={colorMode === m.key ? 'active' : ''}
                  onClick={() => setColorMode(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="panel-group">
            <label className="panel-label">
              Brightness: {brightness.toFixed(2)}
            </label>
            <input
              type="range"
              className="slider"
              min={-1}
              max={1}
              step={0.05}
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
            />
          </div>

          <div className="panel-group">
            <label className="panel-label">
              Contrast: {contrast.toFixed(2)}
            </label>
            <input
              type="range"
              className="slider"
              min={-1}
              max={1}
              step={0.05}
              value={contrast}
              onChange={(e) => setContrast(Number(e.target.value))}
            />
          </div>

          <div className="panel-group">
            <label className="panel-label">Export</label>
            <div className="panel-row">
              <button onClick={handleCopy} disabled={!hasContent}>
                Copy
              </button>
              <button onClick={handleSave} disabled={!hasContent}>
                Save PNG
              </button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

export default App;
