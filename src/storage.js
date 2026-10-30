const KEY = 'clockwork.v1';

const DEFAULTS = {
  version: 1,
  stars: {},
  best: {},
  custom: [],
  settings: {
    lang: null,
    sound: true,
    music: true,
    tilt: false,
  },
  lastLevelId: null,
};

let cache = null;

export function loadSave() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      cache = structuredClone(DEFAULTS);
      return cache;
    }
    const data = JSON.parse(raw);
    cache = {
      ...structuredClone(DEFAULTS),
      ...data,
      settings: { ...DEFAULTS.settings, ...(data.settings || {}) },
      stars: data.stars || {},
      best: data.best || {},
      custom: Array.isArray(data.custom) ? data.custom : [],
    };
  } catch {
    cache = structuredClone(DEFAULTS);
  }
  return cache;
}

export function persist() {
  if (!cache) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage may be unavailable */
  }
}

export function saveSettings(patch) {
  const s = loadSave();
  s.settings = { ...s.settings, ...patch };
  persist();
  return s.settings;
}

export function recordResult(levelId, stars, coins, totalCoins, time) {
  const s = loadSave();
  const prev = s.stars[levelId] || 0;
  if (stars > prev) s.stars[levelId] = stars;
  const prevBest = s.best[levelId];
  if (!prevBest || stars > prevBest.stars || (stars === prevBest.stars && time < prevBest.time)) {
    s.best[levelId] = { stars, coins, totalCoins, time };
  }
  persist();
}

export function saveCustom(level) {
  const s = loadSave();
  const idx = s.custom.findIndex((l) => l.id === level.id);
  if (idx >= 0) s.custom[idx] = level;
  else s.custom.push(level);
  persist();
  return level;
}

export function deleteCustom(id) {
  const s = loadSave();
  s.custom = s.custom.filter((l) => l.id !== id);
  delete s.stars[id];
  delete s.best[id];
  persist();
}

export function getCustom(id) {
  return loadSave().custom.find((l) => l.id === id) || null;
}

export function setLastLevel(id) {
  const s = loadSave();
  s.lastLevelId = id;
  persist();
}

export function totalStars() {
  const s = loadSave();
  return Object.values(s.stars).reduce((a, b) => a + (b || 0), 0);
}
