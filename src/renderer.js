import { PIECES } from './pieces.js';

const COLORS = {
  ink: '#080d18',
  board: '#111c30',
  boardEdge: '#d8a33c',
  brass: '#b47a24',
  brassLight: '#f0c96a',
  brassDark: '#6b4210',
  steel: '#b9c7da',
  steelDark: '#51617a',
  red: '#ef4444',
  pink: '#f472b6',
  gold: '#ffcf4a',
  purple: '#a855f7',
  cyan: '#38d9f5',
  green: '#34d399',
  white: '#f8fafc',
};

const MINI_COLORS = [
  { body: '#ef4444', dark: '#991b1b', light: '#fca5a5' },
  { body: '#3b82f6', dark: '#1e40af', light: '#93c5fd' },
  { body: '#22c55e', dark: '#15803d', light: '#86efac' },
  { body: '#f59e0b', dark: '#b45309', light: '#fcd34d' },
  { body: '#a855f7', dark: '#6b21a8', light: '#d8b4fe' },
];

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function starPath(ctx, cx, cy, outer, inner, points = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = rot + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function makeGear(color, teeth = 12) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.translate(128, 128);
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const r = i % 2 ? 84 : 108;
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(0, 0, 54, 0, Math.PI * 2);
  g.fillStyle = 'rgba(6,10,18,0.55)';
  g.fill();
  g.beginPath();
  g.arc(0, 0, 24, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
  return c;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.dpr = 1;
    this.w = 0;
    this.h = 0;
    this.W = 20;
    this.H = 13;
    this.cell = 32;
    this.ox = 0;
    this.oy = 0;
    this.time = 0;
    this.particles = [];
    this.shake = 0;
    this.tiltX = 0;
    this.tiltY = 0;
    this.bg = null;
    this.board = null;
    this.gearA = null;
    this.gearB = null;
    this.dust = [];
    this.goalPulse = 0;
    this.reducedMotion = false;
    this.resize();
  }

  setLevel(level) {
    this.W = level?.w || 20;
    this.H = level?.h || 13;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.w === w && this.h === h && this.bg) {
      this.layout();
      return;
    }
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.layout();
    this.buildBackground();
    this.buildBoard();
  }

  layout() {
    const pad = Math.max(6, Math.min(18, this.w * 0.02));
    const availW = this.w - pad * 2;
    const availH = this.h - pad * 2;
    this.cell = Math.max(8, Math.min(availW / this.W, availH / this.H));
    const bw = this.W * this.cell;
    const bh = this.H * this.cell;
    this.ox = (this.w - bw) / 2;
    this.oy = (this.h - bh) / 2;
    this.bw = bw;
    this.bh = bh;
  }

  buildBackground() {
    const c = document.createElement('canvas');
    c.width = Math.round(this.w * this.dpr);
    c.height = Math.round(this.h * this.dpr);
    const g = c.getContext('2d');
    g.scale(this.dpr, this.dpr);

    const grad = g.createLinearGradient(0, 0, this.w, this.h);
    grad.addColorStop(0, '#070c16');
    grad.addColorStop(0.45, '#0c1526');
    grad.addColorStop(1, '#0a1220');
    g.fillStyle = grad;
    g.fillRect(0, 0, this.w, this.h);

    const glowA = g.createRadialGradient(this.w * 0.15, this.h * 0.1, 0, this.w * 0.15, this.h * 0.1, this.w * 0.65);
    glowA.addColorStop(0, 'rgba(56,217,245,0.13)');
    glowA.addColorStop(1, 'rgba(56,217,245,0)');
    g.fillStyle = glowA;
    g.fillRect(0, 0, this.w, this.h);

    const glowB = g.createRadialGradient(this.w * 0.9, this.h * 0.95, 0, this.w * 0.9, this.h * 0.95, this.w * 0.7);
    glowB.addColorStop(0, 'rgba(168,85,247,0.12)');
    glowB.addColorStop(1, 'rgba(168,85,247,0)');
    g.fillStyle = glowB;
    g.fillRect(0, 0, this.w, this.h);

    for (let i = 0; i < 90; i++) {
      const x = Math.random() * this.w;
      const y = Math.random() * this.h;
      const r = Math.random() * 1.3 + 0.25;
      g.fillStyle = `rgba(190,220,255,${Math.random() * 0.32 + 0.05})`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }

    const gearColor = 'rgba(120,150,190,0.055)';
    g.save();
    g.translate(this.w * 0.1, this.h * 0.18);
    g.scale((this.w * 0.34) / 256, (this.w * 0.34) / 256);
    g.drawImage(makeGear(gearColor, 14), -128, -128);
    g.restore();
    g.save();
    g.translate(this.w * 0.94, this.h * 0.82);
    g.scale((this.w * 0.42) / 256, (this.w * 0.42) / 256);
    g.drawImage(makeGear(gearColor, 10), -128, -128);
    g.restore();

    this.bg = c;
    this.dust = Array.from({ length: 26 }, () => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      r: Math.random() * 1.6 + 0.4,
      vx: (Math.random() - 0.5) * 5,
      vy: -Math.random() * 6 - 2,
      a: Math.random() * 0.35 + 0.05,
    }));
    this.gearA = makeGear('rgba(200,145,47,0.10)', 12);
    this.gearB = makeGear('rgba(120,180,220,0.09)', 9);
  }

  buildBoard() {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(this.bw * this.dpr));
    c.height = Math.max(1, Math.round(this.bh * this.dpr));
    const g = c.getContext('2d');
    g.scale(this.dpr, this.dpr);
    const w = this.bw;
    const h = this.bh;
    const r = Math.max(8, this.cell * 0.3);

    g.save();
    g.shadowColor = 'rgba(0,0,0,0.65)';
    g.shadowBlur = 26;
    g.shadowOffsetY = 10;
    rr(g, 0, 0, w, h, r);
    g.fillStyle = '#0b1526';
    g.fill();
    g.restore();

    rr(g, 0, 0, w, h, r);
    g.fillStyle = 'rgba(20,34,58,0.96)';
    g.fill();

    const inner = g.createLinearGradient(0, 0, 0, h);
    inner.addColorStop(0, 'rgba(70,105,160,0.14)');
    inner.addColorStop(0.5, 'rgba(20,35,60,0)');
    inner.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = inner;
    g.fill();

    const pad = 0.5;
    g.strokeStyle = 'rgba(216,163,60,0.55)';
    g.lineWidth = 2;
    rr(g, pad, pad, w - pad * 2, h - pad * 2, Math.max(4, r - 2));
    g.stroke();

    g.strokeStyle = 'rgba(160,200,240,0.055)';
    g.lineWidth = 1;
    for (let x = 1; x < this.W; x++) {
      const px = x * this.cell;
      g.beginPath();
      g.moveTo(px, 0);
      g.lineTo(px, h);
      g.stroke();
    }
    for (let y = 1; y < this.H; y++) {
      const py = y * this.cell;
      g.beginPath();
      g.moveTo(0, py);
      g.lineTo(w, py);
      g.stroke();
    }

    const vign = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.72);
    vign.addColorStop(0, 'rgba(0,0,0,0)');
    vign.addColorStop(1, 'rgba(0,0,0,0.42)');
    g.fillStyle = vign;
    g.fill();

    this.board = c;
  }

  cellToScreen(x, y) {
    return { x: this.ox + x * this.cell, y: this.oy + y * this.cell };
  }

  screenToCell(px, py) {
    return {
      x: Math.floor((px - this.ox) / this.cell),
      y: Math.floor((py - this.oy) / this.cell),
    };
  }

  addParticles(x, y, opts = {}) {
    const {
      count = 8, color = COLORS.gold, speed = 2, spread = Math.PI * 2,
      angle = 0, gravity = 6, life = 0.6, size = 0.08, shape = 'circle',
      colors = null,
    } = opts;
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 420) break;
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * (0.35 + Math.random() * 0.9);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        g: gravity,
        life: life * (0.6 + Math.random() * 0.8),
        max: life,
        size: size * (0.6 + Math.random() * 0.9),
        color: colors ? colors[(Math.random() * colors.length) | 0] : color,
        shape,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 8,
      });
    }
  }

  handleEvents(events, world) {
    for (const ev of events) {
      const x = ev.x ?? 0;
      const y = ev.y ?? 0;
      switch (ev.type) {
        case 'coin':
          this.addParticles(x, y, { count: 9, color: COLORS.gold, speed: 2.4, gravity: 4, life: 0.5, size: 0.07 });
          break;
        case 'star':
          this.addParticles(x, y, { count: 22, color: COLORS.gold, speed: 3.4, gravity: 2, life: 0.9, size: 0.1, shape: 'star', colors: ['#ffcf4a', '#ffe9a8', '#f472b6'] });
          break;
        case 'rescue': {
          const c = MINI_COLORS[ev.color % MINI_COLORS.length];
          this.addParticles(x, y, { count: 18, color: c.light, speed: 3.2, gravity: 2, life: 0.8, size: 0.09 });
          break;
        }
        case 'death':
          this.addParticles(x, y, { count: 22, color: '#94a3b8', speed: 3.4, gravity: 8, life: 0.9, size: 0.1, colors: ['#94a3b8', '#ef4444', '#64748b'] });
          break;
        case 'spring':
        case 'boost':
          this.addParticles(x, y, { count: 10, color: ev.type === 'boost' ? '#fbbf24' : '#fca5a5', speed: 3, gravity: 1, life: 0.5, size: 0.08, angle: -Math.PI / 2, spread: 1.1 });
          break;
        case 'warp':
          this.addParticles(x, y, { count: 14, color: COLORS.purple, speed: 2.8, gravity: 0, life: 0.7, size: 0.09 });
          if (ev.tx != null) this.addParticles(ev.tx, ev.ty, { count: 14, color: COLORS.cyan, speed: 2.8, gravity: 0, life: 0.7, size: 0.09 });
          break;
        case 'crumble':
          this.addParticles(x, y, { count: 12, color: '#8a8f9c', speed: 3, gravity: 12, life: 0.7, size: 0.1, shape: 'square' });
          break;
        case 'bumper':
          this.addParticles(x, y, { count: 7, color: COLORS.pink, speed: 2.6, gravity: 3, life: 0.5, size: 0.08 });
          break;
        case 'land':
          if (ev.hard) this.addParticles(x, y, { count: 4, color: 'rgba(200,210,230,0.6)', speed: 1.4, gravity: 2, life: 0.35, size: 0.07 });
          break;
        case 'spawn':
          this.addParticles(x, y, { count: 6, color: COLORS.green, speed: 1.8, gravity: 1, life: 0.45, size: 0.07 });
          break;
        case 'win':
          this.addParticles(world.goal.x + 0.5, world.goal.y + 0.5, {
            count: 60, speed: 5, gravity: 5, life: 1.4, size: 0.1, shape: 'rect',
            colors: ['#ffcf4a', '#34d399', '#38d9f5', '#f472b6', '#a855f7'],
          });
          break;
        default:
          break;
      }
    }
  }

  update(dt, events, world) {
    this.time += dt;
    if (events?.length) this.handleEvents(events, world);
    if (world) this.shake = Math.max(this.shake, world.shake || 0);
    this.shake = Math.max(0, this.shake - dt * 2.6);
    this.goalPulse = (this.goalPulse + dt) % 1000;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
    for (const d of this.dust) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.y < -4) { d.y = this.h + 4; d.x = Math.random() * this.w; }
      if (d.x < -4) d.x = this.w + 4;
      if (d.x > this.w + 4) d.x = -4;
    }
  }

  render(world, ui = {}) {
    const ctx = this.ctx;
    const tilt = ui.tilt || { x: 0, y: 0 };
    this.tiltX += (tilt.x - this.tiltX) * 0.08;
    this.tiltY += (tilt.y - this.tiltY) * 0.08;
    const px = this.tiltX * this.w * 0.02;
    const py = this.tiltY * this.h * 0.015;
    const shakeX = (Math.random() - 0.5) * this.shake * 9;
    const shakeY = (Math.random() - 0.5) * this.shake * 9;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    if (this.bg) {
      ctx.save();
      ctx.translate(px * 0.6 + shakeX * 0.4, py * 0.6 + shakeY * 0.4);
      ctx.drawImage(this.bg, 0, 0, this.w, this.h);
      ctx.restore();
    } else {
      ctx.fillStyle = COLORS.ink;
      ctx.fillRect(0, 0, this.w, this.h);
    }

    ctx.save();
    ctx.globalAlpha = 0.9;
    if (this.gearA) {
      ctx.save();
      ctx.translate(this.w * 0.1 + px, this.h * 0.18 + py);
      ctx.rotate(this.time * 0.08);
      ctx.scale((this.w * 0.3) / 256, (this.w * 0.3) / 256);
      ctx.drawImage(this.gearA, -128, -128);
      ctx.restore();
    }
    if (this.gearB) {
      ctx.save();
      ctx.translate(this.w * 0.94 + px * 1.4, this.h * 0.82 + py * 1.4);
      ctx.rotate(-this.time * 0.06);
      ctx.scale((this.w * 0.38) / 256, (this.w * 0.38) / 256);
      ctx.drawImage(this.gearB, -128, -128);
      ctx.restore();
    }
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(190,220,255,0.3)';
    for (const d of this.dust) {
      ctx.globalAlpha = d.a;
      ctx.beginPath();
      ctx.arc(d.x + px * 0.3, d.y + py * 0.3, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (!world) {
      ctx.save();
      ctx.translate(px, py);
      if (this.board) ctx.drawImage(this.board, this.ox + shakeX, this.oy + shakeY, this.bw, this.bh);
      ctx.restore();
      return;
    }

    const ox = this.ox + px + shakeX;
    const oy = this.oy + py + shakeY;
    this.drawOx = ox;
    this.drawOy = oy;

    ctx.save();
    ctx.translate(px + shakeX, py + shakeY);
    if (this.board) ctx.drawImage(this.board, this.ox, this.oy, this.bw, this.bh);
    ctx.restore();

    const s = this.cell;
    const bx = (x) => ox + x * s;
    const by = (y) => oy + y * s;

    this.drawSpawn(ctx, world, bx, by, s);
    this.drawGoal(ctx, world, bx, by, s);

    for (const tile of world.tiles.values()) {
      this.drawStructural(ctx, tile, bx(tile.x), by(tile.y), s, world);
    }
    for (const ov of world.overlays.values()) {
      this.drawOverlay(ctx, ov, bx(ov.x), by(ov.y), s, world);
    }
    for (const [k, type] of world.items) {
      const x = k % 1000;
      const y = Math.floor(k / 1000);
      this.drawItem(ctx, type, bx(x), by(y), s, x, y);
    }

    if (ui.path && ui.path.length > 1) this.drawPath(ctx, ui.path, bx, by, s);

    for (const m of world.minis) {
      this.drawMini(ctx, m, bx(m.x), by(m.y), s, world);
    }

    this.drawParticles(ctx, bx, by, s);

    if (ui.hover && ui.selected && ui.mode === 'build') {
      this.drawGhost(ctx, ui, bx, by, s);
    }

    if (ui.hover) {
      const { x, y } = ui.hover;
      if (x >= 0 && y >= 0 && x < world.level.w && y < world.level.h) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        rr(ctx, bx(x) + 1, by(y) + 1, s - 2, s - 2, Math.max(3, s * 0.14));
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  drawPath(ctx, path, bx, by, s) {
    ctx.save();
    ctx.lineWidth = Math.max(2, s * 0.07);
    ctx.setLineDash([s * 0.16, s * 0.16]);
    ctx.lineDashOffset = -this.time * s * 0.5;
    ctx.strokeStyle = 'rgba(56,217,245,0.55)';
    ctx.shadowColor = 'rgba(56,217,245,0.6)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    path.forEach((p, i) => {
      const x = bx(p.x);
      const y = by(p.y);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }

  drawGhost(ctx, ui, bx, by, s) {
    const { x, y } = ui.hover;
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    const type = ui.selected;
    if (!type) return;
    ctx.save();
    ctx.globalAlpha = ui.valid === false ? 0.22 : 0.5;
    const def = PIECES[type];
    if (def.layer === 'item') {
      this.drawItem(ctx, type, bx(x), by(y), s, x, y);
    } else if (def.layer === 'overlay') {
      this.drawOverlay(ctx, { x, y, type, g: 0 }, bx(x), by(y), s, { tiles: new Map() });
    } else {
      this.drawStructural(ctx, { x, y, type }, bx(x), by(y), s, {});
    }
    ctx.restore();
    if (ui.valid === false) {
      ctx.save();
      ctx.strokeStyle = 'rgba(239,68,68,0.85)';
      ctx.lineWidth = 2;
      rr(ctx, bx(x) + 2, by(y) + 2, s - 4, s - 4, Math.max(3, s * 0.14));
      ctx.stroke();
      ctx.restore();
    }
  }

  drawSpawn(ctx, world, bx, by, s) {
    const sp = world.spawn;
    const x = bx(sp.x);
    const y = by(sp.y);
    const pad = s * 0.09;
    ctx.save();
    const pulse = 0.55 + Math.sin(this.time * 2.4) * 0.12;
    ctx.shadowColor = `rgba(52,211,153,${pulse})`;
    ctx.shadowBlur = s * 0.5;
    rr(ctx, x + pad, y + pad, s - pad * 2, s - pad * 2, s * 0.24);
    ctx.fillStyle = 'rgba(9,28,30,0.9)';
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.strokeStyle = 'rgba(52,211,153,0.9)';
    ctx.stroke();
    ctx.shadowBlur = 0;

    const cx = x + s / 2;
    const cy = y + s * 0.56;
    ctx.fillStyle = 'rgba(52,211,153,0.18)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.24, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6ee7b7';
    ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.14, cy);
    ctx.lineTo(cx + s * 0.14, cy);
    ctx.moveTo(cx, cy + s * 0.14);
    ctx.lineTo(cx, cy - s * 0.14);
    ctx.stroke();
    const dir = sp.dir ?? 1;
    ctx.fillStyle = '#a7f3d0';
    ctx.beginPath();
    ctx.moveTo(cx + dir * s * 0.3, cy - s * 0.1);
    ctx.lineTo(cx + dir * s * 0.3, cy + s * 0.1);
    ctx.lineTo(cx + dir * s * 0.43, cy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawGoal(ctx, world, bx, by, s) {
    const gx = bx(world.goal.x);
    const gy = by(world.goal.y);
    const pad = s * 0.07;
    const cx = gx + s / 2;
    const cy = gy + s * 0.55;
    const pulse = (Math.sin(this.time * 2.2) + 1) / 2;
    ctx.save();
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.85);
    glow.addColorStop(0, `rgba(255,207,74,${0.34 + pulse * 0.2})`);
    glow.addColorStop(0.55, 'rgba(255,207,74,0.08)');
    glow.addColorStop(1, 'rgba(255,207,74,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(gx - s * 0.5, gy - s * 0.5, s * 2, s * 2);

    rr(ctx, gx + pad, gy + pad, s - pad * 2, s - pad * 2, s * 0.3);
    ctx.fillStyle = 'rgba(34,24,8,0.92)';
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, s * 0.055);
    ctx.strokeStyle = '#ffcf4a';
    ctx.shadowColor = 'rgba(255,207,74,0.8)';
    ctx.shadowBlur = s * 0.3;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(255,207,74,0.16)';
    rr(ctx, cx - s * 0.22, gy + s * 0.3, s * 0.44, s * 0.52, s * 0.18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,224,138,0.85)';
    ctx.lineWidth = Math.max(1.2, s * 0.04);
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, gy + s * 0.55);
    ctx.rotate(Math.sin(this.time * 1.4) * 0.12);
    starPath(ctx, 0, 0, s * 0.18, s * 0.08);
    ctx.fillStyle = '#ffe066';
    ctx.shadowColor = '#ffcf4a';
    ctx.shadowBlur = s * 0.4;
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  drawStructural(ctx, tile, x, y, s, world) {
    const type = tile.type;
    const inset = s * 0.025;
    if (type === 'girder') {
      rr(ctx, x + inset, y + inset, s - inset * 2, s - inset * 2, s * 0.12);
      ctx.fillStyle = '#8a5a1e';
      ctx.fill();
      ctx.fillStyle = '#b47a24';
      ctx.fillRect(x + inset * 2, y + inset * 2, s - inset * 4, s * 0.62);
      ctx.fillStyle = '#e0ad4d';
      ctx.fillRect(x + inset * 2, y + inset * 2, s - inset * 4, s * 0.16);
      ctx.fillStyle = '#5c3a10';
      ctx.fillRect(x + inset * 2, y + s * 0.78, s - inset * 4, s * 0.16);
      ctx.strokeStyle = 'rgba(60,36,6,0.85)';
      ctx.lineWidth = Math.max(1, s * 0.03);
      rr(ctx, x + inset, y + inset, s - inset * 2, s - inset * 2, s * 0.12);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,235,180,0.55)';
      for (const t of [0.2, 0.5, 0.8]) {
        ctx.beginPath();
        ctx.arc(x + s * t, y + s * 0.22, Math.max(0.7, s * 0.032), 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + s * t, y + s * 0.88, Math.max(0.7, s * 0.032), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === 'crumble') {
      const fusing = tile._fusing;
      const jx = fusing ? (Math.random() - 0.5) * s * 0.05 : 0;
      const jy = fusing ? (Math.random() - 0.5) * s * 0.05 : 0;
      rr(ctx, x + inset + jx, y + inset + jy, s - inset * 2, s - inset * 2, s * 0.1);
      ctx.fillStyle = fusing ? '#7d6a5a' : '#6c7280';
      ctx.fill();
      ctx.fillStyle = fusing ? '#a08a74' : '#9aa3b2';
      ctx.fillRect(x + inset * 2 + jx, y + inset * 2 + jy, s - inset * 4, s * 0.16);
      ctx.strokeStyle = 'rgba(40,44,54,0.8)';
      ctx.lineWidth = Math.max(1, s * 0.028);
      ctx.beginPath();
      ctx.moveTo(x + s * 0.22 + jx, y + s * 0.28 + jy);
      ctx.lineTo(x + s * 0.4 + jx, y + s * 0.5 + jy);
      ctx.lineTo(x + s * 0.32 + jx, y + s * 0.72 + jy);
      ctx.moveTo(x + s * 0.6 + jx, y + s * 0.24 + jy);
      ctx.lineTo(x + s * 0.7 + jx, y + s * 0.48 + jy);
      ctx.lineTo(x + s * 0.62 + jx, y + s * 0.66 + jy);
      ctx.lineTo(x + s * 0.78 + jx, y + s * 0.82 + jy);
      ctx.stroke();
      if (fusing) {
        ctx.fillStyle = `rgba(239,68,68,${0.16 + Math.sin(this.time * 22) * 0.1})`;
        rr(ctx, x + inset, y + inset, s - inset * 2, s - inset * 2, s * 0.1);
        ctx.fill();
      }
    } else if (type === 'bumper') {
      rr(ctx, x + inset, y + inset, s - inset * 2, s - inset * 2, s * 0.2);
      ctx.fillStyle = '#3b2540';
      ctx.fill();
      const pulse = 0.5 + Math.sin(this.time * 4 + x * 0.1) * 0.5;
      ctx.strokeStyle = `rgba(244,114,182,${0.5 + pulse * 0.4})`;
      ctx.lineWidth = Math.max(2, s * 0.09);
      rr(ctx, x + s * 0.13, y + s * 0.13, s * 0.74, s * 0.74, s * 0.2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(252,165,165,0.5)';
      ctx.lineWidth = Math.max(1, s * 0.035);
      rr(ctx, x + s * 0.22, y + s * 0.22, s * 0.56, s * 0.56, s * 0.16);
      ctx.stroke();
      ctx.fillStyle = 'rgba(244,114,182,0.25)';
      ctx.beginPath();
      ctx.arc(x + s * 0.5, y + s * 0.5, s * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  overlaySurface(ov, x, y, s, world) {
    const hasBelow = world?.tiles?.has(ov.y * 1000 + ov.x);
    if (hasBelow) return { x: x + s * 0.08, y: y + s * 0.08, w: s * 0.84, h: s * 0.84, top: true };
    return { x: x + s * 0.06, y: y + s * 0.62, w: s * 0.88, h: s * 0.3, top: false };
  }

  drawOverlay(ctx, ov, x, y, s, world) {
    const type = ov.type;
    if (type === 'ladder') {
      const railW = Math.max(1.6, s * 0.09);
      ctx.save();
      ctx.strokeStyle = '#4b5a70';
      ctx.lineWidth = railW + 2;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.27, y);
      ctx.lineTo(x + s * 0.27, y + s);
      ctx.moveTo(x + s * 0.73, y);
      ctx.lineTo(x + s * 0.73, y + s);
      ctx.stroke();
      ctx.strokeStyle = '#c9d4e6';
      ctx.lineWidth = railW;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.27, y);
      ctx.lineTo(x + s * 0.27, y + s);
      ctx.moveTo(x + s * 0.73, y);
      ctx.lineTo(x + s * 0.73, y + s);
      ctx.stroke();
      ctx.strokeStyle = '#9fb2c9';
      ctx.lineWidth = Math.max(1.4, s * 0.065);
      for (let i = 1; i <= 3; i++) {
        const yy = y + (s * i) / 4;
        ctx.beginPath();
        ctx.moveTo(x + s * 0.27, yy);
        ctx.lineTo(x + s * 0.73, yy);
        ctx.stroke();
      }
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(x + s * 0.27, y + s * 0.06, Math.max(1, s * 0.04), 0, Math.PI * 2);
      ctx.arc(x + s * 0.73, y + s * 0.06, Math.max(1, s * 0.04), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    const surf = this.overlaySurface(ov, x, y, s, world);
    if (type === 'spring' || type === 'booster') {
      const compress = Math.max(0, Math.sin(this.time * 3.2 + x * 0.05)) * s * 0.03;
      const baseY = surf.top ? surf.y + s * 0.05 : surf.y + surf.h - s * 0.1;
      const topY = baseY - s * 0.34 + compress;
      ctx.save();
      ctx.fillStyle = type === 'booster' ? '#2b3550' : '#3b1d22';
      rr(ctx, x + s * 0.18, baseY - s * 0.06, s * 0.64, s * 0.12, s * 0.05);
      ctx.fill();
      ctx.strokeStyle = type === 'booster' ? '#fbbf24' : '#f87171';
      ctx.lineWidth = Math.max(1.6, s * 0.07);
      ctx.beginPath();
      const coilTop = topY + s * 0.06;
      const coilBottom = baseY - s * 0.08;
      const n = 4;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const yy = coilBottom + (coilTop - coilBottom) * t;
        const xx = x + s * 0.5 + (i % 2 ? -1 : 1) * s * 0.15;
        if (i === 0) ctx.moveTo(x + s * 0.5, coilBottom);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
      ctx.fillStyle = type === 'booster' ? '#fbbf24' : '#ef4444';
      rr(ctx, x + s * 0.2, topY, s * 0.6, s * 0.1, s * 0.05);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(x + s * 0.25, topY + s * 0.015, s * 0.5, Math.max(1, s * 0.02));
      if (type === 'booster') {
        ctx.fillStyle = `rgba(251,191,36,${0.35 + Math.sin(this.time * 14) * 0.2})`;
        ctx.beginPath();
        ctx.moveTo(x + s * 0.32, baseY + s * 0.06);
        ctx.lineTo(x + s * 0.5, baseY + s * 0.24);
        ctx.lineTo(x + s * 0.68, baseY + s * 0.06);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    } else if (type === 'conveyorR' || type === 'conveyorL') {
      const dir = type === 'conveyorR' ? 1 : -1;
      ctx.save();
      const by = surf.top ? surf.y + s * 0.06 : surf.y + surf.h - s * 0.22;
      rr(ctx, x + s * 0.06, by, s * 0.88, s * 0.2, s * 0.08);
      ctx.fillStyle = '#222b40';
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = Math.max(1, s * 0.025);
      ctx.stroke();
      const off = ((this.time * 1.6 * dir) % 0.34 + 0.34) % 0.34;
      ctx.strokeStyle = '#f4b73f';
      ctx.lineWidth = Math.max(1.4, s * 0.05);
      for (let i = -1; i < 5; i++) {
        const cx = x + s * (0.08 + i * 0.22 + off);
        if (cx < x + s * 0.1 || cx > x + s * 0.88) continue;
        ctx.beginPath();
        ctx.moveTo(cx - dir * s * 0.05, by + s * 0.05);
        ctx.lineTo(cx + dir * s * 0.03, by + s * 0.1);
        ctx.lineTo(cx - dir * s * 0.05, by + s * 0.15);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(x + s * 0.08, by + s * 0.02, s * 0.84, Math.max(1, s * 0.015));
      ctx.restore();
    } else if (type === 'ice') {
      ctx.save();
      const by = surf.top ? surf.y + s * 0.05 : surf.y + surf.h - s * 0.2;
      rr(ctx, x + s * 0.06, by, s * 0.88, s * 0.16, s * 0.06);
      ctx.fillStyle = 'rgba(125,225,255,0.28)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(190,245,255,0.75)';
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(x + s * 0.18, by + s * 0.12);
      ctx.lineTo(x + s * 0.36, by + s * 0.04);
      ctx.moveTo(x + s * 0.55, by + s * 0.13);
      ctx.lineTo(x + s * 0.72, by + s * 0.05);
      ctx.stroke();
      ctx.restore();
    } else if (type === 'spike') {
      ctx.save();
      const by = surf.top ? surf.y + s * 0.14 : surf.y + surf.h - s * 0.16;
      ctx.fillStyle = '#7a2230';
      rr(ctx, x + s * 0.08, by + s * 0.11, s * 0.84, s * 0.08, s * 0.03);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        const sx = x + s * (0.2 + i * 0.3);
        ctx.beginPath();
        ctx.moveTo(sx - s * 0.11, by + s * 0.12);
        ctx.lineTo(sx, by - s * 0.04);
        ctx.lineTo(sx + s * 0.11, by + s * 0.12);
        ctx.closePath();
        ctx.fillStyle = '#cfd8e3';
        ctx.fill();
        ctx.strokeStyle = '#8b97a8';
        ctx.lineWidth = Math.max(0.8, s * 0.02);
        ctx.stroke();
      }
      ctx.restore();
    } else if (type === 'fan') {
      const cx = x + s * 0.5;
      const cy = surf.top ? surf.y + s * 0.4 : surf.y + surf.h - s * 0.18;
      ctx.save();
      ctx.fillStyle = '#3a2a16';
      rr(ctx, x + s * 0.16, cy + s * 0.16, s * 0.68, s * 0.16, s * 0.06);
      ctx.fill();
      ctx.strokeStyle = '#c8912f';
      ctx.lineWidth = Math.max(1.2, s * 0.035);
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.time * 7);
      ctx.fillStyle = '#d8a33c';
      for (let i = 0; i < 3; i++) {
        ctx.rotate((Math.PI * 2) / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(s * 0.14, -s * 0.16, s * 0.03, -s * 0.2);
        ctx.quadraticCurveTo(-s * 0.03, -s * 0.1, 0, 0);
        ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = '#f0c96a';
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(190,230,255,0.35)';
      ctx.lineWidth = Math.max(1, s * 0.03);
      for (let i = 0; i < 3; i++) {
        const t = (this.time * 1.4 + i * 0.33) % 1;
        const yy = cy - s * 0.1 - t * s * 0.55;
        const xx = cx + (i - 1) * s * 0.12;
        ctx.globalAlpha = 0.35 * (1 - t);
        ctx.beginPath();
        ctx.moveTo(xx, yy);
        ctx.lineTo(xx, yy - s * 0.12);
        ctx.stroke();
      }
      ctx.restore();
    } else if (type === 'warp') {
      const g = ov.g ?? 0;
      const hue = [275, 190, 42, 330][g % 4];
      const cx = x + s * 0.5;
      const cy = y + s * 0.5;
      ctx.save();
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.5);
      glow.addColorStop(0, `hsla(${hue},90%,70%,0.55)`);
      glow.addColorStop(1, `hsla(${hue},90%,60%,0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(x - s * 0.2, y - s * 0.2, s * 1.4, s * 1.4);
      ctx.translate(cx, cy);
      ctx.strokeStyle = `hsl(${hue},90%,72%)`;
      ctx.lineWidth = Math.max(1.6, s * 0.06);
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.22, s * 0.34, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `hsla(${hue},90%,80%,0.8)`;
      ctx.lineWidth = Math.max(1.2, s * 0.035);
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, s * (0.12 + i * 0.07), s * (0.26 + i * 0.06), this.time * (i ? -1.4 : 1.8), 0, Math.PI * 1.4);
        ctx.stroke();
      }
      ctx.fillStyle = `hsl(${hue},90%,60%)`;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawItem(ctx, type, x, y, s, gx, gy) {
    const cx = x + s * 0.5;
    const bob = Math.sin(this.time * 3 + gx * 0.7 + gy * 0.3) * s * 0.035;
    const cy = y + s * 0.5 + bob;
    if (type === 'coin') {
      ctx.save();
      ctx.shadowColor = 'rgba(255,207,74,0.7)';
      ctx.shadowBlur = s * 0.25;
      ctx.fillStyle = '#f5b52a';
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 0.19, s * 0.23, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffcf4a';
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 0.15, s * 0.19, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,90,10,0.7)';
      ctx.lineWidth = Math.max(1, s * 0.022);
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 0.09, s * 0.13, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.ellipse(cx - s * 0.05, cy - s * 0.06, s * 0.03, s * 0.05, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (type === 'star') {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.time * 1.2 + gx);
      ctx.shadowColor = 'rgba(255,224,102,0.9)';
      ctx.shadowBlur = s * 0.4;
      starPath(ctx, 0, 0, s * 0.23, s * 0.1);
      const grad = ctx.createLinearGradient(0, -s * 0.2, 0, s * 0.2);
      grad.addColorStop(0, '#fff3b0');
      grad.addColorStop(1, '#f5b52a');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = Math.max(1, s * 0.02);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawMini(ctx, m, x, y, s, world) {
    const c = MINI_COLORS[m.color % MINI_COLORS.length];
    const dir = m.dir || 1;
    const state = m.state;
    let scale = 1;
    let alpha = 1;
    let rot = 0;
    let bob = 0;
    if (state === 'rescued') {
      const t = Math.min(1, m.t / 0.55);
      scale = 1 - t * 0.7;
      alpha = 1 - t;
      bob = -t * s * 0.6;
    } else if (state === 'dead') {
      rot = Math.min(1.2, m.t * 4);
      alpha = 0.75;
    } else {
      bob = m.grounded ? Math.sin(m.anim * 9) * s * 0.018 : 0;
    }
    const squash = m.squash || 0;
    const sy = 1 - squash * 0.12;
    const sx = 1 + squash * 0.07;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (m.grounded || state !== 'alive') {
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath();
      ctx.ellipse(x, y + s * 0.36, s * 0.27, s * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.translate(x, y + bob);
    ctx.rotate(rot);
    ctx.scale(dir * sx, sy * scale);

    const bw = s * 0.58;
    const bh = s * 0.66;

    const keyA = m.anim * 4.5;
    ctx.save();
    ctx.translate(-bw * 0.42, -bh * 0.05);
    ctx.rotate(keyA);
    ctx.strokeStyle = 'rgba(226,232,240,0.85)';
    ctx.lineWidth = Math.max(1.4, s * 0.045);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.085, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.11, 0);
    ctx.lineTo(s * 0.11, 0);
    ctx.stroke();
    ctx.fillStyle = 'rgba(226,232,240,0.9)';
    ctx.beginPath();
    ctx.arc(-s * 0.11, 0, s * 0.03, 0, Math.PI * 2);
    ctx.arc(s * 0.11, 0, s * 0.03, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    rr(ctx, -bw / 2, -bh / 2, bw, bh, s * 0.16);
    const bodyGrad = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2);
    bodyGrad.addColorStop(0, c.light);
    bodyGrad.addColorStop(0.35, c.body);
    bodyGrad.addColorStop(1, c.dark);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(8,13,24,0.6)';
    ctx.lineWidth = Math.max(1, s * 0.025);
    ctx.stroke();

    rr(ctx, -bw * 0.36, -bh * 0.3, bw * 0.72, bh * 0.34, s * 0.1);
    ctx.fillStyle = 'rgba(8,15,26,0.9)';
    ctx.fill();
    ctx.fillStyle = '#e8f4ff';
    ctx.beginPath();
    ctx.arc(-bw * 0.13, -bh * 0.13, s * 0.045, 0, Math.PI * 2);
    ctx.arc(bw * 0.13, -bh * 0.13, s * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.arc(-bw * 0.13, -bh * 0.13, s * 0.02, 0, Math.PI * 2);
    ctx.arc(bw * 0.13, -bh * 0.13, s * 0.02, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(226,232,240,0.8)';
    ctx.lineWidth = Math.max(1, s * 0.022);
    ctx.beginPath();
    ctx.moveTo(0, -bh * 0.5);
    ctx.lineTo(0, -bh * 0.62);
    ctx.stroke();
    ctx.fillStyle = c.light;
    ctx.shadowColor = c.light;
    ctx.shadowBlur = s * 0.18;
    ctx.beginPath();
    ctx.arc(0, -bh * 0.65, s * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    const step = m.grounded && state === 'alive' ? Math.sin(m.anim * 10) : 0;
    ctx.fillStyle = 'rgba(8,13,24,0.85)';
    rr(ctx, -bw * 0.36, bh * 0.42 + step * s * 0.03, bw * 0.28, s * 0.1, s * 0.05);
    ctx.fill();
    rr(ctx, bw * 0.08, bh * 0.42 - step * s * 0.03, bw * 0.28, s * 0.1, s * 0.05);
    ctx.fill();

    ctx.fillStyle = c.light;
    ctx.beginPath();
    ctx.arc(-bw * 0.52, 0, s * 0.07, 0, Math.PI * 2);
    ctx.arc(bw * 0.52, 0, s * 0.07, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawParticles(ctx, bx, by, s) {
    for (const p of this.particles) {
      const a = Math.max(0, Math.min(1, p.life / p.max));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const x = bx(p.x);
      const y = by(p.y);
      const size = Math.max(1, p.size * s);
      if (p.shape === 'star') {
        ctx.translate(x, y);
        ctx.rotate(p.rot);
        starPath(ctx, 0, 0, size * 1.4, size * 0.6);
        ctx.fill();
      } else if (p.shape === 'square' || p.shape === 'rect') {
        ctx.translate(x, y);
        ctx.rotate(p.rot);
        ctx.fillRect(-size / 2, -size / 2, size, size);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}
