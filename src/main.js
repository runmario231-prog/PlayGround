import { World, simulate } from './sim.js';
import { Renderer } from './renderer.js';
import { Sound } from './audio.js';
import { PIECES, PALETTE_ORDER, pieceCost } from './pieces.js';
import {
  CAMPAIGN, levelTitle, levelHint, applySolution, getCampaign,
} from './levels.js';
import {
  cloneLevel, makeBlankLevel, placePiece, removeTopAt, budgetLeft, levelCost,
  encodeLevel, decodeLevel, levelToHash, levelFromHash, validateLevel, countCoins,
  findAt, layerArray,
} from './level.js';
import {
  loadSave, persist, saveSettings, recordResult, saveCustom, deleteCustom,
  getCustom, setLastLevel, totalStars,
} from './storage.js';
import {
  t, setLang, getLang, detectLang, applyI18n, pieceName, pieceDesc,
} from './i18n.js';

const FIXED = 1 / 120;
const canvas = document.getElementById('game-canvas');
const renderer = new Renderer(canvas);
const sound = new Sound();
const modalRoot = document.getElementById('modal-root');
const toastEl = document.getElementById('toast');

const save = loadSave();

const state = {
  screen: 'home',
  level: null,
  baseLevel: null,
  world: null,
  mode: 'build',
  selected: 'girder',
  tool: null,
  hover: null,
  painting: false,
  lastPaint: null,
  undo: [],
  redo: [],
  preview: false,
  previewPath: [],
  previewTimer: null,
  speed: 1,
  acc: 0,
  finishTimer: null,
  resultShown: false,
  lastFrame: performance.now(),
  lastStats: 0,
  tilt: { x: 0, y: 0 },
  tiltEnabled: false,
  tiltBound: false,
  toastTimer: null,
  saveTimer: null,
  bumpSound: 0,
  campaignId: null,
  justOpened: false,
};

/* ---------------- boot ---------------- */

setLang(save.settings.lang || detectLang());
applyI18n();
syncSettingsUI();
updateHomeStars();
bindGlobal();
showScreen('home');
sound.setMuted(!save.settings.sound);
sound.setMusic(save.settings.music !== false);

const fromHash = levelFromHash(location.hash);
if (fromHash) {
  setTimeout(() => {
    openLevel(fromHash);
    toast(t('imported'));
  }, 120);
}

requestAnimationFrame(frame);

/* ---------------- loop ---------------- */

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - state.lastFrame) / 1000));
  state.lastFrame = now;

  if (state.screen === 'game' && state.world) {
    const world = state.world;
    let events = [];
    if (state.mode === 'run' && world.status === 'running') {
      state.acc += dt * state.speed;
      let steps = 0;
      const maxSteps = 20 + state.speed * 20;
      while (state.acc >= FIXED && steps < maxSteps) {
        world.update(FIXED);
        state.acc -= FIXED;
        steps++;
      }
      if (steps >= maxSteps) state.acc = 0;
      events = world.drainEvents();
      playEvents(events);
      renderer.update(dt, events, world);
      if (world.status !== 'running' && state.finishTimer == null) {
        state.finishTimer = 0.8;
      }
      if (state.finishTimer != null) {
        state.finishTimer -= dt;
        if (state.finishTimer <= 0 && !state.resultShown) {
          state.resultShown = true;
          state.finishTimer = null;
          showResult(world.status === 'won');
        }
      }
    } else {
      events = world.drainEvents();
      if (events.length) renderer.update(dt, events, world);
      else renderer.update(dt, [], world);
    }
    renderer.render(world, {
      mode: state.mode,
      selected: state.selected,
      hover: state.hover,
      valid: state.hoverValid,
      path: state.preview ? state.previewPath : null,
      tilt: state.tiltEnabled ? state.tilt : { x: 0, y: 0 },
    });
    if (now - state.lastStats > 90) {
      state.lastStats = now;
      updateStats();
    }
  } else {
    renderer.update(dt, [], null);
  }

  requestAnimationFrame(frame);
}

/* ---------------- screens ---------------- */

function showScreen(name) {
  state.screen = name;
  for (const el of document.querySelectorAll('.screen')) {
    el.classList.toggle('active', el.id === `screen-${name}`);
  }
  if (name === 'levels') renderLevels();
  if (name === 'game') {
    requestAnimationFrame(() => renderer.resize());
  }
  if (name === 'home') {
    updateHomeStars();
    syncSettingsUI();
  }
}

function updateHomeStars() {
  const el = document.getElementById('home-star-count');
  if (el) el.textContent = String(totalStars());
}

/* ---------------- level lifecycle ---------------- */

function openLevel(level, { campaignId = null } = {}) {
  state.baseLevel = cloneLevel(level);
  state.level = cloneLevel(level);
  state.campaignId = campaignId;
  state.mode = 'build';
  state.selected = 'girder';
  state.tool = null;
  state.undo = [];
  state.redo = [];
  state.previewPath = [];
  state.previewTimer = null;
  state.resultShown = false;
  state.finishTimer = null;
  state.acc = 0;
  state.painting = false;
  state.hover = null;
  state.justOpened = true;
  renderer.particles.length = 0;
  renderer.shake = 0;
  setLastLevel(level.id);
  state.world = new World(state.level);
  state.world.status = 'paused';
  showScreen('game');
  renderer.setLevel(state.level);
  requestAnimationFrame(() => {
    renderer.resize();
    renderer.setLevel(state.level);
  });
  updateLevelChrome();
  updatePalette();
  updateToolbar();
  updateStats();
  updateUndoRedo();
  updatePreviewButton();
  syncRunUI();
  if (state.preview) schedulePreview();
  if (level.custom) scheduleAutoSave();
  setTimeout(() => {
    if (state.justOpened && state.screen === 'game') {
      state.justOpened = false;
      if (!level.custom) toast(t('buildHint'), 2600);
    }
  }, 500);
}

function updateLevelChrome() {
  const lvl = state.level;
  if (!lvl) return;
  document.getElementById('level-name').textContent = levelTitle(lvl, getLang()) || t('emptyLevel');
  const tag = document.getElementById('level-tag');
  if (state.campaignId) {
    const c = getCampaign(state.campaignId);
    tag.textContent = `${t('campaign')} ${String(c?.order || '').padStart(2, '0')}`;
  } else if (lvl.custom) {
    tag.textContent = t('custom');
  } else {
    tag.textContent = t('sandbox');
  }
}

function rebuildWorld(status = 'paused') {
  state.world = new World(state.level);
  state.world.status = status;
  state.acc = 0;
}

