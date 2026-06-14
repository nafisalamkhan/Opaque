import { useState, useRef, useCallback } from 'react';
import { useAsciiRender, getCharWidth } from './hooks/useAsciiRender';
import './App.css';

const BLEND_MODES = [
  'Normal', 'Multiply', 'Screen', 'Overlay', 'Darken', 'Lighten',
  'Color Dodge', 'Color Burn', 'Soft Light', 'Hard Light',
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
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      html += `<span style="color:${color}">${chars}</span>`;
      i = j;
    }
    if (y < lines.length - 1) html += '\n';
  }
  return html;
}

function exportSVG(text, colors, mixMode, fontSize) {
  const lines = text.split('\n').filter(l => l.length > 0);
  if (!lines.length) return '';
  const charW = getCharWidth(fontSize);
  const charH = fontSize * 1.2;
  const cols = lines[0].length;
  const rows = lines.length;
  const isMono = mixMode === 'mono';
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * charW}" height="${rows * charH}">`;
  svg += `<style>text{font:${fontSize}px VT323,'Courier New',monospace}</style>`;
  svg += `<rect width="100%" height="100%" fill="#000"/>`;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < lines[y].length; x++) {
      const color = isMono ? '#00FF41' : (colors[y]?.[x] || '#00FF41');
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
  const isMono = mixMode === 'mono';
  for (let y = 0; y < lines.length; y++) {
    for (let x = 0; x < lines[y].length; x++) {
      if (isMono) out += '\x1b[92m' + lines[y][x];
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

function SettingsCard({ title, onReset, children }) {
  return (
    <div className="settings-card">
      <div className="card-header">
        <span className="card-title">:: {title}</span>
        <button className="card-reset" onClick={onReset} title="Reset section">↺</button>
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('generate');
  const [mixMode, setMixMode] = useState('mono');
  const [densityProfile, setDensityProfile] = useState('standard');
  const [densityBias, setDensityBias] = useState(1);
  const [width, setWidth] = useState(120);
  const [heightScale, setHeightScale] = useState(1);
  const [pixelate, setPixelate] = useState(0);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [gamma, setGamma] = useState(1);
  const [invertL, setInvertL] = useState(false);
  const [background, setBackground] = useState('solid');
  const [blendMode, setBlendMode] = useState('normal');
  const [cameraActive, setCameraActive] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [exportScale, setExportScale] = useState(1);
  const [compositions, setCompositions] = useState([]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const preRef = useRef(null);
  const fileInputRef = useRef(null);

  const { text, colors } = useAsciiRender({
    videoRef, canvasRef, width, brightness, contrast, gamma, invertL,
    cameraActive, imageSource: uploadedImage, densityProfile, densityBias,
    heightScale, pixelate, mixMode, background, blendMode,
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
    setInvertL(false); setDensityProfile('standard'); setDensityBias(1);
    setHeightScale(1); setMixMode('mono'); setBackground('solid');
    setBlendMode('normal');
  }, []);

  const handleRandomBias = useCallback(() => {
    setDensityBias(+(Math.random() * 2.8 + 0.2).toFixed(2));
  }, []);

  const handleAddToCompose = useCallback(() => {
    setCompositions(prev => [...prev, { text, colors, mixMode }]);
  }, [text, colors, mixMode]);

  const EXPORT_FONTSIZE = 32;

  const renderExportCanvas = useCallback((scale) => {
    const lines = text.split('\n').filter(l => l.length > 0);
    if (!lines.length) return null;
    const cols = lines[0].length;
    const rows = lines.length;
    const fontSize = EXPORT_FONTSIZE * scale;
    const charW = getCharWidth(fontSize);
    const charH = fontSize * 1.2;
    const c = document.createElement('canvas');
    c.width = Math.ceil(cols * charW);
    c.height = Math.ceil(rows * charH);
    const ctx = c.getContext('2d');
    if (background === 'solid') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.font = `${fontSize}px VT323, 'Courier New', monospace`;
    const isMono = mixMode === 'mono';
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < lines[y].length; x++) {
        ctx.fillStyle = isMono ? '#00FF41' : (colors[y]?.[x] || '#00FF41');
        ctx.fillText(lines[y][x], x * charW, (y + 1) * charH);
      }
    return c;
  }, [text, colors, mixMode, background]);

  const handleSavePNG = useCallback(() => {
    const c = renderExportCanvas(exportScale);
    if (!c) return;
    const link = document.createElement('a');
    link.download = 'opaque-ascii.png';
    link.href = c.toDataURL('image/png');
    link.click();
  }, [renderExportCanvas, exportScale]);

  const handleSaveSVG = useCallback(() => {
    const svg = exportSVG(text, colors, mixMode, EXPORT_FONTSIZE * exportScale);
    if (svg) download('opaque-ascii.svg', svg, 'image/svg+xml');
  }, [text, colors, mixMode, exportScale]);

  const handleSaveTXT = useCallback(() => {
    download('opaque-ascii.txt', text, 'text/plain');
  }, [text]);

  const handleSaveHTML = useCallback(() => {
    const lines = text.split('\n').filter(l => l.length > 0);
    const isMono = mixMode === 'mono';
    const content = isMono
      ? text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      : renderTrueColorHtml(lines, colors);
    const bgStyle = background === 'solid' ? 'background:#000;' : '';
    const html = `<!DOCTYPE html><html><head><style>
body{${bgStyle}color:#00FF41;font:16px VT323,'Courier New',monospace;white-space:pre;margin:0;padding:16px}
</style></head><body><pre>${content}</pre></body></html>`;
    download('opaque-ascii.html', html, 'text/html');
  }, [text, colors, mixMode, background]);

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
  const trueColorHtml = (mixMode !== 'mono') && hasContent ? renderTrueColorHtml(lines, colors) : '';

  if (activeTab === 'compose') {
    return (
      <div className="app">
        <header className="topbar">
          <div className="logo">Opaque</div>
          <div className="pill-tabs">
            <button className="tab" onClick={() => setActiveTab('generate')}>Generate</button>
            <button className="tab active" onClick={() => setActiveTab('compose')}>Compose</button>
          </div>
          <div className="topbar-actions" />
        </header>
        <div className="workspace">
          <div className="stage">
            <div className="empty-compose">
              <span className="empty-icon">📋</span>
              <p>{compositions.length} composition{compositions.length !== 1 ? 's' : ''}</p>
              {compositions.length > 0 && (
                <button className="btn-secondary" onClick={() => setCompositions([])}>Clear All</button>
              )}
              {compositions.length === 0 && <p className="empty-hint">Add compositions from the Generate tab</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`app ${dragOver ? 'drag-over' : ''}`}
      onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
    >
      <header className="topbar">
        <div className="logo">Opaque</div>
        <div className="pill-tabs">
          <button className="tab active" onClick={() => setActiveTab('generate')}>Generate</button>
          <button className="tab" onClick={() => setActiveTab('compose')}>Compose</button>
        </div>
        <div className="topbar-actions">
          <button className={`topbar-btn ${cameraActive ? 'active' : ''}`} onClick={handleCameraToggle} title="Toggle camera">
            {cameraActive ? '■' : '◉'}
          </button>
          <button className="topbar-btn" onClick={handleResetAll}>↺ Reset</button>
          <button className={`topbar-btn ${invertL ? 'active' : ''}`} onClick={() => setInvertL(s => !s)}>
            ⊗ Invert
          </button>
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
              className={`ascii-output ${mixMode === 'mono' ? 'mono' : 'color'} ${background === 'transparent' ? 'bg-transparent' : ''}`}
              style={blendMode !== 'normal' ? { mixBlendMode: blendMode } : undefined}
              tabIndex={0}
            >
              {mixMode !== 'mono' ? (
                <span dangerouslySetInnerHTML={{ __html: trueColorHtml }} />
              ) : (
                text
              )}
            </pre>
          )}
          {cameraError && <div className="camera-error">{cameraError}</div>}
        </main>

        <aside className="sidebar">
          <SettingsCard title="Sampling & Characters" onReset={() => {
            setDensityProfile('standard'); setDensityBias(1); setHeightScale(1); setPixelate(0);
          }}>
            <div className="control-group">
              <label className="control-label">Character Ramp</label>
              <SegmentedControl
                options={[
                  { label: 'Standard', value: 'standard' },
                  { label: 'Blocks', value: 'blocks' },
                  { label: 'Detailed', value: 'detailed' },
                  { label: 'Minimal', value: 'minimal' },
                ]}
                value={densityProfile}
                onChange={setDensityProfile}
              />
            </div>
            <div className="control-group">
              <label className="control-label">Density Bias</label>
              <div className="bias-row">
                <div className="slider-track">
                  <div className="slider-fill" style={{ width: `${((densityBias - 0.1) / (3 - 0.1)) * 100}%` }} />
                  <input
                    type="range" className="slider-input"
                    min={0.1} max={3} step={0.05}
                    value={densityBias}
                    onChange={e => setDensityBias(Number(e.target.value))}
                  />
                </div>
                <span className="slider-value">{densityBias.toFixed(2)}</span>
                <button className="btn-sm" onClick={handleRandomBias} title="Randomize">🎲</button>
              </div>
            </div>
            <Slider label="Width" value={width} min={40} max={350} step={1} onChange={setWidth} />
            <Slider label="Height Scale" value={heightScale} min={0.25} max={2.5} step={0.05} onChange={setHeightScale} />
            <Slider label="Pixelate" value={pixelate} min={0} max={1} step={0.05} onChange={setPixelate} />
          </SettingsCard>

          <SettingsCard title="Tone" onReset={() => {
            setBrightness(0); setContrast(0); setGamma(1);
          }}>
            <Slider label="Brightness" value={brightness} min={-1} max={1} step={0.05} onChange={setBrightness} />
            <Slider label="Contrast" value={contrast} min={-1} max={1} step={0.05} onChange={setContrast} />
            <Slider label="Gamma" value={gamma} min={0.1} max={3} step={0.05} onChange={setGamma} />
          </SettingsCard>

          <SettingsCard title="Colors & Compositing" onReset={() => {
            setMixMode('mono'); setBackground('solid'); setBlendMode('normal');
          }}>
            <div className="control-group">
              <label className="control-label">Mix Mode</label>
              <SegmentedControl
                options={[
                  { label: 'Mono', value: 'mono' },
                  { label: 'Multi', value: 'multi' },
                  { label: 'Original', value: 'original' },
                ]}
                value={mixMode}
                onChange={setMixMode}
              />
            </div>
            <div className="control-group">
              <label className="control-label">Background</label>
              <SegmentedControl
                options={[
                  { label: 'Solid', value: 'solid' },
                  { label: 'Transparent', value: 'transparent' },
                ]}
                value={background}
                onChange={setBackground}
              />
            </div>
            <div className="control-group">
              <label className="control-label">Blend Mode</label>
              <select className="select-blend" value={blendMode} onChange={e => setBlendMode(e.target.value)}>
                {BLEND_MODES.map(m => (
                  <option key={m} value={m.toLowerCase()}>{m}</option>
                ))}
              </select>
            </div>
          </SettingsCard>

          <SettingsCard title="Export" onReset={() => setExportScale(1)}>
            <div className="control-group">
              <label className="control-label">Scale</label>
              <SegmentedControl
                options={[1, 2, 3, 4, 5, 6].map(s => ({ label: `${s}x`, value: s }))}
                value={exportScale}
                onChange={setExportScale}
              />
            </div>
            <div className="btn-row">
              <button className="btn-secondary" onClick={handleCopy} disabled={!hasContent}>Copy Text</button>
              <button className="btn-secondary" onClick={handleAddToCompose} disabled={!hasContent}>
                Compose{compositions.length > 0 ? ` (${compositions.length})` : ''}
              </button>
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
                  <button key={f.label} className="btn-secondary" onClick={f.fn} disabled={!hasContent}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn-primary" onClick={handleDownloadAll} disabled={!hasContent}>
              Download All
            </button>
          </SettingsCard>
        </aside>

        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />
        <input ref={fileInputRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} />
      </div>
    </div>
  );
}

export default App;
