import { CAMPAIGN, applySolution } from '../src/levels.js';
import { World } from '../src/sim.js';
const id = process.argv[2] || 'c2';
const t0 = Number(process.argv[3] || 4.5), t1 = Number(process.argv[4] || 6.0);
const level = applySolution(CAMPAIGN.find(l=>l.id===id));
const w = new World(level);
for (let i=0;i<120*30;i++){
  w.update(1/120);
  if (w.time>=t0 && w.time<=t1) {
    const m=w.minis[0];
    if(m) console.log(w.time.toFixed(3),'x',m.x.toFixed(3),'y',m.y.toFixed(3),'vx',m.vx.toFixed(2),'vy',m.vy.toFixed(2),'dir',m.dir,'gr',m.grounded,'climb',m.climbing,'lcd',m.ladderCd.toFixed(2));
  }
  if (w.status!=='running'){ console.log('END',w.status,'t',w.time.toFixed(2)); break; }
}