function runLevel() {
  sound.init();
  if (!state.level) return;
  if (!state.level.spawn || !state.level.goal) {
    toast(!state.level.spawn ? t('needSpawn') : t('needGoal'));
    return;
  }
  if ((state.level.minis || 0) < 1) {
    toast(t('needMinis'));
    return;
  }
  closeModal();
  state.mode = 'run';
  state.resultShown = false;
  state.finishTimer = null;
  state.acc = 0;
  state.preview = false;
  renderer.particles.length = 0;
  renderer.shake = 0;
  rebuildWorld('running');
  syncRunUI();
  updateStats();
  sound.play('click');
}

function stopRun() {
  state.mode = 'build';
  state.resultShown = false;
  state.finishTimer = null;
  state.acc = 0;
  renderer.particles.length = 0;
  rebuildWorld('paused');
  syncRunUI();
  updateStats();
  if (state.preview) schedulePreview();
}

function restartRun() {
  if (state.mode !== 'run') return;
  state.resultShown = false;
  state.finishTimer = null;
  state.acc = 0;
  renderer.particles.length = 0;
  renderer.shake = 0;
  rebuildWorld('running');
  syncRunUI();
}

function syncRunUI() {
  const game = document.getElementById('screen-game');
  const running = state.mode === 'run';
  game.classList.toggle('running', running);
  document.getElementById('btn-run').classList.toggle('hidden', running);
  document.getElementById('btn-stop').classList.toggle('hidden', !running);
  document.getElementById('btn-restart').classList.toggle('hidden', !running);
  document.getElementById('btn-speed').classList.toggle('hidden', !running);
  document.getElementById('run-badge').classList.toggle('hidden', !running);
  document.getElementById('mode-pill').textContent = running ? t('run') : t('build');
  document.getElementById('btn-speed').textContent = `${state.speed}×`;
  document.getElementById('palette').classList.toggle('hidden', running);
  document.getElementById('toolbar').classList.toggle('hidden', running);
  document.getElementById('btn-undo').style.display = running ? 'none' : '';
  document.getElementById('btn-redo').style.display = running ? 'none' : '';
  document.getElementById('btn-preview').style.display = running ? 'none' : '';
}

function showResult(won) {
  const world = state.world;
  const stars = won ? world.starCount() : 0;
  const level = state.level;
  if (won) {
    recordResult(level.id, stars, world.coins, world.totalCoins, world.time);
    if (level.custom) saveCustom(cloneLevel(level));
    updateHomeStars();
  }
  const next = state.campaignId ? nextCampaign(state.campaignId) : null;
  const starHtml = [0, 1, 2].map((i) => `<span class="star ${i < stars ? 'on' : ''}">★</span>`).join('');
  const rows = won ? `
    <div class="result-row done"><span>${t('minis')}</span><b>${world.rescued}/${world.total}</b></div>
    <div class="result-row ${world.totalCoins > 0 && world.coins >= world.totalCoins ? 'done' : 'missed'}"><span>${t('coins')}</span><b>${world.coins}/${world.totalCoins}</b></div>
    <div class="result-row ${world.star ? 'done' : 'missed'}"><span>${t('gotStar')}</span><b>${world.star ? '★' : '—'}</b></div>
    <div class="result-row"><span>${t('time')}</span><b>${world.time.toFixed(1)}s</b></div>
  ` : '';
  const html = `
    <div class="modal-panel">
      <h2 class="modal-title">${won ? t('levelComplete') : t('levelFailed')}</h2>
      <p class="modal-sub">${won ? t('finished') : t('failBody')}</p>
      <div class="modal-stars">${starHtml}</div>
      ${rows}
      <div class="modal-actions">
        ${won && next ? `<button class="btn primary" data-act="next">${t('nextLevel')}</button>` : ''}
        <button class="btn ${won ? '' : 'primary'}" data-act="retry">${won ? t('replay') : t('retry')}</button>
        <div class="modal-actions row">
          <button class="btn ghost" data-act="build">${t('backToEditor')}</button>
          <button class="btn ghost" data-act="levels">${t('backToLevels')}</button>
        </div>
      </div>
    </div>`;
  openModal(html, { dismissible: false });
  modalRoot.querySelector('[data-act="retry"]')?.addEventListener('click', () => {
    closeModal();
    restartRun();
  });
  modalRoot.querySelector('[data-act="next"]')?.addEventListener('click', () => {
    closeModal();
    if (next) openLevel(cloneLevel(next), { campaignId: next.id });
  });
  modalRoot.querySelector('[data-act="build"]')?.addEventListener('click', () => {
    closeModal();
    stopRun();
  });
  modalRoot.querySelector('[data-act="levels"]')?.addEventListener('click', () => {
    closeModal();
    stopRun();
    showScreen('levels');
  });
  sound.play(won ? 'win' : 'fail');
}

function nextCampaign(id) {
  const idx = CAMPAIGN.findIndex((l) => l.id === id);
  if (idx < 0 || idx + 1 >= CAMPAIGN.length) return null;
  return CAMPAIGN[idx + 1];
}

/* ---------------- editing ---------------- */

function pushHistory() {
  state.undo.push(snapshot());
  if (state.undo.length > 80) state.undo.shift();
  state.redo = [];
  updateUndoRedo();
}

function snapshot() {
  const l = state.level;
  return JSON.stringify({
    tiles: l.tiles, overlays: l.overlays, items: l.items,
    spawn: l.spawn, goal: l.goal, minis: l.minis, budget: l.budget,
  });
}

function applySnapshot(str) {
  const s = JSON.parse(str);
  const l = state.level;
  l.tiles = s.tiles;
  l.overlays = s.overlays;
  l.items = s.items;
  l.spawn = s.spawn;
  l.goal = s.goal;
  l.minis = s.minis;
  l.budget = s.budget;
}

function undo() {
  if (state.mode !== 'build' || !state.undo.length) return;
  state.redo.push(snapshot());
  applySnapshot(state.undo.pop());
  afterEdit();
  sound.play('erase');
}

function redo() {
  if (state.mode !== 'build' || !state.redo.length) return;
  state.undo.push(snapshot());
  applySnapshot(state.redo.pop());
  afterEdit();
  sound.play('place');
}

function updateUndoRedo() {
  document.getElementById('btn-undo').disabled = !state.undo.length || state.mode !== 'build';
  document.getElementById('btn-redo').disabled = !state.redo.length || state.mode !== 'build';
}

function afterEdit({ saveNow = false } = {}) {
  rebuildWorld('paused');
  updatePalette();
  updateStats();
  updateUndoRedo();
  if (state.preview) schedulePreview();
  if (state.level?.custom) {
    if (saveNow) {
      saveCustom(cloneLevel(state.level));
      toast(t('saved'), 1100);
    } else {
      scheduleAutoSave();
    }
  }
}

