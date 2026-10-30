import { PIECES, LAYER, pieceCost } from './pieces.js';

export const GRID_W = 20;
export const GRID_H = 13;

export function cloneLevel(level) {
  return JSON.parse(JSON.stringify(level));
}

export function makeBlankLevel(overrides = {}) {
  return {
    id: 'custom-' + Date.now().toString(36),
    name: '',
    w: GRID_W,
    h: GRID_H,
    budget: 30,
    minis: 3,
    spawn: { x: 2, y: 2, dir: 1 },
    goal: { x: 17, y: 10 },
    tiles: [],
    overlays: [],
    items: [],
    custom: true,
    ...overrides,
  };
}

export function layerOf(type) {
  return PIECES[type]?.layer || null;
}

export function layerArray(level, layer) {
  if (layer === LAYER.tile) return level.tiles || (level.tiles = []);
  if (layer === LAYER.overlay) return level.overlays || (level.overlays = []);
  return level.items || (level.items = []);
}

export function findAt(level, layer, x, y) {
  return layerArray(level, layer).find((p) => p.x === x && p.y === y) || null;
}

export function pieceAt(level, x, y) {
  return findAt(level, LAYER.item, x, y)
    || findAt(level, LAYER.overlay, x, y)
    || findAt(level, LAYER.tile, x, y);
}

export function levelCost(level) {
  let cost = 0;
  for (const layer of [LAYER.tile, LAYER.overlay]) {
    for (const p of levelArraySafe(level, layer)) {
      if (!p.fixed) cost += pieceCost(p.type);
    }
  }
  return cost;
}

function levelArraySafe(level, layer) {
  return level[layer] || [];
}

export function budgetLeft(level) {
  return (level.budget ?? 0) - levelCost(level);
}

function nextWarpGroup(level) {
  const counts = new Map();
  for (const o of level.overlays || []) {
    if (o.type !== 'warp') continue;
    const g = o.g ?? 0;
    counts.set(g, (counts.get(g) || 0) + 1);
  }
  let open = null;
  for (const [g, n] of counts) {
    if (n % 2 === 1) { open = g; break; }
  }
  if (open != null) return open;
  let max = 0;
  for (const g of counts.keys()) max = Math.max(max, g);
  return max + 1;
}

export function canPlace(level, x, y, type) {
  if (x < 0 || y < 0 || x >= level.w || y >= level.h) return { ok: false, reason: 'bounds' };
  const def = PIECES[type];
  if (!def) return { ok: false, reason: 'type' };
  const layer = def.layer;
  const existing = findAt(level, layer, x, y);
  if (existing && existing.fixed) return { ok: false, reason: 'fixed' };
  if (existing && existing.type === type) return { ok: false, reason: 'same' };
  if (layer !== LAYER.item && !existing) {
    const cost = pieceCost(type);
    if (cost > budgetLeft(level)) return { ok: false, reason: 'budget' };
  }
  return { ok: true, layer, existing };
}

export function placePiece(level, x, y, type, extra = {}) {
  const check = canPlace(level, x, y, type);
  if (!check.ok) return check;
  const layer = check.layer;
  const arr = layerArray(level, layer);
  if (check.existing) {
    const idx = arr.indexOf(check.existing);
    if (idx >= 0) arr.splice(idx, 1);
  }
  const piece = { x, y, type, ...extra };
  if (type === 'warp' && piece.g == null) piece.g = nextWarpGroup(level);
  arr.push(piece);
  return { ok: true, layer, piece };
}

export function removeTopAt(level, x, y) {
  for (const layer of [LAYER.item, LAYER.overlay, LAYER.tile]) {
    const arr = layerArray(level, layer);
    const idx = arr.findIndex((p) => p.x === x && p.y === y);
    if (idx >= 0) {
      if (arr[idx].fixed) return { ok: false, reason: 'fixed' };
      const [removed] = arr.splice(idx, 1);
      return { ok: true, layer, removed };
    }
  }
  return { ok: false, reason: 'empty' };
}

export function removeAllAt(level, x, y) {
  let removed = null;
  for (const layer of [LAYER.item, LAYER.overlay, LAYER.tile]) {
    const arr = layerArray(level, layer);
    const idx = arr.findIndex((p) => p.x === x && p.y === y);
    if (idx >= 0 && !arr[idx].fixed) {
      const [p] = arr.splice(idx, 1);
      removed = removed || p;
    }
  }
  return removed;
}

export function countCoins(level) {
  return (level.items || []).filter((p) => p.type === 'coin').length;
}

export function hasStar(level) {
  return (level.items || []).some((p) => p.type === 'star');
}

export function validateLevel(level) {
  if (!level || typeof level !== 'object') return { ok: false, reason: 'shape' };
  if (!Number.isFinite(level.w) || !Number.isFinite(level.h)) return { ok: false, reason: 'size' };
  if (level.w < 6 || level.h < 6 || level.w > 40 || level.h > 30) return { ok: false, reason: 'size' };
  if (!level.spawn || !level.goal) return { ok: false, reason: 'doors' };
  const inBounds = (p) => p && p.x >= 0 && p.y >= 0 && p.x < level.w && p.y < level.h;
  if (!inBounds(level.spawn) || !inBounds(level.goal)) return { ok: false, reason: 'doors' };
  return { ok: true };
}

function b64urlEncode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(text) {
  let s = text.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function serializeLevel(level) {
  const payload = {
    v: 1,
    w: level.w,
    h: level.h,
    b: level.budget,
    m: level.minis,
    n: level.name || '',
    sp: [level.spawn.x, level.spawn.y, level.spawn.dir ?? 1],
    go: [level.goal.x, level.goal.y],
    t: (level.tiles || []).map((p) => [p.x, p.y, p.type, p.fixed ? 1 : 0]),
    o: (level.overlays || []).map((p) => [p.x, p.y, p.type, p.g ?? 0, p.fixed ? 1 : 0]),
    i: (level.items || []).map((p) => [p.x, p.y, p.type, p.fixed ? 1 : 0]),
  };
  return payload;
}

export function encodeLevel(level) {
  return b64urlEncode(JSON.stringify(serializeLevel(level)));
}

export function decodeLevel(code) {
  const raw = b64urlDecode(code.trim());
  const p = JSON.parse(raw);
  if (!p || p.v !== 1) throw new Error('version');
  const level = {
    id: 'shared-' + Date.now().toString(36),
    name: p.n || '',
    w: p.w,
    h: p.h,
    budget: p.b,
    minis: p.m,
    spawn: { x: p.sp[0], y: p.sp[1], dir: p.sp[2] ?? 1 },
    goal: { x: p.go[0], y: p.go[1] },
    tiles: (p.t || []).map(([x, y, type, fixed]) => ({ x, y, type, ...(fixed ? { fixed: true } : {}) })),
    overlays: (p.o || []).map(([x, y, type, g, fixed]) => ({ x, y, type, ...(type === 'warp' ? { g } : {}), ...(fixed ? { fixed: true } : {}) })),
    items: (p.i || []).map(([x, y, type, fixed]) => ({ x, y, type, ...(fixed ? { fixed: true } : {}) })),
    custom: true,
  };
  const v = validateLevel(level);
  if (!v.ok) throw new Error(v.reason);
  return level;
}

export function levelToHash(level) {
  return '#level=' + encodeLevel(level);
}

export function levelFromHash(hash) {
  if (!hash) return null;
  const m = /(?:^|[#&])level=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  try {
    return decodeLevel(m[1]);
  } catch {
    return null;
  }
}
