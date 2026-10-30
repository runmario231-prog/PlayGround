import { isSolid } from './pieces.js';

export const K = {
  HW: 0.34,
  HH: 0.42,
  WALK: 2.35,
  CLIMB: 2.9,
  GRAV: 34,
  MAX_FALL: 20,
  SPRING: 16.5,
  BOOST: 18.5,
  SPAWN_DELAY: 0.78,
  AIR_DRAG: 0.55,
};

const key = (x, y) => y * 1000 + x;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class World {
  constructor(level) {
    this.level = level;
    this.reset();
  }

  reset() {
    this.tiles = new Map();
    this.overlays = new Map();
    this.items = new Map();
    for (const t of this.level.tiles || []) this.tiles.set(key(t.x, t.y), { ...t, _fuse: 0, _fusing: false });
    for (const o of this.level.overlays || []) this.overlays.set(key(o.x, o.y), { ...o });
    for (const it of this.level.items || []) this.items.set(key(it.x, it.y), it.type);

    this.spawn = { ...this.level.spawn };
    this.goal = { ...this.level.goal };
    this.total = Math.max(1, this.level.minis ?? 3);
    this.remaining = this.total;
    this.minis = [];
    this.rescued = 0;
    this.coins = 0;
    this.totalCoins = (this.level.items || []).filter((i) => i.type === 'coin').length;
    this.star = false;
    this.hasStar = (this.level.items || []).some((i) => i.type === 'star');
    this.time = 0;
    this.spawnTimer = 0.45;
    this.status = 'running';
    this.events = [];
    this.shake = 0;
    this.crumbling = new Set();
    this.nextId = 1;
    this.colorSeed = 0;
    this.recording = null;
  }

  setRecording(on) {
    this.recording = on ? [] : null;
  }

  emit(type, data = {}) {
    const ev = { type, ...data };
    this.events.push(ev);
    return ev;
  }

  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  solidAt(cx, cy) {
    const t = this.tiles.get(key(cx, cy));
    return t && isSolid(t.type) ? t : null;
  }

  overlayAt(cx, cy) {
    return this.overlays.get(key(cx, cy)) || null;
  }

  itemAt(cx, cy) {
    return this.items.get(key(cx, cy)) || null;
  }

  spawnMini() {
    const m = {
      id: this.nextId++,
      x: this.spawn.x + 0.5,
      y: this.spawn.y + 0.5,
      vx: 0,
      vy: 0,
      dir: this.spawn.dir ?? 1,
      grounded: false,
      groundTile: null,
      climbing: false,
      ladderCd: 0,
      springCd: 0,
      warpCd: 0,
      state: 'alive',
      anim: Math.random() * 6,
      squash: 0,
      color: this.colorSeed++ % 5,
      t: 0,
      remove: false,
    };
    this.minis.push(m);
    this.emit('spawn', { x: m.x, y: m.y, color: m.color });
    return m;
  }

  update(dt) {
    if (this.status !== 'running') return;
    this.time += dt;
    if (this.recording) {
      if (this.recording.length === 0 || this.time - this.recording[this.recording.length - 1].t > 0.08) {
        const alive = this.minis.find((m) => m.state === 'alive');
        if (alive) this.recording.push({ t: this.time, x: alive.x, y: alive.y });
      }
    }

    if (this.remaining > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnMini();
        this.remaining--;
        this.spawnTimer = K.SPAWN_DELAY;
      }
    }

    for (const tile of [...this.crumbling]) {
      tile._fuse -= dt;
      if (tile._fuse <= 0) {
        this.tiles.delete(key(tile.x, tile.y));
        this.crumbling.delete(tile);
        this.emit('crumble', { x: tile.x + 0.5, y: tile.y + 0.5 });
      }
    }

    for (const m of this.minis) {
      if (m.state !== 'alive') {
        m.t += dt;
        if (m.t > 0.55) m.remove = true;
        continue;
      }
      this.updateMini(m, dt);
    }

    this.minis = this.minis.filter((m) => !m.remove);
    this.shake = Math.max(0, this.shake - dt * 4);

    if (this.status === 'running' && this.remaining === 0 && this.minis.length === 0 && this.rescued === this.total) {
      this.status = 'won';
      this.emit('win', {});
    }
  }

  updateMini(m, dt) {
    m.anim += dt;
    m.warpCd = Math.max(0, m.warpCd - dt);
    m.springCd = Math.max(0, m.springCd - dt);
    m.ladderCd = Math.max(0, m.ladderCd - dt);
    m.squash = Math.max(0, m.squash - dt * 4);

    const cx = Math.floor(m.x);
    const cy = Math.floor(m.y);
    const centerOverlay = this.overlayAt(cx, cy);

    if (!m.climbing && m.ladderCd <= 0 && centerOverlay?.type === 'ladder') {
      m.climbing = true;
      m.climbTop = this.ladderTop(cx, cy);
      m.x = cx + 0.5;
      m.vx = 0;
      m.vy = 0;
    }

    if (m.climbing) {
      this.climb(m, dt, cx, cy);
      this.checkTriggers(m);
      return;
    }

    const feetCell = Math.floor(m.y + K.HH + 0.02);
    const supportOverlay = this.overlayAt(cx, feetCell);
    const effect = supportOverlay || centerOverlay;

    const wasGrounded = m.grounded;
    let speed = K.WALK;
    if (wasGrounded && (effect?.type === 'ice' || centerOverlay?.type === 'ice' || supportOverlay?.type === 'ice')) {
      speed *= 1.65;
    }

    let vx;
    if (wasGrounded) {
      vx = m.dir * speed;
      const conv = conveyorDir(centerOverlay) || conveyorDir(supportOverlay);
      vx += conv * 2.1;
    } else {
      vx = m.vx * (1 - K.AIR_DRAG * dt);
      if (Math.abs(vx) < 0.35) vx = m.dir * K.WALK;
    }
    m.vx = clamp(vx, -6.5, 6.5);

    m.vy += K.GRAV * dt;
    if (this.inFan(m)) m.vy = Math.max(-9.5, m.vy - 78 * dt);
    if (m.vy > K.MAX_FALL) m.vy = K.MAX_FALL;

    m._wasGrounded = wasGrounded;
    m.grounded = false;
    m.groundTile = null;

    m.x += m.vx * dt;
    this.collideX(m);

    m.y += m.vy * dt;
    this.collideY(m);

    const bounceOverlay = this.overlayAt(Math.floor(m.x), Math.floor(m.y + K.HH + 0.02))
      || this.overlayAt(Math.floor(m.x), Math.floor(m.y));
    if (m.springCd <= 0 && bounceOverlay) {
      if (bounceOverlay.type === 'spring') {
        m.vy = -K.SPRING;
        m.grounded = false;
        m.springCd = 0.28;
        this.emit('spring', { x: m.x, y: m.y + 0.35 });
      } else if (bounceOverlay.type === 'booster') {
        m.vy = -K.BOOST;
        m.grounded = false;
        m.springCd = 0.38;
        this.emit('boost', { x: m.x, y: m.y + 0.35 });
      }
    }

    this.checkTriggers(m);
  }

  climb(m, dt, cx, cy) {
    const top = m.climbTop ?? this.ladderTop(cx, cy);
    const targetY = top - K.HH;
    const ny = m.y - K.CLIMB * dt;
    const headRow = Math.floor(ny - K.HH - 0.01);
    if (this.solidAt(cx, headRow)) {
      m.climbing = false;
      m.vy = 0;
      return;
    }
    if (ny <= targetY) {
      m.y = targetY;
      m.vx = 0;
      m.vy = 0;
      m.climbing = false;
      m.grounded = true;
      m.ladderCd = 0.4;
      if (this.solidAt(cx + m.dir, top)) m.x = cx + 0.5 + m.dir * 0.45;
      this.emit('ladderTop', { x: m.x, y: m.y });
    } else {
      m.y = ny;
      m.vx = 0;
      m.vy = 0;
      m.grounded = false;
    }
  }

  ladderTop(cx, cy) {
    let top = cy;
    while (top - 1 >= 0 && this.overlayAt(cx, top - 1)?.type === 'ladder') top--;
    return top;
  }

  collideX(m) {
    if (m.vx === 0) return;
    const x0 = m.x - K.HW;
    const x1 = m.x + K.HW;
    const y0 = m.y - K.HH + 0.07;
    const y1 = m.y + K.HH - 0.07;
    for (let cy = Math.floor(y0); cy <= Math.floor(y1); cy++) {
      for (let cx = Math.floor(x0); cx <= Math.floor(x1); cx++) {
        const t = this.solidAt(cx, cy);
        if (!t) continue;
        if (x1 > cx && x0 < cx + 1 && y1 > cy && y0 < cy + 1) {
          if (m.vx > 0) {
            m.x = cx - K.HW - 0.0001;
            m.dir = -1;
          } else {
            m.x = cx + 1 + K.HW + 0.0001;
            m.dir = 1;
          }
          m.vx = 0;
          if (t.type === 'bumper') {
            m.vy = -6;
            m.grounded = false;
            this.emit('bumper', { x: m.x, y: m.y });
          } else {
            this.emit('bump', { x: m.x, y: m.y, dir: m.dir });
          }
          return;
        }
      }
    }
  }

  collideY(m) {
    const x0 = m.x - K.HW + 0.03;
    const x1 = m.x + K.HW - 0.03;
    const y0 = m.y - K.HH;
    const y1 = m.y + K.HH;
    for (let cy = Math.floor(y0); cy <= Math.floor(y1); cy++) {
      for (let cx = Math.floor(x0); cx <= Math.floor(x1); cx++) {
        const t = this.solidAt(cx, cy);
        if (!t) continue;
        if (x1 > cx && x0 < cx + 1 && y1 > cy && y0 < cy + 1) {
          if (m.vy > 0) {
            m.y = cy - K.HH - 0.0001;
            m.vy = 0;
            m.grounded = true;
            m.groundTile = t;
            m.squash = 1;
            if (!m._wasGrounded) this.emit('land', { x: m.x, y: m.y + K.HH, hard: true });
            if (t.type === 'crumble') this.startCrumble(t);
            return;
          }
          if (m.vy < 0) {
            m.y = cy + 1 + K.HH + 0.0001;
            m.vy = 0;
            this.emit('ceiling', { x: m.x, y: m.y });
            return;
          }
        }
      }
    }
  }

  startCrumble(t) {
    if (t._fusing) return;
    t._fusing = true;
    t._fuse = 0.8;
    this.crumbling.add(t);
    this.emit('crumbleStart', { x: t.x + 0.5, y: t.y + 0.5 });
  }

  inFan(m) {
    const cx = Math.floor(m.x);
    const cy = Math.floor(m.y);
    for (let dx = -1; dx <= 1; dx++) {
      for (let d = 0; d <= 8; d++) {
        if (this.overlayAt(cx + dx, cy + d)?.type === 'fan') return true;
      }
    }
    return false;
  }

  isSpikeAt(m) {
    const x0 = m.x - K.HW + 0.08;
    const x1 = m.x + K.HW - 0.08;
    const y0 = m.y - K.HH + 0.08;
    const y1 = m.y + K.HH - 0.08;
    for (let cy = Math.floor(y0); cy <= Math.floor(y1); cy++) {
      for (let cx = Math.floor(x0); cx <= Math.floor(x1); cx++) {
        if (this.overlayAt(cx, cy)?.type === 'spike') return true;
      }
    }
    const cx = Math.floor(m.x);
    const feet = Math.floor(m.y + K.HH + 0.02);
    if (this.overlayAt(cx, feet)?.type === 'spike') return true;
    if (this.overlayAt(cx, Math.floor(m.y))?.type === 'spike') return true;
    return false;
  }

  checkTriggers(m) {
    const cx = Math.floor(m.x);
    const cy = Math.floor(m.y);

    const item = this.items.get(key(cx, cy));
    if (item) {
      this.items.delete(key(cx, cy));
      if (item === 'coin') {
        this.coins++;
        this.emit('coin', { x: cx + 0.5, y: cy + 0.5 });
      } else if (item === 'star') {
        this.star = true;
        this.emit('star', { x: cx + 0.5, y: cy + 0.5 });
      }
    }

    if (this.isSpikeAt(m)) {
      this.die(m);
      return;
    }

    if (m.warpCd <= 0) {
      const feet = Math.floor(m.y + K.HH + 0.02);
      const ov = this.overlayAt(cx, cy) || this.overlayAt(cx, feet);
      if (ov?.type === 'warp') {
        this.doWarp(m, ov);
      }
    }

    const goalCx = this.goal.x;
    const goalCy = this.goal.y;
    const feetCell = Math.floor(m.y + K.HH + 0.02);
    if ((cx === goalCx && cy === goalCy) || (cx === goalCx && feetCell === goalCy)) {
      this.rescue(m);
      return;
    }

    if (m.y > this.level.h + 1.2) this.die(m);
  }

  doWarp(m, ov) {
    let dest = null;
    const group = ov.g ?? 0;
    for (const o of this.overlays.values()) {
      if (o === ov) continue;
      if (o.type === 'warp' && (o.g ?? 0) === group) { dest = o; break; }
    }
    if (!dest) return;
    m.x = dest.x + 0.5;
    m.y = dest.y + 0.5;
    m.vx = 0;
    m.vy = 0;
    m.climbing = false;
    m.grounded = false;
    m.warpCd = 0.9;
    this.emit('warp', { x: ov.x + 0.5, y: ov.y + 0.5, tx: dest.x + 0.5, ty: dest.y + 0.5, group });
  }

  rescue(m) {
    if (m.state !== 'alive') return;
    m.state = 'rescued';
    m.t = 0;
    this.rescued++;
    this.emit('rescue', { x: m.x, y: m.y, color: m.color, index: this.rescued });
  }

  die(m) {
    if (m.state !== 'alive') return;
    m.state = 'dead';
    m.t = 0;
    this.status = 'lost';
    this.shake = 1;
    this.emit('death', { x: m.x, y: m.y, color: m.color });
  }

  starCount() {
    return (this.status === 'won' ? 1 : 0)
      + (this.totalCoins > 0 && this.coins >= this.totalCoins ? 1 : 0)
      + (this.star ? 1 : 0);
  }
}

function conveyorDir(ov) {
  if (ov?.type === 'conveyorR') return 1;
  if (ov?.type === 'conveyorL') return -1;
  return 0;
}

// Run a headless simulation. Returns the world and sampled path points.
export function simulate(level, { maxTime = 40, dt = 1 / 120, record = true } = {}) {
  const world = new World(level);
  world.setRecording(record);
  const steps = Math.ceil(maxTime / dt);
  for (let i = 0; i < steps; i++) {
    world.update(dt);
    if (world.status !== 'running') break;
  }
  return { world, path: world.recording || [] };
}
