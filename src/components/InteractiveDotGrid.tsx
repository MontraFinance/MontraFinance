import { useEffect, useRef, useCallback } from 'react';

/**
 * Interactive Dot Grid — cursor-reactive canvas background.
 * A grid of vertical dashes with ambient wave animation and
 * dramatic blue glow that follows the cursor.
 * Inspired by base.org's hero background.
 */

const DOT_SPACING = 18;
const DOT_WIDTH = 2;
const DOT_BASE_HEIGHT = 4;
const DOT_MAX_HEIGHT = 24;
const CURSOR_RADIUS = 280;
const WAVE_SPEED = 0.0008;
const WAVE_SCALE = 0.015;
const WAVE_AMPLITUDE = 8;

// Ambient base visibility
const BASE_ALPHA = 0.14;
const CURSOR_ALPHA = 0.85;

// Colors — Montra brand blue
const BASE_R = 170, BASE_G = 168, BASE_B = 165;
const GLOW_R = 30, GLOW_G = 30, GLOW_B = 255;

export default function InteractiveDotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const targetRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef(0);
  const dprRef = useRef(1);
  const timeRef = useRef(0);
  const startRef = useRef(Date.now());

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    dprRef.current = dpr;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = dprRef.current;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const time = (Date.now() - startRef.current) * WAVE_SPEED;
    timeRef.current = time;

    // Smooth lerp mouse position
    const cur = mouseRef.current;
    const tgt = targetRef.current;
    cur.x += (tgt.x - cur.x) * 0.12;
    cur.y += (tgt.y - cur.y) * 0.12;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cols = Math.ceil(w / DOT_SPACING) + 1;
    const rows = Math.ceil(h / DOT_SPACING) + 1;
    const offsetX = (w - (cols - 1) * DOT_SPACING) / 2;
    const offsetY = (h - (rows - 1) * DOT_SPACING) / 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = offsetX + col * DOT_SPACING;
        const y = offsetY + row * DOT_SPACING;

        // --- Ambient wave animation ---
        const wave1 = Math.sin(x * WAVE_SCALE + time) * Math.cos(y * WAVE_SCALE * 0.7 + time * 0.6);
        const wave2 = Math.sin((x + y) * WAVE_SCALE * 0.5 + time * 1.3) * 0.5;
        const wave = (wave1 + wave2) * WAVE_AMPLITUDE;

        // Ambient height varies with wave
        const ambientH = DOT_BASE_HEIGHT + Math.max(0, wave);
        const ambientAlpha = BASE_ALPHA + Math.max(0, wave1 * 0.06);

        // --- Cursor proximity ---
        const dx = x - cur.x;
        const dy = y - cur.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const rawT = Math.max(0, 1 - dist / CURSOR_RADIUS);
        const t = rawT * rawT * (3 - 2 * rawT); // smoothstep

        // Final values — blend ambient + cursor
        const dotH = ambientH + (DOT_MAX_HEIGHT - ambientH) * t;
        const alpha = ambientAlpha + (CURSOR_ALPHA - ambientAlpha) * t;

        const r = BASE_R + (GLOW_R - BASE_R) * t;
        const g = BASE_G + (GLOW_G - BASE_G) * t;
        const b = BASE_B + (GLOW_B - BASE_B) * t;

        ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${alpha.toFixed(3)})`;
        ctx.fillRect(
          x - DOT_WIDTH / 2,
          y - dotH / 2,
          DOT_WIDTH,
          dotH
        );
      }
    }

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    resize();
    rafRef.current = requestAnimationFrame(draw);

    const onMove = (e: MouseEvent) => {
      targetRef.current = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => {
      targetRef.current = { x: -9999, y: -9999 };
    };

    window.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('resize', resize);
    };
  }, [resize, draw]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
