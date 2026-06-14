import { useState, useRef, useCallback, useEffect } from 'react';
import { useAsciiRender, getCharWidth, DENSITY_PROFILES } from './hooks/useAsciiRender';
import './App.css';

function renderTrueColorHtml(lines, colors) {
  let html = '';
  for (let y = 0; y < lines.length; y++) {
    const line = lines[y];
    const rowColors = colors[y] || [];
    let i = 0;
    while (i < line.length) {
      const color = rowColors[i] || '#EAEAEA';
      let j = i + 1;
      while (j < line.length && rowColors[j] === color) j++;
      const chars = line.slice(i, j)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      html += `<span style="color:${color}">${chars}</span>`;
      i = j;
    }
    if (y < lines.length - 1) html += '\n';
  }
  return html;
}

function exportSVG(text, colors, mixMode, fontSize, isLightMode) {
  const lines = text.split('\n').filter(l => l.length > 0);
  if (!lines.length) return '';
  const charW = getCharWidth(fontSize);
  const charH = fontSize * 1.2;
  const cols = lines[0].length;
  const rows = lines.length;

  let bg;
  if (mixMode === 'phosphor') bg = '#000000';
  else bg = isLightMode ? '#FFFFFF' : '#000000';

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * charW}" height="${rows * charH}">`;
  svg += `<style>text{font:${fontSize}px VT323,'Courier New',monospace}</style>`;
  svg += `<rect width="100%" height="100%" fill="${bg}"/>`;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < lines[y].length; x++) {
      let color;
      if (mixMode === 'phosphor') color = '#39FF14';
      else if (mixMode === 'mono') color = isLightMode ? '#000000' : '#FFFFFF';
      else color = colors[y]?.[x] || '#EAEAEA';
      const ch = lines[y][x].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      svg += `<text x="${(x * charW).toFixed(1)}" y="${((y + 1) * charH).toFixed(1)}" fill="${color}">${ch}</text>`;
    }
  svg += '</svg>';
  return svg;
}

function exportJSON(text, colors) {
  const lines = text.split('\n').filter(l => l.length > 0);
  const data = [];
  for (let y = 0; y < lines.length; y++) {
    const row = [];
    for (let x = 0; x < lines[y].length; x++)
      row.push({ c: lines[y][x], t: colors[y]?.[x] || null });
    data.push(row);
  }
  return JSON.stringify(data, null, 2);
}

function exportANSI(text, colors, mixMode) {
  const lines = text.split('\n').filter(l => l.length > 0);
  let out = '';
  for (let y = 0; y < lines.length; y++) {
    for (let x = 0; x < lines[y].length; x++) {
      if (mixMode === 'phosphor') out += '\x1b[92m' + lines[y][x];
      else if (mixMode === 'mono') out += '\x1b[97m' + lines[y][x];
      else {
        const c = colors[y]?.[x];
        if (c) {
          const m = c.match(/(\d+)/g);
          if (m) out += `\x1b[38;2;${m[0]};${m[1]};${m[2]}m${lines[y][x]}`;
          else out += lines[y][x];
        } else out += lines[y][x];
      }
    }
    if (y < lines.length - 1) out += '\n';
  }
  out += '\x1b[0m';
  return out;
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10"/>
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
    </svg>
  );
}

function InvertIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2a10 10 0 0 1 0 20"/>
    </svg>
  );
}

function HeaderButton({ icon, label, active, onClick, title }) {
  return (
    <button className={`topbar-btn ${active ? 'active' : ''}`} onClick={onClick} title={title}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = filename;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}

function Slider({ label, value, min, max, step, onChange }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider-row">
      <span className="slider-label">{label}</span>
      <div className="slider-track">
        <div className="slider-fill" style={{ width: `${pct}%` }} />
        <input
          type="range"
          className="slider-input"
          min={min} max={max} step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
        />
      </div>
      <span className="slider-value">{step < 1 ? value.toFixed(2) : value}</span>
    </div>
  );
}

