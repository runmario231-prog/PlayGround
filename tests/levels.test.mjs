import assert from 'node:assert/strict';
import { CAMPAIGN, applySolution } from '../src/levels.js';
import { simulate } from '../src/sim.js';
import { levelCost, budgetLeft, encodeLevel, decodeLevel } from '../src/level.js';

let failed = 0;

for (const level of CAMPAIGN) {
  const solved = applySolution(level);
  const cost = levelCost(solved);
  const left = budgetLeft(solved);
  const { world } = simulate(solved, { maxTime: 60, record: false });
  const ok = world.status === 'won';
  if (!ok) failed++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'} ${level.id} ${level.name.en} :: status=${world.status}` +
    ` rescued=${world.rescued}/${world.total} coins=${world.coins}/${world.totalCoins}` +
    ` star=${world.star} time=${world.time.toFixed(1)}s cost=${cost}/${solved.budget} left=${left}`,
  );
  if (world.status === 'lost') {
    const dead = world.minis.find((m) => m.state === 'dead');
    console.log('   lost near', dead ? { x: dead.x.toFixed(2), y: dead.y.toFixed(2) } : '?');
  }
}

// Round-trip encoding
for (const level of CAMPAIGN) {
  const code = encodeLevel(level);
  const back = decodeLevel(code);
  assert.equal(back.w, level.w);
  assert.equal(back.spawn.x, level.spawn.x);
  assert.equal(back.goal.y, level.goal.y);
  assert.equal(back.tiles.length, level.tiles.length);
  assert.equal(back.overlays.length, level.overlays.length);
  assert.equal(back.items.length, level.items.length);
}
console.log('PASS level encode/decode round-trip');

if (failed) {
  console.error(`${failed} campaign level(s) not solved by their stored solution`);
  process.exit(1);
}
