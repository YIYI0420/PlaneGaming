const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const A = require('../racing/engine.js');
const { Race, stats, sanitize } = A;
const invalid = sanitize({ car: 'invalid', color: '<script>', laps: 99, engine: -1, mode: 'oops' });
assert.equal(invalid.car, 'falcon'); assert.equal(invalid.color, A.DEFAULTS.color); assert.equal(invalid.laps, 3); assert.equal(invalid.engine, 1); assert.equal(invalid.mode, 'race');
assert.ok(stats({ engine: 3 }).maxSpeed > stats({ engine: 1 }).maxSpeed);
assert.ok(stats({ tires: 3 }).grip > stats({ tires: 1 }).grip);
assert.ok(stats({ turbo: 3 }).boost > stats({ turbo: 1 }).boost);
function begin(c) { const r = new Race(c); for (let i = 0; i < 250; i++) r.step(.02); assert.equal(r.stage, 'racing'); return r; }
const race = begin({ mode: 'trial' });
assert.ok(race.speed > 0); assert.equal(race.bots.length, 0);
race.togglePause(); const paused = [race.distance, race.time, race.speed]; race.step(.1, { accelerate: true }); assert.deepEqual([race.distance, race.time, race.speed], paused); race.togglePause();
race.speed = race.stats.maxSpeed; race.x = 0; let initial = race.nitro;
for (let i = 0; i < 20; i++) race.step(.02, { nitro: true });
assert.ok(race.speed > race.stats.maxSpeed, 'nitro breaks normal speed limit'); assert.ok(race.nitro < initial, 'nitro consumes fuel');
race.x = 0; race.speed = 7000; initial = race.nitro;
for (let i = 0; i < 35; i++) race.step(.02, { steer: .4, drift: true });
assert.ok(race.driftCharge > 3); race.step(.02); assert.ok(race.nitro > initial); assert.equal(race.driftCount, 1); assert.equal(race.driftCharge, 0);
race.x = 1.5; race.speed = 9000; for (let i = 0; i < 25; i++) race.step(.02); assert.ok(race.speed < 8000, 'offroad slows vehicle'); race.resetCar(); assert.equal(race.x, 0);
race.speed = 5000; race.step(.02, { brake: true }); assert.ok(race.speed < 5000, 'braking slows vehicle');
const manual = begin({ auto: false }); assert.equal(manual.speed, 0); manual.step(.1, { accelerate: true }); assert.ok(manual.speed > 0);
const collision = begin({ mode: 'race' }); collision.speed = 8500; collision.x = 0; collision.bots[0].distance = collision.distance; collision.bots[0].x = 0; collision.bots[0].phase = 0; collision.step(.02); assert.ok(collision.hitCooldown > 0); assert.ok(collision.speed < 7500);
const clear = begin({ track: 'coast', weather: 'clear', mode: 'trial' }), snow = begin({ track: 'coast', weather: 'snow', mode: 'trial' }); clear.speed = snow.speed = 8000; clear.step(.1, { steer: 1 }); snow.step(.1, { steer: 1 }); assert.ok(clear.x > snow.x, 'weather affects grip and steering');
const raceResults = [];
for (const map of A.MAPS) {
  for (const car of A.CARS) {
    const r = begin({ track: map.id, car: car.id, laps: 2, difficulty: 'normal' });
    for (let i = 0; i < 18000 && r.stage !== 'finished'; i++) {
      const ratio = r.speed / r.stats.maxSpeed, curve = r.segmentAt(r.playerPosition).curve, surface = r.track.surface * (r.weather === 'rain' ? .92 : r.weather === 'snow' ? .86 : 1);
      const centrifugal = curve * ratio * ratio * .73 / (r.stats.grip * surface);
      const steering = (1.65 + ratio * .6) * Math.min(ratio * 2, 1) * r.stats.handling * surface;
      const steer = A.clamp(centrifugal / Math.max(.01, steering) - r.x * 1.8, -1, 1);
      r.step(.02, { steer, nitro: r.nitro > 5 && Math.abs(curve) < .2 });
      assert.ok(Number.isFinite(r.x) && Number.isFinite(r.speed)); assert.ok(r.nitro >= 0 && r.nitro <= 100);
    }
    assert.equal(r.stage, 'finished', `${map.id}/${car.id} must finish`);
    assert.equal(r.lapTimes.length, 2); assert.ok(r.result.rank >= 1 && r.result.rank <= 6);
    assert.ok(Math.abs(r.lapTimes.reduce((a, b) => a + b, 0) - r.finishTime) < .01);
    const end = r.distance; r.step(.1); assert.equal(r.distance, end, 'finished races are frozen');
    raceResults.push({ map: map.id, car: car.id, time: r.finishTime.toFixed(2), rank: r.rank });
  }
}
// Execute the real renderer with a checking canvas: invalid coordinates throw.
const gradient = { addColorStop() {} };
const methods = ['beginPath','closePath','fill','stroke','save','restore','clip','clearRect'];
const ctx = { createLinearGradient: () => gradient, createRadialGradient: () => gradient };
for (const method of methods) ctx[method] = () => {};
for (const method of ['moveTo','lineTo','fillRect','strokeRect','rect','roundRect','ellipse','arc','translate','rotate','scale','setTransform','fillText']) ctx[method] = (...args) => { for (const v of args) if (typeof v === 'number') assert.ok(Number.isFinite(v), `finite ${method} argument`); };
const sandbox = { Apex: A, window: { devicePixelRatio: 1 } }; sandbox.window.window = sandbox.window;
vm.createContext(sandbox); vm.runInContext(fs.readFileSync(path.join(__dirname, '../racing/renderer.js'), 'utf8'), sandbox);
for (const width of [390, 1280]) {
  const canvas = { width, height: 720, getContext: () => ctx, getBoundingClientRect: () => ({ width, height: 720 }) };
  const renderer = new sandbox.window.ApexRender.Renderer(canvas);
  for (const map of A.MAPS) {
    const r = new Race({ track: map.id });
    for (const progress of [.001, .17, .43, .8, .999]) { r.distance = progress * r.track.length; r.speed = 9500; r.drifting = true; r.boosting = true; renderer.render(r, 5); }
    sandbox.window.ApexRender.drawMiniMap(canvas, r); sandbox.window.ApexRender.mapThumbnail(canvas, map);
  }
  for (const car of A.CARS) for (const skin of ['solid','stripe','carbon','neon','racing']) sandbox.window.ApexRender.garageCar(ctx, { ...A.DEFAULTS, car: car.id, skin }, width, 423, 2);
}
console.log('PASS: tuning, sanitization, acceleration, brake, pause, drift, nitro, offroad, weather, collisions, rescue, 16 complete two-lap races, renderer on all tracks and skins at mobile/desktop widths.');
console.table(raceResults);
