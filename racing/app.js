(() => {
  'use strict';
  const { CARS, MAPS, sanitize, stats, buildTrack, timeText, clamp, Race } = Apex;
  const $ = id => document.getElementById(id);
  let storageOK = true;
  function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; } }
  function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { storageOK = false; document.querySelector('.saved-note').textContent = '本机存储不可用，配置仅本次有效'; } }
  let config = sanitize(read('apex-config-v1', {}));
  const rawCareer = read('apex-career-v1', {});
  const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const career = { races: finite(rawCareer.races) ? rawCareer.races : 0, wins: finite(rawCareer.wins) ? rawCareer.wins : 0, distance: finite(rawCareer.distance) ? rawCareer.distance : 0, runs: Array.isArray(rawCareer.runs) ? rawCareer.runs.filter(r => r && finite(r.time) && r.time > 0 && finite(r.bestLap) && MAPS.some(m => m.id === r.track)).slice(-80) : [] };
  const paints = [{ color: '#c7f36a', name: '酸橙绿' }, { color: '#f0f2e9', name: '冰川白' }, { color: '#ff805e', name: '熔岩橙' }, { color: '#6ab8ef', name: '极光蓝' }, { color: '#b59aee', name: '星云紫' }, { color: '#35444d', name: '石墨黑' }];
  const skins = [{ id: 'solid', name: '纯色原厂' }, { id: 'stripe', name: '赛道条纹' }, { id: 'carbon', name: '碳纤维' }, { id: 'neon', name: '霓虹光带' }, { id: 'racing', name: '竞赛涂装' }];
  const wheels = [{ id: 'sport', name: '五星运动' }, { id: 'aero', name: '封闭风刃' }, { id: 'rally', name: '多辐拉力' }];
  const difficultyNames = { easy: '休闲', normal: '标准', hard: '高手' }, weatherNames = { clear: '晴朗', rain: '下雨', snow: '飘雪' };
  const keys = new Set(), touches = new Map();
  let race = null, renderer = null, lastFrame = 0, previewTime = 0, uiTimer = 0, rankingTimer = 0, lastCountdown = '', pendingResult = false;
  const preview = $('car-preview'), previewContext = preview.getContext('2d');
  let previewSize = { width: 600, height: 423 };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function signature(c) {
    const fixed = sanitize(c), track = MAPS.find(x => x.id === fixed.track);
    return [fixed.track, fixed.mode, fixed.laps, fixed.difficulty, fixed.weather === 'auto' ? track.weather : fixed.weather].join('/');
  }
  function bestRun(c) { const runs = career.runs.filter(r => r.signature === signature(c)); return runs.length ? Math.min(...runs.map(r => r.time)) : null; }
  function button(label, className, click) { const b = document.createElement('button'); b.className = className; b.type = 'button'; b.addEventListener('click', click); b.setAttribute('aria-label', label); return b; }
  function setConfig(key, value) { config[key] = value; config = sanitize(config); save('apex-config-v1', config); updateGarage(); audio.beep(520, .035, .025); }
  function initGarage() {
    CARS.forEach(car => {
      const b = button(`选择${car.name}，${car.tag}`, 'car-choice', () => setConfig('car', car.id)); b.dataset.car = car.id;
      b.innerHTML = `<span class="car-number">${car.code}</span><span><strong>${car.name}</strong><small>${car.tag}</small></span><span class="choice-check">✓</span>`; $('car-list').appendChild(b);
    });
    paints.forEach(paint => { const b = button(`车身配色：${paint.name}`, 'paint-swatch', () => setConfig('color', paint.color)); b.dataset.color = paint.color; b.style.setProperty('--paint', paint.color); b.title = paint.name; $('paint-options').appendChild(b); });
    skins.forEach(skin => { const b = button(`涂装：${skin.name}`, 'skin-option', () => setConfig('skin', skin.id)); b.dataset.skin = skin.id; b.textContent = skin.name; $('skin-options').appendChild(b); });
    wheels.forEach(wheel => { const b = button(`轮毂：${wheel.name}`, '', () => setConfig('wheels', wheel.id)); b.dataset.wheels = wheel.id; b.textContent = wheel.name; $('wheel-options').appendChild(b); });
    MAPS.forEach((map, i) => {
      const b = button(`选择赛道：${map.name}`, 'map-card', () => setConfig('track', map.id)); b.dataset.track = map.id;
      b.innerHTML = `<canvas width="560" height="230" aria-hidden="true"></canvas><span class="map-badge">0${i + 1} / ${map.english}</span><span class="map-check">✓</span><div class="map-caption"><div><strong>${map.name}</strong><small>${map.label}</small></div><span class="map-difficulty">${'▮'.repeat(map.rating)}<i>${'▮'.repeat(4 - map.rating)}</i></span></div>`;
      $('map-list').appendChild(b); ApexRender.mapThumbnail(b.querySelector('canvas'), map);
    });
    const names = ['极速', '加速', '操控', '氮气'];
    $('stat-bars').innerHTML = names.map((name, i) => `<div class="stat-line"><span>${name}</span><div><i id="stat-fill-${i}"></i></div><b id="stat-value-${i}">0</b></div>`).join('');
    updateGarage();
  }
  function updateGarage() {
    const car = CARS.find(c => c.id === config.car), track = MAPS.find(m => m.id === config.track), performance = stats(config);
    for (const key of ['car', 'color', 'skin', 'wheels', 'track']) document.querySelectorAll(`[data-${key}]`).forEach(el => { const selected = el.dataset[key] === config[key]; el.classList.toggle('selected', selected); el.setAttribute('aria-pressed', String(selected)); });
    $('preview-brand').textContent = car.brand; $('preview-name').textContent = car.name; $('preview-code').textContent = car.tag + ' / ' + car.code;
    $('preview-description').textContent = car.desc; $('car-category').textContent = car.body.toUpperCase() + ' / ' + car.code + ' SERIES';
    $('color-name').textContent = paints.find(p => p.color === config.color)?.name || '自定义';
    const values = [Math.min(99, performance.maxSpeed / 12000 * 100), Math.min(99, performance.acceleration / 7200 * 100), Math.min(99, performance.handling / 1.4 * 100), (performance.boost - 1) * 245];
    values.forEach((v, i) => { $(`stat-fill-${i}`).style.width = `${v}%`; $(`stat-value-${i}`).textContent = Math.round(v); });
    for (const key of ['engine', 'turbo', 'tires']) { $(`${key}-setting`).value = config[key]; $(`${key}-label`).textContent = ['街道 / 01', '运动 / 02', '赛道 / 03'][config[key] - 1]; }
    for (const key of ['mode', 'difficulty', 'laps', 'weather']) $(`${key}-setting`).value = config[key];
    $('auto-setting').checked = config.auto; $('difficulty-setting').disabled = config.mode === 'trial';
    $('sound-btn').classList.toggle('enabled', config.sound); $('sound-btn').setAttribute('aria-label', config.sound ? '关闭声音' : '开启声音');
    $('launch-summary').textContent = car.name + ' / ' + track.name;
    $('track-description').textContent = track.desc; $('track-distance').textContent = (buildTrack(track.id).length / 100000).toFixed(1) + ' KM / LAP';
    $('total-races').textContent = String(career.races).padStart(2, '0');
  }
  class AudioSystem {
    constructor() { this.context = null; this.oscillator = null; this.gain = null; this.driftGain = null; }
    unlock() {
      if (!config.sound) return;
      try {
        if (!this.context) {
          this.context = new (window.AudioContext || window.webkitAudioContext)();
          this.oscillator = this.context.createOscillator(); this.gain = this.context.createGain(); this.oscillator.type = 'sawtooth'; this.oscillator.frequency.value = 55; this.gain.gain.value = 0;
          const filter = this.context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 650;
          this.oscillator.connect(filter); filter.connect(this.gain); this.gain.connect(this.context.destination); this.oscillator.start();
          this.driftOsc = this.context.createOscillator(); this.driftGain = this.context.createGain(); this.driftOsc.type = 'triangle'; this.driftOsc.frequency.value = 440; this.driftGain.gain.value = 0; this.driftOsc.connect(this.driftGain); this.driftGain.connect(this.context.destination); this.driftOsc.start();
        }
        if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      } catch (_) { config.sound = false; updateGarage(); }
    }
    beep(freq = 660, duration = .12, volume = .045) {
      if (!config.sound || !this.context) return;
      const oscillator = this.context.createOscillator(), gain = this.context.createGain(), t = this.context.currentTime;
      oscillator.frequency.value = freq; gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(.001, t + duration); oscillator.connect(gain); gain.connect(this.context.destination); oscillator.start(); oscillator.stop(t + duration);
    }
    update() {
      if (!this.context) return;
      const active = config.sound && race?.stage === 'racing', now = this.context.currentTime;
      this.gain.gain.setTargetAtTime(active ? .018 + race.speed / race.stats.maxSpeed * .012 : 0, now, .05);
      this.oscillator.frequency.setTargetAtTime(active ? 45 + race.speed / race.stats.maxSpeed * 105 + (race.boosting ? 40 : 0) : 45, now, .08);
      this.driftGain.gain.setTargetAtTime(active && race.drifting ? .018 : 0, now, .06);
    }
  }
  const audio = new AudioSystem();
  function switchTab(performance) { $('appearance-panel').hidden = performance; $('performance-panel').hidden = !performance; $('appearance-tab').classList.toggle('selected', !performance); $('performance-tab').classList.toggle('selected', performance); $('appearance-tab').setAttribute('aria-selected', String(!performance)); $('performance-tab').setAttribute('aria-selected', String(performance)); }
  function clearInput() { keys.clear(); touches.clear(); document.querySelectorAll('.mobile-controls .held').forEach(b => b.classList.remove('held')); }
  function startRace() {
    clearInput(); audio.unlock(); pendingResult = false; lastCountdown = ''; race = new Race(config);
    $('race-screen').hidden = false; $('garage').hidden = true; document.body.style.overflow = 'hidden';
    $('pause-overlay').hidden = true; $('result-overlay').hidden = true; $('pause-btn').setAttribute('aria-label', '暂停比赛');
    $('race-map-name').textContent = race.track.name; $('race-map-mode').textContent = `${race.config.mode === 'race' ? 'CIRCUIT RACE' : 'TIME ATTACK'} / ${weatherNames[race.weather]}`;
    if (!renderer) renderer = new ApexRender.Renderer($('race-canvas')); else renderer.resize();
    uiTimer = rankingTimer = 1; updateRaceUI(); $('start-btn').blur();
  }
  function pauseRace() {
    if (!race || ['finished'].includes(race.stage)) return;
    race.togglePause(); clearInput(); $('pause-overlay').hidden = race.stage !== 'paused'; $('pause-btn').setAttribute('aria-label', race.stage === 'paused' ? '继续比赛' : '暂停比赛'); audio.update();
  }
  function goGarage() {
    clearInput(); race = null; audio.update(); $('race-screen').hidden = true; $('garage').hidden = false; document.body.style.overflow = '';
    $('result-overlay').hidden = true; $('pause-overlay').hidden = true; resizePreview(); updateGarage();
  }
  function input() {
    const active = new Set(touches.values());
    return { steer: Number(keys.has('d') || keys.has('arrowright') || active.has('right')) - Number(keys.has('a') || keys.has('arrowleft') || active.has('left')), accelerate: keys.has('w') || keys.has('arrowup') || active.has('accelerate'), brake: keys.has('s') || keys.has('arrowdown') || active.has('brake'), drift: keys.has(' ') || active.has('drift'), nitro: keys.has('shift') || active.has('nitro') };
  }
  function updateRaceUI() {
    if (!race) return;
    $('race-position').textContent = race.config.mode === 'trial' ? '01' : String(race.rank).padStart(2, '0'); $('race-total').textContent = race.config.mode === 'trial' ? '/ TT' : '/ 06';
    $('race-lap').textContent = `${race.lap} / ${race.config.laps}`; $('race-time').textContent = timeText(race.finishTime ?? race.time);
    $('race-best').textContent = race.lapTimes.length ? timeText(Math.min(...race.lapTimes)) : '--:--.---';
    $('speed-value').textContent = race.kmh; $('speed-gear').textContent = race.kmh < 5 ? 'N' : Math.min(6, Math.floor(race.kmh / 52) + 1);
    $('speed-state').textContent = race.boosting ? 'NITRO BOOST' : race.offroad ? 'OFF ROAD' : race.drifting ? 'DRIFTING' : 'IN CONTROL';
    $('nitro-value').textContent = Math.floor(race.nitro) + '%'; $('nitro-fill').style.width = race.nitro + '%'; $('nitro-label').textContent = race.boosting ? 'NITRO / BOOSTING' : race.nitro < 10 ? 'NITRO / LOW' : 'NITRO READY';
    $('race-progress-fill').style.width = race.progress * 100 + '%';
    $('race-notice').textContent = race.notification; $('race-notice').classList.toggle('visible', race.notificationTime > 0 && race.stage === 'racing');
    $('drift-display').classList.toggle('visible', race.drifting && race.stage === 'racing'); $('drift-charge').textContent = '+' + Math.floor(race.driftCharge);
    if (race.stage === 'countdown') {
      const count = race.countdown > .5 ? String(Math.ceil(race.countdown - .5)) : 'GO';
      $('countdown').textContent = count;
      if (count !== lastCountdown) { audio.beep(count === 'GO' ? 1040 : 520, .15, .07); lastCountdown = count; }
    } else $('countdown').textContent = '';
    ApexRender.drawMiniMap($('minimap'), race);
  }
  function updateRanking() {
    if (!race) return;
    $('leaderboard').hidden = race.config.mode === 'trial';
    $('leaderboard').replaceChildren();
    race.ranking.forEach((racer, i) => {
      const el = document.createElement('div'); el.className = racer.id === 'player' ? 'current' : '';
      const rank = document.createElement('b'); rank.textContent = String(i + 1).padStart(2, '0');
      const dot = document.createElement('i'); dot.style.background = racer.color;
      const name = document.createElement('span'); name.textContent = racer.name;
      const gap = document.createElement('small'); gap.textContent = racer.finishTime != null ? 'FIN' : racer.id === 'player' ? 'YOU' : (racer.distance > race.distance ? '+' : '−') + (Math.abs(racer.distance - race.distance) / 100).toFixed(0) + 'm';
      el.append(rank, dot, name, gap); $('leaderboard').appendChild(el);
    });
  }
  function finishRace() {
    pendingResult = true; clearInput(); audio.update();
    const result = race.result, previous = bestRun(race.config), newBest = previous == null || result.time < previous;
    career.races++; if (result.mode === 'race' && result.rank === 1) career.wins++; career.distance += result.distance;
    career.runs.push({ ...result, signature: signature(race.config), weather: race.weather, date: new Date().toISOString() }); career.runs = career.runs.slice(-80); save('apex-career-v1', career);
    $('result-badge').textContent = newBest ? '✦ PERSONAL BEST / 新纪录' : 'CHECKERED FLAG / 完赛';
    $('result-rank').textContent = result.mode === 'trial' ? 'TT' : String(result.rank).padStart(2, '0'); $('result-total').textContent = result.mode === 'trial' ? 'TIME ATTACK' : '/ 06';
    $('result-title').textContent = result.mode === 'trial' ? '每一秒，都由你刷新。' : result.rank === 1 ? '这条赛道，属于你。' : result.rank <= 3 ? '漂亮的冲线。' : '下一场，超越自己。';
    $('result-map').textContent = `${race.track.name} · ${CARS.find(c => c.id === result.car).name} · ${result.laps} 圈 · ${difficultyNames[result.difficulty]} · ${weatherNames[race.weather]}`;
    $('result-time').textContent = timeText(result.time); $('result-lap').textContent = timeText(result.bestLap); $('result-speed').textContent = result.topSpeed + ' KM/H'; $('result-drifts').textContent = result.drifts + ' 次';
    $('result-laps').textContent = result.lapTimes.map((lap, i) => `LAP ${i + 1} / ${timeText(lap)}`).join('   ·   ');
    $('result-overlay').hidden = false; $('pause-overlay').hidden = true; $('race-notice').classList.remove('visible'); $('drift-display').classList.remove('visible');
    audio.beep(newBest ? 880 : 660, .3, .07);
  }
  function showRecords() {
    $('career-stats').replaceChildren();
    for (const [value, label] of [[career.races, '完赛场次'], [career.wins, '竞速冠军'], [(career.distance / 1000).toFixed(1), '累计公里']]) { const div = document.createElement('div'), strong = document.createElement('strong'), span = document.createElement('span'); strong.textContent = value; span.textContent = label; div.append(strong, span); $('career-stats').appendChild(div); }
    const bests = new Map(); career.runs.forEach(r => { if (!bests.has(r.signature) || bests.get(r.signature).time > r.time) bests.set(r.signature, r); });
    $('records-list').replaceChildren();
    if (!bests.size) { const p = document.createElement('p'); p.className = 'empty-record'; p.textContent = '这里还没有圈速。第一条纪录，等你来写。'; $('records-list').appendChild(p); }
    else [...bests.values()].slice(-12).reverse().forEach(r => {
      const cfg = sanitize(r), div = document.createElement('div'), left = document.createElement('div'), title = document.createElement('strong'), small = document.createElement('small'), time = document.createElement('b');
      div.className = 'record-item'; title.textContent = MAPS.find(m => m.id === r.track).name; small.textContent = `${cfg.mode === 'race' ? '竞速' : '计时'} / ${cfg.laps} 圈 / ${difficultyNames[cfg.difficulty]} / ${weatherNames[r.weather] || '默认天气'}`; time.textContent = timeText(r.time); left.append(title, small); div.append(left, time); $('records-list').appendChild(div);
    });
    $('records-dialog').showModal();
  }
  function resizePreview() { const r = preview.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2); if (r.width < 1 || r.height < 1) return; previewSize = { width: r.width, height: r.height }; preview.width = Math.round(r.width * dpr); preview.height = Math.round(r.height * dpr); }
  function frame(timestamp) {
    const dt = Math.min((timestamp - (lastFrame || timestamp)) / 1000, .05); lastFrame = timestamp;
    if (race) {
      race.step(dt, input());
      if (race.stage === 'finished' && !pendingResult) finishRace();
      renderer.render(race, race.time + Math.max(0, 3.5 - race.countdown));
      uiTimer += dt; rankingTimer += dt;
      if (uiTimer >= .06) { updateRaceUI(); uiTimer = 0; }
      if (rankingTimer >= .3) { updateRanking(); rankingTimer = 0; }
    } else {
      if (!reducedMotion) previewTime += dt;
      previewContext.setTransform(preview.width / previewSize.width, 0, 0, preview.height / previewSize.height, 0, 0); ApexRender.garageCar(previewContext, config, previewSize.width, previewSize.height, previewTime);
    }
    audio.update(); requestAnimationFrame(frame);
  }
  $('appearance-tab').addEventListener('click', () => switchTab(false)); $('performance-tab').addEventListener('click', () => switchTab(true));
  for (const key of ['engine', 'turbo', 'tires']) $(`${key}-setting`).addEventListener('input', event => setConfig(key, Number(event.target.value)));
  for (const key of ['mode', 'difficulty', 'laps', 'weather']) $(`${key}-setting`).addEventListener('change', event => setConfig(key, event.target.value));
  $('auto-setting').addEventListener('change', event => setConfig('auto', event.target.checked));
  $('sound-btn').addEventListener('click', () => { config.sound = !config.sound; audio.unlock(); save('apex-config-v1', config); updateGarage(); audio.beep(); });
  $('help-btn').addEventListener('click', () => $('help-dialog').showModal());
  document.querySelectorAll('.dialog-close').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); } }));
  document.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.nav === 'records') { showRecords(); return; }
    document.querySelectorAll('[data-nav]').forEach(el => el.classList.toggle('active', el === b));
    (b.dataset.nav === 'tracks' ? $('tracks') : $('garage')).scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' });
  }));
  $('start-btn').addEventListener('click', startRace); $('pause-btn').addEventListener('click', pauseRace); $('resume-btn').addEventListener('click', pauseRace);
  $('restart-btn').addEventListener('click', startRace); $('again-btn').addEventListener('click', startRace); $('garage-btn').addEventListener('click', goGarage); $('result-garage-btn').addEventListener('click', goGarage);
  document.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (!race) { if (key === 'enter' && !document.querySelector('dialog[open]') && !['BUTTON', 'INPUT', 'SELECT', 'A'].includes(document.activeElement?.tagName)) startRace(); return; }
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'w', 'a', 's', 'd', 'shift', 'p', 'escape', 'r'].includes(key)) event.preventDefault();
    if (event.repeat) return;
    if (key === 'p' || key === 'escape') { pauseRace(); return; }
    if (key === 'r') { race.resetCar(); return; }
    keys.add(key);
  });
  document.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
  document.querySelectorAll('[data-hold]').forEach(b => {
    b.addEventListener('pointerdown', event => { event.preventDefault(); if (!race || race.stage !== 'racing') return; b.setPointerCapture(event.pointerId); touches.set(event.pointerId, b.dataset.hold); b.classList.add('held'); });
    const release = event => { touches.delete(event.pointerId); if (![...touches.values()].includes(b.dataset.hold)) b.classList.remove('held'); };
    b.addEventListener('pointerup', release); b.addEventListener('pointercancel', release); b.addEventListener('lostpointercapture', release);
  });
  document.addEventListener('pointerdown', event => { if (event.pointerType === 'touch') document.body.classList.add('touch-enabled'); }, { passive: true });
  const autoPause = () => { clearInput(); if (race && ['racing', 'countdown'].includes(race.stage)) pauseRace(); audio.update(); };
  window.addEventListener('blur', autoPause); document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
  window.addEventListener('resize', () => { if (race) renderer.resize(); else resizePreview(); });
  new ResizeObserver(resizePreview).observe(preview);
  initGarage(); resizePreview(); requestAnimationFrame(frame);
})();