function scheduleAutoSave() {
  if (!state.level?.custom) return;
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    if (state.level?.custom) {
      saveCustom(cloneLevel(state.level));
    }
  }, 550);
}

function applyAt(cx, cy) {
  const lvl = state.level;
  if (cx < 0 || cy < 0 || cx >= lvl.w || cy >= lvl.h) return false;
  const solid = findAt(lvl, 'tiles', cx, cy);

  if (state.tool === 'spawn') {
    if (solid) { toast(t('cantPlaceSolid')); return false; }
    if (lvl.spawn.x === cx && lvl.spawn.y === cy) return false;
    lvl.spawn = { ...lvl.spawn, x: cx, y: cy };
    sound.play('place');
    return true;
  }
  if (state.tool === 'goal') {
    if (solid) { toast(t('cantPlaceSolid')); return false; }
    if (lvl.goal.x === cx && lvl.goal.y === cy) return false;
    lvl.goal = { x: cx, y: cy };
    sound.play('place');
    return true;
  }
  if (state.tool === 'erase') {
    const res = removeTopAt(lvl, cx, cy);
    if (!res.ok) {
      if (res.reason === 'fixed') toast(t('fixedPiece'));
      return false;
    }
    sound.play('erase');
    return true;
  }
  if (!state.selected) return false;
  const res = placePiece(lvl, cx, cy, state.selected);
  if (!res.ok) {
    if (res.reason === 'budget') toast(t('budgetFull'));
    else if (res.reason === 'fixed') toast(t('fixedPiece'));
    return false;
  }
  sound.play('place');
  return true;
}

/* ---------------- pointer input ---------------- */

function eventCell(e) {
  const rect = canvas.getBoundingClientRect();
  return renderer.screenToCell(e.clientX - rect.left, e.clientY - rect.top);
}

function onPointerDown(e) {
  if (state.screen !== 'game') return;
  sound.init();
  if (state.mode !== 'build') return;
  if (e.button != null && e.button !== 0) return;
  const cell = eventCell(e);
  if (cell.x < 0 || cell.y < 0 || cell.x >= state.level.w || cell.y >= state.level.h) return;
  e.preventDefault();
  state.painting = true;
  state.lastPaint = null;
  pushHistory();
  const changed = applyAt(cell.x, cell.y);
  if (!changed) {
    state.undo.pop();
    updateUndoRedo();
  } else {
    state.lastPaint = `${cell.x},${cell.y}`;
    afterEdit();
  }
  try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
}

function onPointerMove(e) {
  if (state.screen !== 'game') return;
  const cell = eventCell(e);
  const inb = cell.x >= 0 && cell.y >= 0 && cell.x < state.level.w && cell.y < state.level.h;
  state.hover = inb ? cell : null;
  state.hoverValid = inb ? canPlaceHere(cell.x, cell.y) : true;
  if (!state.painting || state.mode !== 'build') return;
  if (!inb) return;
  const key = `${cell.x},${cell.y}`;
  if (key === state.lastPaint) return;
  if (state.tool === 'spawn' || state.tool === 'goal') return;
  state.lastPaint = key;
  if (applyAt(cell.x, cell.y)) afterEdit();
}

function onPointerUp() {
  state.painting = false;
  state.lastPaint = null;
}

function canPlaceHere(x, y) {
  if (!state.selected || state.tool) return true;
  const def = PIECES[state.selected];
  if (!def) return true;
  if (def.layer === 'item') return true;
  const existing = findAt(state.level, def.layer, x, y);
  if (existing && existing.fixed) return false;
  const delta = pieceCost(state.selected) - (existing ? pieceCost(existing.type) : 0);
  return delta <= budgetLeft(state.level);
}

canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
canvas.addEventListener('pointermove', onPointerMove, { passive: false });
canvas.addEventListener('pointerup', onPointerUp);
canvas.addEventListener('pointercancel', onPointerUp);
canvas.addEventListener('pointerleave', () => { state.hover = null; state.painting = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

/* ---------------- palette ---------------- */

function makeIcon(type) {
  const c = document.createElement('canvas');
  c.width = 76;
  c.height = 76;
  const g = c.getContext('2d');
  g.scale(2, 2);
  const s = 38;
  const def = PIECES[type];
  if (!def) return c;
  if (def.layer === 'item') renderer.drawItem(g, type, 0, 0, s, 3, 2);
  else if (def.layer === 'overlay') renderer.drawOverlay(g, { x: 0, y: 0, type, g: 0 }, 0, 0, s, { tiles: new Map() });
  else renderer.drawStructural(g, { x: 0, y: 0, type }, 0, 0, s, {});
  return c;
}

function updatePalette() {
  const pal = document.getElementById('palette');
  if (!pal) return;
  const left = budgetLeft(state.level);
  const selected = state.tool ? null : state.selected;
  const existing = new Map([...pal.children].map((el) => [el.dataset.type, el]));
  for (const type of PALETTE_ORDER) {
    const def = PIECES[type];
    let btn = existing.get(type);
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'piece';
      btn.dataset.type = type;
      btn.type = 'button';
      btn.appendChild(makeIcon(type));
      const name = document.createElement('span');
      name.className = 'piece-name';
      btn.appendChild(name);
      const cost = document.createElement('span');
      cost.className = 'piece-cost';
      btn.appendChild(cost);
      btn.addEventListener('click', () => {
        sound.init();
        state.selected = type;
        state.tool = null;
        updatePalette();
        updateToolbar();
        sound.play('click');
      });
      pal.appendChild(btn);
    }
    btn.querySelector('.piece-name').textContent = pieceName(def);
    const cost = btn.querySelector('.piece-cost');
    cost.textContent = def.cost === 0 ? '✦' : String(def.cost);
    cost.classList.toggle('free', def.cost === 0);
    btn.classList.toggle('selected', selected === type);
    const cant = def.cost > left && !findAt(state.level, def.layer, 0, 0);
    btn.classList.toggle('cant', def.cost > left);
    btn.title = pieceDesc(def);
  }
  updateBudgetPill();
}

function updateBudgetPill() {
  const left = budgetLeft(state.level);
  const el = document.getElementById('budget-left');
  if (el) el.textContent = String(left);
  const pill = document.querySelector('.budget-pill');
  if (pill) pill.classList.toggle('danger', left < 0);
}

function updateToolbar() {
  for (const b of document.querySelectorAll('.tool')) {
    const tool = b.dataset.tool;
    b.classList.toggle('active', state.tool === tool && ['erase', 'spawn', 'goal'].includes(tool));
  }
}

/* ---------------- stats ---------------- */

function updateStats() {
  const w = state.world;
  const l = state.level;
  if (!w || !l) return;
  const minis = document.getElementById('stat-minis');
  const coins = document.getElementById('stat-coins');
  const budget = document.getElementById('stat-budget');
  if (minis) minis.textContent = `${w.rescued}/${w.total}`;
  if (coins) coins.textContent = `${w.coins}/${w.totalCoins}`;
  const left = budgetLeft(l);
  if (budget) budget.textContent = String(left);
  const bs = document.querySelector('.budget-stat');
  if (bs) bs.classList.toggle('danger', left < 0);
  updateBudgetPill();
}

/* ---------------- preview ---------------- */

function schedulePreview() {
  clearTimeout(state.previewTimer);
  state.previewTimer = setTimeout(computePreview, 220);
}

function computePreview() {
  if (!state.preview || !state.level || state.mode !== 'build') {
    state.previewPath = [];
    return;
  }
  try {
    const { path } = simulate(cloneLevel(state.level), { maxTime: 18, record: true });
    state.previewPath = path.filter((p, i, a) => i === 0 || Math.abs(p.x - a[i - 1].x) + Math.abs(p.y - a[i - 1].y) > 0.12);
  } catch {
    state.previewPath = [];
  }
}

function updatePreviewButton() {
  const b = document.getElementById('btn-preview');
  if (!b) return;
  b.classList.toggle('active', state.preview);
  b.setAttribute('aria-pressed', String(state.preview));
}

function togglePreview() {
  state.preview = !state.preview;
  updatePreviewButton();
  if (state.preview) {
    schedulePreview();
    toast(t('previewOn'), 1100);
  } else {
    state.previewPath = [];
    toast(t('previewOff'), 1100);
  }
  sound.play('click');
}

/* ---------------- settings / tilt ---------------- */

function syncSettingsUI() {
  const s = loadSave().settings;
  const soundBtn = document.getElementById('btn-sound');
  const tiltBtn = document.getElementById('btn-tilt');
  if (soundBtn) soundBtn.setAttribute('aria-pressed', String(!!s.sound));
  if (tiltBtn) tiltBtn.setAttribute('aria-pressed', String(!!state.tiltEnabled));
  const langBtn = document.getElementById('btn-lang');
  if (langBtn) langBtn.textContent = t('language');
}

function toggleSound() {
  sound.init();
  const s = loadSave().settings;
  const next = !s.sound;
  saveSettings({ sound: next });
  sound.setMuted(!next);
  syncSettingsUI();
  if (next) sound.play('click');
  toast(next ? t('sound') + ' ✓' : t('sound') + ' ✕', 1000);
}

function toggleMusic() {
  sound.init();
  const s = loadSave().settings;
  const next = !s.music;
  saveSettings({ music: next });
  sound.setMusic(next);
  toast(next ? t('music') + ' ✓' : t('music') + ' ✕', 1000);
}

function toggleLang() {
  const next = getLang() === 'ar' ? 'en' : 'ar';
  setLang(next);
  saveSettings({ lang: next });
  applyI18n();
  updateLevelChrome();
  updatePalette();
  updateToolbar();
  syncRunUI();
  syncSettingsUI();
  updateHomeStars();
  if (state.screen === 'levels') renderLevels();
  toast(next === 'ar' ? 'تم تغيير اللغة' : 'Language changed', 1000);
}

async function toggleTilt() {
  sound.init();
  if (state.tiltEnabled) {
    disableTilt();
    return;
  }
  if (typeof DeviceOrientationEvent === 'undefined') {
    toast(t('tiltUnavailable'));
    return;
  }
  try {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') {
        toast(t('tiltDenied'));
        return;
      }
    }
  } catch {
    toast(t('tiltDenied'));
    return;
  }
  bindTilt();
  state.tiltEnabled = true;
  saveSettings({ tilt: true });
  syncSettingsUI();
  toast(t('toastTilt'), 2000);
}

function bindTilt() {
  if (state.tiltBound) return;
  state.tiltBound = true;
  window.addEventListener('deviceorientation', onOrientation, true);
}

function disableTilt() {
  state.tiltEnabled = false;
  state.tilt = { x: 0, y: 0 };
  saveSettings({ tilt: false });
  syncSettingsUI();
  toast(t('tiltOff'), 1200);
}

function onOrientation(e) {
  if (!state.tiltEnabled) return;
  let g = e.gamma || 0;
  let b = e.beta || 0;
  const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  if (Math.abs(angle) === 90) {
    const tmp = g;
    g = b;
    b = tmp;
  }
  const dead = (v, d = 0.08) => (Math.abs(v) < d ? 0 : v);
  const tx = Math.max(-1, Math.min(1, g / 26));
  const ty = Math.max(-1, Math.min(1, (b - 35) / 28));
  state.tilt = { x: dead(tx), y: dead(ty) };
}

/* ---------------- modal helpers ---------------- */

let modalDismissible = true;

function openModal(html, { dismissible = true } = {}) {
  modalDismissible = dismissible;
  modalRoot.innerHTML = html;
  modalRoot.classList.remove('hidden');
}

function closeModal() {
  modalRoot.classList.add('hidden');
  modalRoot.innerHTML = '';
}

modalRoot.addEventListener('click', (e) => {
  if (e.target === modalRoot && modalDismissible) closeModal();
});

function toast(msg, ms = 1800) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

/* ---------------- modals ---------------- */

function showHow() {
  const steps = [
    t('tip1'), t('tip2'), t('tip3'), t('tip4'),
  ];
  openModal(`
    <div class="modal-panel">
      <h2 class="modal-title">${t('howTo')}</h2>
      <p class="modal-sub">${t('howBody')}</p>
      <div class="how-steps">
        ${steps.map((s, i) => `<div class="how-step"><span class="how-num">${i + 1}</span><p>${s}</p></div>`).join('')}
      </div>
      <p class="modal-sub" style="margin-bottom:16px">${t('controlsBody')}</p>
      <div class="modal-actions">
        <button class="btn primary" data-act="close">${t('done')}</button>
      </div>
      <p class="credits">${t('credits')}<br>${t('privacy')}</p>
    </div>`);
  modalRoot.querySelector('[data-act="close"]').addEventListener('click', closeModal);
}

