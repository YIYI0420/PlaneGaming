(function (root, factory) {
  const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.Blackout = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const WEAPONS = {
    m4: { name: 'M4A1 突击步枪', short: 'M4A1', mag: 30, reserve: 90, damage: 30, interval: .125, reload: 1.75, recoil: .06, spread: .004, supply: 30, cap: 180, desc: '稳定连射 / 均衡可靠' },
    ak: { name: 'AK-47 突击步枪', short: 'AK-47', mag: 30, reserve: 90, damage: 40, interval: .17, reload: 2.2, recoil: .115, spread: .009, supply: 30, cap: 180, desc: '高单发伤害 / 后坐更强' },
    awm: { name: 'AWM 栓动狙击枪', short: 'AWM', mag: 5, reserve: 20, damage: 158, interval: 1.12, reload: 2.55, recoil: .16, spread: .002, supply: 5, cap: 40, desc: '高精度点杀 / 五发弹匣' },
    pistol: { name: 'P-12 备用手枪', short: 'P-12', mag: 12, reserve: Infinity, damage: 36, interval: .3125, reload: 1.25, recoil: .085, spread: .004 }
  };
  const OPTICS = { red: { name: '红点瞄准镜', short: '红点', zoom: 1.25 }, x4: { name: '四倍瞄准镜', short: '4×', zoom: 4 }, x8: { name: '八倍瞄准镜', short: '8×', zoom: 8 } };
  const MELEE = {
    combat: { name:'军用匕首',short:'军用匕首',damage:65,interval:.40,range:1.95,angle:38,cleave:1,backstab:1.4,armor:1,color:'#97b2b5',desc:'均衡 · 快速刺击',mag:Infinity,reload:0,recoil:0 },
    karambit: { name:'爪刀',short:'爪刀',damage:48,interval:.29,range:1.65,angle:42,cleave:1,backstab:2.2,armor:1,color:'#d9aa78',desc:'极速 · 背刺强化',mag:Infinity,reload:0,recoil:0 },
    machete: { name:'开山刀',short:'开山刀',damage:95,interval:.68,range:2.3,angle:65,cleave:3,backstab:1.2,armor:1,color:'#91b68d',desc:'横扫 · 最多三目标',mag:Infinity,reload:0,recoil:0 },
    katana: { name:'武士刀',short:'武士刀',damage:115,interval:.82,range:2.8,angle:48,cleave:2,backstab:1.3,armor:1,color:'#b1b7d9',desc:'长距离 · 双目标',mag:Infinity,reload:0,recoil:0 },
    axe: { name:'战斧',short:'战斧',damage:165,interval:1.1,range:2.1,angle:44,cleave:1,backstab:1.2,armor:1.35,color:'#dd9273',desc:'重击 · 对护甲增伤',mag:Infinity,reload:0,recoil:0 }
  };
  const MELEE_ATTACKS = {
    combat:{light:{duration:.40,windup:.10,active:.10,damage:1,range:0,angle:38,cleave:1},heavy:{duration:.86,windup:.31,active:.14,damage:2.15,range:.25,angle:24,cleave:1}},
    karambit:{light:{duration:.29,windup:.07,active:.08,damage:1,range:0,angle:42,cleave:1},heavy:{duration:.72,windup:.25,active:.13,damage:2.2,range:.12,angle:46,cleave:1}},
    machete:{light:{duration:.68,windup:.18,active:.16,damage:1,range:0,angle:65,cleave:3},heavy:{duration:1.18,windup:.43,active:.20,damage:2.05,range:.18,angle:72,cleave:3}},
    katana:{light:{duration:.82,windup:.21,active:.17,damage:1,range:0,angle:48,cleave:2},heavy:{duration:1.32,windup:.49,active:.18,damage:2.3,range:.35,angle:26,cleave:1}},
    axe:{light:{duration:1.10,windup:.27,active:.20,damage:1,range:0,angle:44,cleave:1},heavy:{duration:1.52,windup:.60,active:.22,damage:2.3,range:.15,angle:40,cleave:2}}
  };
  const BOSS_RULES={hp:9600,guardBody:.40,guardHead:1,weakHead:2.4,transition:1.2};
  const ENEMIES = { walker: { hp: 85, speed: 1.4, damage: 8, height: 1.8, radius: .3, cooldown: 1.4 }, runner: { hp: 60, speed: 2.65, damage: 9, height: 1.48, radius: .26, cooldown: 1.05 }, armor: { hp: 220, speed: .9, damage: 16, height: 2.05, radius: .38, cooldown: 1.8 }, boss: { hp:BOSS_RULES.hp,speed:1.55,damage:24,height:3.8,radius:.72,cooldown:1.5 } };
  const OBSTACLES = [
    { id: 'bus-west', x1: -9, x2: -5.5, z1: -9, z2: 4, height: 2.85 },
    { id: 'bus-east', x1: 5.2, x2: 8.7, z1: -5, z2: 8, height: 2.85 },
    { id: 'bus-south', x1: -15, x2: -4.6, z1: 10.2, z2: 13.6, height: 2.85 },
    { id: 'cover-center', x1: -1.8, x2: 1.8, z1: -3.7, z2: -2.8, height: .7 },
    { id: 'crates-east', x1: 11, x2: 13, z1: -.5, z2: 1.5, height: 1.4 },
    { id: 'crates-west', x1: -14, x2: -12.2, z1: -15, z2: -13.2, height: 1.2 },
    { id: 'shed-west', x1: -17.5, x2: -14.7, z1: 16.5, z2: 21.5, height: 3.3 },
  ];
  const GATE = { id: 'gate', x1: -3.1, x2: 3.1, z1: -19.5, z2: -19.1, height: 3.3 };
  const BOX = { x: 11.6, z: 13.5 };
  const EXIT = { x: 0, z: -20.8 };
  const GRID = { x1: -14.6, x2: -10, z1: -10.5, z2: -3.1 };
  const TURRET = { x: 11.7, z: 8.4 };
  const PORTALS = [{ x: -16.4, z: -5.8 }, { x: 16.4, z: -7.5 }, { x: 0, z: -17.8 }];
  const PICKUPS = [{ id: 0, type: 'ammo', x: -12.0, z: 2.5 }, { id: 1, type: 'ammo', x: 12.7, z: 4.6 }, { id: 2, type: 'health', x: -2.7, z: -11.4 }];
  function rayBox(origin, direction, box) {
    let tmin = 0, tmax = Infinity;
    for (const [axis, lo, hi] of [['x', box.x1, box.x2], ['y', box.y1 ?? 0, box.height ?? box.y2], ['z', box.z1, box.z2]]) {
      const d = direction[axis], p = origin[axis];
      if (Math.abs(d) < 1e-8) { if (p < lo || p > hi) return Infinity; }
      else { let a = (lo - p) / d, b = (hi - p) / d; if (a > b) [a, b] = [b, a]; tmin = Math.max(tmin, a); tmax = Math.min(tmax, b); if (tmin > tmax) return Infinity; }
    }
    return tmax >= 0 ? tmin : Infinity;
  }
  function raySphere(o, d, center, radius) {
    const x = o.x - center.x, y = o.y - center.y, z = o.z - center.z;
    const b = x * d.x + y * d.y + z * d.z, c = x * x + y * y + z * z - radius * radius, disc = b * b - c;
    if (disc < 0) return Infinity; const t = -b - Math.sqrt(disc); return t >= 0 ? t : Infinity;
  }
  function direction(yaw, pitch = 0) { return { x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) }; }
  function formatTime(seconds) { const whole = Math.floor(seconds); return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`; }
  class Game {
    constructor(options = {}) {
      this.seed = options.seed || 1937; this.stage = 'tutorial'; this.paused = false; this.time = 0; this.stageTime = 0; this.wave = 0; this.spawned = 0;
      this.player = { x: 0, z: 15.6, y: 1.65, feet: 0, vy: 0, grounded: true, yaw: 0, pitch: -.015, hp: 100, hitCooldown: 0, recoil: 0, stamina:100,sprinting:false,exhausted:false,recovery:0 };
      this.mode = options.mode === 'bossTraining' ? 'bossTraining' : 'campaign'; this.melee = Object.hasOwn(MELEE,options.melee) ? options.melee : 'combat';
      this.meleeTime=0;this.meleeAction=null;this.meleeCombo=0;this.bossDefeated=false;this.hazards=[];
      this.primary = ['m4', 'ak', 'awm'].includes(options.primary) ? options.primary : 'm4'; this.optic = OPTICS[options.optic] ? options.optic : 'red'; this.aiming = false;
      this.weapon = 'rifle'; this.ammo = { rifle: WEAPONS[this.primary].mag, pistol: 12 }; this.reserve = WEAPONS[this.primary].reserve; this.reloadTime = 0; this.reloadDuration = 0; this.fireCooldown = 0; this.grenades = 2; this.grenadeCooldown = 0;
      this.enemies = []; this.projectiles = []; this.nextId = 1; this.events = []; this.queue = []; this.spawnTimer = 0;
      this.facility = null; this.perk = null; this.turretAmmo = 120; this.turretTimer = 0; this.gridTimer = .8; this.gridFlash = 0;
      this.gateTime = 18; this.gateOpen = false; this.reinforcementTimer = 2; this.pickups = PICKUPS.map(p => ({ ...p, taken: false }));
      this.stats = { kills: 0, playerKills: 0, headshots: 0, facilityKills: 0, assists: 0, facilityDamage: 0, shots: 0, hits: 0, damageTaken: 0, grenadesUsed: 0, meleeKills:0,swings:0,heavySwings:0,bossDamage:0 };
      this.notice = '左侧移动，右侧转向；敌人进入准星后可射击'; this.noticeTime = 7; this.result = null;
      this.flow = null; this.flowTimer = 0; this.goalCell = ''; this.setWaveQueue(0);
    }
    random() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
    event(type, data = {}) { if (this.events.length < 180) this.events.push({ type, ...data }); }
    drainEvents() { const e = this.events; this.events = []; return e; }
    notify(text, seconds = 3) { this.notice = text; this.noticeTime = seconds; this.event('notice', { text }); }
    setStage(stage) { this.stage = stage; this.stageTime = 0; this.event('stage', { stage }); }
    get obstacles() { return this.gateOpen ? OBSTACLES : [...OBSTACLES, GATE]; }
    get activeCombat() { return ['wave', 'boss', 'evac', 'escape'].includes(this.stage); }
    get weaponInfo() { return this.weapon === 'melee' ? MELEE[this.melee] : WEAPONS[this.weapon === 'rifle' ? this.primary : 'pistol']; }
    get boss() { return this.enemies.find(e=>e.kind==='boss'&&!e.dead) || null; }
    get bossStatus() { const b=this.boss;if(!b)return '';if(this.stage==='bossIntro')return '守门者逼近 · 准备战斗';if(b.transition>0)return '护甲重组 · 随从即将入场';if(b.exposed>0)return `弱点暴露 ${b.exposed.toFixed(1)} 秒 · 集火头部`;return b.skill?({slam:b.phaseNumber>=2?'双重震地 · 跳跃后注意第二道冲击波':'震地蓄力 · 离开圆圈或跳跃',charge:b.skill.chain?'连环冲撞 · 锁定后横向躲避':'冲撞锁定 · 引诱撞墙',toxic:'毒液落点 · 离开预警区',rush:'冲撞中 · 保持横向移动'}[b.skill.type]):'护甲防守 · 引诱撞墙 / 重击破势'; }
    get zoom() { return this.aiming ? (this.weapon === 'rifle' ? OPTICS[this.optic].zoom : 1.25) : 1; }
    get frozen() { return this.paused || ['facilityChoice', 'perkChoice', 'won', 'lost'].includes(this.stage); }
    get remaining() { return this.enemies.filter(e => !e.dead).length + this.queue.length; }
    get objective() {
      return { tutorial: '熟悉操作，即将开始第一波', wave: `清除第 ${this.wave} 波 · 剩余 ${this.remaining}`, facilityTravel: '前往东南配电箱 · 选择供电设施', facilityChoice: '选择一种防守设施', perkChoice: '选择本局强化', bossIntro:'最终首领 · 守门者正在进入总站',boss:'击败守门者 · 躲避地面预警',gateTravel: this.stageTime < 6 ? '区域清空 · 补给并准备撤离' : '前往北侧闸门 · 启动开门', evac: `守住 ${Math.ceil(this.gateTime)} 秒 · 闸门正在开启`, escape: '闸门已开启 · 进入绿色撤离区', won: '撤离成功', lost: '任务失败' }[this.stage];
    }
    get objectivePoint() { if (this.stage === 'facilityTravel') return BOX; if (['gateTravel', 'evac', 'escape'].includes(this.stage)) return EXIT; return null; }
    get interaction() {
      if (this.stage === 'facilityTravel' && distance(this.player, BOX) < 2.8) return '连接配电箱';
      if (this.stage === 'gateTravel' && this.stageTime >= 6 && distance(this.player, EXIT) < 4.5) return '启动撤离闸门';
      return '';
    }
    pause() { if (!['won', 'lost'].includes(this.stage)) this.paused = true; }
    resume() { this.paused = false; }
    look(dx, dy) { if (this.frozen) return; this.player.yaw += dx; this.player.pitch = clamp(this.player.pitch + dy, -1.05, .95); }
    setWaveQueue(wave) {
      const types = wave === 1 ? Array(8).fill('walker') : wave === 2 ? ['walker', 'walker', 'runner', ...Array(5).fill('walker'), 'runner', ...Array(5).fill('walker'), 'runner'] : wave === 3 ? ['walker', 'walker', 'runner', ...Array(4).fill('walker'), 'runner', 'walker', 'armor', ...Array(3).fill('walker'), 'runner', ...Array(4).fill('walker'), 'runner'] : [];
      this.queue = types; this.spawned = 0;
    }
    startWave(wave) {
      this.wave = wave; this.setWaveQueue(wave); this.spawnTimer = .5; this.pickups.forEach(p => { p.taken = false; }); this.flowTimer = 0;
      this.setStage('wave'); this.notify(`第 ${wave} 波 / ${this.queue.length} 个目标`, 4); this.event('wave', { wave });
    }
    skipTutorial() { if (this.stage === 'tutorial') this.startWave(1); }
    interact() {
      if (!this.interaction || this.frozen) return false;
      if (this.stage === 'facilityTravel') this.setStage('facilityChoice');
      else if (this.stage === 'gateTravel') { this.setStage('evac'); this.gateTime = 18; this.reinforcementTimer = 2; this.notify('闸门开启中，保持移动！', 4); }
      return true;
    }
    resupply() { this.player.hp = Math.min(100, this.player.hp + 18); this.reserve = Math.min(WEAPONS[this.primary].cap, this.reserve + WEAPONS[this.primary].supply); }
    chooseFacility(value) {
      if (this.stage !== 'facilityChoice' || !['grid', 'turret'].includes(value) || this.facility) return false;
      this.facility = value; this.resupply(); this.event('power', { facility: value }); this.startWave(2); return true;
    }
    choosePerk(value) {
      if (this.stage !== 'perkChoice' || !['pierce', 'reload', 'shock'].includes(value) || this.perk) return false;
      this.perk = value; if (value === 'shock') this.grenades = Math.min(3, this.grenades + 1); this.resupply(); this.startWave(3); return true;
    }
    switchWeapon(value) {
      if (!['rifle', 'pistol','melee'].includes(value) || this.frozen || this.meleeAction) return;
      if (this.weapon === value) return; this.weapon = value; this.reloadTime = 0; this.fireCooldown = Math.max(this.fireCooldown, .18); this.event('switch', { weapon: value });
    }
    reload() {
      const w = this.weaponInfo; if (this.weapon==='melee' || this.reloadTime > 0 || this.ammo[this.weapon] >= w.mag || (this.weapon === 'rifle' && this.reserve <= 0) || this.frozen) return false;
      this.reloadDuration = w.reload * (this.perk === 'reload' ? .65 : 1); this.reloadTime = this.reloadDuration; this.event('reload', { duration: this.reloadDuration, weapon: this.weapon }); return true;
    }
    jump() {
      if (this.frozen || !this.player.grounded) return false;
      this.player.vy = 4.8; this.player.grounded = false; this.event('jump'); return true;
    }
    supportHeight(x, z, feet) {
      let floor = 0;
      for (const o of this.obstacles) if (x > o.x1 - .30 && x < o.x2 + .30 && z > o.z1 - .30 && z < o.z2 + .30 && o.height <= feet + .035) floor = Math.max(floor, o.height);
      return floor;
    }
    updateJump(dt) {
      const p = this.player, support = this.supportHeight(p.x, p.z, p.feet);
      if (p.grounded && p.feet > support + .035) p.grounded = false;
      if (!p.grounded) {
        const before = p.feet; p.vy -= 13 * dt; p.feet += p.vy * dt;
        const landing = this.supportHeight(p.x, p.z, before);
        if (p.vy <= 0 && p.feet <= landing) { p.feet = landing; p.vy = 0; p.grounded = true; this.event('land'); }
      }
      p.y = 1.65 + p.feet;
    }
    isBlocked(x, z, radius = .32, feet = 0) { return Math.abs(x) > 17.35 - radius || Math.abs(z) > 21.35 - radius || this.obstacles.some(o => o.height > feet + .015 && x > o.x1 - radius && x < o.x2 + radius && z > o.z1 - radius && z < o.z2 + radius); }
    move(actor, dx, dz, radius = .32) {
      const feet = actor === this.player ? actor.feet : 0;
      if (!this.isBlocked(actor.x + dx, actor.z, radius, feet)) actor.x += dx;
      if (!this.isBlocked(actor.x, actor.z + dz, radius, feet)) actor.z += dz;
    }
    wallDistance(origin, dir, range = 45) { let closest = range; for (const obstacle of this.obstacles) closest = Math.min(closest, rayBox(origin, dir, obstacle)); return closest; }
    lineClear(a, b, y = 1) { const dist = distance(a, b); if (dist < .01) return true; const dir = { x: (b.x - a.x) / dist, y: 0, z: (b.z - a.z) / dist }; return this.wallDistance({ x: a.x, y, z: a.z }, dir, dist + .01) >= dist - .05; }
    walkClear(a, b, radius = .34) {
      const dist = distance(a, b), steps = Math.ceil(dist / .42);
      for (let i = 1; i <= steps; i++) { const t = i / steps; if (this.isBlocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, radius)) return false; } return true;
    }
    trace(origin = this.player, dir = direction(this.player.yaw, this.player.pitch), range = 45) {
      const wall = this.wallDistance(origin, dir, range), hits = [];
      for (const e of this.enemies) {
        if (e.dead) continue; const info = ENEMIES[e.kind], headCenter = { x: e.x, y: info.height - .2, z: e.z };
        const headT = raySphere(origin, dir, headCenter, e.kind === 'boss' ? .42 : e.kind === 'armor' ? .245 : .215);
        const bodyT = rayBox(origin, dir, { x1: e.x - info.radius, x2: e.x + info.radius, z1: e.z - info.radius, z2: e.z + info.radius, y1: .18, height: info.height - .42 });
        const t = Math.min(headT, bodyT); if (t < wall) hits.push({ enemy: e, distance: t, head: headT <= bodyT, point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t } });
      }
      hits.sort((a, b) => a.distance - b.distance); return { hits, wall, dir };
    }
    shoot(auto = false) {
      if (this.frozen || this.player.sprinting || !['tutorial', 'wave','boss', 'facilityTravel', 'gateTravel', 'evac', 'escape'].includes(this.stage) || this.fireCooldown > 0 || this.reloadTime > 0) return false;
      if(this.weapon==='melee')return this.meleeAttack(auto);
      if (this.ammo[this.weapon] <= 0) { this.reload(); return false; }
      const trace = this.trace(); if (auto && !trace.hits.length) return false;
      const weapon = this.weaponInfo; this.ammo[this.weapon]--; this.fireCooldown = weapon.interval; this.player.recoil = weapon.recoil; this.player.pitch = clamp(this.player.pitch + weapon.recoil * (this.aiming ? .17 : .25), -1.05, .95); this.stats.shots++;
      this.event('shoot', { weapon: this.weapon, dir: trace.dir, origin: { ...this.player }, point: trace.hits[0]?.point ?? { x: this.player.x + trace.dir.x * trace.wall, y: this.player.y + trace.dir.y * trace.wall, z: this.player.z + trace.dir.z * trace.wall } });
      if (trace.hits.length) this.stats.hits++;
      for (let i = 0; i < Math.min(trace.hits.length, 2); i++) {
        if (i > 0 && (this.perk !== 'pierce' || trace.hits[0].enemy.kind !== 'walker')) break;
        const hit = trace.hits[i], e = hit.enemy; let damage = weapon.damage * (hit.head ? 2.4 : 1);
        const front = -(trace.dir.x * e.fx + trace.dir.z * e.fz) > .12;
        if (e.kind === 'armor' && !hit.head && front) damage *= .24;
        this.damageEnemy(e, damage, 'player', hit.head); this.event('hit', { point: hit.point, head: hit.head, armor: e.kind === 'armor' && !hit.head && front });
      }
      return true;
    }
    meleeTargets(type='light') {
      const w=MELEE[this.melee],a=MELEE_ATTACKS[this.melee][type],d=direction(this.player.yaw),p=this.player;
      return this.enemies.filter(e=>{
        if(e.dead)return false;const dist=distance(e,p),info=ENEMIES[e.kind];
        return dist<=w.range+a.range+info.radius*.4 && p.feet<info.height && (dist<.01 || (d.x*(e.x-p.x)+d.z*(e.z-p.z))/dist>=Math.cos(a.angle*Math.PI/180)) && this.lineClear(p,e,Math.min(p.y,1.2));
      }).sort((a,b)=>distance(a,p)-distance(b,p));
    }
    meleeAttack(auto=false,type='light') {
      if(this.frozen||this.weapon!=='melee'||this.meleeAction||this.fireCooldown>0||this.player.sprinting||!['tutorial','wave','boss','facilityTravel','gateTravel','evac','escape'].includes(this.stage))return false;
      const a=MELEE_ATTACKS[this.melee][type];if(!a)return false;
      if(auto&&!this.meleeTargets(type).length)return false;
      if(type==='heavy'&&this.player.stamina<18){if(this.notice!=='体力不足 · 重击需要 18 体力'||this.noticeTime<=0)this.notify('体力不足 · 重击需要 18 体力',1.5);return false;}
      if(type==='heavy'){this.player.stamina-=18;this.player.recovery=a.duration+.35;this.stats.heavySwings++;}
      this.fireCooldown=a.duration;this.meleeTime=a.duration;this.stats.swings++;
      this.meleeAction={type,elapsed:0,duration:a.duration,windup:a.windup,active:a.active,impact:a.windup+a.active*.5,hitDone:false,combo:this.meleeCombo++%2};
      this.event('slashstart',{melee:this.melee,heavy:type==='heavy'});return true;
    }
    updateMelee(dt) {
      const action=this.meleeAction;if(!action)return;
      action.elapsed=Math.min(action.duration,action.elapsed+dt);this.meleeTime=Math.max(0,action.duration-action.elapsed);
      if(!action.hitDone&&action.elapsed>=action.impact){action.hitDone=true;this.resolveMelee(action);}
      if(action.elapsed>=action.duration)this.meleeAction=null;
    }
    resolveMelee(action) {
      const w=MELEE[this.melee],a=MELEE_ATTACKS[this.melee][action.type],targets=this.meleeTargets(action.type);
      this.event('slash',{melee:this.melee,heavy:action.type==='heavy'});
      for(const e of targets.slice(0,a.cleave)){
        const toPlayer={x:this.player.x-e.x,z:this.player.z-e.z},len=Math.max(.01,distance(e,this.player));
        const back=(toPlayer.x*e.fx+toPlayer.z*e.fz)/len<-.3;
        const armored=e.kind==='armor'||e.kind==='boss';const amount=w.damage*a.damage*(back?w.backstab:1)*(armored?w.armor:1);
        this.damageEnemy(e,amount,action.type==='heavy'?'heavy':'melee');this.event('hit',{point:{x:e.x,y:Math.min(1.35,ENEMIES[e.kind].height*.65),z:e.z},head:false,armor:armored});
      }
    }
    updateSprint(dt,input,moving) {
      const p=this.player;p.recovery=Math.max(0,p.recovery-dt);
      if(p.exhausted&&p.stamina>=25)p.exhausted=false;
      p.sprinting=!!input.sprint&&moving&&!input.aim&&!input.fire&&!input.heavy&&!this.meleeAction&&!p.exhausted&&p.stamina>0&&this.fireCooldown<=.05;
      if(p.sprinting){p.stamina=Math.max(0,p.stamina-20*dt);p.recovery=.8;if(p.stamina===0){p.exhausted=true;p.sprinting=false;this.notify('体力耗尽 · 松开奔跑等待恢复',2);}}
      else if(p.recovery<=0)p.stamina=Math.min(100,p.stamina+24*dt);
    }
    damageEnemy(e, damage, source, head = false) {
      if(e.dead)return;
      if(e.kind==='boss'){
        if(e.transition>0||this.stage==='bossIntro')return;
        const weak=e.exposed>0;
        if(source==='player')damage*=weak?1:head?BOSS_RULES.guardHead/2.4:BOSS_RULES.guardBody;
        else if(source==='heavy')damage*=weak?2:1.2;
        else if(source==='melee')damage*=weak?1.5:.75;
        else damage*=weak?(source==='grenade'?1.2:.9):(source==='grenade'?.55:.45);
        const floor=e.phaseNumber<3?e.maxHp*(3-e.phaseNumber)/3:0;
        damage=Math.min(damage,e.hp-floor);
        if(source==='heavy'||source==='melee'){
          e.stagger=Math.min(100,e.stagger+(source==='heavy'?(this.melee==='axe'?35:26):4));
          if(e.stagger>=100){e.stagger=0;e.exposed=3;e.stun=1.4;e.skill=null;e.windup=0;e.skillCooldown=3.4;this.notify('重击破势！弱点暴露 3 秒',3);this.event('bossstagger');}
        }
      }
      const actual=Math.min(e.hp,Math.max(0,damage));e.hp-=actual;e.hit=.13;
      if(e.kind==='boss'){
        this.stats.bossDamage+=actual;
        if(e.hp>0&&e.phaseNumber<3&&e.hp<=e.maxHp*(3-e.phaseNumber)/3+.001){
          e.phaseNumber++;e.enraged=e.phaseNumber===3;e.transition=BOSS_RULES.transition;e.skill=null;e.windup=0;e.exposed=0;e.stun=0;e.stagger=0;this.hazards=[];
          this.player.hp=Math.min(100,this.player.hp+25);this.reserve=Math.min(WEAPONS[this.primary].cap,this.reserve+WEAPONS[this.primary].supply*2);this.pickups.forEach(p=>p.taken=false);
          this.notify('第 '+e.phaseNumber+' 阶段 · 护甲重组，弹药补充',3);this.event('enrage');
        }
      }
      if(source==='facility'){e.facilityAt=this.time;this.stats.facilityDamage+=actual;}
      if(e.hp>0)return;
      e.dead=true;this.stats.kills++;
      if(source==='melee'||source==='heavy')this.stats.meleeKills++;
      if(e.kind==='boss'){
        this.bossDefeated=true;this.hazards=[];
        for(const add of this.enemies)if(add!==e&&!add.dead){add.dead=true;this.event('death',{id:add.id,x:add.x,z:add.z,kind:add.kind,head:false});}
        this.event('bossdown',{x:e.x,z:e.z});this.notify('守门者已倒下 · 前往出口撤离',5);
      }
      if(source==='facility')this.stats.facilityKills++;else{this.stats.playerKills++;if(head)this.stats.headshots++;if(this.time-e.facilityAt<4)this.stats.assists++;}
      this.event('death',{id:e.id,x:e.x,z:e.z,kind:e.kind,head});
    }
    throwGrenade() {
      if (this.frozen || this.grenades <= 0 || this.grenadeCooldown > 0 || !['wave','boss', 'evac', 'escape', 'tutorial', 'gateTravel', 'facilityTravel'].includes(this.stage)) return false;
      this.grenades--; this.stats.grenadesUsed++; this.grenadeCooldown = .65;
      const d = direction(this.player.yaw, clamp(this.player.pitch + .22, -.2, .65));
      this.projectiles.push({ id: this.nextId++, x: this.player.x + d.x * .5, y: this.player.y - .3, z: this.player.z + d.z * .5, vx: d.x * 8.7, vy: Math.max(1.8, d.y * 8.7), vz: d.z * 8.7, timer: 1.4 }); this.event('throw'); return true;
    }
    explode(p) {
      this.event('explosion', { x: p.x, y: .3, z: p.z, shock: this.perk === 'shock' });
      for (const e of this.enemies) {
        if (e.dead) continue; const d = distance(p, e); if (d > 5 || !this.lineClear(p, e, .7)) continue;
        this.damageEnemy(e, 150 * (1 - d / 6), 'grenade'); if (this.perk === 'shock') { e.slow = Math.max(e.slow, 4); e.slowFactor = .4; }
      }
    }
    spawn(kind) {
      const portal = PORTALS[this.spawned % PORTALS.length]; const e = { id: this.nextId++, kind, x: portal.x + (this.random() - .5) * .7, z: portal.z + (this.random() - .5) * .7, hp: ENEMIES[kind].hp, maxHp: ENEMIES[kind].hp, fx: 0, fz: 1, cooldown: .6, windup: 0, slow: 0, slowFactor: 1, hit: 0, phase: this.random() * 6.28, facilityAt: -100, dead: false };
      this.enemies.push(e); this.spawned++; this.event('spawn', { id: e.id, kind, x: e.x, z: e.z }); if (kind === 'runner') this.notify('奔袭者进入总站 · 优先处理', 2); if (kind === 'armor') this.notify('护甲目标出现 · 瞄准暴露头部', 4); return e;
    }
    startBossEncounter() {
      if(this.boss||this.bossDefeated)return false;
      this.wave=3;this.queue=[];this.pickups.forEach(p=>p.taken=false);this.grenades=Math.min(3,this.grenades+1);
      this.player.hp=Math.min(100,this.player.hp+40);this.reserve=WEAPONS[this.primary].cap;this.player.stamina=100;
      if(this.mode==='bossTraining'){this.player.x=0;this.player.z=6;}
      const boss=this.spawn('boss');Object.assign(boss,{x:0,z:-14,skill:null,skillCooldown:2.5,skillIndex:0,enraged:false,phaseNumber:1,transition:0,stun:0,stagger:0,exposed:0,supplyTimer:14});
      this.setStage('bossIntro');this.notify('守门者 / 9600 生命 · 三阶段，技能后集火发光弱点',5);this.event('bossintro');return true;
    }
    beginBossSkill(b,type,chain=0) {
      if(b.dead||b.transition>0||this.stage!=='boss')return false;
      const dx=this.player.x-b.x,dz=this.player.z-b.z,len=Math.max(.01,Math.hypot(dx,dz));
      b.fx=dx/len;b.fz=dz/len;b.windup=0;
      const warning=type==='slam'?(b.enraged?1:1.2):type==='charge'?(chain?.7:b.enraged?.8:1.05):1;
      b.skill={type,timer:warning,duration:warning,chain,x:b.x,z:b.z,dx:dx/len,dz:dz/len,length:Math.min(18,len+3),radius:5.5,hit:false};
      if(type==='toxic')for(let i=0;i<b.phaseNumber+2;i++){
        const angle=i*2.4;this.hazards.push({id:this.nextId++,type:'toxic',x:clamp(this.player.x+(i?Math.cos(angle)*2.3:0),-16,16),z:clamp(this.player.z+(i?Math.sin(angle)*2.3:0),-20,20),radius:b.enraged?1.8:1.65,warning:1.65,life:5,tick:0});
      }
      this.hazards=this.hazards.slice(-12);
      this.notify(({slam:'震地蓄力！离开红圈或起跳',charge:chain?'二次冲撞！再次横向闪避':'冲撞锁定！横向奔跑躲避',toxic:'毒液落点！离开地面预警'})[type],2.5);this.event('bossskill',{skill:type,x:b.x,z:b.z});return true;
    }
    finishBossSkill(b,wall=false){
      b.skill=null;b.windup=0;b.exposed=wall?3:b.phaseNumber===3?1.5:2;b.stun=wall?.7:0;b.skillCooldown=b.exposed+(b.phaseNumber===3?1.7:b.phaseNumber===2?2.2:2.7);
      if(wall){this.notify('冲撞撞墙！弱点暴露 3 秒',3);this.event('bossstagger');}
    }
    updateBoss(b,dt) {
      if(this.stage!=='boss')return;
      b.exposed=Math.max(0,b.exposed-dt);b.stun=Math.max(0,b.stun-dt);b.supplyTimer-=dt;
      if(b.supplyTimer<=0){b.supplyTimer=14;this.pickups.filter(p=>p.type==='ammo').forEach(p=>p.taken=false);this.notify('弹药补给已刷新 · 留意绿色补给标记',2);}
      if(b.transition>0){
        b.transition=Math.max(0,b.transition-dt);
        if(b.transition===0){b.skillCooldown=1;for(let i=0;i<2&&this.enemies.filter(e=>!e.dead&&e.kind!=='boss').length<4;i++)this.spawn(b.phaseNumber===3?'runner':'walker');}
        return;
      }
      if(b.stun>0)return;
      if(b.skill){
        const s=b.skill;s.timer-=dt;
        if(s.type==='rush'){
          const speed=b.enraged?10.2:9,before={x:b.x,z:b.z};this.move(b,s.dx*speed*dt,s.dz*speed*dt,.75);b.fx=s.dx;b.fz=s.dz;b.phase+=dt*11;
          if(!s.hit&&distance(b,this.player)<1.55&&this.lineClear(b,this.player,1.1)){this.hurt(30);s.hit=true;this.move(this.player,s.dx*.7,s.dz*.7);}
          if(distance(before,b)<speed*dt*.25){this.finishBossSkill(b,true);return;}
        }
        if(s.timer<=0){
          if(s.type==='charge'){s.type='rush';s.timer=Math.min(1.7,s.length/(b.enraged?10.2:9));s.hit=false;this.event('bosscharge');return;}
          if(s.type==='rush'&&b.phaseNumber>=2&&!s.chain){this.beginBossSkill(b,'charge',1);return;}
          if(s.type==='slam'){
            if(distance(b,this.player)<s.radius&&this.player.feet<.5&&this.lineClear(b,this.player,.9))this.hurt(28);
            this.event('bossslam',{x:b.x,z:b.z,radius:s.radius});
            if(b.phaseNumber>=2)this.hazards.push({id:this.nextId++,type:'shockwave',x:b.x,z:b.z,radius:.1,maxRadius:b.enraged?9:8,warning:.65,life:2,tick:0,hit:false});
          }
          this.finishBossSkill(b);
        }
        return;
      }
      b.skillCooldown-=dt;const dist=distance(b,this.player);
      if(b.skillCooldown<=0){const turn=b.skillIndex++%3;this.beginBossSkill(b,turn===0?'toxic':turn===1?'charge':dist<7?'slam':'toxic');return;}
      if(b.exposed>0)return;
      if(dist<2.3&&this.lineClear(b,this.player,1.1)){
        b.fx=(this.player.x-b.x)/Math.max(.01,dist);b.fz=(this.player.z-b.z)/Math.max(.01,dist);
        if(b.windup>0){b.windup-=dt;if(b.windup<=0){if(distance(b,this.player)<2.65&&this.lineClear(b,this.player,1.1))this.hurt(22);b.cooldown=1.7;}}
        else if(b.cooldown<=0){b.windup=.65;this.event('attack',{x:b.x,z:b.z});}
      }else{
        b.windup=0;const target=this.navigate(b),d=distance(b,target);if(d>.025){b.fx=(target.x-b.x)/d;b.fz=(target.z-b.z)/d;const speed=(b.enraged?2:1.55)*(b.slow>0?b.slowFactor:1);this.move(b,b.fx*speed*dt,b.fz*speed*dt,.75);b.phase+=dt*speed*3;}
      }
    }
    updateHazards(dt) {
      for(const h of this.hazards){
        if(h.warning>0){h.warning=Math.max(0,h.warning-dt);continue;}
        h.life-=dt;
        if(h.type==='shockwave'){
          const before=h.radius;h.radius+=7*dt;
          const d=distance(h,this.player);
          if(!h.hit&&d>=before-.6&&d<=h.radius+.6&&this.player.feet<.5&&this.lineClear(h,this.player,.9)){this.hurt(18);h.hit=true;}
          if(h.radius>=h.maxRadius)h.life=0;
        }else{h.tick-=dt;if(h.tick<=0){h.tick=.8;if(distance(h,this.player)<h.radius&&this.player.feet<.55)this.hurt(9);}}
      }
      this.hazards=this.hazards.filter(h=>h.life>0);
    }
    buildFlow() {
      const width = 35, height = 43, minX = -17, minZ = -21, cells = new Uint8Array(width * height), dist = new Int16Array(width * height); dist.fill(32767);
      for (let z = 0; z < height; z++) for (let x = 0; x < width; x++) cells[z * width + x] = this.isBlocked(x + minX, z + minZ, .4) ? 1 : 0;
      let gx = clamp(Math.round(this.player.x) - minX, 0, width - 1), gz = clamp(Math.round(this.player.z) - minZ, 0, height - 1);
      if (cells[gz * width + gx]) { let found = false; for (let r = 1; r <= 3 && !found; r++) for (let z = Math.max(0, gz - r); z <= Math.min(height - 1, gz + r) && !found; z++) for (let x = Math.max(0, gx - r); x <= Math.min(width - 1, gx + r); x++) if (!cells[z * width + x]) { gx = x; gz = z; found = true; break; } }
      const queue = [gz * width + gx]; dist[queue[0]] = 0;
      for (let q = 0; q < queue.length; q++) { const index = queue[q], x = index % width, z = Math.floor(index / width); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (nx < 0 || nx >= width || nz < 0 || nz >= height) continue; const ni = nz * width + nx; if (!cells[ni] && dist[ni] > dist[index] + 1) { dist[ni] = dist[index] + 1; queue.push(ni); } } }
      this.flow = { width, height, minX, minZ, cells, dist }; this.flowTimer = .65; this.goalCell = Math.round(this.player.x) + '/' + Math.round(this.player.z);
    }
    navigate(e) {
      if (this.walkClear(e, this.player, ENEMIES[e.kind].radius + .02)) return this.player;
      const f = this.flow; if (!f) return this.player;
      const x = clamp(Math.round(e.x) - f.minX, 0, f.width - 1), z = clamp(Math.round(e.z) - f.minZ, 0, f.height - 1);
      let best = Infinity, target = { x: e.x, z: e.z };
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, nz = z + dz; if (nx < 0 || nx >= f.width || nz < 0 || nz >= f.height) continue; const index = nz * f.width + nx;
        if (f.cells[index] || f.dist[index] === 32767) continue;
        const p = { x: nx + f.minX, z: nz + f.minZ }; if (!this.walkClear(e, p, ENEMIES[e.kind].radius + .02)) continue;
        const value = f.dist[index] + distance(e, p) * .25; if (value < best) { best = value; target = p; }
      }
      return target;
    }
    updateFacility(dt) {
      if (!this.facility || !this.activeCombat) return;
      if (this.facility === 'grid') {
        this.gridTimer -= dt; if (this.gridTimer > 0) return; this.gridTimer = 2.8; this.gridFlash = .45; this.event('gridpulse');
        for (const e of this.enemies) if (!e.dead && e.x > GRID.x1 && e.x < GRID.x2 && e.z > GRID.z1 && e.z < GRID.z2) { e.slow = Math.max(e.slow, 2.6); e.slowFactor = .45; e.facilityAt = this.time; this.damageEnemy(e, 32, 'facility'); }
      } else {
        this.turretTimer -= dt; if (this.turretTimer > 0 || this.turretAmmo <= 0) return;
        const targets = this.enemies.filter(e => { const d = distance(e, TURRET); return !e.dead && d < 22 && -(e.z - TURRET.z) / Math.max(.01, d) > Math.cos(50 * Math.PI / 180) && this.lineClear(TURRET, e, 1.2); }).sort((a, b) => distance(a, TURRET) - distance(b, TURRET));
        const e = targets[0]; if (!e) return; this.turretAmmo--; this.turretTimer = .25; this.damageEnemy(e, e.kind === 'armor' ? 24 * .24 : 24, 'facility'); this.event('turretshot', { x: e.x, y: 1.1, z: e.z, id: e.id });
      }
    }
    hurt(damage) { if (this.player.hitCooldown > 0 || this.frozen) return; this.player.hp = Math.max(0, this.player.hp - damage); this.player.hitCooldown = .22; this.stats.damageTaken += damage; this.event('hurt', { damage }); if (this.player.hp <= 0) this.finish(false); }
    finish(won) {
      if (['won', 'lost'].includes(this.stage)) return; this.setStage(won ? 'won' : 'lost');
      this.result = { won, mode:this.mode, melee:this.melee, bossDefeated:this.bossDefeated, time: this.time, wave: this.wave, facility: this.facility, perk: this.perk, primary: this.primary, optic: this.optic, ...this.stats, accuracy: this.stats.shots ? Math.round(this.stats.hits / this.stats.shots * 100) : 0 };
    }
    step(dt, input = {}) {
      if (this.frozen || !Number.isFinite(dt) || dt <= 0) return;
      let remaining = Math.min(dt, .1); while (remaining > .000001 && !this.frozen) { const slice = Math.min(.02, remaining); this.tick(slice, input); remaining -= slice; }
    }
    tick(dt, input) {
      this.time += dt; this.stageTime += dt; this.noticeTime = Math.max(0, this.noticeTime - dt); this.fireCooldown = Math.max(0, this.fireCooldown - dt); this.grenadeCooldown = Math.max(0, this.grenadeCooldown - dt); this.player.hitCooldown = Math.max(0, this.player.hitCooldown - dt); this.player.recoil = Math.max(0, this.player.recoil - dt * .5); this.gridFlash = Math.max(0, this.gridFlash - dt);

      this.aiming = !!input.aim && this.weapon!=='melee';
      this.updateJump(dt);
      const dx = clamp(Number(input.x) || 0, -1, 1), forward = clamp(Number(input.forward) || 0, -1, 1), length = Math.max(1, Math.hypot(dx, forward));
      this.updateSprint(dt,input,Math.hypot(dx,forward)>.1);const speed=(this.player.sprinting?6.4:3.8)*dt;
      const sin = Math.sin(this.player.yaw), cos = Math.cos(this.player.yaw);
      this.move(this.player, (dx * cos - forward * sin) / length * speed, (-forward * cos - dx * sin) / length * speed);
      if (input.turn) this.look(input.turn * dt * 1.7, 0);
      if (this.reloadTime > 0) { this.reloadTime = Math.max(0, this.reloadTime - dt); if (this.reloadTime <= 0) { const needed = this.weaponInfo.mag - this.ammo[this.weapon], amount = this.weapon === 'pistol' ? needed : Math.min(needed, this.reserve); this.ammo[this.weapon] += amount; if (this.weapon === 'rifle') this.reserve -= amount; this.event('reloaded'); } }
      this.updateMelee(dt);
      if(!this.player.sprinting){if(this.weapon==='melee'&&input.heavy)this.meleeAttack(false,'heavy');else if(input.fire||input.autoFire)this.shoot(!input.fire);}
      if (this.weapon!=='melee' && this.ammo[this.weapon] <= 0 && this.reloadTime <= 0) this.reload();
      if (this.weapon === 'rifle' && this.ammo.rifle === 0 && this.reserve === 0 && this.reloadTime <= 0) { this.switchWeapon('pistol'); this.notify('步枪弹药耗尽 · 已切换备用手枪', 4); }
      for (const p of this.pickups) if (!p.taken && distance(p, this.player) < 1.15) {
        if (p.type === 'ammo' && this.reserve < WEAPONS[this.primary].cap) { this.reserve = Math.min(WEAPONS[this.primary].cap, this.reserve + WEAPONS[this.primary].supply); p.taken = true; this.notify('主武器备用弹药 +' + WEAPONS[this.primary].supply); this.event('pickup'); }
        else if (p.type === 'health' && this.player.hp < 100) { this.player.hp = Math.min(100, this.player.hp + 30); p.taken = true; this.notify('恢复 30 生命'); this.event('pickup'); }
      }
      if (this.stage === 'tutorial' && this.stageTime >= 15) this.startWave(1);
      if (this.stage==='bossIntro' && this.stageTime>=3){this.setStage('boss');this.event('wave',{wave:'boss'});}
      this.flowTimer -= dt; const cell = Math.round(this.player.x) + '/' + Math.round(this.player.z); if (this.activeCombat && (this.flowTimer <= 0 || this.goalCell !== cell)) this.buildFlow();
      if (this.stage === 'wave') {
        this.spawnTimer -= dt; if (this.spawnTimer <= 0 && this.queue.length && this.enemies.filter(e => !e.dead).length < 8) { this.spawn(this.queue.shift()); this.spawnTimer = this.wave === 1 ? 3.4 : this.wave === 2 ? 2.2 : 2.1; }
      }
      if (this.stage === 'evac') {
        this.gateTime = Math.max(0, this.gateTime - dt); this.reinforcementTimer -= dt;
        if (this.reinforcementTimer <= 0 && this.enemies.filter(e => !e.dead).length < 6) { this.spawn(this.random() < .25 ? 'runner' : 'walker'); this.reinforcementTimer = 3.5; }
        if (this.gateTime <= 0) { this.gateOpen = true; this.flowTimer = 0; this.setStage('escape'); this.notify('闸门已开启 · 现在撤离！', 6); this.event('gateopen'); }
      }
      for (const e of this.enemies) {
        if (e.dead) continue; e.hit = Math.max(0, e.hit - dt); e.slow = Math.max(0, e.slow - dt); e.cooldown = Math.max(0, e.cooldown - dt);
        if(e.kind==='boss'){this.updateBoss(e,dt);continue;}
        const info = ENEMIES[e.kind], dist = distance(e, this.player);
        if (dist < 1.35 && this.lineClear(e, this.player, 1)) {
          e.fx = (this.player.x - e.x) / Math.max(dist, .01); e.fz = (this.player.z - e.z) / Math.max(dist, .01);
          if (e.windup > 0) { e.windup -= dt; if (e.windup <= 0) { if (distance(e, this.player) < 1.65 && this.lineClear(e, this.player, 1)) this.hurt(info.damage); e.cooldown = info.cooldown; } }
          else if (e.cooldown <= 0) { e.windup = .42; this.event('attack', { x: e.x, z: e.z }); }
        } else {
          e.windup = 0; const target = this.navigate(e), d = distance(e, target); if (d < .025) continue;
          e.fx = (target.x - e.x) / d; e.fz = (target.z - e.z) / d;
          let vx = e.fx * info.speed * (e.slow > 0 ? e.slowFactor : 1), vz = e.fz * info.speed * (e.slow > 0 ? e.slowFactor : 1);
          for (const other of this.enemies) if (other !== e && !other.dead) { const gap = distance(e, other); if (gap > .001 && gap < .72) { const push = (.72 - gap) * 2; vx += (e.x - other.x) / gap * push; vz += (e.z - other.z) / gap * push; } }
          this.move(e, vx * dt, vz * dt, info.radius + .02); e.phase += dt * info.speed * 4;
        }
      }
      if (this.frozen) return;
      this.updateFacility(dt);this.updateHazards(dt);if(this.frozen)return;
      for (const p of this.projectiles) { p.timer -= dt; p.vy -= 9.8 * dt; const nx = p.x + p.vx * dt, nz = p.z + p.vz * dt; if (this.isBlocked(nx, nz, .08, p.y - .1)) { p.vx *= -.3; p.vz *= -.3; } else { p.x = nx; p.z = nz; } p.y += p.vy * dt; if (p.y < .13) { p.y = .13; p.vy = Math.abs(p.vy) * .23; p.vx *= .8; p.vz *= .8; } if (p.timer <= 0) this.explode(p); }
      this.projectiles = this.projectiles.filter(p => p.timer > 0); this.enemies = this.enemies.filter(e => !e.dead);
      if (this.stage === 'wave' && this.queue.length === 0 && this.enemies.length === 0) { if (this.wave === 1) { this.setStage('facilityTravel'); this.notify('第一波已清空 · 前往标记的配电箱'); } else if (this.wave === 2) { this.setStage('perkChoice'); } else { this.startBossEncounter(); } }
      if(this.stage==='boss'&&this.bossDefeated){this.hazards=[];if(this.mode==='bossTraining'){this.finish(true);}else{this.setStage('gateTravel');this.flowTimer=0;}}
      if (this.stage === 'escape' && Math.abs(this.player.x) < 2.6 && this.player.z < -19.7) this.finish(true);
    }
  }
  return { Game, WEAPONS, OPTICS, MELEE, MELEE_ATTACKS, BOSS_RULES, ENEMIES, OBSTACLES, GATE, BOX, EXIT, GRID, TURRET, PORTALS, PICKUPS, direction, rayBox, raySphere, clamp, distance, formatTime };
});
