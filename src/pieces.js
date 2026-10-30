// Piece catalogue for Clockwork Capers.
// Structural pieces are solid. Overlays sit on/in a cell and trigger effects.
// Items are collectibles and never block movement.

export const LAYER = {
  tile: 'tiles',
  overlay: 'overlays',
  item: 'items',
};

export const PIECES = {
  girder: {
    cost: 2,
    layer: LAYER.tile,
    name: { en: 'Girder', ar: 'عارضة' },
    desc: { en: 'A solid brass beam. Build bridges and walls.', ar: 'عارضة نحاسية صلبة. ابنِ بها الجسور والجدران.' },
    hint: { en: 'Solid', ar: 'صلب' },
  },
  ladder: {
    cost: 1,
    layer: LAYER.overlay,
    name: { en: 'Ladder', ar: 'سلّم' },
    desc: { en: 'Wind-up toys climb ladders automatically.', ar: 'تصعد اللعب الملوية السلالم تلقائياً.' },
    hint: { en: 'Climb', ar: 'تسلّق' },
  },
  spring: {
    cost: 2,
    layer: LAYER.overlay,
    name: { en: 'Spring', ar: 'زنبرك' },
    desc: { en: 'Bounces a toy high into the air.', ar: 'يقذف اللعبة عالياً في الهواء.' },
    hint: { en: 'Bounce', ar: 'قفز' },
  },
  booster: {
    cost: 3,
    layer: LAYER.overlay,
    name: { en: 'Booster', ar: 'معزّز' },
    desc: { en: 'A rocket pad. Launches much higher than a spring.', ar: 'منصة صاروخية تطلق اللعبة أعلى بكثير من الزنبرك.' },
    hint: { en: 'Launch', ar: 'إطلاق' },
  },
  conveyorR: {
    cost: 2,
    layer: LAYER.overlay,
    name: { en: 'Belt →', ar: 'سير →' },
    desc: { en: 'Pushes toys to the right. Keep momentum in the air.', ar: 'يدفع اللعب إلى اليمين. يحافظ على الزخم في الهواء.' },
    hint: { en: 'Push →', ar: 'دفع →' },
  },
  conveyorL: {
    cost: 2,
    layer: LAYER.overlay,
    name: { en: 'Belt ←', ar: 'سير ←' },
    desc: { en: 'Pushes toys to the left. Keep momentum in the air.', ar: 'يدفع اللعب إلى اليسار. يحافظ على الزخم في الهواء.' },
    hint: { en: 'Push ←', ar: 'دفع ←' },
  },
  ice: {
    cost: 1,
    layer: LAYER.overlay,
    name: { en: 'Ice', ar: 'جليد' },
    desc: { en: 'Slippery! Toys move faster and carry that speed.', ar: 'زلق! تتحرك اللعب أسرع وتحتفظ بهذه السرعة.' },
    hint: { en: 'Slippery', ar: 'زلق' },
  },
  spike: {
    cost: 1,
    layer: LAYER.overlay,
    name: { en: 'Spikes', ar: 'أشواك' },
    desc: { en: 'Danger! Any toy that touches spikes is lost.', ar: 'خطر! أي لعبة تلمس الأشواك تُفقد.' },
    hint: { en: 'Hazard', ar: 'خطر' },
  },
  crumble: {
    cost: 1,
    layer: LAYER.tile,
    name: { en: 'Crumble', ar: 'متفتّت' },
    desc: { en: 'Cracks after a toy stands on it, then falls away.', ar: 'يتشقق بعد وقوف اللعبة عليه ثم ينهار.' },
    hint: { en: 'Fragile', ar: 'هش' },
  },
  bumper: {
    cost: 2,
    layer: LAYER.tile,
    name: { en: 'Bumper', ar: 'مرتدة' },
    desc: { en: 'Sends a toy bouncing back the other way.', ar: 'يرد اللعبة لترتد في الاتجاه المعاكس.' },
    hint: { en: 'Bounce back', ar: 'ارتداد' },
  },
  fan: {
    cost: 2,
    layer: LAYER.overlay,
    name: { en: 'Fan', ar: 'مروحة' },
    desc: { en: 'A rising wind column lifts toys upward.', ar: 'عمود هواء صاعد يرفع اللعب إلى الأعلى.' },
    hint: { en: 'Updraft', ar: 'تيار صاعد' },
  },
  warp: {
    cost: 3,
    layer: LAYER.overlay,
    name: { en: 'Warp', ar: 'بوابة' },
    desc: { en: 'Pairs with another portal. Toys teleport between them.', ar: 'تترافق مع بوابة أخرى. تنتقل اللعب بينهما.' },
    hint: { en: 'Teleport', ar: 'انتقال' },
  },
  coin: {
    cost: 0,
    layer: LAYER.item,
    name: { en: 'Coin', ar: 'عملة' },
    desc: { en: 'Collect every coin for an extra star.', ar: 'اجمع كل العملات لتحصل على نجمة إضافية.' },
    hint: { en: 'Collect', ar: 'جمع' },
  },
  star: {
    cost: 0,
    layer: LAYER.item,
    name: { en: 'Star', ar: 'نجمة' },
    desc: { en: 'A hidden bonus star. Grab it for a third star.', ar: 'نجمة إضافية مخفية. التقطها لتحصل على النجمة الثالثة.' },
    hint: { en: 'Bonus', ar: 'مكافأة' },
  },
};

export const PALETTE_ORDER = [
  'girder', 'ladder', 'spring', 'booster', 'conveyorR', 'conveyorL',
  'ice', 'spike', 'crumble', 'bumper', 'fan', 'warp', 'coin', 'star',
];

export const SOLID_TYPES = new Set(['girder', 'crumble', 'bumper']);

export function piece(type) {
  return PIECES[type] || null;
}

export function pieceCost(type) {
  return PIECES[type]?.cost ?? 0;
}

export function isSolid(type) {
  return SOLID_TYPES.has(type);
}
