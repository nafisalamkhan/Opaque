# Opaque

A premium client-side ASCII art generator with a retro terminal aesthetic and polished dark/light theme UI.

[![Vercel](https://img.shields.io/badge/deployed%20on-Vercel-000?style=flat&logo=vercel)](https://opaque-zeta.vercel.app/)

## Features

- **Image Upload** — Drag-and-drop or file picker (JPEG, PNG, WebP)
- **Live Camera** — Real-time webcam via `getUserMedia` + `requestAnimationFrame`
- **ASCII Engine** — Luminance mapping `(r·0.299)+(g·0.587)+(b·0.114)` with gamma/brightness/contrast/invert and per-pixel color extraction
- **4 Density Profiles** — Standard, Blocks, Detailed, Minimal with editable character ramp and bias control
- **3 Mix Modes** — Phosphor (`#39FF14` on black), Mono (theme-aware black/white), Original (per-character pixel-accurate RGB)
- **Adjustable Sampling** — Column width (40–350), height scale, pixelate, density bias with randomize
- **Light/Dark Theme** — Toggle with 36+ CSS custom properties; light mode uses soft dark grays (`#1C1C1E`)
- **Multi-Format Export** — PNG (1x–6x scale with WYSIWYG `ctx.textBaseline='top'` rendering), SVG, TXT, HTML, JSON, ANSI, and Download All
- **Scale Protection** — Automatic fallback if canvas exceeds browser limits, with toast notification
- **Glassmorphic Toasts** — `backdrop-filter: blur(12px)` notifications for copy and all download actions
- **Premium UI** — Glowing phosphor `#39FF14` logo with CRT `text-shadow`, pill sliders, segmented controls, header utility buttons with inline SVGs, shuffle SVG icon
- **Glowing Phosphor Logo** — VT323 at 24px with layered green glow `text-shadow`
- **Fully Responsive** — 1100px, 768px, 480px breakpoints
- **Copy to Clipboard** — With slide-up glassmorphic toast

## Tech Stack

- **React** (Vite)
- **Canvas API** — pixel extraction, character measurement, WYSIWYG PNG rendering
- **WebRTC** — `navigator.mediaDevices.getUserMedia` for camera input
- **VT323** — monospace retro terminal font from Google Fonts
- **Inter** — UI sans-serif font
- **SVG** — inline vector icons for all UI controls

100% client-side. No backend.
