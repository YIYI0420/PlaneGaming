const assert = require('node:assert/strict');
const { Game, WEAPONS, OPTICS, ENEMIES, BOX, EXIT, GRID, TURRET, distance } = require('../blackout/engine.js');
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }
function advance(g, seconds, input = {}) { for (let t = 0; t < seconds - 1e-6; t += .05) g.step(.05, input); }
function target(g, kind, x, z) { const e = g.spawn(kind); Object.assign(e, { x, z, fx: 0, fz: 1 }); return e; }
function aim(g, e, head = true) { const dx = e.x - g.player.x, dz = e.z - g.player.z; g.player.yaw = Math.atan2(-dx, -dz); g.player.pitch = Math.atan2((head ? ENEMIES[e.kind].height - .2 : 1) - g.player.y, Math.hypot(dx, dz)); }
test('wave composition is exactly 8, 15 and 19 with three enemy types', () => {
  const g = new Game();
  for (const [wave, counts] of [[1,[8,0,0]], [2,[12,3,0]], [3,[14,4,1]]]) { g.setWaveQueue(wave); assert.deepEqual(['walker','runner','armor'].map(k => g.queue.filter(v => v === k).length), counts); }
});
test('all nine primary / optic combinations retain distinct stats and real zoom', () => {
  for (const primary of ['m4','ak','awm']) for (const optic of ['red','x4','x8']) { const g = new Game({ primary, optic }); assert.equal(g.ammo.rifle, WEAPONS[primary].mag); g.step(.02, { aim: true }); assert.equal(g.zoom, OPTICS[optic].zoom); g.switchWeapon('pistol'); assert.equal(g.zoom, 1.25); }
  assert.ok(WEAPONS.ak.damage > WEAPONS.m4.damage && WEAPONS.ak.recoil > WEAPONS.m4.recoil); assert.equal(WEAPONS.awm.mag, 5);
});
test('primary reload consumes finite reserve; pistol reload does not', () => {
  for (const primary of ['m4','ak','awm']) { const g = new Game({ primary }); g.ammo.rifle = 0; g.reserve = 3; assert.equal(g.reload(), true); advance(g, 3); assert.equal(g.ammo.rifle, 3); assert.equal(g.reserve, 0); g.switchWeapon('pistol'); g.ammo.pistol = 0; g.reload(); advance(g, 1.4); assert.equal(g.ammo.pistol, 12); assert.equal(g.reserve, 0); }
});
test('AWM kills exposed armored head; frontal armor reduces body damage', () => {
  const g = new Game({ primary: 'awm' }); const e = target(g, 'armor', 0, 7); aim(g, e); assert.ok(g.shoot()); assert.ok(e.dead); assert.equal(g.stats.headshots, 1);
  const b = new Game({ primary:'ak' }); const armor = target(b,'armor',0,7); aim(b,armor,false); b.shoot(); assert.ok(Math.abs(armor.hp - (220 - 40*.24)) < 1e-6);
});
test('bus blocks both bullets and melee; low cover allows elevated shots', () => {
  const g = new Game({ primary:'awm' }); g.player.x=-7; g.player.z=7; const e=target(g,'walker',-7,-12); aim(g,e); g.shoot(); assert.equal(e.hp,85); assert.equal(g.stats.hits,0);
  assert.equal(g.lineClear({x:-7,z:4.4},{x:-7,z:3.6},1),false);
  const h = new Game({primary:'awm'}); h.player.z=0; const behind=target(h,'walker',0,-6); aim(h,behind); h.shoot(); assert.equal(behind.dead,true);
});
test('piercing affects one additional enemy only after ordinary zombie', () => {
  const g = new Game({primary:'awm'}); g.perk='pierce'; const a=target(g,'walker',0,9), b=target(g,'walker',0,6), c=target(g,'walker',0,3); aim(g,a); g.shoot(); assert.ok(a.dead&&b.dead&&!c.dead);
  const h = new Game({primary:'awm'}); h.perk='pierce'; const runner=target(h,'runner',0,9), other=target(h,'walker',0,6); aim(h,runner,false); h.shoot(); assert.ok(runner.dead&&!other.dead);
});
test('grenade respects walls; shock applies four-second slow', () => {
  const g = new Game(); g.perk='shock'; const a=target(g,'armor',0,6), b=target(g,'walker',-7,3); g.explode({x:0,z:7}); assert.equal(a.slow,4); assert.equal(a.slowFactor,.4); const hp=b.hp; g.explode({x:-7,z:5}); assert.equal(b.hp,hp);
});
test('electric grid and turret damage and account for assisted kills', () => {
  const g=new Game(); g.stage='wave'; g.facility='grid'; g.gridTimer=0; const e=target(g,'walker',GRID.x1+1,GRID.z1+1); g.updateFacility(.02); assert.equal(e.hp,53); assert.equal(e.slowFactor,.45); g.damageEnemy(e,60,'player'); assert.equal(g.stats.assists,1);
  const h=new Game(); h.stage='wave'; h.facility='turret'; const a=target(h,'walker',TURRET.x,TURRET.z-4); for(let i=0;i<4;i++)h.updateFacility(.3); assert.ok(a.dead); assert.equal(h.stats.facilityKills,1); assert.equal(h.turretAmmo,116);
  const blocked=target(h,'walker',7,0); h.turretTimer=0; h.updateFacility(.3); assert.equal(blocked.hp,85);
});
test('spawn cap, failure result and frozen simulation', () => {
  const g=new Game(); g.skipTutorial(); g.player.hp=1e6; advance(g,80); assert.equal(g.enemies.filter(e=>!e.dead).length,8); assert.equal(g.queue.length,0); g.pause(); const before=JSON.stringify(g.player), time=g.time; advance(g,10,{forward:1,fire:true}); assert.equal(JSON.stringify(g.player),before); assert.equal(g.time,time); g.resume(); g.player.hp=1; g.player.hitCooldown=0; g.hurt(8); assert.equal(g.stage,'lost'); assert.equal(g.result.won,false);
});
test('zombies navigate around buses from every entrance', () => {
  for(let portal=0;portal<3;portal++){const g=new Game();g.stage='evac';g.gateTime=9999;g.reinforcementTimer=9999;g.player.hp=1e6;g.spawned=portal;const e=g.spawn('walker');advance(g,65);assert.ok(distance(e,g.player)<1.7, `portal ${portal}: ${e.x},${e.z}`);assert.ok(g.stats.damageTaken>0);}
});
test('all weapon / facility / perk builds complete wave, power, perk, gate and extraction flow', () => {
  let runs=0;
  for(const primary of ['m4','ak','awm'])for(const facility of ['grid','turret'])for(const perk of ['pierce','reload','shock']){
    const g=new Game({primary,optic:'x8',seed:35+runs}); g.skipTutorial(); g.player.hp=1e6;
    for(let frame=0;frame<11000 && g.stage!=='gateTravel';frame++){
      if(g.stage==='facilityTravel'){Object.assign(g.player,BOX);assert.ok(g.interact()); const before=g.time; advance(g,1); assert.equal(g.time,before); assert.equal(g.chooseFacility('invalid'),false); assert.ok(g.chooseFacility(facility));}
      if(g.stage==='perkChoice'){assert.ok(g.choosePerk(perk));}
      const visible=g.enemies.filter(e=>!e.dead&&g.lineClear(g.player,e,1.65)).sort((a,b)=>distance(a,g.player)-distance(b,g.player)); if(visible[0])aim(g,visible[0]);
      // This harness isolates progression and weapon rules; survival balance is tested by playtesting.
      g.player.hp=1e6; g.step(.05,{fire:!!visible[0],aim:true});g.drainEvents();
    }
    assert.equal(g.stage,'gateTravel',primary+'/'+facility+'/'+perk); assert.ok(g.stats.kills>=43);assert.equal(g.bossDefeated,true);assert.ok(Math.abs(g.stats.bossDamage-9600)<.01);
    Object.assign(g.player,{x:0,z:-17.5,hp:1e6,yaw:0,pitch:0});assert.equal(g.interact(),false);advance(g,6.1);assert.ok(g.interact()); const remaining=g.gateTime;g.pause();advance(g,3);assert.equal(g.gateTime,remaining);g.resume();advance(g,18.1);assert.equal(g.stage,'escape');assert.equal(g.gateOpen,true);const spawned=g.spawned;advance(g,2);assert.equal(g.spawned,spawned);assert.equal(g.stage,'escape');advance(g,1,{forward:1});assert.equal(g.stage,'won');assert.ok(g.result.won);assert.equal(g.result.primary,primary);assert.equal(g.result.perk,perk);assert.equal(g.result.facility,facility);runs++;
  }
  assert.equal(runs,18);
});
console.log(`Blackout: ${checks} checks passed, including 18 complete build simulations.`);
