(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const W = 600, H = 760, TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const formatScore = n => String(n).padStart(6, '0');
  let best = 0;
  try { best = Number(localStorage.getItem('orbit-best')) || 0; } catch (_) { /* Storage is optional. */ }
  let state = 'ready', score = 0, kills = 0, elapsed = 0, wave = 1, bombs = 3;
  let waveTime = 0, spawnTime = 0, fireTime = 0, clock = 0, last = 0;
  let enemies = [], bullets = [], enemyBullets = [], particles = [], pickups = [];
  let player = createPlayer(), boss = null, bossSpawned = false;
  let shake = 0, flash = 0, announcementTime = 0, pointer = null;
  let audioContext = null, sound = false;
  const keys = new Set();
  const stars = Array.from({ length: 100 }, () => ({ x: rand(0, W), y: rand(0, H), z: rand(.2, 1), phase: rand(0, TAU) }));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function createPlayer() { return { x: W / 2, y: H - 110, r: 15, hp: 3, level: 1, invincible: 0, shield: 0 }; }
  function tone(frequency, duration = .08, type = 'sine', volume = .04, end = frequency) {
    if (!sound || !audioContext) return;
    const t = audioContext.currentTime;
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, t);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(.001, t + duration);
    oscillator.connect(gain); gain.connect(audioContext.destination);
    oscillator.start(t); oscillator.stop(t + duration);
  }
  function unlockAudio() {
    if (!sound) return;
    try {
      if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    } catch (_) { sound = false; updateSound(); }
  }
  function updateSound() { $('sound-status').textContent = sound ? 'ON' : 'OFF'; $('sound-btn').setAttribute('aria-label', sound ? '关闭音效' : '开启音效'); }
  function saveBest() {
    if (score <= best) return;
    best = score;
    try { localStorage.setItem('orbit-best', String(best)); } catch (_) { /* Keep the session record if storage is unavailable. */ }
  }
  function updateHud() {
    $('score').textContent = formatScore(score);
    $('best').textContent = formatScore(Math.max(best, score));
    $('wave').textContent = String(wave).padStart(2, '0');
    $('lives').textContent = '♥ '.repeat(player.hp) + '♡ '.repeat(3 - player.hp);
    $('bombs').textContent = bombs;
    $('bomb-btn').disabled = state !== 'playing' || bombs === 0;
    $('pause-btn').disabled = !['playing', 'paused'].includes(state);
    $('pause-btn').textContent = state === 'paused' ? '▶' : 'Ⅱ';
    $('pause-btn').setAttribute('aria-label', state === 'paused' ? '继续游戏' : '暂停游戏');
    $('kills').textContent = kills;
    $('weapon').textContent = `LV. ${player.level}`;
    $('time').textContent = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`;
    $('boss-hud').hidden = !boss;
    if (boss) $('boss-health').style.width = `${100 * boss.hp / boss.maxHp}%`;
  }
  function announce(text) { $('announcement').textContent = text; announcementTime = 2.6; $('announcement').classList.add('visible'); }
  function start() {
    unlockAudio();
    score = kills = elapsed = waveTime = spawnTime = fireTime = 0;
    wave = 1; bombs = 3; enemies = []; bullets = []; enemyBullets = []; particles = []; pickups = [];
    player = createPlayer(); boss = null; bossSpawned = false; flash = shake = 0;
    keys.clear(); pointer = null; state = 'playing';
    $('overlay').hidden = true;
    $('flight-status').textContent = 'IN FLIGHT / 作战中';
    updateHud(); announce('WAVE 01 / 出击'); tone(440, .25, 'sine', .06, 880);
  }
  function showOverlay(badge, title, description, button, hint) {
    $('overlay-badge').textContent = badge;
    $('overlay-title').innerHTML = title;
    $('overlay-description').innerHTML = description;
    $('start-btn').innerHTML = `${button}<span>↗</span>`;
    $('start-hint').textContent = hint;
    $('hero-mark').textContent = state === 'over' ? '✦' : '⌁';
    $('overlay').hidden = false;
  }
  function pause() {
    if (state === 'playing') {
      state = 'paused'; keys.clear(); pointer = null;
      showOverlay('Ⅱ FLIGHT PAUSED', '稍作休整。<br>星海还在等你。', '飞行进度已保留。<br>准备好了，就继续前进。', '继续飞行', '按 P / ENTER 继续');
      $('flight-status').textContent = 'PAUSED / 飞行暂停';
    } else if (state === 'paused') {
      unlockAudio(); state = 'playing'; $('overlay').hidden = true;
      $('flight-status').textContent = 'IN FLIGHT / 作战中';
    }
    updateHud();
  }
  function gameOver() {
    const record = score > best;
    state = 'over'; saveBest(); keys.clear(); pointer = null;
    burst(player.x, player.y, '#d5fa6c', 65); tone(160, .65, 'sawtooth', .08, 30);
    showOverlay(record ? '✦ NEW HIGH SCORE' : 'MISSION COMPLETE', '每次坠落。<br>都是下次的起点。', `本次得分 <b style="color:#d5fa6c">${formatScore(score)}</b> · 击落 ${kills} 架<br>抵达第 ${wave} 波 · 飞行 ${Math.floor(elapsed)} 秒`, '再次出击', '按 ENTER 重新开始');
    $('flight-status').textContent = 'MISSION ENDED / 任务结束';
    updateHud();
  }
  function burst(x, y, color, count = 15) {
    for (let i = 0; i < count; i++) {
      const angle = rand(0, TAU), speed = rand(35, 210);
      const life = rand(.2, .7);
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, color, size: rand(1, 4) });
    }
  }
  function damagePlayer() {
    if (player.invincible > 0 || player.shield > 0 || state !== 'playing') return;
    player.hp--; player.invincible = 1.6; player.level = Math.max(1, player.level - 1);
    shake = .3; burst(player.x, player.y, '#ffad7d', 20); tone(100, .2, 'sawtooth', .07, 35);
    if (player.hp <= 0) gameOver();
    updateHud();
  }
  function destroyEnemy(enemy, drop = true) {
    if (enemy.dead) return;
    enemy.dead = true;
    const isBoss = enemy.type === 'boss';
    score += isBoss ? 2500 : enemy.type === 'heavy' ? 250 : enemy.type === 'scout' ? 150 : 100;
    kills++; saveBest(); burst(enemy.x, enemy.y, isBoss ? '#ff887d' : '#ffba88', isBoss ? 80 : 20);
    tone(isBoss ? 80 : 140, isBoss ? .5 : .12, 'triangle', .045, 35);
    if (isBoss) {
      boss = null; enemyBullets = []; bombs = Math.min(5, bombs + 1); wave++; waveTime = 0; bossSpawned = false;
      player.hp = Math.min(3, player.hp + 1); shake = .6;
      announce('区域肃清 / 生命 +1 · 脉冲 +1');
    }
    if (drop && (isBoss || kills % 8 === 0 || Math.random() < .10)) {
      pickups.push({ x: enemy.x, y: enemy.y, r: 16, type: isBoss ? 'weapon' : ['weapon', 'weapon', 'shield', 'heal'][Math.floor(rand(0, 4))], phase: rand(0, TAU) });
    }
    updateHud();
  }
  function useBomb() {
    if (state !== 'playing' || bombs <= 0) return;
    bombs--; flash = .55; shake = .35; enemyBullets = [];
    enemies.forEach(e => destroyEnemy(e, false)); enemies = [];
    if (boss) { boss.hp -= 65; if (boss.hp <= 0) destroyEnemy(boss); }
    tone(70, .5, 'sine', .16, 450); updateHud();
  }
  function spawnEnemy() {
    const roll = Math.random(), type = wave >= 2 && roll < .17 ? 'heavy' : roll < .44 ? 'scout' : 'fighter';
    const x = rand(40, W - 40);
    enemies.push({ x, baseX: x, y: -45, r: type === 'heavy' ? 24 : 17, type, hp: type === 'heavy' ? 7 + wave : type === 'scout' ? 2 : 2 + Math.floor(wave / 3), speed: type === 'heavy' ? 60 + wave * 3 : rand(90, 145) + Math.min(wave, 20) * 7, age: 0, shot: rand(1.4, 3.2), dead: false });
  }
  function spawnBoss() {
    const hp = 230 + Math.floor(wave / 4) * 75;
    boss = { x: W / 2, y: -90, r: 58, hp, maxHp: hp, age: 0, shot: 1.6, type: 'boss', dead: false };
    bossSpawned = true; announce('⚠ WARNING / 毁灭者接近'); tone(200, .6, 'sawtooth', .04, 90); updateHud();
  }
  function fire() {
    const offsets = player.level === 1 ? [0] : player.level === 2 ? [-11, 11] : [-19, 0, 19];
    offsets.forEach(offset => bullets.push({ x: player.x + offset, y: player.y - 26, vx: player.level === 3 ? offset * 2.3 : 0, vy: -620, r: 4, damage: 1 }));
    tone(780, .045, 'sine', .014, 390);
  }
  function update(dt) {
    clock += dt;
    stars.forEach(s => { s.y += dt * (state === 'playing' ? 22 + s.z * 62 : 8 + s.z * 12); if (s.y > H) { s.y = -3; s.x = rand(0, W); } });
    if (state !== 'paused') {
      particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
      particles = particles.filter(p => p.life > 0);
      shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt);
    }
    if (state !== 'playing') return;
    elapsed += dt; waveTime += dt; spawnTime -= dt; fireTime -= dt;
    player.invincible = Math.max(0, player.invincible - dt); player.shield = Math.max(0, player.shield - dt);
    announcementTime -= dt;
    if (announcementTime <= 0) $('announcement').classList.remove('visible');
    let dx = Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a'));
    let dy = Number(keys.has('arrowdown') || keys.has('s')) - Number(keys.has('arrowup') || keys.has('w'));
    if (dx || dy) { pointer = null; const length = Math.hypot(dx, dy); player.x += dx / length * 330 * dt; player.y += dy / length * 330 * dt; }
    else if (pointer) { const d = distance(player, pointer), step = Math.min(d, dt * 650); if (d > 1) { player.x += (pointer.x - player.x) / d * step; player.y += (pointer.y - player.y) / d * step; } }
    player.x = clamp(player.x, 23, W - 23); player.y = clamp(player.y, 110, H - 45);
    if (fireTime <= 0) { fire(); fireTime = .15; }
    if (wave % 4 === 0 && !bossSpawned) spawnBoss();
    if (!boss && waveTime >= 20) { wave++; waveTime = 0; announce(`WAVE ${String(wave).padStart(2, '0')} / 敌机来袭`); updateHud(); }
    if (!boss && wave % 4 !== 0 && spawnTime <= 0) { spawnEnemy(); spawnTime = Math.max(.23, .90 - wave * .055); }
    enemies.forEach(e => {
      e.age += dt; e.y += e.speed * dt;
      if (e.type === 'scout') e.x = clamp(e.baseX + Math.sin(e.age * 2.8) * 68, 23, W - 23);
      e.shot -= dt;
      if (e.shot <= 0 && e.y > 30 && e.y < H - 160 && (wave >= 2 || e.type === 'heavy')) {
        const angle = Math.atan2(player.y - e.y, player.x - e.x);
        enemyBullets.push({ x: e.x, y: e.y + 18, vx: Math.cos(angle) * 170, vy: Math.sin(angle) * 170, r: 5 }); e.shot = rand(2, 3.8);
      }
    });
    if (boss) {
      boss.age += dt; boss.y = Math.min(145, boss.y + dt * 85);
      boss.x = W / 2 + Math.sin(boss.age * .8) * 175; boss.shot -= dt;
      if (boss.y >= 100 && boss.shot <= 0) {
        for (let i = -3; i <= 3; i++) { const a = Math.PI / 2 + i * .20 + Math.sin(boss.age) * .22; enemyBullets.push({ x: boss.x, y: boss.y + 38, vx: Math.cos(a) * 195, vy: Math.sin(a) * 195, r: 6 }); }
        boss.shot = Math.max(.48, 1.1 - wave * .025); tone(140, .1, 'triangle', .025);
      }
    }
    bullets.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; });
    enemyBullets.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; });
    const targets = boss ? [...enemies, boss] : enemies;
    for (const b of bullets) {
      for (const e of targets) {
        if (!e.dead && distance(b, e) < b.r + e.r) {
          b.dead = true; e.hp -= b.damage; burst(b.x, b.y, '#8af4ed', 3);
          if (e.hp <= 0) destroyEnemy(e);
          break;
        }
      }
    }
    for (const e of targets) {
      if (!e.dead && distance(e, player) < e.r + player.r) { if (e.type !== 'boss') destroyEnemy(e, false); damagePlayer(); }
    }
    for (const b of enemyBullets) {
      if (distance(b, player) < b.r + player.r) { b.dead = true; if (player.shield > 0) burst(b.x, b.y, '#b69cfa', 6); damagePlayer(); }
    }
    if (state !== 'playing') return;
    pickups.forEach(p => {
      p.y += dt * 90;
      if (distance(p, player) < p.r + player.r + 6) {
        p.dead = true;
        if (p.type === 'weapon') { if (player.level < 3) { player.level++; announce('火力升级 / LV. ' + player.level); } else { score += 200; announce('火力已满 / 奖励 +200'); } }
        else if (p.type === 'shield') { player.shield = 8; announce('护盾启动 / 8 SEC'); }
        else { if (player.hp < 3) { player.hp++; announce('机体修复 / +1 HP'); } else { score += 150; announce('机体完好 / 奖励 +150'); } }
        tone(600, .2, 'sine', .06, 1200); saveBest(); updateHud();
      }
    });
    enemies = enemies.filter(e => !e.dead && e.y < H + 50);
    bullets = bullets.filter(b => !b.dead && b.y > -20 && b.x > -20 && b.x < W + 20);
    enemyBullets = enemyBullets.filter(b => !b.dead && b.y < H + 20 && b.y > -30 && b.x > -20 && b.x < W + 20);
    pickups = pickups.filter(p => !p.dead && p.y < H + 30);
    updateHud();
  }

  function polygon(points, fill, stroke) {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function drawPlayer(x, y, scale = 1, idle = false) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    const flame = 16 + Math.sin(clock * 45) * 7;
    const glow = ctx.createRadialGradient(0, 24, 0, 0, 24, 42); glow.addColorStop(0, '#9fedcb50'); glow.addColorStop(1, '#79e6db00'); ctx.fillStyle = glow; ctx.fillRect(-45, 0, 90, 80);
    polygon([[-8, 16], [0, 24 + flame], [8, 16]], '#b0f7d84d'); polygon([[-3, 17], [0, 20 + flame * .8], [3, 17]], '#d7ff9d');
    polygon([[0, -31], [10, -3], [27, 17], [26, 23], [8, 16], [0, 21], [-8, 16], [-26, 23], [-27, 17], [-10, -3]], '#b5c4c5', '#d4e4e4');
    polygon([[0, -31], [7, 3], [0, 17], [-7, 3]], '#e5f5df'); polygon([[0, -17], [4, -4], [0, 3], [-4, -4]], '#536b75');
    polygon([[-10, 1], [-23, 18], [-11, 14]], '#607d80'); polygon([[10, 1], [23, 18], [11, 14]], '#607d80');
    ctx.fillStyle = '#d5fa6c'; ctx.fillRect(-22, 17, 6, 3); ctx.fillRect(16, 17, 6, 3);
    if (!idle && player.shield > 0) { ctx.strokeStyle = '#bc9cff'; ctx.lineWidth = 2; ctx.shadowColor = '#bc9cff'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(0, 0, 41 + Math.sin(clock * 5) * 2, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
  function drawEnemy(e) {
    ctx.save(); ctx.translate(e.x, e.y);
    if (e.type === 'boss') {
      ctx.fillStyle = '#fa7b5855'; ctx.fillRect(-46, -42, 12, -rand(10, 27)); ctx.fillRect(34, -42, 12, -rand(10, 27));
      polygon([[0, -43], [29, -23], [55, -38], [75, 0], [70, 28], [40, 14], [22, 40], [0, 52], [-22, 40], [-40, 14], [-70, 28], [-75, 0], [-55, -38], [-29, -23]], '#3b2936', '#aa6373');
      polygon([[0, -25], [22, 4], [0, 33], [-22, 4]], '#774452', '#ff9b8a');
      ctx.fillStyle = '#ff957d'; ctx.shadowColor = '#ff806f'; ctx.shadowBlur = 17; ctx.fillRect(-7, 0, 14, 16); ctx.fillRect(-57, 9, 18, 4); ctx.fillRect(39, 9, 18, 4);
    } else {
      const heavy = e.type === 'heavy', scout = e.type === 'scout';
      ctx.scale(heavy ? 1.3 : 1, heavy ? 1.3 : 1);
      polygon([[0, 25], [9, 6], [24, 12], [20, -8], [7, -14], [0, -22], [-7, -14], [-20, -8], [-24, 12], [-9, 6]], heavy ? '#624052' : scout ? '#544869' : '#3c4e67', heavy ? '#cb7c8b' : scout ? '#ad90d0' : '#7c99b7');
      polygon([[0, 12], [5, -3], [0, -10], [-5, -3]], '#f9a583');
      ctx.fillStyle = '#fba27b'; ctx.fillRect(-14, -16, 4, -rand(3, 10)); ctx.fillRect(10, -16, 4, -rand(3, 10));
    }
    ctx.restore();
  }
  function draw() {
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.fillStyle = '#080e19'; ctx.fillRect(0, 0, W, H);
    const nebula = ctx.createRadialGradient(440, 260, 20, 300, 330, 450); nebula.addColorStop(0, '#13293750'); nebula.addColorStop(.5, '#10243920'); nebula.addColorStop(1, '#080e1900'); ctx.fillStyle = nebula; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#789caf07'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = (clock * 12) % 60; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    stars.forEach(s => { ctx.globalAlpha = (.25 + s.z * .65) * (.8 + Math.sin(clock * 1.5 + s.phase) * .2); ctx.fillStyle = s.z > .8 ? '#c6e6ef' : '#6c8aa7'; ctx.fillRect(s.x, s.y, s.z > .8 ? 1.8 : 1, s.z > .8 && state === 'playing' ? 4 : 1.5); }); ctx.globalAlpha = 1;
    ctx.save(); if (shake > 0 && !reducedMotion) ctx.translate(rand(-shake * 12, shake * 12), rand(-shake * 12, shake * 12));
    if (state === 'ready') { ctx.globalAlpha = .20; drawPlayer(W / 2, H * .78, 2.2, true); ctx.globalAlpha = 1; }
    else {
      enemies.forEach(drawEnemy); if (boss) drawEnemy(boss);
      ctx.shadowColor = '#9df7d7'; ctx.shadowBlur = 10;
      bullets.forEach(b => { ctx.fillStyle = '#d8ffa9'; ctx.fillRect(b.x - 2, b.y - 10, 4, 20); ctx.fillStyle = '#fff'; ctx.fillRect(b.x - 1, b.y - 10, 2, 12); }); ctx.shadowBlur = 0;
      enemyBullets.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fillStyle = '#fa8e80'; ctx.shadowColor = '#fb7968'; ctx.shadowBlur = 9; ctx.fill(); }); ctx.shadowBlur = 0;
      if (state !== 'over' && (player.invincible <= 0 || Math.floor(clock * 14) % 2 === 0)) drawPlayer(player.x, player.y);
      pickups.forEach(p => {
        ctx.save(); ctx.translate(p.x, p.y); const color = p.type === 'weapon' ? '#6ae3ed' : p.type === 'shield' ? '#b69cfa' : '#ffad7d';
        ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.strokeStyle = color; ctx.fillStyle = '#102432'; ctx.lineWidth = 1.5;
        ctx.rotate(Math.sin(clock * 3 + p.phase) * .12); ctx.fillRect(-14, -14, 28, 28); ctx.strokeRect(-14, -14, 28, 28);
        ctx.shadowBlur = 0; ctx.fillStyle = color; ctx.font = 'bold 23px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.type === 'weapon' ? '↑' : p.type === 'shield' ? '◇' : '+', 0, 1); ctx.restore();
      });
    }
    particles.forEach(p => { ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); }); ctx.globalAlpha = 1;
    if (flash > 0) { ctx.globalAlpha = flash * .65; ctx.fillStyle = '#d5fff3'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; const radius = (1 - flash / .55) * 950; ctx.strokeStyle = '#d5fa6c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(player.x, player.y, radius, 0, TAU); ctx.stroke(); }
    ctx.restore();
    const vignette = ctx.createRadialGradient(W / 2, H / 2, 170, W / 2, H / 2, 490); vignette.addColorStop(0, '#03071000'); vignette.addColorStop(1, '#03071090'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
  }
  function frame(timestamp) { const dt = Math.min((timestamp - (last || timestamp)) / 1000, .05); last = timestamp; update(dt); draw(); requestAnimationFrame(frame); }
  function resize() { const dpr = Math.min(window.devicePixelRatio || 1, 2); const rect = canvas.getBoundingClientRect(); canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr); }
  function setPointer(event) { const r = canvas.getBoundingClientRect(); pointer = { x: (event.clientX - r.left) / r.width * W, y: (event.clientY - r.top) / r.height * H }; }
  canvas.addEventListener('pointerdown', event => { if (state !== 'playing') return; event.preventDefault(); unlockAudio(); canvas.setPointerCapture(event.pointerId); setPointer(event); });
  canvas.addEventListener('pointermove', event => { if (state === 'playing' && (event.pointerType === 'mouse' || canvas.hasPointerCapture(event.pointerId))) setPointer(event); });
  canvas.addEventListener('pointerup', event => { if (event.pointerType !== 'mouse') pointer = null; });
  canvas.addEventListener('pointercancel', () => { pointer = null; });
  canvas.addEventListener('pointerleave', () => { pointer = null; });
  document.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd', 'x', 'p'].includes(key)) event.preventDefault();
    if (event.repeat) return;
    if (key === 'enter' && !['BUTTON', 'A'].includes(document.activeElement?.tagName)) { if (state === 'paused') pause(); else if (state !== 'playing') start(); }
    if (key === 'p' || key === 'escape') pause();
    if (key === 'x') useBomb();
    if (state === 'playing') keys.add(key);
  });
  document.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pause(); });
  window.addEventListener('blur', () => { if (state === 'playing') pause(); });
  $('start-btn').addEventListener('click', () => { if (state === 'paused') pause(); else start(); $('start-btn').blur(); });
  $('pause-btn').addEventListener('click', () => { pause(); $('pause-btn').blur(); });
  $('bomb-btn').addEventListener('click', () => { useBomb(); $('bomb-btn').blur(); });
  $('sound-btn').addEventListener('click', () => { sound = !sound; unlockAudio(); updateSound(); if (sound) tone(660, .12); $('sound-btn').blur(); });
  window.addEventListener('resize', resize);
  new ResizeObserver(resize).observe(canvas);
  resize(); updateHud(); requestAnimationFrame(frame);
})();
