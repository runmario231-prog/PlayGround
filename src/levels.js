import { makeBlankLevel } from './level.js';

const T = (x, y, type, extra = {}) => ({ x, y, type, fixed: true, ...extra });
const O = (x, y, type, extra = {}) => ({ x, y, type, fixed: true, ...extra });
const I = (x, y, type) => ({ x, y, type, fixed: true });

const range = (a, b) => {
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
};

export const CAMPAIGN = [
  {
    id: 'c1',
    order: 1,
    name: { en: 'First Steps', ar: 'خطوات أولى' },
    hint: {
      en: 'Bridge the gap with girders. The toys walk on their own!',
      ar: 'اربط الفجوة بالعوارض. اللعب تسير وحدها!',
    },
    w: 20,
    h: 13,
    budget: 28,
    minis: 3,
    spawn: { x: 1, y: 2, dir: 1 },
    goal: { x: 17, y: 2 },
    tiles: [
      ...range(0, 3).map((x) => T(x, 3, 'girder')),
      ...range(16, 19).map((x) => T(x, 3, 'girder')),
    ],
    overlays: [],
    items: [I(7, 2, 'coin'), I(10, 2, 'coin'), I(13, 2, 'coin')],
    solution: {
      tiles: range(4, 15).map((x) => ({ x, y: 3, type: 'girder' })),
      overlays: [],
      items: [],
    },
  },
  {
    id: 'c2',
    order: 2,
    name: { en: 'Up We Go', ar: 'إلى الأعلى' },
    hint: {
      en: 'Ladders are free to climb. Reach the high platform.',
      ar: 'السلالم مجانية للتسلّق. اصل إلى المنصة العالية.',
    },
    w: 20,
    h: 13,
    budget: 24,
    minis: 3,
    spawn: { x: 2, y: 11, dir: 1 },
    goal: { x: 17, y: 4 },
    tiles: [
      ...range(0, 8).map((x) => T(x, 12, 'girder')),
      ...range(15, 19).map((x) => T(x, 5, 'girder')),
    ],
    overlays: [],
    items: [I(8, 9, 'coin'), I(8, 7, 'coin'), I(11, 4, 'coin'), I(14, 4, 'coin')],
    solution: {
      tiles: range(9, 14).map((x) => ({ x, y: 5, type: 'girder' })),
      overlays: range(5, 11).map((y) => ({ x: 8, y, type: 'ladder' })),
      items: [],
    },
  },
  {
    id: 'c3',
    order: 3,
    name: { en: 'Spring Fling', ar: 'قفزة الزنبرك' },
    hint: {
      en: 'A spring at the edge can launch a toy across the pit.',
      ar: 'زنبرك عند الحافة يقذف اللعبة عبر الحفرة.',
    },
    w: 20,
    h: 13,
    budget: 22,
    minis: 3,
    spawn: { x: 2, y: 10, dir: 1 },
    goal: { x: 17, y: 7 },
    tiles: [
      ...range(0, 6).map((x) => T(x, 11, 'girder')),
      ...range(15, 19).map((x) => T(x, 8, 'girder')),
    ],
    overlays: [],
    items: [I(8, 7, 'coin'), I(11, 7, 'coin'), I(14, 7, 'coin')],
    solution: {
      tiles: range(7, 14).map((x) => ({ x, y: 8, type: 'girder' })),
      overlays: [{ x: 6, y: 10, type: 'spring' }],
      items: [],
    },
  },
  {
    id: 'c4',
    order: 4,
    name: { en: 'Twin Portals', ar: 'بوابتان' },
    hint: {
      en: 'One portal is fixed. Place its twin above the high platform.',
      ar: 'بوابة واحدة ثابتة. ضع توأمها فوق المنصة العالية.',
    },
    w: 20,
    h: 13,
    budget: 5,
    minis: 3,
    spawn: { x: 2, y: 10, dir: 1 },
    goal: { x: 17, y: 4 },
    tiles: [
      ...range(0, 5).map((x) => T(x, 11, 'girder')),
      ...range(14, 19).map((x) => T(x, 5, 'girder')),
    ],
    overlays: [O(5, 10, 'warp', { g: 1 })],
    items: [I(15, 4, 'coin'), I(16, 4, 'coin')],
    solution: {
      tiles: [],
      overlays: [{ x: 14, y: 4, type: 'warp', g: 1 }],
      items: [],
    },
  },
  {
    id: 'c5',
    order: 5,
    name: { en: 'Windy Heights', ar: 'مرتفعات الريح' },
    hint: {
      en: 'A fan pushes toys upward. Let the updraft carry them across.',
      ar: 'المروحة تدفع اللعب لأعلى. دع التيار الصاعد يحملها.',
    },
    w: 20,
    h: 13,
    budget: 6,
    minis: 3,
    spawn: { x: 2, y: 10, dir: 1 },
    goal: { x: 17, y: 3 },
    tiles: [
      ...range(0, 6).map((x) => T(x, 11, 'girder')),
      ...range(8, 19).map((x) => T(x, 4, 'girder')),
    ],
    overlays: [],
    items: [I(10, 3, 'coin'), I(14, 3, 'coin'), I(16, 3, 'star')],
    solution: {
      tiles: [],
      overlays: [{ x: 6, y: 10, type: 'fan' }],
      items: [],
    },
  },
  {
    id: 'c6',
    order: 6,
    name: { en: 'Crumble Crossing', ar: 'عبور متفتّت' },
    hint: {
      en: 'Only one toy. Cheap crumble blocks will hold just long enough.',
      ar: 'لعبة واحدة فقط. قطع التفتّت الرخيصة ستصمد للوقت الكافي.',
    },
    w: 20,
    h: 13,
    budget: 7,
    minis: 1,
    spawn: { x: 2, y: 10, dir: 1 },
    goal: { x: 17, y: 10 },
    tiles: [
      ...range(0, 5).map((x) => T(x, 11, 'girder')),
      ...range(12, 19).map((x) => T(x, 11, 'girder')),
    ],
    overlays: [],
    items: [
      I(6, 10, 'coin'), I(7, 10, 'coin'), I(8, 10, 'coin'),
      I(9, 10, 'coin'), I(10, 10, 'coin'), I(11, 10, 'coin'),
      I(9, 9, 'star'),
    ],
    solution: {
      tiles: range(6, 11).map((x) => ({ x, y: 11, type: 'crumble' })),
      overlays: [],
      items: [],
    },
  },
  {
    id: 'c7',
    order: 7,
    name: { en: 'Belt & Booster', ar: 'حزام وصاروخ' },
    hint: {
      en: 'Momentum carries through the air. Combine a belt with a booster.',
      ar: 'الزخم يستمر في الهواء. اجمع بين السير والمعزّز.',
    },
    w: 20,
    h: 13,
    budget: 5,
    minis: 3,
    spawn: { x: 2, y: 10, dir: 1 },
    goal: { x: 17, y: 10 },
    tiles: [
      ...range(0, 7).map((x) => T(x, 11, 'girder')),
      ...range(10, 19).map((x) => T(x, 11, 'girder')),
    ],
    overlays: [],
    items: [I(9, 6, 'coin'), I(10, 6, 'coin'), I(12, 10, 'coin'), I(14, 10, 'coin'), I(9, 5, 'star')],
    solution: {
      tiles: [],
      overlays: [
        { x: 6, y: 10, type: 'conveyorR' },
        { x: 7, y: 10, type: 'booster' },
      ],
      items: [],
    },
  },
  {
    id: 'c8',
    order: 8,
    name: { en: 'Grand Finale', ar: 'الختام الكبير' },
    hint: {
      en: 'Spring, fan, spring again. Use the updraft and clear the wall.',
      ar: 'زنبرك، مروحة، ثم زنبرك. استخدم التيار الصاعد وتجاوز الجدار.',
    },
    w: 20,
    h: 13,
    budget: 12,
    minis: 3,
    spawn: { x: 2, y: 11, dir: 1 },
    goal: { x: 17, y: 3 },
    tiles: [
      ...range(0, 4).map((x) => T(x, 12, 'girder')),
      ...range(5, 9).map((x) => T(x, 9, 'girder')),
      ...range(12, 19).map((x) => T(x, 4, 'girder')),
      T(15, 3, 'girder'),
    ],
    overlays: [],
    items: [
      I(6, 8, 'coin'), I(8, 8, 'coin'),
      I(12, 3, 'star'), I(13, 3, 'coin'), I(16, 3, 'coin'),
    ],
    solution: {
      tiles: [],
      overlays: [
        { x: 4, y: 11, type: 'spring' },
        { x: 10, y: 8, type: 'fan' },
        { x: 14, y: 3, type: 'spring' },
      ],
      items: [],
    },
  },
];

export function levelTitle(level, lang = 'en') {
  if (!level) return '';
  if (typeof level.name === 'string') return level.name;
  return level.name?.[lang] || level.name?.en || '';
}

export function levelHint(level, lang = 'en') {
  if (!level) return '';
  return level.hint?.[lang] || level.hint?.en || '';
}

export function getCampaign(id) {
  return CAMPAIGN.find((l) => l.id === id) || null;
}

export function applySolution(level) {
  const sol = level.solution;
  if (!sol) return false;
  const copy = JSON.parse(JSON.stringify(level));
  for (const t of sol.tiles || []) copy.tiles.push({ ...t });
  for (const o of sol.overlays || []) copy.overlays.push({ ...o });
  for (const i of sol.items || []) copy.items.push({ ...i });
  return copy;
}

export function sandboxLevel() {
  return makeBlankLevel({ id: 'sandbox', name: { en: 'Workshop', ar: 'الورشة' }, budget: 40, minis: 3 });
}
