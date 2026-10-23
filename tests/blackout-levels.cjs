const assert=require('node:assert/strict');
const {Game,LEVELS,ENEMIES,distance}=require('../blackout/engine.js');
const advance=(g,t,input={})=>{for(let n=0;n<Math.ceil(t/.05);n++)g.step(.05,input);};
function aim(g,e){const h=ENEMIES[e.kind].height,head={x:e.x,y:h-.12,z:e.z},dx=head.x-g.player.x,dz=head.z-g.player.z;g.player.yaw=Math.atan2(-dx,-dz);g.player.pitch=Math.atan2(head.y-g.player.y,Math.hypot(dx,dz));}
assert.equal(LEVELS.length,3);assert.equal(new Game({level:-1}).levelIndex,0);
for(const level of [0,1,2]){
 const g=new Game({level});assert.equal(g.level,LEVELS[level]);assert.equal(g.nextLevel(),null);
 for(let w=1;w<=3;w++){g.setWaveQueue(w);assert.deepEqual(['walker','runner','armor'].map(k=>g.queue.filter(t=>t===k).length),g.level.waves[w-1]);}
 for(const target of [g.level.box,...g.level.pickups,{x:0,z:-17.5},...g.level.portals]){
  assert.equal(g.isBlocked(target.x,target.z,.75),false,`${g.level.id} objective is blocked`);
  g.player.x=target.x;g.player.z=target.z;g.buildFlow();const f=g.flow,index=(Math.round(15.6)-f.minZ)*f.width+(0-f.minX);assert.ok(f.dist[index]<32767,`${g.level.id} unreachable route`);
 }
 g.player.x=0;g.player.z=15.6;g.startBossEncounter();advance(g,3.05);assert.equal(g.boss.maxHp,g.level.bossHp);
 g.beginBossSkill(g.boss,'toxic');assert.equal(g.hazards.length,3+g.level.toxicExtra);
 g.finish(true);const next=g.nextLevel();if(level<2){assert.equal(next.levelIndex,level+1);assert.equal(next.player.hp,100);assert.equal(next.facility,null);assert.equal(next.perk,null);assert.equal(next.primary,g.primary);assert.equal(next.melee,g.melee);assert.equal(next.optic,g.optic);}else assert.equal(next,null);
 const training=new Game({level,mode:'bossTraining'});training.finish(true);assert.equal(training.nextLevel(),null);
}
console.log('PASS: three layouts, objective connectivity, wave composition, boss profiles and chapter transitions.');
{
  let runs=0;
  for(const level of [0,1,2])for(const primary of ['m4','ak','awm'])for(const facility of ['grid','turret'])for(const perk of ['pierce','reload','shock']){
    const g=new Game({level,primary,optic:'x8',seed:35+runs}); g.skipTutorial(); g.player.hp=1e6;
    for(let frame=0;frame<11000 && g.stage!=='gateTravel';frame++){
      if(g.stage==='facilityTravel'){Object.assign(g.player,g.level.box);assert.ok(g.interact()); const before=g.time; advance(g,1); assert.equal(g.time,before); assert.equal(g.chooseFacility('invalid'),false); assert.ok(g.chooseFacility(facility));}
      if(g.stage==='perkChoice'){assert.ok(g.choosePerk(perk));}
      const visible=g.enemies.filter(e=>!e.dead&&g.lineClear(g.player,e,1.65)).sort((a,b)=>distance(a,g.player)-distance(b,g.player)); if(visible[0])aim(g,visible[0]);
      // This harness isolates progression and weapon rules; survival balance is tested by playtesting.
      g.player.hp=1e6; g.step(.05,{fire:!!visible[0],aim:true});g.drainEvents();
    }
    assert.equal(g.stage,'gateTravel',primary+'/'+facility+'/'+perk); assert.ok(g.stats.kills>=43);assert.equal(g.bossDefeated,true);assert.ok(Math.abs(g.stats.bossDamage-g.level.bossHp)<.01);
    Object.assign(g.player,{x:0,z:-17.5,hp:1e6,yaw:0,pitch:0});assert.equal(g.interact(),false);advance(g,6.1);assert.ok(g.interact()); const remaining=g.gateTime;g.pause();advance(g,3);assert.equal(g.gateTime,remaining);g.resume();advance(g,g.level.evacSeconds+.1);assert.equal(g.stage,'escape');assert.equal(g.gateOpen,true);const spawned=g.spawned;advance(g,2);assert.equal(g.spawned,spawned);assert.equal(g.stage,'escape');advance(g,1,{forward:1});assert.equal(g.stage,'won');assert.ok(g.result.won);assert.equal(g.result.primary,primary);assert.equal(g.result.perk,perk);assert.equal(g.result.facility,facility);assert.equal(g.result.levelIndex,level);runs++;
  }
  assert.equal(runs,54);
}
console.log('PASS: 54 weapon/facility/perk/chapter builds complete all waves, boss and extraction.');