function showSettings() {
  const s = loadSave().settings;
  openModal(`
    <div class="modal-panel">
      <h2 class="modal-title">${t('settings')}</h2>
      <p class="modal-sub">${t('privacy')}</p>
      <div class="settings-list">
        <div class="setting">
          <div class="setting-label"><b>${t('sound')}</b><span>${t('controls')}</span></div>
          <button class="switch" data-toggle="sound" aria-pressed="${!!s.sound}"></button>
        </div>
        <div class="setting">
          <div class="setting-label"><b>${t('music')}</b><span>${t('sound')}</span></div>
          <button class="switch" data-toggle="music" aria-pressed="${s.music !== false}"></button>
        </div>
        <div class="setting">
          <div class="setting-label"><b>${t('tilt')}</b><span>${t('motionPrompt')}</span></div>
          <button class="switch" data-toggle="tilt" aria-pressed="${!!state.tiltEnabled}"></button>
        </div>
        <div class="setting">
          <div class="setting-label"><b>${t('language')}</b><span>${getLang() === 'ar' ? 'العربية' : 'English'}</span></div>
          <button class="btn compact" data-act="lang">${t('language')}</button>
        </div>
      </div>
      <div class="settings-actions">
        <button class="btn ghost" data-act="how">${t('howTo')}</button>
        <button class="btn ghost" data-act="import">${t('importCode')}</button>
        <button class="btn ghost" data-act="reset">${t('reset')}</button>
        <button class="btn ghost" data-act="close">${t('close')}</button>
      </div>
    </div>`);
  modalRoot.querySelector('[data-toggle="sound"]').addEventListener('click', (e) => {
    toggleSound();
    e.currentTarget.setAttribute('aria-pressed', String(!!loadSave().settings.sound));
  });
  modalRoot.querySelector('[data-toggle="music"]').addEventListener('click', (e) => {
    toggleMusic();
    e.currentTarget.setAttribute('aria-pressed', String(loadSave().settings.music !== false));
  });
  modalRoot.querySelector('[data-toggle="tilt"]').addEventListener('click', async (e) => {
    await toggleTilt();
    e.currentTarget.setAttribute('aria-pressed', String(!!state.tiltEnabled));
  });
  modalRoot.querySelector('[data-act="lang"]').addEventListener('click', () => {
    toggleLang();
    closeModal();
  });
  modalRoot.querySelector('[data-act="how"]').addEventListener('click', showHow);
  modalRoot.querySelector('[data-act="import"]').addEventListener('click', showImport);
  modalRoot.querySelector('[data-act="reset"]').addEventListener('click', resetLevel);
  modalRoot.querySelector('[data-act="close"]').addEventListener('click', closeModal);
}

function showHint() {
  if (!state.level) return;
  const hint = levelHint(state.level, getLang());
  const hasSolution = !!state.level.solution;
  openModal(`
    <div class="modal-panel">
      <h2 class="modal-title">${t('hint')}</h2>
      <p class="modal-sub">${hint || t('buildHint')}</p>
      <div class="modal-actions">
        ${hasSolution ? `<button class="btn primary" data-act="solution">${t('showSolution')}</button>` : ''}
        <button class="btn ghost" data-act="close">${t('close')}</button>
      </div>
    </div>`);
  modalRoot.querySelector('[data-act="close"]').addEventListener('click', closeModal);
  modalRoot.querySelector('[data-act="solution"]')?.addEventListener('click', () => {
    applyStoredSolution();
    closeModal();
  });
}

function applyStoredSolution() {
  const lvl = state.level;
  const sol = lvl.solution;
  if (!sol) return;
  pushHistory();
  lvl.tiles = lvl.tiles.filter((p) => p.fixed);
  lvl.overlays = lvl.overlays.filter((p) => p.fixed);
  lvl.items = lvl.items.filter((p) => p.fixed);
  for (const p of sol.tiles || []) lvl.tiles.push({ ...p });
  for (const p of sol.overlays || []) lvl.overlays.push({ ...p });
  for (const p of sol.items || []) lvl.items.push({ ...p });
  afterEdit();
  toast(t('solutionShown'), 2200);
}

function showSave() {
  if (!state.level) return;
  const current = levelTitle(state.level, getLang());
  openModal(`
    <div class="modal-panel">
      <h2 class="modal-title">${t('saveLevel')}</h2>
      <p class="modal-sub">${t('saveName')}</p>
      <div class="field">
        <label>${t('nameLabel')}</label>
        <input id="save-name" maxlength="40" value="${escapeHtml(current)}" />
      </div>
      <div class="modal-actions row">
        <button class="btn primary" data-act="save">${t('saveLevel')}</button>
        <button class="btn ghost" data-act="close">${t('cancel')}</button>
      </div>
    </div>`);
  const input = modalRoot.querySelector('#save-name');
  input.focus();
  input.select();
  modalRoot.querySelector('[data-act="close"]').addEventListener('click', closeModal);
  modalRoot.querySelector('[data-act="save"]').addEventListener('click', () => {
    const name = input.value.trim() || t('emptyLevel');
    const lvl = state.level;
    if (!lvl.custom) {
      lvl.id = 'custom-' + Date.now().toString(36);
      lvl.custom = true;
    }
    if (typeof lvl.name === 'string') lvl.name = name;
    else lvl.name = { en: name, ar: name };
    saveCustom(cloneLevel(lvl));
    setLastLevel(lvl.id);
    updateLevelChrome();
    closeModal();
    toast(t('levelSaved'));
  });
}

function showShare() {
  if (!state.level) return;
  let code = '';
  try {
    code = encodeLevel(state.level);
  } catch {
    toast(t('shareFailed'));
    return;
  }
  const url = `${location.origin}${location.pathname}${levelToHash(state.level)}`;
  openModal(`
    <div class="modal-panel">
      <h2 class="modal-title">${t('shareLevel')}</h2>
      <p class="modal-sub">${t('shareTitle')}</p>
      <div class="field">
        <label>${t('levelCode')}</label>
        <input id="share-code" readonly value="${escapeHtml(url)}" />
      </div>
      <div class="modal-actions row">
        <button class="btn primary" data-act="copy">${t('share')}</button>
        <button class="btn ghost" data-act="close">${t('close')}</button>
      </div>
    </div>`);
  modalRoot.querySelector('[data-act="close"]').addEventListener('click', closeModal);
  modalRoot.querySelector('[data-act="copy"]').addEventListener('click', async () => {
    try {
      await copyText(url);
      toast(t('shareCopied'));
    } catch {
      try { await copyText(code); toast(t('shareCopied')); }
      catch { toast(t('shareFailed')); }
    }
  });
}