function SegmentedControl({ options, value, onChange, width }) {
  return (
    <div className="segmented-control" style={width ? { width } : undefined}>
      {options.map(o => (
        <button
          key={o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function App() {
  const [isLightMode, setIsLightMode] = useState(false);
  const [mixMode, setMixMode] = useState('phosphor');
  const [densityProfile, setDensityProfile] = useState('standard');
  const [densityRamp, setDensityRamp] = useState(DENSITY_PROFILES.standard);
  const [densityBias, setDensityBias] = useState(1);
  const [width, setWidth] = useState(120);
  const [heightScale, setHeightScale] = useState(1);
  const [pixelate, setPixelate] = useState(0);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [gamma, setGamma] = useState(1);
  const [invertL, setInvertL] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [exportScale, setExportScale] = useState(1);

  useEffect(() => {
    document.documentElement.classList.toggle('theme-light', isLightMode);
  }, [isLightMode]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const preRef = useRef(null);
  const fileInputRef = useRef(null);

  const { text, colors } = useAsciiRender({
    videoRef, canvasRef, width, brightness, contrast, gamma, invertL,
    cameraActive, imageSource: uploadedImage, densityRamp, densityBias,
    heightScale, pixelate, mixMode,
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

  const handleDensityProfile = useCallback((profile) => {
    setDensityProfile(profile);
    setDensityRamp(DENSITY_PROFILES[profile] || DENSITY_PROFILES.standard);
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
      if (stream) stream.getTracks().forEach(t => t.stop());
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
    } catch {
      setCameraError('Camera access denied or unavailable.');
    }
  }, [cameraActive]);

  const handleCopy = useCallback(async () => {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }, [text]);

  const handleResetAll = useCallback(() => {
    setBrightness(0); setContrast(0); setGamma(1); setPixelate(0);
    setInvertL(false); setDensityProfile('standard'); setDensityRamp(DENSITY_PROFILES.standard);
    setDensityBias(1);
    setHeightScale(1); setMixMode('phosphor');
  }, []);

  const handleRandomBias = useCallback(() => {
    setDensityBias(+(Math.random() * 2.8 + 0.2).toFixed(2));
  }, []);

  const EXPORT_FONTSIZE = 32;

  const renderExportCanvas = useCallback((scale) => {
    const lines = text.split('\n').filter(l => l.length > 0);
    if (!lines.length) return null;
    const cols = lines[0].length;
    const rows = lines.length;
    const fontSize = EXPORT_FONTSIZE * scale;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = `${fontSize}px VT323, 'Courier New', monospace`;
    const charW = ctx.measureText('M').width;
    const charH = fontSize * 1.2;
    c.width = Math.ceil(cols * charW);
    c.height = Math.ceil(rows * charH);

    let bg, fg;
    if (mixMode === 'phosphor') {
      bg = '#000000'; fg = '#39FF14';
    } else if (mixMode === 'mono') {
      bg = isLightMode ? '#FFFFFF' : '#000000';
      fg = isLightMode ? '#000000' : '#FFFFFF';
    } else {
      bg = isLightMode ? '#FFFFFF' : '#000000';
      fg = null;
    }

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, c.width, c.height);

    for (let y = 0; y < rows; y++)
      for (let x = 0; x < lines[y].length; x++) {
        ctx.fillStyle = mixMode === 'original' ? (colors[y]?.[x] || '#EAEAEA') : fg;
        ctx.fillText(lines[y][x], x * charW, (y + 1) * charH);
      }
    return c;
  }, [text, colors, mixMode, isLightMode]);

  const handleSavePNG = useCallback(() => {
    const c = renderExportCanvas(exportScale);
    if (!c) return;
    const link = document.createElement('a');
    link.download = 'opaque-ascii.png';
    link.href = c.toDataURL('image/png');
    link.click();
  }, [renderExportCanvas, exportScale]);

  const handleSaveSVG = useCallback(() => {
    const svg = exportSVG(text, colors, mixMode, EXPORT_FONTSIZE * exportScale, isLightMode);
    if (svg) download('opaque-ascii.svg', svg, 'image/svg+xml');
  }, [text, colors, mixMode, exportScale, isLightMode]);

  const handleSaveTXT = useCallback(() => {
    download('opaque-ascii.txt', text, 'text/plain');
  }, [text]);

  const handleSaveHTML = useCallback(() => {
    const lines = text.split('\n').filter(l => l.length > 0);
    let content, bodyColor, bg;
    if (mixMode === 'phosphor') {
      bg = '#000000';
      bodyColor = '#39FF14';
    } else if (mixMode === 'mono') {
      bg = isLightMode ? '#FFFFFF' : '#000000';
      bodyColor = isLightMode ? '#000000' : '#FFFFFF';
    } else {
      bg = isLightMode ? '#FFFFFF' : '#000000';
      bodyColor = '#EAEAEA';
    }
    if (mixMode === 'original') {
      content = renderTrueColorHtml(lines, colors);
    } else {
      content = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    const html = `<!DOCTYPE html><html><head><style>
body{background:${bg};color:${bodyColor};font:16px VT323,'Courier New',monospace;white-space:pre;margin:0;padding:16px}
</style></head><body><pre>${content}</pre></body></html>`;
    download('opaque-ascii.html', html, 'text/html');
  }, [text, colors, mixMode, isLightMode]);

  const handleSaveJSON = useCallback(() => {
    download('opaque-ascii.json', exportJSON(text, colors), 'application/json');
  }, [text, colors]);

  const handleSaveANSI = useCallback(() => {
    download('opaque-ascii.ansi', exportANSI(text, colors, mixMode), 'text/plain');
  }, [text, colors, mixMode]);

  const handleDownloadAll = useCallback(() => {
    handleSavePNG(); handleSaveSVG(); handleSaveTXT();
    handleSaveHTML(); handleSaveJSON(); handleSaveANSI();
  }, [handleSavePNG, handleSaveSVG, handleSaveTXT, handleSaveHTML, handleSaveJSON, handleSaveANSI]);

  const hasContent = !!(uploadedImage || cameraActive);
  const lines = text.split('\n');
  const trueColorHtml = (mixMode === 'original') && hasContent ? renderTrueColorHtml(lines, colors) : '';

  return (
    <div
      className={`app ${isLightMode ? 'theme-light' : ''} ${dragOver ? 'drag-over' : ''}`}
      onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
    >
      <header className="topbar">
        <div className="logo">Opaque</div>
        <div className="topbar-actions">
          <HeaderButton icon={isLightMode ? <MoonIcon /> : <SunIcon />} label="Theme" onClick={() => setIsLightMode(s => !s)} title="Toggle theme" />
          <HeaderButton icon={<CameraIcon />} label="Camera" active={cameraActive} onClick={handleCameraToggle} title="Toggle camera" />
          <HeaderButton icon={<ResetIcon />} label="Reset" onClick={handleResetAll} title="Reset all settings" />
          <HeaderButton icon={<InvertIcon />} label="Invert" active={invertL} onClick={() => setInvertL(s => !s)} title="Toggle invert" />
        </div>
      </header>

      <div className="workspace">
        <main className="stage">
          {!hasContent ? (
            <div className="drop-zone" onClick={() => fileInputRef.current.click()}>
              <div className="drop-zone-content">
                <div className="drop-icon">⊞</div>
                <p className="drop-title">Drop image here</p>
                <p className="drop-hint">or click to browse &nbsp;·&nbsp; paste screenshot &nbsp;·&nbsp; use camera</p>
              </div>
            </div>
          ) : (
            <pre
              ref={preRef}
              className={`ascii-output ${mixMode === 'phosphor' ? 'phosphor' : mixMode === 'mono' ? 'mono' : 'color'}`}
              tabIndex={0}
            >
              {mixMode === 'original' ? (
                <span dangerouslySetInnerHTML={{ __html: trueColorHtml }} />
              ) : (
                text
              )}
            </pre>
          )}
          {cameraError && <div className="camera-error">{cameraError}</div>}
        </main>

        <aside className="sidebar">
          <div className="panel">
            <div className="panel-section">
              <div className="section-header">
                <span className="section-title">:: Sampling & Characters</span>
                <button className="section-reset" onClick={() => {
                  handleDensityProfile('standard'); setDensityBias(1); setHeightScale(1); setPixelate(0);
                }} title="Reset section">↺</button>
              </div>
              <div className="section-body">
                <div className="control-group">
                  <label className="control-label">Character Ramp</label>
                  <SegmentedControl options={[
                    { label: 'Standard', value: 'standard' },
                    { label: 'Blocks', value: 'blocks' },
                    { label: 'Detailed', value: 'detailed' },
                    { label: 'Minimal', value: 'minimal' },
                  ]} value={densityProfile} onChange={handleDensityProfile} />
                </div>
                <input type="text" className="ramp-input" value={densityRamp} onChange={e => setDensityRamp(e.target.value)} />
                <div className="control-group">
                  <label className="control-label">Density Bias</label>
                  <div className="bias-row">
                    <div className="slider-track">
                      <div className="slider-fill" style={{ width: `${((densityBias - 0.1) / (3 - 0.1)) * 100}%` }} />
                      <input type="range" className="slider-input" min={0.1} max={3} step={0.05}
                        value={densityBias} onChange={e => setDensityBias(Number(e.target.value))} />
                    </div>
                    <span className="slider-value">{densityBias.toFixed(2)}</span>
                    <button className="btn-sm" onClick={handleRandomBias} title="Randomize">🎲</button>
                  </div>
                </div>
                <Slider label="Width" value={width} min={40} max={350} step={1} onChange={setWidth} />
                <Slider label="Height Scale" value={heightScale} min={0.25} max={2.5} step={0.05} onChange={setHeightScale} />
                <Slider label="Pixelate" value={pixelate} min={0} max={1} step={0.05} onChange={setPixelate} />
              </div>
            </div>

            <div className="panel-section">
              <div className="section-header">
                <span className="section-title">:: Tone</span>
                <button className="section-reset" onClick={() => {
                  setBrightness(0); setContrast(0); setGamma(1);
                }} title="Reset section">↺</button>
              </div>
              <div className="section-body">
                <Slider label="Brightness" value={brightness} min={-1} max={1} step={0.05} onChange={setBrightness} />
                <Slider label="Contrast" value={contrast} min={-1} max={1} step={0.05} onChange={setContrast} />
                <Slider label="Gamma" value={gamma} min={0.1} max={3} step={0.05} onChange={setGamma} />
              </div>
            </div>

            <div className="panel-section">
              <div className="section-header">
                <span className="section-title">:: Colors & Compositing</span>
                <button className="section-reset" onClick={() => {
                  setMixMode('phosphor');
                }} title="Reset section">↺</button>
              </div>
              <div className="section-body">
                <div className="control-group">
                  <label className="control-label">Mix Mode</label>
                  <SegmentedControl options={[
                    { label: 'Phosphor', value: 'phosphor' },
                    { label: 'Mono', value: 'mono' },
                    { label: 'Original', value: 'original' },
                  ]} value={mixMode} onChange={setMixMode} />
                </div>
              </div>
            </div>

            <div className="panel-section">
              <div className="section-header">
                <span className="section-title">:: Export</span>
                <button className="section-reset" onClick={() => setExportScale(1)} title="Reset section">↺</button>
              </div>
              <div className="section-body">
                <div className="control-group">
                  <label className="control-label">Scale</label>
                  <SegmentedControl
                    options={[1, 2, 3, 4, 5, 6].map(s => ({ label: `${s}x`, value: s }))}
                    value={exportScale} onChange={setExportScale} />
                </div>
                <div className="btn-row">
                  <button className="btn-secondary" onClick={handleCopy} disabled={!hasContent}>Copy Text</button>
                </div>
                <div className="control-group">
                  <label className="control-label">Formats</label>
                  <div className="btn-grid">
                    {[
                      { label: 'PNG', fn: handleSavePNG },
                      { label: 'SVG', fn: handleSaveSVG },
                      { label: 'TXT', fn: handleSaveTXT },
                      { label: 'HTML', fn: handleSaveHTML },
                      { label: 'JSON', fn: handleSaveJSON },
                      { label: 'ANSI', fn: handleSaveANSI },
                    ].map(f => (
                      <button key={f.label} className="btn-secondary" onClick={f.fn} disabled={!hasContent}>{f.label}</button>
                    ))}
                  </div>
                </div>
                <button className="btn-primary" onClick={handleDownloadAll} disabled={!hasContent}>
                  Download All
                </button>
              </div>
            </div>
          </div>
        </aside>

        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />
        <input ref={fileInputRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} />
      </div>
    </div>
  );
}

export default App;
