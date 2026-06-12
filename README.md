# Opaque ▓▒░

A fully client-side web app that converts images and live camera feeds into real-time ASCII art with retro terminal aesthetics.


## Features

- **Image Upload** — Drag-and-drop or file picker (JPEG, PNG, WebP)
- **Live Camera** — Real-time webcam processing via `getUserMedia` + `requestAnimationFrame`
- **ASCII Engine** — Luminance formula `(r·0.299)+(g·0.587)+(b·0.114)` mapped to a 32-character density string; aspect-ratio corrected for proper proportions
- **Resolution Control** — Adjustable column width (80–350)
- **3 Color Modes** — Classic Green (#00FF41 terminal glow), Monochrome (white on black), True Color (per-character pixel-accurate RGB)
- **Brightness / Contrast** — Real-time adjustment with per-pixel processing
- **High-Res Export** — PNG download rendered at 32px font size for ultra-resolution output
- **Copy to Clipboard** — Raw ASCII text export

## Tech Stack

- **React** (Vite)
- **Canvas API** — pixel extraction and image processing
- **WebRTC** — `navigator.mediaDevices.getUserMedia` for camera input
- **VT323** — monospace retro terminal font from Google Fonts

No backend. 100% client-side.