function showImport() {
  openModal(`
    <div class="modal-panel">
      <h2 class="modal-title">${t('importCode')}</h2>
      <p class="modal-sub">${t('importPrompt')}</p>
      <div class="field">
        <label>${t('levelCode')}</label>
        <input id="import-code" placeholder="https://…/#level=…" />
      </div>
      <div class="modal-actions row">
        <button class="btn primary" data-act="import">${t('importCode')}</button>
        <button class="btn ghost" data-act="close">${t('cancel')}</button>
      </div>
    </div>`);
  const input = modalRoot.querySelector('#import-code');
  input.focus();
  modalRoot.querySelector('[data-act="close"]').addEventListener('click', closeModal);
  modalRoot.querySelector('[data-act="import"]').addEventListener('click', () => {
    const raw = input.value.trim();
    const m = /level=([A-Za-z0-9_-]+)/.exec(raw);
    const code = m ? m[1] : raw;
    try {
      const lvl = decodeLevel(code);
      closeModal();
      openLevel(lvl);
      toast(t('imported'));
    } catch {
      toast(t('importFailed'));
    }
  });
}

function showLevelSettings() {
  if (!state.level) return;
  const lvl = state.level;
  openModal(`
    <div class="modal-panel">
      <h2 class="modal-title">${t('levelSettings')}</h2>
      <div class="field">
        <label>${t('nameLabel')}</label>
        <input id="ls-name" maxlength="40" value="${escapeHtml(levelTitle(lvl, getLang()))}" />
      </div>
      <div class="field-row">
        <div class="field">
          <label>${t('toysLabel')}</label>
          <input id="ls-minis" type="number" min="1" max="8" value="${lvl.minis || 3}" />
        </div>
        <div class="field">
          <label>${t('budgetLabel')}</label>
          <input id="ls-budget" type="number" min="0" max="999" value="${lvl.budget || 0}" />
        </div>
      </div>
      <div class="modal-actions row">
        <button class="btn primary" data-act="apply">${t('apply')}</button>
        <button class="btn ghost" data-act="close">${t('cancel')}</button>
      </div>
    </div>`);
  modalRoot.querySelector('[data-act="close"]').addEventListener('click', closeModal);
  modalRoot.querySelector('[data-act="apply"]').addEventListener('click', () => {
    const name = modalRoot.querySelector('#ls-name').value.trim() || t('emptyLevel');
    const minis = Math.max(1, Math.min(8, Number(modalRoot.querySelector('#ls-minis').value) || 3));
    const budget = Math.max(0, Math.min(999, Number(modalRoot.querySelector('#ls-budget').value) || 0));
    pushHistory();
    if (typeof lvl.name === 'string') lvl.name = name;
    else lvl.name = { en: name, ar: name };
    lvl.minis = minis;
    lvl.budget = budget;
    afterEdit();
    updateLevelChrome();
    closeModal();
    toast(t('saved'), 1100);
  });
}

function resetLevel() {
  if (!state.level) return;
  openModal(`
    <div class="modal-panel">
      <h2 class="modal-title">${t('reset')}</h2>
      <p class="modal-sub">${t('resetConfirm')}</p>
      <div class="modal-actions row">
        <button class="btn primary" data-act="yes">${t('reset')}</button>
        <button class="btn ghost" data-act="no">${t('cancel')}</button>
      </div>
    </div>`);
  modalRoot.querySelector('[data-act="no"]').addEventListener('click', closeModal);
  modalRoot.querySelector('[data-act="yes"]').addEventListener('click', () => {
    if (state.baseLevel) {
      const keepId = state.level.id;
      const keepCustom = state.level.custom;
      state.level = cloneLevel(state.baseLevel);
      state.level.id = keepId;
      if (keepCustom) state.level.custom = true;
    }
    state.undo = [];
    state.redo = [];
    afterEdit();
    updateLevelChrome();
    closeModal();
    toast(t('reset'), 1200);
  });
}

function clearLevel() {
  openModal(`
    <div class="modal-panel">
      <h2 class="modal-title">${t('clear')}</h2>
      <p class="modal-sub">${t('clearConfirm')}</p>
      <div class="modal-actions row">
        <button class="btn primary" data-act="yes">${t('clear')}</button>
        <button class="btn ghost" data-act="no">${t('cancel')}</button>
      </div>
    </div>`);
  modalRoot.querySelector('[data-act="no"]').addEventListener('click', closeModal);
  modalRoot.querySelector('[data-act="yes"]').addEventListener('click', () => {
    pushHistory();
    const lvl = state.level;
    lvl.tiles = lvl.tiles.filter((p) => p.fixed);
    lvl.overlays = lvl.overlays.filter((p) => p.fixed);
    lvl.items = lvl.items.filter((p) => p.fixed);
    afterEdit();
    closeModal();
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('copy failed');
}

/* ---------------- level select ---------------- */

function renderLevels() {
  const lang = getLang();
  const s = loadSave();
  const camp = document.getElementById('campaign-grid');
  camp.innerHTML = '';
  let earned = 0;
  for (const level of CAMPAIGN) {
    const stars = s.stars[level.id] || 0;
    earned += stars;
    camp.appendChild(makeLevelCard(level, {
      stars,
      badge: String(level.order).padStart(2, '0'),
      sub: `${level.minis} ${t('minis')} · ${countCoins(level)} ${t('coins')}`,
      onClick: () => openLevel(cloneLevel(level), { campaignId: level.id }),
    }));
  }
  document.getElementById('campaign-progress').textContent = `${earned}/${CAMPAIGN.length * 3} ★`;

  const custom = document.getElementById('custom-grid');
  custom.innerHTML = '';
  const list = s.custom || [];
  for (const level of list) {
    const stars = s.stars[level.id] || 0;
    custom.appendChild(makeLevelCard(level, {
      stars,
      sub: `${level.minis || 3} ${t('minis')} · ${countCoins(level)} ${t('coins')}`,
      onDelete: () => confirmDelete(level),
      onClick: () => openLevel(cloneLevel(level)),
    }));
  }
  const newCard = document.createElement('button');
  newCard.className = 'level-new';
  newCard.innerHTML = `<span>＋</span><span>${t('newLevel')}</span>`;
  newCard.addEventListener('click', createNewLevel);
  custom.appendChild(newCard);
}

function makeLevelCard(level, { stars = 0, badge = null, sub = '', onClick, onDelete } = {}) {
  const card = document.createElement('button');
  card.className = 'level-card';
  card.type = 'button';
  const thumb = document.createElement('div');
  thumb.className = 'level-thumb';
  const cv = document.createElement('canvas');
  cv.width = 240;
  cv.height = 156;
  thumb.appendChild(cv);
  if (badge) {
    const b = document.createElement('span');
    b.className = 'level-badge';
    b.textContent = badge;
    thumb.appendChild(b);
  }
  const info = document.createElement('div');
  info.className = 'level-info';
  const name = document.createElement('span');
  name.className = 'level-name';
  name.textContent = levelTitle(level, getLang()) || t('emptyLevel');
  const subEl = document.createElement('span');
  subEl.className = 'level-sub';
  subEl.textContent = sub;
  const starEl = document.createElement('span');
  starEl.className = 'level-stars';
  starEl.innerHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? 'on' : ''}">★</span>`).join('');
  info.append(name, subEl, starEl);
  card.append(thumb, info);
  card.addEventListener('click', onClick);
  if (onDelete) {
    const del = document.createElement('span');
    del.className = 'level-del';
    del.textContent = '✕';
    del.setAttribute('role', 'button');
    del.setAttribute('aria-label', t('deleteLevel'));
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      onDelete();
    });
    thumb.appendChild(del);
  }
  drawThumb(cv, level);
  return card;
}

