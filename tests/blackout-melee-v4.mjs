import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as THREE from '../blackout/vendor/three.module.min.js';
import {MELEE_POSES,applyMeleePose} from '../blackout/melee-pose.js';
const require=createRequire(import.meta.url),{Game,MELEE,MELEE_ATTACKS,WEAPONS}=require('../blackout/engine.js');
const advance=(g,t,input={})=>{for(let i=0;i<Math.ceil(t/.005);i++)g.step(.005,input);};
const signatures=new Set();
for(const id of Object.keys(MELEE))for(const type of ['light','heavy']){
 const g=new Game({melee:id});g.switchWeapon('melee');advance(g,.2);const e=g.spawn('armor');Object.assign(e,{x:0,z:14.25,fx:0,fz:1});
 assert.ok(g.meleeAttack(false,type));const action={...g.meleeAction},hp=e.hp;
 advance(g,action.impact-.02);assert.equal(e.hp,hp,'no damage before blade contact');
 g.pause();const time=g.meleeAction.elapsed;advance(g,1);assert.equal(g.meleeAction.elapsed,time);g.resume();
 advance(g,.03);assert.ok(e.hp<hp,'impact deals damage');const remaining=e.hp;
 g.switchWeapon('rifle');assert.equal(g.weapon,'melee','cannot cancel recovery');advance(g,.02);assert.equal(e.hp,remaining,'single contact per swing');
 const root=new THREE.Group();let previous=null;
 for(let i=0;i<=1000;i++){const poseAction={...action,elapsed:action.duration*i/1000};applyMeleePose(root,id,poseAction);assert.ok(root.position.z<-.6);assert.ok(root.position.toArray().every(Number.isFinite));if(previous){assert.ok(root.position.distanceTo(previous.p)<.03);assert.ok(root.quaternion.angleTo(previous.q)<.08);}previous={p:root.position.clone(),q:root.quaternion.clone()};}
 applyMeleePose(root,id,{...action,elapsed:action.impact});signatures.add(JSON.stringify([...root.position.toArray(),...root.quaternion.toArray()].map(v=>v.toFixed(3))));
 applyMeleePose(root,id,action);const first=root.position.clone(),rotation=root.quaternion.clone();applyMeleePose(root,id,{...action,elapsed:action.duration});assert.ok(root.position.distanceTo(first)<1e-8);assert.ok(root.quaternion.angleTo(rotation)<1e-6);
 assert.equal(g.stats.heavySwings,type==='heavy'?1:0);
}
assert.equal(signatures.size,10,'ten distinct light/heavy contact poses');
const miss=new Game();miss.switchWeapon('melee');advance(miss,.2);const e=miss.spawn('walker');Object.assign(e,{x:0,z:14.2});miss.meleeAttack();e.z=8;advance(miss,.2);assert.equal(e.hp,85,'range is checked at contact, not button press');
const tired=new Game();tired.switchWeapon('melee');advance(tired,.2);tired.player.stamina=17;assert.equal(tired.meleeAttack(false,'heavy'),false);
console.log('PASS: 10 distinct continuous wrist animations, delayed single-hit contact, recovery, pause, live range and stamina.');
const encounter=()=>{const g=new Game({mode:'bossTraining'});g.startBossEncounter();advance(g,3.01);return g;};
const g=encounter(),b=g.boss;
g.damageEnemy(b,72,'player',true);assert.equal(b.hp,9570);g.damageEnemy(b,30,'player');assert.equal(b.hp,9558);b.exposed=2;g.damageEnemy(b,72,'player',true);assert.equal(b.hp,9486);
b.exposed=0;for(let i=0;i<4;i++)g.damageEnemy(b,1,'heavy');assert.ok(b.exposed>0&&b.stun>0);assert.equal(b.stagger,0);
g.damageEnemy(b,1e6,'player');assert.equal(b.hp,6400);assert.equal(b.phaseNumber,2);g.damageEnemy(b,1e6,'player');assert.equal(b.hp,6400);advance(g,1.21);assert.equal(g.enemies.filter(e=>e.kind!=='boss').length,2);
g.damageEnemy(b,1e6,'player');assert.equal(b.hp,3200);advance(g,1.21);assert.equal(g.enemies.filter(e=>e.kind!=='boss').length,4);assert.ok(b.enraged);
g.beginBossSkill(b,'slam');advance(g,1.01);assert.ok(g.hazards.some(h=>h.type==='shockwave'));g.damageEnemy(b,1e6,'player');g.step(.01);assert.equal(g.hazards.length,0);assert.equal(g.stage,'won');assert.ok(Math.abs(g.stats.bossDamage-9600)<1e-6);
const charge=encounter();Object.assign(charge.boss,{x:0,z:-6});Object.assign(charge.player,{x:0,z:3});charge.beginBossSkill(charge.boss,'charge');advance(charge,2);assert.ok(charge.boss.exposed>0,'wall impact exposes boss');
const supply=encounter();supply.pickups.forEach(p=>p.taken=true);advance(supply,14.1);assert.ok(supply.pickups.filter(p=>p.type==='ammo').some(p=>!p.taken));
const chained=encounter();Object.assign(chained.boss,{x:12,z:-12,phaseNumber:2});Object.assign(chained.player,{x:12,z:-5});chained.beginBossSkill(chained.boss,'charge');advance(chained,2.25);assert.equal(chained.boss.skill.type,'charge');assert.equal(chained.boss.skill.chain,1);assert.ok(chained.boss.skill.timer>0,'second charge gets a fresh warning');
for(const jump of [false,true]){const wave=encounter();Object.assign(wave.player,{x:0,z:-13});wave.hazards=[{id:987,type:'shockwave',x:0,z:-14,radius:.1,maxRadius:8,warning:0,life:2,hit:false}];if(jump)wave.player.feet=.7;wave.updateHazards(.08);assert.equal(wave.player.hp,jump?100:82);}
console.log('PASS: armor/weakpoint damage, heavy stagger, phase damage caps, adds, shockwave, wall weakness, resupply and boss victory.');
for(const primary of ['m4','ak','awm']){
 const g=encounter(),boss=g.boss,w=WEAPONS[primary];let ammo=w.mag,delay=0,shots=0,skills=0;
 for(let frame=0;frame<24000&&!boss.dead;frame++){
  g.player.hp=1e6;g.step(.005);delay-=.005;
  if(delay<=0&&g.stage==='boss'&&boss.transition<=0){g.damageEnemy(boss,w.damage*2.4,'player',true);shots++;ammo--;if(ammo===0){ammo=w.mag;delay=w.reload;}else delay=w.interval;}
  skills+=g.drainEvents().filter(e=>e.type==='bossskill').length;
 }
 assert.ok(boss.dead,primary+' must be beatable');assert.ok(g.time-3>25,primary+' should not melt the boss');assert.ok(skills>=3);console.log(`IDEAL HEADSHOT MODEL ${primary}: ${(g.time-3).toFixed(1)} s / ${shots} rounds / ${skills} skills (ignores survival, misses and ammo travel).`);
}
