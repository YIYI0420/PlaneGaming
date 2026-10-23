const assert=require('node:assert/strict');
const {Game,MELEE,MELEE_ATTACKS,BOSS_RULES,ENEMIES,distance}=require('../blackout/engine.js');
const advance=(g,t,input={})=>{for(let i=0;i<Math.round(t/.01);i++)g.step(.01,input);};
let checks=0;function test(name,fn){fn();checks++;console.log('PASS',name);}
const place=(g,kind,x,z)=>{const e=g.spawn(kind);Object.assign(e,{x,z,fx:0,fz:1});return e;};
function encounter(mode='campaign'){const g=new Game({mode});g.startBossEncounter();advance(g,3.01);return g;}
test('Shift sprint increases travel speed, consumes stamina, yields to aim and manual fire',()=>{
 const walk=new Game(),run=new Game();advance(walk,1,{forward:1});advance(run,1,{forward:1,sprint:true});assert.ok(15.6-run.player.z>(15.6-walk.player.z)*1.6);assert.ok(Math.abs(run.player.stamina-80)<.01);assert.ok(run.player.sprinting);
 run.step(.01,{forward:1,sprint:true,aim:true});assert.equal(run.player.sprinting,false);run.step(.01,{forward:1,sprint:true,fire:true});assert.equal(run.player.sprinting,false);assert.equal(run.ammo.rifle,29);
 const mobile=new Game();advance(mobile,.5,{forward:1,sprint:true,autoFire:true});assert.ok(mobile.player.sprinting,'touch auto-fire must not disable running');
});
test('stamina exhaustion, recovery, stationary input and pause',()=>{
 const g=new Game();advance(g,5.01,{x:1,sprint:true});assert.ok(g.player.exhausted);assert.equal(g.player.sprinting,false);const before=g.player.stamina;g.pause();advance(g,2);assert.equal(g.player.stamina,before);g.resume();advance(g,2);assert.ok(g.player.stamina>=25);g.step(.01,{sprint:true});assert.equal(g.player.sprinting,false);advance(g,4);assert.equal(g.player.stamina,100);
});
test('five selectable melee weapons have distinct damage, cadence, reach and models keys',()=>{
 assert.equal(Object.keys(MELEE).length,5);for(const id of Object.keys(MELEE)){const g=new Game({melee:id});assert.equal(g.melee,id);g.switchWeapon('melee');advance(g,.2);const e=place(g,'armor',0,14.3),ammo={...g.ammo},reserve=g.reserve;assert.ok(g.shoot());assert.equal(e.hp,220);advance(g,MELEE_ATTACKS[id].light.windup+MELEE_ATTACKS[id].light.active*.5+.02);assert.ok(e.hp<220);assert.equal(g.shoot(),false);assert.deepEqual(g.ammo,ammo);assert.equal(g.reserve,reserve);assert.equal(g.stats.shots,0);assert.equal(g.stats.swings,1);assert.equal(g.reload(),false);g.step(.01,{aim:true});assert.equal(g.zoom,1);}
 assert.equal(new Game({melee:'invalid'}).melee,'combat');
});
test('machete cleaves three, axe breaks armor, karambit rewards backstab',()=>{
 const g=new Game({melee:'machete'});g.switchWeapon('melee');advance(g,.2);const victims=[-.35,0,.35].map(x=>place(g,'walker',x,14.1));g.shoot();advance(g,.29);assert.ok(victims.every(e=>e.dead));assert.equal(g.stats.meleeKills,3);
 const axe=new Game({melee:'axe'});axe.switchWeapon('melee');advance(axe,.2);const armor=place(axe,'armor',0,14.2);axe.shoot();advance(axe,.39);assert.ok(armor.dead);
 const k=new Game({melee:'karambit'});k.switchWeapon('melee');advance(k,.2);const e=place(k,'walker',0,14.3);e.fz=-1;k.shoot();k.updateMelee(.13);assert.ok(e.dead);
});
test('melee obeys range, facing and bus occlusion',()=>{
 const g=new Game({melee:'katana'});g.switchWeapon('melee');advance(g,.2);const far=place(g,'walker',0,10),behind=place(g,'walker',0,17);assert.equal(g.shoot(true),false);g.shoot();assert.equal(far.hp,85);assert.equal(behind.hp,85);
 const wall=new Game({melee:'katana'});wall.switchWeapon('melee');advance(wall,.2);wall.player.x=-7;wall.player.z=4.5;const blocked=place(wall,'walker',-7,3.4);wall.shoot();assert.equal(blocked.hp,85);
});
test('boss introduction gates attacks, has large body, 9600 health and three bounded phases',()=>{
 const g=new Game();g.startBossEncounter();assert.equal(g.stage,'bossIntro');assert.equal(g.shoot(),false);assert.equal(g.boss.hp,BOSS_RULES.hp);assert.ok(ENEMIES.boss.height>ENEMIES.armor.height*1.7);assert.equal(g.startBossEncounter(),false);advance(g,3.01);assert.equal(g.stage,'boss');g.damageEnemy(g.boss,1e6,'player');assert.equal(g.boss.hp,6400);assert.equal(g.boss.phaseNumber,2);advance(g,1.21);g.damageEnemy(g.boss,1e6,'player');assert.equal(g.boss.hp,3200);assert.equal(g.boss.enraged,true);
});
test('slam has windup, damages on impact, is blocked by buses and can be jumped',()=>{
 for(const dodge of [false,true]){const g=encounter(),b=g.boss;Object.assign(g.player,{x:0,z:b.z+3.5});g.beginBossSkill(b,'slam');advance(g,.95);assert.equal(g.player.hp,100);if(dodge)g.jump();advance(g,.3);assert.equal(g.player.hp,dodge?100:72);}
 const g=encounter(),b=g.boss;Object.assign(b,{x:-7,z:5.2});Object.assign(g.player,{x:-7,z:2});g.beginBossSkill(b,'slam');advance(g,1.25);assert.equal(g.player.hp,100);
});
test('charge hits once, can be sidestepped, stops at obstacle',()=>{
 for(const dodge of [false,true]){const g=encounter(),b=g.boss;Object.assign(g.player,{x:0,z:-6});g.beginBossSkill(b,'charge');advance(g,1.95,dodge?{x:1,sprint:true}:{});assert.equal(g.player.hp,dodge?100:70);}
 const g=encounter(),b=g.boss;Object.assign(b,{x:0,z:-6});Object.assign(g.player,{x:0,z:3});g.beginBossSkill(b,'charge');advance(g,2);assert.ok(b.z<-4.4);assert.equal(g.player.hp,100);
});
test('toxic skill warns, ticks damage, pauses, and can be escaped',()=>{
 const g=encounter(),b=g.boss;Object.assign(g.player,{x:0,z:5});g.beginBossSkill(b,'toxic');assert.equal(g.hazards.length,3);advance(g,1.5);assert.equal(g.player.hp,100);const before=JSON.stringify(g.hazards);g.pause();advance(g,5);assert.equal(JSON.stringify(g.hazards),before);g.resume();advance(g,.2);assert.equal(g.player.hp,91);advance(g,1,{x:1,sprint:true});const hp=g.player.hp;advance(g,2);assert.equal(g.player.hp,hp);assert.ok(g.hazards.length<=3);
});
test('boss death clears hazards and opens campaign exit phase; training finishes separately',()=>{
 for(const mode of ['campaign','bossTraining']){const g=encounter(mode),b=g.boss;g.beginBossSkill(b,'toxic');for(let phase=0;phase<3;phase++){g.damageEnemy(b,1e6,'player',true);if(!b.dead)advance(g,1.21);}assert.equal(g.hazards.length,0);g.step(.01);assert.ok(g.bossDefeated);assert.equal(g.stage,mode==='campaign'?'gateTravel':'won');if(g.result){assert.equal(g.result.mode,'bossTraining');assert.equal(g.result.bossDefeated,true);}}
});
test('boss navigation works at its larger collision radius',()=>{
 const g=encounter(),b=g.boss;g.player.hp=1e6;for(let i=0;i<6000&&distance(b,g.player)>2.5;i++){b.skillCooldown=999;g.step(.01);g.drainEvents();}assert.ok(distance(b,g.player)<2.6,`${b.x},${b.z}`);
});
console.log(`Expansion: ${checks} checks passed.`);
