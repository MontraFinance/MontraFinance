import { useEffect, useRef, useCallback } from 'react';

/**
 * Conway's Game of Life — animated canvas background.
 * Renders a subtle grid of living/dying cells that evolve
 * according to the classic B3/S23 rules.
 *
 * Styled to match an editorial manifesto aesthetic:
 * muted green cells on a warm cream background.
 */

const CELL_SIZE = 8;
const ALIVE_COLOR = 'rgba(0, 180, 80, 0.18)';
const FADE_COLOR = 'rgba(0, 180, 80, 0.06)';
const TICK_MS = 220;
const INITIAL_DENSITY = 0.12;

export default function GameOfLifeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<Uint8Array | null>(null);
  const fadeRef = useRef<Uint8Array | null>(null);
  const colsRef = useRef(0);
  const rowsRef = useRef(0);
  const rafRef = useRef(0);
  const lastTickRef = useRef(0);

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = document.documentElement.scrollHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);

    const cols = Math.ceil(w / CELL_SIZE);
    const rows = Math.ceil(h / CELL_SIZE);
    colsRef.current = cols;
    rowsRef.current = rows;

    const size = cols * rows;
    const grid = new Uint8Array(size);
    const fade = new Uint8Array(size);

    // Seed
    for (let i = 0; i < size; i++) {
      grid[i] = Math.random() < INITIAL_DENSITY ? 1 : 0;
    }

    gridRef.current = grid;
    fadeRef.current = fade;
  }, []);

  const step = useCallback(() => {
    const grid = gridRef.current;
    const fade = fadeRef.current;
    if (!grid || !fade) return;

    const cols = colsRef.current;
    const rows = rowsRef.current;
    const size = cols * rows;
    const next = new Uint8Array(size);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let neighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = (x + dx + cols) % cols;
            const ny = (y + dy + rows) % rows;
            neighbors += grid[ny * cols + nx];
          }
        }
        const idx = y * cols + x;
        const alive = grid[idx];
        if (alive) {
          next[idx] = neighbors === 2 || neighbors === 3 ? 1 : 0;
        } else {
          next[idx] = neighbors === 3 ? 1 : 0;
        }

        // Track fade: was alive, now dead
        if (alive && !next[idx]) {
          fade[idx] = 4; // fade frames
        } else if (fade[idx] > 0) {
          fade[idx]--;
        }
      }
    }

    gridRef.current = next;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const grid = gridRef.current;
    const fade = fadeRef.current;
    if (!canvas || !grid || !fade) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cols = colsRef.current;
    const rows = rowsRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = y * cols + x;
        if (grid[idx]) {
          ctx.fillStyle = ALIVE_COLOR;
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
        } else if (fade[idx] > 0) {
          ctx.fillStyle = FADE_COLOR;
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
        }
      }
    }
  }, []);

  useEffect(() => {
    init();

    const loop = (ts: number) => {
      if (ts - lastTickRef.current >= TICK_MS) {
        step();
        draw();
        lastTickRef.current = ts;
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    const onResize = () => {
      init();
      draw();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, [init, step, draw]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
