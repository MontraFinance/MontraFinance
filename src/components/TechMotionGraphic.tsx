import { useEffect, useRef } from 'react';

const TechMotionGraphic = () => {
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

    // Node positions for the neural network layers
    const layers = [3, 5, 7, 5, 3];
    const getNodePositions = (w: number, h: number) => {
      const nodes: { x: number; y: number; layer: number; index: number }[] = [];
      const layerSpacing = w / (layers.length + 1);
      layers.forEach((count, li) => {
        const x = layerSpacing * (li + 1);
        const nodeSpacing = h / (count + 1);
        for (let ni = 0; ni < count; ni++) {
          nodes.push({ x, y: nodeSpacing * (ni + 1), layer: li, index: ni });
        }
      });
      return nodes;
    };

    // Data packets traveling along connections
    interface Packet {
      fromNode: number;
      toNode: number;
      progress: number;
      speed: number;
      born: number;
    }

    const packets: Packet[] = [];
    let lastPacketSpawn = 0;

    // Particle field
    interface Particle {
      x: number; y: number; vx: number; vy: number; size: number; alpha: number; life: number; maxLife: number;
    }
    const particles: Particle[] = [];

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);
      time += 0.016;

      const primaryHue = 240;
      const primary = (a: number) => `hsla(${primaryHue}, 100%, 50%, ${a})`;
      const primaryLight = (a: number) => `hsla(${primaryHue}, 100%, 70%, ${a})`;

      // === BACKGROUND GRID ===
      ctx.strokeStyle = primary(0.03);
      ctx.lineWidth = 0.5;
      const gridSize = 30;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // === ROTATING RINGS ===
      for (let r = 0; r < 3; r++) {
        const radius = 80 + r * 50;
        const rotation = time * (0.3 + r * 0.15) * (r % 2 === 0 ? 1 : -1);
        const dashCount = 40 + r * 20;
        const alpha = 0.08 + Math.sin(time * 0.5 + r) * 0.04;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation);

        for (let i = 0; i < dashCount; i++) {
          const angle = (i / dashCount) * Math.PI * 2;
          const dashLen = 0.04 + Math.sin(time * 2 + i * 0.5) * 0.02;
          const startAngle = angle;
          const endAngle = angle + dashLen;

          ctx.beginPath();
          ctx.arc(0, 0, radius, startAngle, endAngle);
          ctx.strokeStyle = primary(alpha + Math.sin(time * 3 + i) * 0.03);
          ctx.lineWidth = 1 + Math.sin(time * 2 + i * 0.3) * 0.5;
          ctx.stroke();
        }

        // Orbiting nodes on rings
        const orbitCount = 2 + r;
        for (let o = 0; o < orbitCount; o++) {
          const angle = rotation * 2 + (o / orbitCount) * Math.PI * 2;
          const ox = Math.cos(angle) * radius;
          const oy = Math.sin(angle) * radius;
          const pulse = 2 + Math.sin(time * 4 + o) * 1;

          // Glow
          const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, pulse * 4);
          grad.addColorStop(0, primary(0.4));
          grad.addColorStop(1, primary(0));
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(ox, oy, pulse * 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = primary(0.8);
          ctx.beginPath();
          ctx.arc(ox, oy, pulse, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      // === NEURAL NETWORK ===
      const nodes = getNodePositions(w, h);

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          if (nodes[j].layer === nodes[i].layer + 1) {
            const pulse = Math.sin(time * 2 + i * 0.3 + j * 0.2) * 0.5 + 0.5;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);

            // Curved connections
            const midX = (nodes[i].x + nodes[j].x) / 2;
            const curve = Math.sin(time + i + j) * 10;
            ctx.quadraticCurveTo(midX, (nodes[i].y + nodes[j].y) / 2 + curve, nodes[j].x, nodes[j].y);

            ctx.strokeStyle = primary(0.03 + pulse * 0.06);
            ctx.lineWidth = 0.5 + pulse * 0.5;
            ctx.stroke();
          }
        }
      }

      // Spawn data packets
      if (time - lastPacketSpawn > 0.15 && packets.length < 30) {
        const fromLayer = Math.floor(Math.random() * (layers.length - 1));
        const fromNodes = nodes.filter(n => n.layer === fromLayer);
        const toNodes = nodes.filter(n => n.layer === fromLayer + 1);
        const fromNode = nodes.indexOf(fromNodes[Math.floor(Math.random() * fromNodes.length)]);
        const toNode = nodes.indexOf(toNodes[Math.floor(Math.random() * toNodes.length)]);
        packets.push({ fromNode, toNode, progress: 0, speed: 0.4 + Math.random() * 0.6, born: time });
        lastPacketSpawn = time;
      }

      // Draw & update packets
      for (let p = packets.length - 1; p >= 0; p--) {
        const pkt = packets[p];
        pkt.progress += pkt.speed * 0.016;
        if (pkt.progress >= 1) { packets.splice(p, 1); continue; }

        const from = nodes[pkt.fromNode];
        const to = nodes[pkt.toNode];
        const t = pkt.progress;
        const midX = (from.x + to.x) / 2;
        const curve = Math.sin(pkt.born + pkt.fromNode + pkt.toNode) * 10;
        const midY = (from.y + to.y) / 2 + curve;
        // Quadratic bezier point
        const px = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * midX + t * t * to.x;
        const py = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * midY + t * t * to.y;

        const grad = ctx.createRadialGradient(px, py, 0, px, py, 8);
        grad.addColorStop(0, primaryLight(0.8));
        grad.addColorStop(1, primary(0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = primaryLight(1);
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw nodes
      for (const node of nodes) {
        const pulse = Math.sin(time * 3 + node.layer * 0.8 + node.index * 0.5) * 0.5 + 0.5;
        const size = 2.5 + pulse * 1.5;

        // Glow
        const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, size * 5);
        grad.addColorStop(0, primary(0.15 + pulse * 0.1));
        grad.addColorStop(1, primary(0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(node.x, node.y, size * 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = primary(0.5 + pulse * 0.4);
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = primaryLight(0.8 + pulse * 0.2);
        ctx.beginPath();
        ctx.arc(node.x, node.y, size * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // === FLOATING PARTICLES ===
      if (Math.random() < 0.3) {
        particles.push({
          x: Math.random() * w,
          y: h + 5,
          vx: (Math.random() - 0.5) * 0.3,
          vy: -(0.3 + Math.random() * 0.5),
          size: 0.5 + Math.random() * 1.5,
          alpha: 0.1 + Math.random() * 0.3,
          life: 0,
          maxLife: 3 + Math.random() * 4,
        });
      }

      for (let p = particles.length - 1; p >= 0; p--) {
        const pt = particles[p];
        pt.life += 0.016;
        if (pt.life > pt.maxLife) { particles.splice(p, 1); continue; }
        pt.x += pt.vx + Math.sin(time * 2 + pt.x * 0.01) * 0.1;
        pt.y += pt.vy;
        const fadeIn = Math.min(pt.life * 2, 1);
        const fadeOut = Math.max(1 - (pt.life - pt.maxLife + 1), 0);
        const a = pt.alpha * fadeIn * fadeOut;

        ctx.fillStyle = primary(a);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // === HEXAGONAL NODES (floating) ===
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + time * 0.1;
        const radius = 140 + Math.sin(time * 0.3 + i) * 30;
        const hx = cx + Math.cos(angle) * radius;
        const hy = cy + Math.sin(angle) * radius;
        const pulse = Math.sin(time * 2 + i * 1.2) * 0.5 + 0.5;

        // Hex shape
        ctx.beginPath();
        for (let v = 0; v < 6; v++) {
          const va = (v / 6) * Math.PI * 2 - Math.PI / 6 + time * 0.5;
          const vr = 6 + pulse * 3;
          const vx = hx + Math.cos(va) * vr;
          const vy = hy + Math.sin(va) * vr;
          v === 0 ? ctx.moveTo(vx, vy) : ctx.lineTo(vx, vy);
        }
        ctx.closePath();
        ctx.strokeStyle = primary(0.2 + pulse * 0.15);
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.fillStyle = primary(0.03 + pulse * 0.04);
        ctx.fill();

        // Connection line to center
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(cx, cy);
        ctx.strokeStyle = primary(0.02 + pulse * 0.02);
        ctx.lineWidth = 0.3;
        ctx.stroke();
      }

      // === CENTER CORE ===
      const coreSize = 12 + Math.sin(time * 1.5) * 3;
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreSize * 3);
      coreGrad.addColorStop(0, primary(0.2));
      coreGrad.addColorStop(0.5, primary(0.05));
      coreGrad.addColorStop(1, primary(0));
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreSize * 3, 0, Math.PI * 2);
      ctx.fill();

      // Core inner ring
      ctx.beginPath();
      ctx.arc(cx, cy, coreSize, 0, Math.PI * 2);
      ctx.strokeStyle = primary(0.3 + Math.sin(time * 2) * 0.1);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Core dot
      ctx.fillStyle = primaryLight(0.9);
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();

      // === DATA LABELS (floating text) ===
      ctx.font = '9px "Geist Mono", monospace';
      const labels = [
        { text: 'SIGNAL_PROC', angle: -0.8 + time * 0.05, r: 170 },
        { text: 'MONTRA_ENGINE', angle: 0.5 + time * 0.04, r: 185 },
        { text: 'RISK_ANALYSIS', angle: 2.2 + time * 0.06, r: 160 },
        { text: 'QWEN_2.5_32B', angle: 3.8 + time * 0.03, r: 175 },
        { text: 'BASE_CHAIN', angle: 5.0 + time * 0.05, r: 165 },
      ];
      for (const lbl of labels) {
        const lx = cx + Math.cos(lbl.angle) * lbl.r;
        const ly = cy + Math.sin(lbl.angle) * lbl.r;
        const alpha = 0.15 + Math.sin(time * 1.5 + lbl.angle) * 0.08;
        ctx.fillStyle = primary(alpha);
        ctx.textAlign = 'center';
        ctx.fillText(lbl.text, lx, ly);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  );
};

export default TechMotionGraphic;