function confirmDelete(level) {
  openModal(`
    <div class="modal-panel">
      <h2 class="modal-title">${t('deleteLevel')}</h2>
      <p class="modal-sub">${escapeHtml(levelTitle(level, getLang()))}</p>
      <p class="modal-sub">${t('deleteConfirm')}</p>
      <div class="modal-actions row">
        <button class="btn primary" data-act="yes">${t('deleteLevel')}</button>
        <button class="btn ghost" data-act="no">${t('cancel')}</button>
      </div>
    </div>`);
  modalRoot.querySelector('[data-act="no"]').addEventListener('click', closeModal);
  modalRoot.querySelector('[data-act="yes"]').addEventListener('click', () => {
    deleteCustom(level.id);
    closeModal();
    renderLevels();
    updateHomeStars();
    toast(t('levelDeleted'));
  });
}

function drawThumb(cv, level) {
  const g = cv.getContext('2d');
  const W = cv.width;
  const H = cv.height;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0d1a2e');
  grad.addColorStop(1, '#0a1220');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  const pad = 8;
  const cell = Math.min((W - pad * 2) / level.w, (H - pad * 2) / level.h);
  const ox = (W - level.w * cell) / 2;
  const oy = (H - level.h * cell) / 2;

  g.strokeStyle = 'rgba(150,190,240,0.07)';
  g.lineWidth = 1;
  for (let x = 1; x < level.w; x++) {
    g.beginPath();
    g.moveTo(ox + x * cell, oy);
    g.lineTo(ox + x * cell, oy + level.h * cell);
    g.stroke();
  }
  for (let y = 1; y < level.h; y++) {
    g.beginPath();
    g.moveTo(ox, oy + y * cell);
    g.lineTo(ox + level.w * cell, oy + y * cell);
    g.stroke();
  }

  const tileColor = { girder: '#b47a24', crumble: '#6c7280', bumper: '#d1568f' };
  for (const t of level.tiles || []) {
    g.fillStyle = tileColor[t.type] || '#8a5a1e';
    g.fillRect(ox + t.x * cell + 0.5, oy + t.y * cell + 0.5, cell - 1, cell - 1);
  }
  for (const o of level.overlays || []) {
    const cx = ox + (o.x + 0.5) * cell;
    const cy = oy + (o.y + 0.5) * cell;
    if (o.type === 'ladder') {
      g.strokeStyle = '#b9c7da';
      g.lineWidth = Math.max(1, cell * 0.14);
      g.beginPath();
      g.moveTo(cx - cell * 0.16, cy - cell * 0.5);
      g.lineTo(cx - cell * 0.16, cy + cell * 0.5);
      g.moveTo(cx + cell * 0.16, cy - cell * 0.5);
      g.lineTo(cx + cell * 0.16, cy + cell * 0.5);
      g.stroke();
    } else {
      g.fillStyle = o.type === 'spike' ? '#ef4444'
        : o.type === 'warp' ? '#a855f7'
        : o.type === 'fan' ? '#38d9f5'
        : o.type.startsWith('conveyor') ? '#f4b73f'
        : o.type === 'ice' ? '#7de1ff'
        : o.type === 'booster' ? '#fbbf24'
        : '#f87171';
      g.beginPath();
      g.arc(cx, cy, Math.max(1.5, cell * 0.16), 0, Math.PI * 2);
      g.fill();
    }
  }
  for (const it of level.items || []) {
    const cx = ox + (it.x + 0.5) * cell;
    const cy = oy + (it.y + 0.5) * cell;
    g.fillStyle = it.type === 'star' ? '#ffe066' : '#ffcf4a';
    g.beginPath();
    g.arc(cx, cy, Math.max(1.2, cell * (it.type === 'star' ? 0.2 : 0.14)), 0, Math.PI * 2);
    g.fill();
  }
  if (level.spawn) {
    g.fillStyle = 'rgba(52,211,153,0.85)';
    g.fillRect(ox + level.spawn.x * cell + cell * 0.15, oy + level.spawn.y * cell + cell * 0.15, cell * 0.7, cell * 0.7);
  }
  if (level.goal) {
    g.fillStyle = '#ffcf4a';
    g.beginPath();
    g.arc(ox + (level.goal.x + 0.5) * cell, oy + (level.goal.y + 0.5) * cell, Math.max(1.5, cell * 0.24), 0, Math.PI * 2);
    g.fill();
  }

  const vign = g.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.8);
  vign.addColorStop(0, 'rgba(0,0,0,0)');
  vign.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = vign;
  g.fillRect(0, 0, W, H);
}

/* ---------------- create / random ---------------- */

function createNewLevel() {
  const lvl = makeBlankLevel({
    id: 'custom-' + Date.now().toString(36),
    name: { en: 'My Workshop', ar: 'ورشتي' },
    custom: true,
    budget: 30,
    minis: 3,
  });
  saveCustom(cloneLevel(lvl));
  openLevel(lvl);
  toast(t('buildHint'), 2200);
}

