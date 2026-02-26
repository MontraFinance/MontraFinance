import { useEffect, useRef } from 'react';

type DitherVariant = 'engine' | 'terminal' | 'marketplace' | 'visualizations';

interface DitherGraphicProps {
  variant: DitherVariant;
  className?: string;
}

const PIXEL_SIZE = 4;

const DitherGraphic = ({ variant, className = '' }: DitherGraphicProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let time = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    // Dither pattern: Bayer 4x4 matrix normalized
    const bayer4x4 = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5],
    ].map(row => row.map(v => v / 16));

    const dither = (x: number, y: number, intensity: number): boolean => {
      const bx = Math.floor(x / PIXEL_SIZE) % 4;
      const by = Math.floor(y / PIXEL_SIZE) % 4;
      return intensity > bayer4x4[by][bx];
    };

    const primaryColor = 'hsl(240, 100%, 50%)';
    const primaryLight = 'hsl(240, 100%, 70%)';
    const primaryDim = 'hsl(240, 100%, 40%)';

    const drawPixel = (x: number, y: number, color: string) => {
      ctx.fillStyle = color;
      const px = Math.floor(x / PIXEL_SIZE) * PIXEL_SIZE;
      const py = Math.floor(y / PIXEL_SIZE) * PIXEL_SIZE;
      ctx.fillRect(px, py, PIXEL_SIZE - 1, PIXEL_SIZE - 1);
    };

    const drawDitheredCircle = (cx: number, cy: number, radius: number, intensity: number, color: string, w: number, h: number) => {
      const startX = Math.max(0, Math.floor((cx - radius) / PIXEL_SIZE) * PIXEL_SIZE);
      const endX = Math.min(w, Math.ceil((cx + radius) / PIXEL_SIZE) * PIXEL_SIZE);
      const startY = Math.max(0, Math.floor((cy - radius) / PIXEL_SIZE) * PIXEL_SIZE);
      const endY = Math.min(h, Math.ceil((cy + radius) / PIXEL_SIZE) * PIXEL_SIZE);

      for (let x = startX; x < endX; x += PIXEL_SIZE) {
        for (let y = startY; y < endY; y += PIXEL_SIZE) {
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          if (dist < radius) {
            const falloff = 1 - dist / radius;
            const i = falloff * intensity;
            if (dither(x, y, i)) {
              drawPixel(x, y, color);
            }
          }
        }
      }
    };

    const drawDitheredLine = (x1: number, y1: number, x2: number, y2: number, thickness: number, intensity: number, color: string) => {
      const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      const steps = Math.ceil(len / PIXEL_SIZE);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t;
        for (let dy = -thickness; dy <= thickness; dy += PIXEL_SIZE) {
          for (let dx = -thickness; dx <= thickness; dx += PIXEL_SIZE) {
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d <= thickness && dither(x + dx, y + dy, intensity * (1 - d / thickness))) {
              drawPixel(x + dx, y + dy, color);
            }
          }
        }
      }
    };

    // === VARIANT RENDERERS ===
    const drawEngine = (w: number, h: number) => {
      const cx = w / 2;
      const cy = h / 2;

      // Pulsing core
      const coreR = 20 + Math.sin(time * 2) * 5;
      drawDitheredCircle(cx, cy, coreR, 0.9, primaryColor, w, h);
      drawDitheredCircle(cx, cy, coreR * 0.5, 1, primaryLight, w, h);

      // Orbiting gears/rings
      for (let r = 0; r < 3; r++) {
        const radius = 40 + r * 22;
        const segments = 12 + r * 4;
        const rot = time * (1 - r * 0.3) * (r % 2 === 0 ? 1 : -1);
        for (let i = 0; i < segments; i++) {
          const angle = (i / segments) * Math.PI * 2 + rot;
          const next = ((i + 1) / segments) * Math.PI * 2 + rot;
          if (i % 2 === 0) {
            const x1 = cx + Math.cos(angle) * radius;
            const y1 = cy + Math.sin(angle) * radius;
            const x2 = cx + Math.cos(next) * radius;
            const y2 = cy + Math.sin(next) * radius;
            drawDitheredLine(x1, y1, x2, y2, PIXEL_SIZE, 0.6 - r * 0.15, primaryColor);
          }
        }
        // Nodes on ring
        const nodeCount = 3 + r;
        for (let n = 0; n < nodeCount; n++) {
          const a = (n / nodeCount) * Math.PI * 2 + rot * 1.5;
          const nx = cx + Math.cos(a) * radius;
          const ny = cy + Math.sin(a) * radius;
          const pulse = Math.sin(time * 3 + n + r) * 0.3 + 0.7;
          drawDitheredCircle(nx, ny, 4 + pulse * 2, pulse, primaryLight, w, h);
        }
      }

      // Data beams radiating outward
      for (let b = 0; b < 8; b++) {
        const angle = (b / 8) * Math.PI * 2 + time * 0.2;
        const progress = ((time * 0.8 + b * 0.4) % 1);
        const bx = cx + Math.cos(angle) * (30 + progress * 70);
        const by = cy + Math.sin(angle) * (30 + progress * 70);
        drawDitheredCircle(bx, by, 3, 1 - progress, primaryLight, w, h);
      }
    };

    const drawTerminal = (w: number, h: number) => {
      const margin = 16;
      const termW = w - margin * 2;
      const termH = h - margin * 2;

      // Terminal frame
      for (let x = margin; x < margin + termW; x += PIXEL_SIZE) {
        if (dither(x, 0, 0.5)) drawPixel(x, margin, primaryDim);
        if (dither(x, 0, 0.5)) drawPixel(x, margin + termH, primaryDim);
      }
      for (let y = margin; y < margin + termH; y += PIXEL_SIZE) {
        if (dither(0, y, 0.5)) drawPixel(margin, y, primaryDim);
        if (dither(0, y, 0.5)) drawPixel(margin + termW, y, primaryDim);
      }

      // Title bar dots
      for (let d = 0; d < 3; d++) {
        drawDitheredCircle(margin + 12 + d * 12, margin + 10, 3, 0.8, d === 0 ? primaryColor : primaryDim, w, h);
      }

      // Typing cursor
      const cursorX = margin + 12 + ((time * 60) % (termW - 40));
      const lineY = margin + 30;
      const blinkOn = Math.sin(time * 6) > 0;

      // Chat lines (scrolling)
      const lineCount = 6;
      for (let l = 0; l < lineCount; l++) {
        const ly = lineY + l * 18;
        if (ly > margin + termH - 10) break;
        const isUser = l % 3 === 0;
        const lineLen = 30 + Math.sin(l * 2.5 + time * 0.3) * 20 + (isUser ? 0 : 40);
        const alpha = l === lineCount - 1 ? 0.3 + Math.sin(time * 4) * 0.2 : 0.5;
        const color = isUser ? primaryLight : primaryColor;

        // Prefix indicator
        drawDitheredCircle(margin + 10, ly + 2, 2, 0.8, color, w, h);

        for (let px = margin + 18; px < margin + 18 + lineLen; px += PIXEL_SIZE) {
          if (dither(px, ly, alpha)) {
            drawPixel(px, ly, color);
          }
          // Gaps for "words"
          if ((px - margin) % 28 < PIXEL_SIZE) continue;
        }
      }

      // Blinking cursor
      if (blinkOn) {
        for (let cy = lineY + (lineCount - 1) * 18 - 2; cy < lineY + (lineCount - 1) * 18 + 8; cy += PIXEL_SIZE) {
          drawPixel(cursorX, cy, primaryLight);
        }
      }

      // Floating AI particles
      for (let p = 0; p < 5; p++) {
        const px = w * 0.7 + Math.sin(time * 1.5 + p * 1.3) * 30;
        const py = h * 0.3 + Math.cos(time * 1.2 + p * 0.9) * 25;
        drawDitheredCircle(px, py, 6 + Math.sin(time * 2 + p) * 3, 0.4, primaryColor, w, h);
      }
    };

    const drawMarketplace = (w: number, h: number) => {
      const cx = w / 2;
      const cy = h / 2;

      // Grid of strategy cards (dithered boxes)
      const cols = 3;
      const rows = 3;
      const cardW = 36;
      const cardH = 28;
      const gap = 8;
      const gridW = cols * (cardW + gap) - gap;
      const gridH = rows * (cardH + gap) - gap;
      const startX = cx - gridW / 2;
      const startY = cy - gridH / 2;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = startX + c * (cardW + gap);
          const y = startY + r * (cardH + gap);
          const wave = Math.sin(time * 2 + r * 0.5 + c * 0.7) * 0.3 + 0.5;
          const highlighted = Math.floor((time * 0.5) % (cols * rows)) === r * cols + c;

          // Card outline
          for (let px = x; px < x + cardW; px += PIXEL_SIZE) {
            if (dither(px, 0, wave)) {
              drawPixel(px, y, highlighted ? primaryLight : primaryDim);
              drawPixel(px, y + cardH, highlighted ? primaryLight : primaryDim);
            }
          }
          for (let py = y; py < y + cardH; py += PIXEL_SIZE) {
            if (dither(0, py, wave)) {
              drawPixel(x, py, highlighted ? primaryLight : primaryDim);
              drawPixel(x + cardW, py, highlighted ? primaryLight : primaryDim);
            }
          }

          // Mini bar chart inside card
          const bars = 4;
          for (let b = 0; b < bars; b++) {
            const barH = 4 + Math.sin(time * 1.5 + b + r + c) * 6 + 6;
            const bx = x + 4 + b * 8;
            for (let by = y + cardH - 4 - barH; by < y + cardH - 4; by += PIXEL_SIZE) {
              if (dither(bx, by, highlighted ? 0.9 : 0.5)) {
                drawPixel(bx, by, highlighted ? primaryLight : primaryColor);
              }
            }
          }
        }
      }

      // Connection lines between cards
      for (let i = 0; i < 4; i++) {
        const progress = ((time * 0.6 + i * 0.25) % 1);
        const fromR = Math.floor(i / 2);
        const fromC = i % 2;
        const toR = fromR + (i < 2 ? 0 : 1);
        const toC = fromC + 1;
        const x1 = startX + fromC * (cardW + gap) + cardW;
        const y1 = startY + fromR * (cardH + gap) + cardH / 2;
        const x2 = startX + toC * (cardW + gap);
        const y2 = startY + toR * (cardH + gap) + cardH / 2;
        const px = x1 + (x2 - x1) * progress;
        const py = y1 + (y2 - y1) * progress;
        drawDitheredCircle(px, py, 3, 1 - progress * 0.5, primaryLight, w, h);
      }
    };

    const drawVisualizations = (w: number, h: number) => {
      const cx = w / 2;
      const cy = h / 2;

      // 3D wireframe cube (isometric projection)
      const size = 35;
      const rotY = time * 0.7;
      const rotX = Math.PI * 0.15;

      const project = (x: number, y: number, z: number): [number, number] => {
        const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
        const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
        const rx = x * cosY - z * sinY;
        const rz = x * sinY + z * cosY;
        const ry = y * cosX - rz * sinX;
        return [cx + rx, cy + ry];
      };

      const vertices: [number, number, number][] = [
        [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
        [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
      ].map(([x, y, z]) => [x * size, y * size, z * size]);

      const edges: [number, number][] = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
      ];

      // Draw edges
      for (const [a, b] of edges) {
        const [x1, y1] = project(...vertices[a]);
        const [x2, y2] = project(...vertices[b]);
        drawDitheredLine(x1, y1, x2, y2, PIXEL_SIZE * 0.5, 0.6, primaryColor);
      }

      // Vertices as bright dots
      for (const v of vertices) {
        const [px, py] = project(...v);
        drawDitheredCircle(px, py, 4, 0.9, primaryLight, w, h);
      }

      // Scattered data points around the cube
      for (let p = 0; p < 20; p++) {
        const angle = (p / 20) * Math.PI * 2 + time * 0.3;
        const radius = 55 + Math.sin(time + p * 0.8) * 15;
        const elevation = Math.sin(time * 0.5 + p * 0.6) * 25;
        const px = cx + Math.cos(angle) * radius;
        const py = cy + elevation + Math.sin(angle) * radius * 0.3;
        const intensity = 0.2 + Math.sin(time * 2 + p) * 0.15;
        drawDitheredCircle(px, py, 2, intensity, primaryDim, w, h);
      }

      // Wave form at bottom
      for (let x = 0; x < w; x += PIXEL_SIZE) {
        const wave = Math.sin(x * 0.05 + time * 2) * 12 + Math.sin(x * 0.02 - time) * 8;
        const baseY = h * 0.82 + wave;
        const intensity = 0.3 + Math.sin(x * 0.03 + time) * 0.15;
        if (dither(x, baseY, intensity)) {
          drawPixel(x, baseY, primaryColor);
        }
      }
    };

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);
      time += 0.016;

      switch (variant) {
        case 'engine': drawEngine(w, h); break;
        case 'terminal': drawTerminal(w, h); break;
        case 'marketplace': drawMarketplace(w, h); break;
        case 'visualizations': drawVisualizations(w, h); break;
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [variant]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full ${className}`}
      style={{ display: 'block', imageRendering: 'pixelated' }}
    />
  );
};

export default DitherGraphic;
