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
  const ENEMIES = { walker: { hp: 85, speed: 1.4, damage: 8, height: 1.8, radius: .3, cooldown: 1.4 }, runner: { hp: 60, speed: 2.65, damage: 9, height: 1.48, radius: .26, cooldown: 1.05 }, armor: { hp: 220, speed: .9, damage: 16, height: 2.05, radius: .38, cooldown: 1.8 } };
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
      this.player = { x: 0, z: 15.6, y: 1.65, feet: 0, vy: 0, grounded: true, yaw: 0, pitch: -.015, hp: 100, hitCooldown: 0, recoil: 0 };
      this.primary = ['m4', 'ak', 'awm'].includes(options.primary) ? options.primary : 'm4'; this.optic = OPTICS[options.optic] ? options.optic : 'red'; this.aiming = false;
      this.weapon = 'rifle'; this.ammo = { rifle: WEAPONS[this.primary].mag, pistol: 12 }; this.reserve = WEAPONS[this.primary].reserve; this.reloadTime = 0; this.reloadDuration = 0; this.fireCooldown = 0; this.grenades = 2; this.grenadeCooldown = 0;
      this.enemies = []; this.projectiles = []; this.nextId = 1; this.events = []; this.queue = []; this.spawnTimer = 0;
      this.facility = null; this.perk = null; this.turretAmmo = 120; this.turretTimer = 0; this.gridTimer = .8; this.gridFlash = 0;
      this.gateTime = 18; this.gateOpen = false; this.reinforcementTimer = 2; this.pickups = PICKUPS.map(p => ({ ...p, taken: false }));
      this.stats = { kills: 0, playerKills: 0, headshots: 0, facilityKills: 0, assists: 0, facilityDamage: 0, shots: 0, hits: 0, damageTaken: 0, grenadesUsed: 0 };
      this.notice = '左侧移动，右侧转向；敌人进入准星后可射击'; this.noticeTime = 7; this.result = null;
      this.flow = null; this.flowTimer = 0; this.goalCell = ''; this.setWaveQueue(0);
    }
    random() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
    event(type, data = {}) { if (this.events.length < 180) this.events.push({ type, ...data }); }
    drainEvents() { const e = this.events; this.events = []; return e; }
    notify(text, seconds = 3) { this.notice = text; this.noticeTime = seconds; this.event('notice', { text }); }
    setStage(stage) { this.stage = stage; this.stageTime = 0; this.event('stage', { stage }); }
    get obstacles() { return this.gateOpen ? OBSTACLES : [...OBSTACLES, GATE]; }
    get activeCombat() { return ['wave', 'evac', 'escape'].includes(this.stage); }
    get weaponInfo() { return WEAPONS[this.weapon === 'rifle' ? this.primary : 'pistol']; }
    get zoom() { return this.aiming ? (this.weapon === 'rifle' ? OPTICS[this.optic].zoom : 1.25) : 1; }
    get frozen() { return this.paused || ['facilityChoice', 'perkChoice', 'won', 'lost'].includes(this.stage); }
    get remaining() { return this.enemies.filter(e => !e.dead).length + this.queue.length; }
    get objective() {
      return { tutorial: '熟悉操作，即将开始第一波', wave: `清除第 ${this.wave} 波 · 剩余 ${this.remaining}`, facilityTravel: '前往东南配电箱 · 选择供电设施', facilityChoice: '选择一种防守设施', perkChoice: '选择本局强化', gateTravel: this.stageTime < 6 ? '区域清空 · 补给并准备撤离' : '前往北侧闸门 · 启动开门', evac: `守住 ${Math.ceil(this.gateTime)} 秒 · 闸门正在开启`, escape: '闸门已开启 · 进入绿色撤离区', won: '撤离成功', lost: '任务失败' }[this.stage];
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
      if (!['rifle', 'pistol'].includes(value) || this.frozen) return;
      if (this.weapon === value) return; this.weapon = value; this.reloadTime = 0; this.fireCooldown = Math.max(this.fireCooldown, .18); this.event('switch', { weapon: value });
    }
    reload() {
      const w = this.weaponInfo; if (this.reloadTime > 0 || this.ammo[this.weapon] >= w.mag || (this.weapon === 'rifle' && this.reserve <= 0) || this.frozen) return false;
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
        const headT = raySphere(origin, dir, headCenter, e.kind === 'armor' ? .245 : .215);
        const bodyT = rayBox(origin, dir, { x1: e.x - info.radius, x2: e.x + info.radius, z1: e.z - info.radius, z2: e.z + info.radius, y1: .18, height: info.height - .42 });
        const t = Math.min(headT, bodyT); if (t < wall) hits.push({ enemy: e, distance: t, head: headT <= bodyT, point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t } });
      }
      hits.sort((a, b) => a.distance - b.distance); return { hits, wall, dir };
    }
    shoot(auto = false) {
      if (this.frozen || !['tutorial', 'wave', 'facilityTravel', 'gateTravel', 'evac', 'escape'].includes(this.stage) || this.fireCooldown > 0 || this.reloadTime > 0) return false;
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
    damageEnemy(e, damage, source, head = false) {
      if (e.dead) return; const actual = Math.min(e.hp, damage); e.hp -= damage; e.hit = .13;
      if (source === 'facility') { e.facilityAt = this.time; this.stats.facilityDamage += actual; }
      if (e.hp > 0) return;
      e.dead = true; this.stats.kills++;
      if (source === 'facility') this.stats.facilityKills++; else { this.stats.playerKills++; if (head) this.stats.headshots++; if (this.time - e.facilityAt < 4) this.stats.assists++; }
      this.event('death', { id: e.id, x: e.x, z: e.z, kind: e.kind, head });
    }
    throwGrenade() {
      if (this.frozen || this.grenades <= 0 || this.grenadeCooldown > 0 || !['wave', 'evac', 'escape', 'tutorial', 'gateTravel', 'facilityTravel'].includes(this.stage)) return false;
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
      this.result = { won, time: this.time, wave: this.wave, facility: this.facility, perk: this.perk, primary: this.primary, optic: this.optic, ...this.stats, accuracy: this.stats.shots ? Math.round(this.stats.hits / this.stats.shots * 100) : 0 };
    }
    step(dt, input = {}) {
      if (this.frozen || !Number.isFinite(dt) || dt <= 0) return;
      let remaining = Math.min(dt, .1); while (remaining > .000001 && !this.frozen) { const slice = Math.min(.02, remaining); this.tick(slice, input); remaining -= slice; }
    }
    tick(dt, input) {
      this.time += dt; this.stageTime += dt; this.noticeTime = Math.max(0, this.noticeTime - dt); this.fireCooldown = Math.max(0, this.fireCooldown - dt); this.grenadeCooldown = Math.max(0, this.grenadeCooldown - dt); this.player.hitCooldown = Math.max(0, this.player.hitCooldown - dt); this.player.recoil = Math.max(0, this.player.recoil - dt * .5); this.gridFlash = Math.max(0, this.gridFlash - dt);
      this.aiming = !!input.aim;
      this.updateJump(dt);
      const dx = clamp(Number(input.x) || 0, -1, 1), forward = clamp(Number(input.forward) || 0, -1, 1), length = Math.max(1, Math.hypot(dx, forward)), speed = 3.8 * dt;
      const sin = Math.sin(this.player.yaw), cos = Math.cos(this.player.yaw);
      this.move(this.player, (dx * cos - forward * sin) / length * speed, (-forward * cos - dx * sin) / length * speed);
      if (input.turn) this.look(input.turn * dt * 1.7, 0);
      if (this.reloadTime > 0) { this.reloadTime = Math.max(0, this.reloadTime - dt); if (this.reloadTime <= 0) { const needed = this.weaponInfo.mag - this.ammo[this.weapon], amount = this.weapon === 'pistol' ? needed : Math.min(needed, this.reserve); this.ammo[this.weapon] += amount; if (this.weapon === 'rifle') this.reserve -= amount; this.event('reloaded'); } }
      if (input.fire || input.autoFire) this.shoot(!input.fire);
      if (this.ammo[this.weapon] <= 0 && this.reloadTime <= 0) this.reload();
      if (this.weapon === 'rifle' && this.ammo.rifle === 0 && this.reserve === 0 && this.reloadTime <= 0) { this.switchWeapon('pistol'); this.notify('步枪弹药耗尽 · 已切换备用手枪', 4); }
      for (const p of this.pickups) if (!p.taken && distance(p, this.player) < 1.15) {
        if (p.type === 'ammo' && this.reserve < WEAPONS[this.primary].cap) { this.reserve = Math.min(WEAPONS[this.primary].cap, this.reserve + WEAPONS[this.primary].supply); p.taken = true; this.notify('主武器备用弹药 +' + WEAPONS[this.primary].supply); this.event('pickup'); }
        else if (p.type === 'health' && this.player.hp < 100) { this.player.hp = Math.min(100, this.player.hp + 30); p.taken = true; this.notify('恢复 30 生命'); this.event('pickup'); }
      }
      if (this.stage === 'tutorial' && this.stageTime >= 15) this.startWave(1);
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
      this.updateFacility(dt);
      for (const p of this.projectiles) { p.timer -= dt; p.vy -= 9.8 * dt; const nx = p.x + p.vx * dt, nz = p.z + p.vz * dt; if (this.isBlocked(nx, nz, .08, p.y - .1)) { p.vx *= -.3; p.vz *= -.3; } else { p.x = nx; p.z = nz; } p.y += p.vy * dt; if (p.y < .13) { p.y = .13; p.vy = Math.abs(p.vy) * .23; p.vx *= .8; p.vz *= .8; } if (p.timer <= 0) this.explode(p); }
      this.projectiles = this.projectiles.filter(p => p.timer > 0); this.enemies = this.enemies.filter(e => !e.dead);
      if (this.stage === 'wave' && this.queue.length === 0 && this.enemies.length === 0) { if (this.wave === 1) { this.setStage('facilityTravel'); this.notify('第一波已清空 · 前往标记的配电箱'); } else if (this.wave === 2) { this.setStage('perkChoice'); } else { this.setStage('gateTravel'); this.notify('三波清空 · 补给后前往北侧出口', 6); } }
      if (this.stage === 'escape' && Math.abs(this.player.x) < 2.6 && this.player.z < -19.7) this.finish(true);
    }
  }
  return { Game, WEAPONS, OPTICS, ENEMIES, OBSTACLES, GATE, BOX, EXIT, GRID, TURRET, PORTALS, PICKUPS, direction, rayBox, raySphere, clamp, distance, formatTime };
});
