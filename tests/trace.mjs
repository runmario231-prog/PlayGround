import { CAMPAIGN, applySolution } from '../src/levels.js';
import { World } from '../src/sim.js';
const id = process.argv[2] || 'c3';
const level = applySolution(CAMPAIGN.find(l=>l.id===id));
const w = new World(level);
let last = -99;
for (let i=0;i<120*30;i++){
  w.update(1/120);
  const m = w.minis[0];
  if (m && Math.abs(m.x-last)>0.3){ console.log(w.time.toFixed(2), 'x',m.x.toFixed(2),'y',m.y.toFixed(2),'vx',m.vx.toFixed(2),'vy',m.vy.toFixed(2),'dir',m.dir,'gr',m.grounded,'climb',m.climbing); last=m.x; }
  if (w.status!=='running'){ console.log('END',w.status,'t',w.time.toFixed(2)); break; }
}
