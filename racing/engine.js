(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Apex = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SEGMENT = 200, ROAD_WIDTH = 1200, CAMERA_HEIGHT = 1050, CAMERA_DEPTH = .84;
  const PLAYER_Z = CAMERA_HEIGHT * CAMERA_DEPTH;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const mod = (n, d) => ((n % d) + d) % d;
  const mix = (a, b, t) => a + (b - a) * t;
  const CARS = [
    { id: 'falcon', name: '游隼 GT', brand: 'FALCON', tag: '均衡跑车', code: '01', max: 10400, accel: 5100, handling: 1.02, grip: 1.02, body: 'sport', desc: '精准、轻盈，任何弯道都游刃有余。' },
    { id: 'phantom', name: '幻影 X', brand: 'PHANTOM', tag: '极速超跑', code: '02', max: 11400, accel: 4200, handling: .88, grip: .86, body: 'hyper', desc: '为长直道而生，用极速撕开空气。' },
    { id: 'volt', name: '雷霆 RS', brand: 'VOLT', tag: '电驱先锋', code: '03', max: 9900, accel: 6500, handling: 1.09, grip: 1.08, body: 'electric', desc: '即刻响应的电驱动力，出弯先人一步。' },
    { id: 'nomad', name: '流浪者 R', brand: 'NOMAD', tag: '拉力猛兽', code: '04', max: 9700, accel: 4900, handling: 1.14, grip: 1.27, body: 'rally', desc: '宽体底盘与高抓地力，征服复杂路面。' },
  ];
  const MAPS = [
    { id: 'coast', name: '蔚蓝海岸', english: 'AZURE COAST', label: '海风 / 日间', rating: 1, surface: 1, sky: ['#63b8d5', '#d3eef0'], ground: ['#c9b687', '#d9c392'], road: ['#52616b', '#56656d'], accent: '#75e4eb', scenery: 'coast', length: 1500, sections: [[140, 0, 0], [170, .65, 30], [160, -.78, 110], [150, 0, 90], [200, .9, -15], [160, -.6, 110], [160, -.9, 25], [170, .65, 50], [190, 0, 0]], desc: '海岸公路、棕榈与跨海长弯。适合熟悉漂移节奏。', weather: 'clear' },
    { id: 'city', name: '霓虹都市', english: 'NEON DISTRICT', label: '城市 / 夜间', rating: 3, surface: .93, sky: ['#090e29', '#343066'], ground: ['#171d30', '#1a2137'], road: ['#2c3447', '#30394d'], accent: '#b9a0ff', scenery: 'city', length: 1700, sections: [[170, 0, 0], [190, .9, 35], [160, -.95, 0], [170, .7, 90], [170, -.9, 50], [170, .95, -30], [180, 0, 100], [150, -.7, 80], [170, .85, 0], [170, 0, 0]], desc: '摩天楼间的连续 S 弯。霓虹在湿润柏油路上流动。', weather: 'rain' },
    { id: 'canyon', name: '赤岩峡谷', english: 'REDROCK RUN', label: '峡谷 / 黄昏', rating: 2, surface: .97, sky: ['#9f6b8f', '#ffc18c'], ground: ['#a55d46', '#b76e50'], road: ['#554b4d', '#5d5150'], accent: '#ffb27c', scenery: 'canyon', length: 1800, sections: [[160, 0, 0], [180, -.65, 140], [200, .9, 240], [170, .8, 0], [190, -.95, -100], [170, 0, 170], [200, -.7, 200], [180, .9, -60], [180, -.6, 70], [170, 0, 0]], desc: '穿越赤色岩壁与起伏山道，在落日下挑战连续弯。', weather: 'clear' },
    { id: 'alpine', name: '极地山脊', english: 'ALPINE RIDGE', label: '雪山 / 飘雪', rating: 4, surface: .81, sky: ['#7997b1', '#dbe8ec'], ground: ['#e2edf0', '#d5e2e8'], road: ['#677882', '#70818c'], accent: '#b5dfef', scenery: 'alpine', length: 1800, sections: [[150, 0, 0], [190, .8, 150], [190, -.95, 320], [160, .95, 100], [190, -.9, -60], [190, .8, 250], [180, -.9, 100], [180, .7, -70], [190, -.7, 60], [180, 0, 0]], desc: '高海拔、低抓地力。控制入弯速度，沿着雪线前进。', weather: 'snow' },
  ];
  const DEFAULTS = { car: 'falcon', track: 'coast', color: '#c7f36a', skin: 'stripe', wheels: 'sport', engine: 2, turbo: 2, tires: 2, mode: 'race', difficulty: 'normal', laps: 2, auto: true, sound: false, weather: 'auto' };
  function sanitize(raw = {}) {
    const c = { ...DEFAULTS };
    for (const key of ['car', 'track', 'color', 'skin', 'wheels', 'engine', 'turbo', 'tires', 'mode', 'difficulty', 'laps', 'auto', 'sound', 'weather']) if (Object.prototype.hasOwnProperty.call(raw, key)) c[key] = raw[key];
    if (!CARS.some(x => x.id === c.car)) c.car = DEFAULTS.car;
    if (!MAPS.some(x => x.id === c.track)) c.track = DEFAULTS.track;
    if (!/^#[0-9a-f]{6}$/i.test(c.color)) c.color = DEFAULTS.color;
    for (const key of ['engine', 'turbo', 'tires', 'laps']) c[key] = clamp(Math.round(Number(c[key]) || 2), 1, 3);
    for (const [key, values] of Object.entries({ skin: ['solid', 'stripe', 'carbon', 'neon', 'racing'], wheels: ['sport', 'aero', 'rally'], mode: ['race', 'trial'], difficulty: ['easy', 'normal', 'hard'], weather: ['auto', 'clear', 'rain', 'snow'] })) if (!values.includes(c[key])) c[key] = DEFAULTS[key];
    c.auto = c.auto !== false; c.sound = c.sound === true;
    return c;
  }
  function stats(config) {
    const c = sanitize(config), car = CARS.find(x => x.id === c.car);
    return { maxSpeed: car.max * (1 + (c.engine - 2) * .055), acceleration: car.accel * (1 + (c.engine - 2) * .09), handling: car.handling * (1 + (c.tires - 2) * .09), grip: car.grip * (1 + (c.tires - 2) * .13), boost: 1.22 + c.turbo * .055, nitroConsumption: 24 - c.turbo * 1.5, car };
  }
  function buildTrack(id) {
    const meta = MAPS.find(m => m.id === id) || MAPS[0];
    const segments = [];
    let previousHeight = 0;
    for (const [count, curve, height] of meta.sections) {
      for (let i = 0; i < count; i++) {
        const t = i / count, ease = (1 - Math.cos(t * Math.PI * 2)) / 2;
        const y = mix(previousHeight, height * 10, (1 - Math.cos(t * Math.PI)) / 2);
        const lastY = segments.length ? segments[segments.length - 1].y2 : 0;
        segments.push({ index: segments.length, curve: curve * ease, y1: lastY, y2: y, scenery: (segments.length * 17 + 13) % 101 });
      }
      previousHeight = height * 10;
    }
    // Ease the final endpoint to the initial height, keeping the loop continuous.
    segments[segments.length - 1].y2 = 0;
    return { ...meta, segments, length: segments.length * SEGMENT };
  }
  function timeText(seconds, milliseconds = true) {
    if (!Number.isFinite(seconds) || seconds < 0) return '--:--.---';
    const ms = Math.round(seconds * 1000), min = Math.floor(ms / 60000), sec = Math.floor(ms / 1000) % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}${milliseconds ? '.' + String(ms % 1000).padStart(3, '0') : ''}`;
  }
  class Race {
    constructor(config) {
      this.config = sanitize(config); this.stats = stats(this.config); this.track = buildTrack(this.config.track);
      this.stage = 'countdown'; this.countdown = 3.5; this.time = 0; this.distance = 0; this.speed = 0; this.x = 0;
      this.nitro = 55; this.boosting = false; this.drifting = false; this.driftCharge = 0; this.driftDirection = 0;
      this.driftCount = 0; this.driftTotal = 0; this.bestDrift = 0; this.topSpeed = 0; this.offroad = false; this.hitCooldown = 0;
      this.lapTimes = []; this.lapStart = 0; this.completedLaps = 0; this.flash = 0; this.notification = ''; this.notificationTime = 0;
      this.tireMarks = []; this.wasDrifting = false; this.lastSteer = 0; this.rank = this.config.mode === 'trial' ? 1 : 6; this.finishTime = null; this.result = null;
      const difficulty = { easy: .75, normal: .87, hard: .98 }[this.config.difficulty];
      const names = ['NOVA', '零号玩家', '夜行者', '柚子汽水', '赤道风'];
      const colors = ['#fa8262', '#7bbcff', '#ac8dff', '#ffd267', '#67e8c6'];
      this.bots = this.config.mode === 'trial' ? [] : names.map((name, i) => ({ id: i, name, color: colors[i], x: (i % 3 - 1) * .48, distance: (5 - i) * 620, speed: 0, maxSpeed: 10700 * difficulty * (1 + (i - 2) * .016), phase: i * 1.8, finishTime: null, body: CARS[(i + 1) % CARS.length].body }));
    }
    get position() { return mod(this.distance, this.track.length); }
    get playerPosition() { return mod(this.distance + PLAYER_Z, this.track.length); }
    get lap() { return Math.min(this.config.laps, this.completedLaps + 1); }
    get kmh() { return Math.round(this.speed / 40); }
    get progress() { return clamp(this.distance / (this.track.length * this.config.laps), 0, 1); }
    get weather() { return this.config.weather === 'auto' ? this.track.weather : this.config.weather; }
    get ranking() {
      return [{ id: 'player', name: '你', distance: this.distance, finishTime: this.finishTime, color: this.config.color }, ...this.bots].sort((a, b) => {
        if (a.finishTime != null && b.finishTime != null) return a.finishTime - b.finishTime;
        if (a.finishTime != null) return -1;
        if (b.finishTime != null) return 1;
        return b.distance - a.distance;
      });
    }
    segmentAt(z) { return this.track.segments[Math.floor(mod(z, this.track.length) / SEGMENT)]; }
    notify(message) { this.notification = message; this.notificationTime = 2; }
    togglePause() { if (this.stage === 'paused') this.stage = this.previousStage; else if (['racing', 'countdown'].includes(this.stage)) { this.previousStage = this.stage; this.stage = 'paused'; } }
    resetCar() { if (this.stage !== 'racing') return; this.x = 0; this.speed *= .3; this.hitCooldown = 1.5; this.driftCharge = 0; this.notify('已回到赛道中央'); }
    step(dt, input = {}) {
      if (!Number.isFinite(dt) || dt <= 0 || ['paused', 'finished'].includes(this.stage)) return;
      dt = Math.min(dt, .15);
      while (dt > 0) { const step = Math.min(dt, .02); this.tick(step, input); dt -= step; }
    }
    tick(dt, input) {
      if (this.stage === 'finished') return;
      this.flash = Math.max(0, this.flash - dt); this.notificationTime = Math.max(0, this.notificationTime - dt); this.hitCooldown = Math.max(0, this.hitCooldown - dt);
      if (this.stage === 'countdown') { this.countdown -= dt; if (this.countdown <= 0) { this.stage = 'racing'; this.notify('GO! 完美起步'); } return; }
      const oldDistance = this.distance;
      this.time += dt;
      const segment = this.segmentAt(this.playerPosition), speedRatio = this.speed / this.stats.maxSpeed;
      const steer = clamp(Number(input.steer) || 0, -1, 1);
      this.braking = !!input.brake;
      const surface = this.track.surface * (this.weather === 'rain' ? .92 : this.weather === 'snow' ? .86 : 1);
      this.offroad = Math.abs(this.x) > 1.02;
      this.drifting = !!input.drift && Math.abs(steer) > .15 && speedRatio > .35 && !this.offroad;
      this.boosting = !!input.nitro && this.nitro > .5 && this.speed > 500 && !this.offroad;
      const cap = this.stats.maxSpeed * (this.boosting ? this.stats.boost : 1);
      if (input.brake) this.speed -= 12000 * dt;
      else if (input.accelerate || this.config.auto) this.speed += this.stats.acceleration * (this.boosting ? 1.7 : 1) * dt;
      else this.speed -= 1700 * dt;
      if (this.speed > cap) this.speed -= (this.speed - cap) * Math.min(1, dt * 3.5);
      this.speed = clamp(this.speed, 0, this.stats.maxSpeed * this.stats.boost);
      if (this.offroad) { this.speed -= this.speed * 1.45 * dt; this.speed = Math.max(0, this.speed); }
      if (this.drifting) { this.speed -= this.speed * .07 * dt; this.driftCharge += dt * (15 + Math.abs(segment.curve) * 20) * speedRatio; this.driftTotal += dt; this.driftDirection = steer; }
      if (this.wasDrifting && !this.drifting && this.driftCharge > 3) {
        this.nitro = Math.min(100, this.nitro + this.driftCharge); this.driftCount++; this.bestDrift = Math.max(this.bestDrift, this.driftCharge);
        this.notify(this.driftCharge > 24 ? `完美漂移 · 氮气 +${Math.round(this.driftCharge)}` : `漂移集气 · +${Math.round(this.driftCharge)}`); this.driftCharge = 0;
      } else if (!this.drifting && this.driftCharge <= 3) this.driftCharge = 0;
      this.wasDrifting = this.drifting;
      if (this.boosting) this.nitro = Math.max(0, this.nitro - this.stats.nitroConsumption * dt);
      else this.nitro = Math.min(100, this.nitro + dt * 1.8);
      const movement = dt * (1.65 + speedRatio * .6) * Math.min(speedRatio * 2, 1) * this.stats.handling * surface;
      this.x += steer * movement * (this.drifting ? 1.23 : 1);
      this.x -= segment.curve * speedRatio * speedRatio * dt * (this.drifting ? .48 : .73) / (this.stats.grip * surface);
      this.x = clamp(this.x, -2.1, 2.1); this.lastSteer = mix(this.lastSteer, steer, dt * 7);
      this.distance += this.speed * dt; this.topSpeed = Math.max(this.topSpeed, this.kmh);
      for (const bot of this.bots) {
        if (bot.finishTime != null) continue;
        const curve = this.segmentAt(bot.distance + PLAYER_Z).curve;
        const targetSpeed = bot.maxSpeed * (1 - Math.abs(curve) * .15) * (1 + Math.sin(this.time * .29 + bot.phase) * .035);
        bot.speed = mix(bot.speed, targetSpeed, dt * .8);
        bot.x = clamp(Math.sin(this.time * .25 + bot.phase) * .58 - curve * .22, -.8, .8);
        bot.distance += bot.speed * dt;
        const finish = this.track.length * this.config.laps;
        if (bot.distance >= finish) { bot.finishTime = this.time - (bot.distance - finish) / Math.max(1, bot.speed); bot.distance = finish; }
        let separation = mod(bot.distance - this.distance + this.track.length / 2, this.track.length) - this.track.length / 2;
        if (Math.abs(separation) < 190 && Math.abs(bot.x - this.x) < .22 && this.hitCooldown <= 0 && this.speed > 2000) {
          this.speed *= .62; this.x += this.x < bot.x ? -.16 : .16; this.hitCooldown = .9; this.flash = .22; this.notify('发生碰撞 · 注意保持距离');
        }
      }
      this.rank = this.ranking.findIndex(x => x.id === 'player') + 1;
      const newLaps = Math.floor(this.distance / this.track.length);
      if (newLaps > this.completedLaps) {
        const crossingTime = this.time - (this.distance - newLaps * this.track.length) / Math.max(1, this.speed);
        this.lapTimes.push(crossingTime - this.lapStart); this.lapStart = crossingTime; this.completedLaps = newLaps;
        if (newLaps < this.config.laps) { this.nitro = Math.min(100, this.nitro + 20); this.notify(`第 ${newLaps + 1} 圈 / 氮气补给 +20`); }
      }
      const finish = this.track.length * this.config.laps;
      if (this.distance >= finish && oldDistance < finish) {
        this.finishTime = this.time - (this.distance - finish) / Math.max(this.speed, 1); this.distance = finish;
        this.rank = this.ranking.findIndex(x => x.id === 'player') + 1;
        this.stage = 'finished'; this.boosting = false; this.drifting = false;
        this.result = { track: this.config.track, car: this.config.car, mode: this.config.mode, difficulty: this.config.difficulty, laps: this.config.laps, time: this.finishTime, rank: this.rank, topSpeed: this.topSpeed, drifts: this.driftCount, bestLap: Math.min(...this.lapTimes), distance: finish / 100, lapTimes: [...this.lapTimes] };
      }
    }
  }
  return { CARS, MAPS, DEFAULTS, SEGMENT, ROAD_WIDTH, CAMERA_HEIGHT, CAMERA_DEPTH, PLAYER_Z, clamp, mod, mix, sanitize, stats, buildTrack, timeText, Race };
});