function makeRandomLevel() {
  const n = Math.floor(Math.random() * 900 + 100);
  const lvl = makeBlankLevel({
    id: 'custom-' + Date.now().toString(36),
    name: { en: `Workshop ${n}`, ar: `ورشة ${n}` },
    custom: true,
    budget: 34,
    minis: 2 + Math.floor(Math.random() * 3),
  });
  const W = lvl.w;
  const H = lvl.h;
  const add = (x, y, type) => {
    if (x === lvl.spawn.x && y === lvl.spawn.y) return;
    if (x === lvl.goal.x && y === lvl.goal.y) return;
    lvl.tiles.push({ x, y, type, fixed: true });
  };
  const addItem = (x, y, type) => lvl.items.push({ x, y, type, fixed: true });
  const style = Math.floor(Math.random() * 3);
  if (style === 0) {
    for (let x = 0; x <= 4; x++) add(x, 12, 'girder');
    for (let x = 15; x < W; x++) add(x, 12, 'girder');
    lvl.spawn = { x: 1, y: 11, dir: 1 };
    lvl.goal = { x: 18, y: 11 };
  } else if (style === 1) {
    for (let x = 0; x <= 5; x++) add(x, 12, 'girder');
    for (let x = 13; x < W; x++) add(x, 5, 'girder');
    lvl.spawn = { x: 1, y: 11, dir: 1 };
    lvl.goal = { x: 18, y: 4 };
  } else {
    for (let x = 0; x <= 6; x++) add(x, 11, 'girder');
    for (let x = 8; x <= 12; x++) add(x, 8, 'girder');
    for (let x = 14; x < W; x++) add(x, 11, 'girder');
    lvl.spawn = { x: 1, y: 10, dir: 1 };
    lvl.goal = { x: 18, y: 10 };
  }
  for (let i = 0; i < 5; i++) {
    const x = 2 + Math.floor(Math.random() * (W - 4));
    const y = 1 + Math.floor(Math.random() * (H - 4));
    if (findAt(lvl, 'tiles', x, y)) continue;
    addItem(x, y, 'coin');
  }
  saveCustom(cloneLevel(lvl));
  openLevel(lvl);
}

/* ---------------- events ---------------- */

function bindGlobal() {
  document.getElementById('btn-play').addEventListener('click', () => {
    sound.init();
    const last = save.lastLevelId;
    const camp = getCampaign(last);
    if (camp) {
      openLevel(cloneLevel(camp), { campaignId: camp.id });
      return;
    }
    const custom = getCustom(last);
    if (custom) {
      openLevel(cloneLevel(custom));
      return;
    }
    openLevel(cloneLevel(CAMPAIGN[0]), { campaignId: CAMPAIGN[0].id });
  });
  document.getElementById('btn-levels').addEventListener('click', () => { sound.play('click'); showScreen('levels'); });
  document.getElementById('btn-create').addEventListener('click', () => { sound.init(); createNewLevel(); });
  document.getElementById('btn-how').addEventListener('click', () => { sound.play('click'); showHow(); });
  document.getElementById('btn-lang').addEventListener('click', toggleLang);
  document.getElementById('btn-sound').addEventListener('click', toggleSound);
  document.getElementById('btn-tilt').addEventListener('click', toggleTilt);

  document.getElementById('levels-back').addEventListener('click', () => { sound.play('click'); showScreen('home'); });
  document.getElementById('levels-new').addEventListener('click', createNewLevel);
  document.getElementById('btn-import').addEventListener('click', showImport);
  document.getElementById('btn-random').addEventListener('click', () => { sound.init(); makeRandomLevel(); });

  document.getElementById('game-back').addEventListener('click', () => {
    if (state.mode === 'run') stopRun();
    if (state.level?.custom) saveCustom(cloneLevel(state.level));
    showScreen('levels');
  });
  document.getElementById('btn-run').addEventListener('click', runLevel);
  document.getElementById('btn-stop').addEventListener('click', stopRun);
  document.getElementById('btn-restart').addEventListener('click', restartRun);
  document.getElementById('btn-speed').addEventListener('click', () => {
    state.speed = state.speed >= 3 ? 1 : state.speed + 1;
    document.getElementById('btn-speed').textContent = `${state.speed}×`;
    sound.play('click');
  });
  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-redo').addEventListener('click', redo);
  document.getElementById('btn-preview').addEventListener('click', togglePreview);
  document.getElementById('btn-settings').addEventListener('click', () => { sound.play('click'); showSettings(); });

  for (const b of document.querySelectorAll('.tool')) {
    b.addEventListener('click', () => {
      const tool = b.dataset.tool;
      sound.init();
      if (tool === 'erase' || tool === 'spawn' || tool === 'goal') {
        state.tool = state.tool === tool ? null : tool;
        if (state.tool) state.selected = null;
        updateToolbar();
        updatePalette();
        sound.play('click');
      } else if (tool === 'clear') {
        clearLevel();
      } else if (tool === 'hint') {
        showHint();
      } else if (tool === 'save') {
        showSave();
      } else if (tool === 'share') {
        showShare();
      }
    });
  }

  window.addEventListener('resize', () => {
    if (state.screen === 'game') renderer.resize();
  });
  window.addEventListener('orientationchange', () => {
    setTimeout(() => { if (state.screen === 'game') renderer.resize(); }, 220);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) sound.stopMusic();
    else if (loadSave().settings.music !== false) sound.startMusic();
  });
  window.addEventListener('keydown', (e) => {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    sound.init();
    if (e.key === 'Escape') {
      if (!modalRoot.classList.contains('hidden')) closeModal();
      else if (state.screen === 'game') { if (state.mode === 'run') stopRun(); showScreen('levels'); }
      else if (state.screen === 'levels') showScreen('home');
      return;
    }
    if (state.screen !== 'game') return;
    if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); undo(); }
    else if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); redo(); }
    else if (e.key === 'e' || e.key === 'E') { state.tool = 'erase'; state.selected = null; updateToolbar(); updatePalette(); }
    else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (state.mode === 'run') stopRun(); else runLevel();
    } else if (e.key === 'p' || e.key === 'P') togglePreview();
    else if (/^[1-9]$/.test(e.key)) {
      const type = PALETTE_ORDER[Number(e.key) - 1];
      if (type) { state.selected = type; state.tool = null; updatePalette(); updateToolbar(); }
    }
  });
}

/* ---------------- sound events ---------------- */

function playEvents(events) {
  const now = performance.now();
  for (const ev of events) {
    switch (ev.type) {
      case 'coin': sound.play('coin'); break;
      case 'star': sound.play('star'); break;
      case 'rescue': sound.play('rescue'); break;
      case 'death': sound.play('death'); break;
      case 'spring': sound.play('spring'); break;
      case 'boost': sound.play('boost'); break;
      case 'warp': sound.play('warp'); break;
      case 'crumble': sound.play('crumble'); break;
      case 'bumper': sound.play('bumper'); break;
      case 'spawn': sound.play('spawn'); break;
      case 'win': sound.play('win'); break;
      case 'bump':
        if (now - state.bumpSound > 90) { state.bumpSound = now; sound.play('bump'); }
        break;
      default: break;
    }
  }
}

/* ---------------- tilt restore ---------------- */

if (save.settings.tilt) {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    bindTilt();
    state.tiltEnabled = true;
  }
}

/* expose a tiny debug surface for verification */
window.__clockwork = {
  state,
  openLevel,
  CAMPAIGN,
  runLevel,
  stopRun,
  get level() { return state.level; },
  get world() { return state.world; },
};
