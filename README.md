# Opaque ▓▒░

A fully client-side web application that converts uploaded images and live camera feeds into real-time ASCII art. Features a classic green terminal aesthetic.

## ⚡ Features

- **Image Upload** — Drag-and-drop or file picker (JPEG, PNG, WebP)
- **Live Camera** — Real-time webcam feed processed frame-by-frame
- **ASCII Engine** — Pixel luminance → density character mapping, rendered at up to 60fps via `requestAnimationFrame`
- **Resolution Control** — Adjustable column width (50–250)
- **3 Color Modes** — Classic Green (#00FF41 with glow), Monochrome (white on black), True Color (per-character pixel-accurate colors)
- **Brightness / Contrast** — Real-time adjustment sliders
- **Export** — Copy raw ASCII to clipboard, save rendered output as PNG

## 🛠️ Tech Stack

- **React** (Vite)
- **Canvas API** — pixel extraction and image processing
- **WebRTC** — `navigator.mediaDevices.getUserMedia` for camera access
- **VT323** — monospace retro terminal font from Google Fonts

No backend. 100% client-side.

## 🚀 Getting Started
