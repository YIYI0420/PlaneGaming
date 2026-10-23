import { World } from './scene.js?v=2';
const B = window.Blackout;
const { Game, WEAPONS, OPTICS, OBSTACLES, GRID, TURRET, BOX, EXIT, PORTALS, clamp, direction, distance, formatTime } = B;
const $ = id => document.getElementById(id);
const touchQuery = matchMedia('(pointer:coarse)');
let touchMode = touchQuery.matches, options = { primary: 'm4', optic: 'red', quality: touchMode ? 'low' : 'high', renderRevision: 2, sound: true, auto: true };
let storageAvailable = true;
function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; } }
function save(key, data) { try { localStorage.setItem(key, JSON.stringify(data)); } catch (_) { storageAvailable = false; } }
const stored = read('blackout-loadout-v1', {});
if (['m4', 'ak', 'awm'].includes(stored.primary)) options.primary = stored.primary;
if (OPTICS[stored.optic]) options.optic = stored.optic;
if (stored.renderRevision === 2 && ['low', 'standard', 'high'].includes(stored.quality)) options.quality = stored.quality;
for (const key of ['sound', 'auto']) if (typeof stored[key] === 'boolean') options[key] = stored[key];
let history = read('blackout-results-v1', []); if (!Array.isArray(history)) history = [];
history = history.filter(r => r && typeof r.won === 'boolean' && Number.isFinite(r.time) && r.time >= 0).slice(-50);
document.body.classList.toggle('touch-mode', touchMode);
window.bootProgress(65, '正在构建公交总站、武器和导航…');
const view = new World($('world'), options.quality);
let game = null, lastTimestamp = 0, menuTime = 0, hudTimer = 0, aimTimer = 0, lastStage = '', resultSaved = false, manualFire = false, toggleAim = false;
let joystickPointer = null, joystickInput = { x: 0, forward: 0 }, lookPointer = null, lastLook = { x: 0, y: 0 }, lastLocked = false, hitFlash = 0, hurtFlash = 0;
let portrait = innerHeight > innerWidth;
const mouse = new window.BlackoutControls.MouseControls($('world'), document, {
  enabled: () => !!game && !game.frozen,
  engage: () => requestPointer(),
  look: (dx, dy) => { const sensitivity = .0024 / (mouse.aim || toggleAim ? (game.weapon === 'rifle' ? OPTICS[game.optic].zoom : 1.25) : 1); game.look(-dx * sensitivity, -dy * sensitivity); }
});
const keys = new Set();
const weaponDescriptions = { m4: '低后坐、稳定连射，适合持续火力和第一次进入总站的幸存者。', ak: '单发伤害更高，后坐更强；瞄准头部能迅速压制普通目标。', awm: '五发弹匣与栓动间隔，用高伤害精确点杀；近身时记得切换手枪。' };
const facilityNames = { grid: '通道电网', turret: '自动炮台' }, perkNames = { pierce: '穿透弹', reload: '快速装填', shock: '电击手雷' };

class SoundSystem {
  constructor() { this.context = null; this.master = null; this.noise = null; }
  unlock() {
    if (!options.sound) return;
    try {
      if (!this.context) {
        this.context = new (window.AudioContext || window.webkitAudioContext)(); this.master = this.context.createGain(); this.master.gain.value = .5;
        const compressor = this.context.createDynamicsCompressor(); compressor.threshold.value = -16; compressor.ratio.value = 8; this.master.connect(compressor); compressor.connect(this.context.destination);
        this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate); const data = this.noise.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      this.master.gain.setTargetAtTime(options.sound ? .5 : 0, this.context.currentTime, .03);
    } catch (_) { options.sound = false; updateMenu(); }
  }
  setMuted() { if (this.context) this.master.gain.setTargetAtTime(options.sound ? .5 : 0, this.context.currentTime, .025); }
  tone(frequency, duration = .12, volume = .1, type = 'sine', end = frequency) {
    if (!this.context || !options.sound) return; const t = this.context.currentTime, osc = this.context.createOscillator(), gain = this.context.createGain(); osc.type = type; osc.frequency.setValueAtTime(frequency, t); osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + duration); gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(.001, t + duration); osc.connect(gain); gain.connect(this.master); osc.start(t); osc.stop(t + duration);
  }
  noiseBurst(duration, filter, volume) {
    if (!this.context || !options.sound) return; const t = this.context.currentTime, source = this.context.createBufferSource(), gain = this.context.createGain(), lowpass = this.context.createBiquadFilter(); source.buffer = this.noise; lowpass.type = 'lowpass'; lowpass.frequency.value = filter; gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(.001, t + duration); source.connect(lowpass); lowpass.connect(gain); gain.connect(this.master); source.start(t, Math.random() * .5, duration); source.stop(t + duration + .01);
  }
  events(events) {
    for (const e of events) {
      if (e.type === 'shoot') { const kind = e.weapon === 'pistol' ? 'pistol' : game.primary; this.noiseBurst(kind === 'awm' ? .25 : kind === 'ak' ? .13 : .075, kind === 'awm' ? 1700 : 3200, kind === 'awm' ? .65 : .38); this.tone(kind === 'awm' ? 80 : kind === 'ak' ? 130 : 180, kind === 'awm' ? .28 : .1, .14, 'triangle', 35); }
      if (e.type === 'hit') { this.tone(e.head ? 1020 : e.armor ? 1800 : 640, .045, .07, 'triangle', e.head ? 1600 : 400); hitFlash = .15; $('hit-marker').className = 'hit-marker' + (e.head ? ' head' : e.armor ? ' armor' : ''); }
      if (e.type === 'hurt') { this.noiseBurst(.16, 600, .2); this.tone(95, .2, .1, 'sine', 45); hurtFlash = .7; }
      if (e.type === 'jump') this.noiseBurst(.10, 500, .05);
      if (e.type === 'land') this.noiseBurst(.11, 350, .09);
      if (e.type === 'reload') { this.noiseBurst(.1, 2500, .08); this.tone(160, .05, .04, 'square'); }
      if (e.type === 'reloaded' || e.type === 'switch') this.tone(330, .06, .05, 'triangle', 500);
      if (e.type === 'pickup') this.tone(500, .16, .09, 'sine', 880);
      if (e.type === 'explosion') { this.noiseBurst(.65, 800, .6); this.tone(70, .5, .2, 'sawtooth', 25); }
      if (e.type === 'gridpulse') this.noiseBurst(.15, 1600, .07);
      if (e.type === 'turretshot') this.noiseBurst(.05, 1700, .08);
      if (e.type === 'wave' || e.type === 'gateopen') this.tone(e.type === 'gateopen' ? 520 : 220, .5, .10, 'sine', e.type === 'gateopen' ? 1040 : 440);
      if (e.type === 'spawn' && e.kind !== 'walker') { const gain = Math.max(.02, .1 * (1 - distance(e, game.player) / 35)); this.tone(e.kind === 'runner' ? 240 : 85, .45, gain, 'sawtooth', 55); }
      if (e.type === 'attack') this.noiseBurst(.15, 420, .07);
    }
  }
}
const sound = new SoundSystem();
function updateMenu() {
  document.querySelectorAll('[data-weapon]').forEach(b => { const selected = b.dataset.weapon === options.primary; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); });
  document.querySelectorAll('[data-optic]').forEach(b => { const selected = b.dataset.optic === options.optic; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); });
  $('weapon-description').textContent = weaponDescriptions[options.primary]; $('quality-setting').value = options.quality; $('pause-quality').value = options.quality; $('sound-setting').checked = options.sound; $('auto-setting').checked = options.auto;
  const wins = history.filter(r => r.won), best = wins.length ? Math.min(...wins.map(r => r.time)) : null;
  $('career-label').textContent = !storageAvailable ? '浏览器存储不可用，本次仍可游玩。' : wins.length ? `${wins.length} 次成功撤离 / 最佳 ${formatTime(best)}` : '准备好，活着回来。';
}
function saveOptions() { save('blackout-loadout-v1', options); }
function clearInput() { keys.clear(); manualFire = false; mouse.reset(); toggleAim = false; lookPointer = null; joystickPointer = null; joystickInput = { x: 0, forward: 0 }; $('joystick-knob').style.transform = ''; }
function releasePointer() { if (document.pointerLockElement) document.exitPointerLock(); }
function requestPointer() {
  if (touchMode || !game || game.frozen) return;
  try { const result = $('world').requestPointerLock(); result?.catch?.(() => { $('pointer-hint').hidden = false; }); } catch (_) { $('pointer-hint').hidden = false; }
}
function start() {
  clearInput(); sound.unlock(); view.reset(); view.setQuality(options.quality); game = new Game({ primary: options.primary, optic: options.optic, seed: Date.now() % 2147483647 });
  lastStage = ''; resultSaved = false; hitFlash = hurtFlash = 0; hudTimer = 1; $('menu').hidden = true; $('hud').hidden = false; $('pause-overlay').hidden = true; $('result-overlay').hidden = true; $('selection-overlay').hidden = true;
  $('tutorial-copy').textContent = touchMode ? '左摇杆移动 · 右侧转向 · 对准敌人自动开火 · ↑ 跳跃' : 'WASD 移动 · 空格跳跃 · 左键开火 · 右键或 Q 开镜';
  requestPointer(); syncStage(); updateHUD();
}
function pause(reason = '游戏已暂停，准备好了再继续。') {
  if (!game || game.frozen) return; game.pause(); clearInput(); releasePointer(); $('pause-description').textContent = reason; $('pause-overlay').hidden = false; $('scope-overlay').hidden = true;
  document.querySelectorAll('[data-pause-optic]').forEach(b => b.classList.toggle('selected', b.dataset.pauseOptic === game.optic));
}
function resume() { if (!game) return; game.resume(); clearInput(); $('pause-overlay').hidden = true; sound.unlock(); requestPointer(); }
function backToMenu() { clearInput(); releasePointer(); game = null; view.reset(); $('menu').hidden = false; $('hud').hidden = true; for (const id of ['pause-overlay', 'selection-overlay', 'result-overlay']) $(id).hidden = true; updateMenu(); }
function setOptic(value) { if (!OPTICS[value]) return; options.optic = value; if (game) game.optic = value; saveOptions(); updateMenu(); document.querySelectorAll('[data-pause-optic]').forEach(b => b.classList.toggle('selected', b.dataset.pauseOptic === value)); }
function switchGun() { if (!game || game.frozen) return; game.switchWeapon(game.weapon === 'rifle' ? 'pistol' : 'rifle'); }
function selectionCard(icon, title, tag, description, rule, action) {
  const b = document.createElement('button'); b.className = 'selection-card'; b.innerHTML = `<span class="selection-icon">${icon}</span><span class="card-tag">${tag}</span><strong>${title}</strong><p>${description}</p><div class="card-rule">${rule}</div><span class="card-choose">确认选择 ↗</span>`; b.addEventListener('click', action); return b;
}
function showSelection(type) {
  clearInput(); releasePointer(); $('selection-overlay').hidden = false; $('selection-cards').replaceChildren();
  if (type === 'facilityChoice') {
    $('selection-kicker').textContent = 'WAVE 01 CLEAR / POWER RESTORED'; $('selection-title').textContent = '把电，送到最需要的地方。'; $('selection-description').textContent = '电力只够接通一种设施。你的站位，将决定它的作用。';
    const select = value => { game.chooseFacility(value); $('selection-overlay').hidden = true; sound.unlock(); requestPointer(); };
    $('selection-cards').append(selectionCard('ϟ', '通道电网', 'WEST LANE / AREA CONTROL', '接通西侧通道。周期性电击范围内敌人，并显著减缓它们的移动。', '每 2.8 秒脉冲 · 32 伤害 · 减速 55%<br>适合绕行与引敌进入狭窄通道。', () => select('grid')), selectionCard('⌖', '自动炮台', 'EAST LOT / FIXED DEFENSE', '接通东侧炮台。固定向北覆盖停车带，为你分担正面的火力。', '120 发弹药 · 自动攻击 · 遵守遮挡<br>适合围绕东侧阵地，优先处理漏网目标。', () => select('turret')));
  } else {
    $('selection-kicker').textContent = 'WAVE 02 CLEAR / ADAPT & SURVIVE'; $('selection-title').textContent = '下一波，用你的方式应对。'; $('selection-description').textContent = '选择一种强化。效果持续到本局结束。';
    const select = value => { game.choosePerk(value); $('selection-overlay').hidden = true; sound.unlock(); requestPointer(); };
    $('selection-cards').append(selectionCard('↠', '穿透弹', 'LINE THEM UP', '子弹经过一个普通僵尸后，还能命中它后面的另一个敌人。', '将敌人引到同一直线。<br>墙体和护甲仍会阻挡穿透。', () => select('pierce')), selectionCard('↻', '快速装填', 'LESS DOWNTIME', '所有武器的换弹时间缩短 35%，减小火力中断的危险。', '步枪和备用手枪均生效。<br>适合持续射击和近距离应急。', () => select('reload')), selectionCard('◈', '电击手雷', 'MAKE SOME SPACE', '手雷额外减速范围内敌人 4 秒，为被包围时留出脱身空间。', '减速 60% · 立即补充一枚手雷。<br>手雷上限 3 枚。', () => select('shock')));
  }
}
function showResult() {
  if (resultSaved) return; resultSaved = true; clearInput(); releasePointer();
  const result = game.result, previousWins = history.filter(r => r.won && r.primary === result.primary && r.facility === result.facility), record = result.won && (!previousWins.length || result.time < Math.min(...previousWins.map(r => r.time)));
  history.push({ ...result, date: new Date().toISOString() }); history = history.slice(-50); save('blackout-results-v1', history);
  $('result-tag').textContent = result.won ? record ? '✦ NEW RECORD / 成功撤离' : 'EXTRACTION COMPLETE' : 'SIGNAL LOST / 任务失败';
  $('result-symbol').textContent = result.won ? '↗' : '✕'; $('result-title').textContent = result.won ? '你等到了天亮。' : '信号，在这里中断。';
  $('result-description').textContent = result.won ? '走出了总站。下一次，试试另一种防守方式。' : `抵达第 ${Math.max(1, result.wave)} 波。调整枪械、倍率或路线，再试一次。`;
  $('result-stats').replaceChildren();
  for (const [value, label] of [[formatTime(result.time), '本局用时'], [result.kills, '总击杀'], [result.headshots, '爆头击杀'], [result.facilityKills, '设施击杀'], [result.assists, '设施助攻'], [result.accuracy + '%', '射击命中率']]) { const d = document.createElement('div'), strong = document.createElement('strong'), span = document.createElement('span'); strong.textContent = value; span.textContent = label; d.append(strong, span); $('result-stats').appendChild(d); }
  $('result-build').textContent = `${WEAPONS[result.primary].short} / ${OPTICS[result.optic].short} / ${facilityNames[result.facility] || '未接通设施'} / ${perkNames[result.perk] || '未获得强化'}`;
  $('result-overlay').hidden = false; $('selection-overlay').hidden = true; $('pause-overlay').hidden = true; sound.tone(result.won ? 480 : 160, .6, .12, 'sine', result.won ? 960 : 40);
}
function syncStage() {
  if (!game || game.stage === lastStage) return; lastStage = game.stage;
  $('tutorial-hint').hidden = game.stage !== 'tutorial';
  if (['facilityChoice', 'perkChoice'].includes(game.stage)) showSelection(game.stage);
  else if (['won', 'lost'].includes(game.stage)) showResult();
}
function updateHUD() {
  if (!game) return;
  $('wave-label').textContent = game.wave ? `${String(game.wave).padStart(2, '0')} / 03` : '引导';
  $('remaining-label').textContent = game.stage === 'wave' ? `${game.remaining} 个目标` : ['evac', 'escape'].includes(game.stage) ? '撤离阶段' : game.stage === 'tutorial' ? `${Math.max(0, Math.ceil(15 - game.stageTime))} 秒后开始` : '区域清空';
  [...$('wave-dots').children].forEach((dot, i) => { dot.classList.toggle('active', game.wave === i + 1 && game.stage === 'wave'); dot.classList.toggle('done', game.wave > i + 1 || game.wave === i + 1 && game.stage !== 'wave'); });
  $('objective-tag').textContent = game.stage === 'escape' ? '立即撤离' : game.stage === 'wave' ? '当前目标 / 保持移动' : '当前目标'; $('objective-text').textContent = game.objective;
  $('elapsed-time').textContent = formatTime(game.time); $('gate-progress').hidden = !['evac', 'escape'].includes(game.stage); $('gate-fill').style.width = (18 - game.gateTime) / 18 * 100 + '%';
  $('hp-label').textContent = game.player.hp; $('hp-fill').style.width = game.player.hp + '%'; $('hp-fill').style.background = game.player.hp < 35 ? '#dd8b67' : '#b7cf91'; $('hp-status').textContent = game.player.hp < 35 ? 'CRITICAL / 寻找医疗补给' : 'VITALS STABLE';
  $('ammo-label').textContent = String(game.ammo[game.weapon]).padStart(2, '0'); $('reserve-label').textContent = game.weapon === 'pistol' ? '∞' : game.reserve;
  $('current-weapon').textContent = game.weaponInfo.short; $('reload-label').textContent = game.reloadTime > 0 ? `装填 ${game.reloadTime.toFixed(1)}s` : game.weapon === 'rifle' && game.primary === 'awm' && game.fireCooldown > .2 ? '拉栓中' : '';
  $('reload-fill').style.width = game.reloadTime > 0 ? (1 - game.reloadTime / game.reloadDuration) * 100 + '%' : '0%';
  $('grenade-count').textContent = game.grenades; $('grenade-button').disabled = game.grenades <= 0;
  $('cycle-optic').textContent = game.weapon === 'pistol' ? '铁瞄' : OPTICS[game.optic].short; $('cycle-optic').disabled = game.weapon === 'pistol';
  const scoped = game.aiming && !game.frozen; $('scope-overlay').hidden = !scoped; $('scope-overlay').classList.toggle('red-optic', game.optic === 'red' || game.weapon === 'pistol'); $('scope-label').textContent = game.weapon === 'pistol' ? '铁瞄' : OPTICS[game.optic].short;
  $('reticle').hidden = scoped; $('aim-button').classList.toggle('active', game.aiming); $('aim-button').querySelector('small').textContent = game.aiming ? '关镜' : '开镜';
  $('interact-button').hidden = !game.interaction || game.frozen; $('interact-label').textContent = game.interaction;
  $('notice').textContent = game.notice; $('notice').classList.toggle('visible', game.noticeTime > 0 && !game.frozen && game.stage !== 'tutorial');
  $('facility-state').hidden = !game.facility; if (game.facility) { $('facility-name').textContent = facilityNames[game.facility]; $('facility-detail').textContent = game.facility === 'grid' ? `下次脉冲 ${Math.max(0, game.gridTimer).toFixed(1)}s` : `剩余 ${game.turretAmmo} / 120 发`; }
  const point = game.objectivePoint; $('objective-arrow').hidden = !point;
  if (point) { const angle = Math.atan2(point.x - game.player.x, -(point.z - game.player.z)) + game.player.yaw; $('objective-arrow').querySelector('span').style.transform = `rotate(${angle}rad)`; $('objective-distance').textContent = Math.round(distance(point, game.player)) + ' M'; }
  const target = game.trace().hits[0]; $('reticle').classList.toggle('on-target', !!target); $('target-label').textContent = target ? target.enemy.kind === 'armor' ? '护甲目标 / 头部弱点' : target.enemy.kind === 'runner' ? '奔袭者' : '感染者' : '';
  $('hud-sound').setAttribute('aria-label', options.sound ? '关闭音效' : '开启音效'); $('hud-sound').style.opacity = options.sound ? '1' : '.45';
  drawRadar();
}
function drawRadar() {
  const canvas = $('radar'), c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  c.clearRect(0, 0, w, h); c.fillStyle = '#0e2028bb'; c.fillRect(6, 5, w - 12, h - 16); c.strokeStyle = '#a3b38c40'; c.lineWidth = 1; c.strokeRect(6, 5, w - 12, h - 16);
  const px = x => 75 + x * 3.55, pz = z => 79 + z * 3.25;
  c.fillStyle = '#698279aa'; for (const o of OBSTACLES) c.fillRect(px(o.x1), pz(o.z1), (o.x2 - o.x1) * 3.55, (o.z2 - o.z1) * 3.25);
  if (game.facility === 'grid') { c.fillStyle = '#73d9e060'; c.fillRect(px(GRID.x1), pz(GRID.z1), (GRID.x2 - GRID.x1) * 3.55, (GRID.z2 - GRID.z1) * 3.25); }
  else if (game.facility === 'turret') { c.fillStyle = '#9bd3cf'; c.fillRect(px(TURRET.x) - 2, pz(TURRET.z) - 2, 4, 4); }
  for (const portal of PORTALS) { c.fillStyle = '#dba57a70'; c.fillRect(px(portal.x) - 2, pz(portal.z) - 2, 4, 4); }
  for (const e of game.enemies) { c.fillStyle = e.kind === 'runner' ? '#e99565' : e.kind === 'armor' ? '#c8d8ee' : '#b7c88b'; c.beginPath(); c.arc(px(e.x), pz(e.z), 1.5, 0, TAU); c.fill(); }
  const target = game.objectivePoint; if (target) { c.strokeStyle = '#f1cb8c'; c.strokeRect(px(target.x) - 3, pz(target.z) - 3, 6, 6); }
  c.save(); c.translate(px(game.player.x), pz(game.player.z)); c.rotate(-game.player.yaw); c.fillStyle = '#f9d99e'; c.beginPath(); c.moveTo(0, -5); c.lineTo(-3.5, 4); c.lineTo(3.5, 4); c.closePath(); c.fill(); c.restore();
  c.fillStyle = '#b1c59e8a'; c.font = '7px Consolas,monospace'; c.textAlign = 'center'; c.fillText('N ↑ / 总站示意图', 75, 166);
}
const TAU = Math.PI * 2;
function inputs() {
  return { x: joystickInput.x + Number(keys.has('d')) - Number(keys.has('a')), forward: joystickInput.forward + Number(keys.has('w')) - Number(keys.has('s')), turn: Number(keys.has('arrowleft')) - Number(keys.has('arrowright')), fire: mouse.fire || manualFire, autoFire: touchMode && options.auto, aim: mouse.aim || toggleAim };
}
function frame(timestamp) {
  const dt = Math.min((timestamp - (lastTimestamp || timestamp)) / 1000, .05); lastTimestamp = timestamp;
  if (game) {
    game.step(dt, inputs()); const events = game.drainEvents(); view.handleEvents(events); sound.events(events); syncStage();
    view.render(game, game.frozen ? 0 : dt); hudTimer += dt; if (hudTimer >= .08) { updateHUD(); hudTimer = 0; }
    hitFlash = Math.max(0, hitFlash - dt); hurtFlash = Math.max(0, hurtFlash - dt * 1.8); $('hit-marker').style.opacity = hitFlash > 0 ? '1' : '0'; $('hurt-overlay').style.opacity = hurtFlash;
  } else { menuTime += dt; view.render(null, dt, menuTime); }
  requestAnimationFrame(frame);
}

document.querySelectorAll('[data-weapon]').forEach(b => b.addEventListener('click', () => { options.primary = b.dataset.weapon; saveOptions(); updateMenu(); }));
document.querySelectorAll('[data-optic]').forEach(b => b.addEventListener('click', () => setOptic(b.dataset.optic)));
document.querySelectorAll('[data-pause-optic]').forEach(b => b.addEventListener('click', () => setOptic(b.dataset.pauseOptic)));
for (const id of ['quality-setting', 'pause-quality']) $(id).addEventListener('change', e => { options.quality = e.target.value; saveOptions(); view.setQuality(options.quality); updateMenu(); });
$('sound-setting').addEventListener('change', e => { options.sound = e.target.checked; sound.unlock(); sound.setMuted(); saveOptions(); });
$('auto-setting').addEventListener('change', e => { options.auto = e.target.checked; saveOptions(); });
$('start-button').addEventListener('click', start); $('pause-button').addEventListener('click', () => pause()); $('resume-button').addEventListener('click', resume);
$('restart-button').addEventListener('click', start); $('retry-button').addEventListener('click', start); $('back-menu').addEventListener('click', backToMenu); $('change-loadout').addEventListener('click', backToMenu);
$('skip-tutorial').addEventListener('click', () => { game?.skipTutorial(); requestPointer(); });
$('guide-button').addEventListener('click', () => $('guide-dialog').showModal()); $('close-guide').addEventListener('click', () => $('guide-dialog').close());
$('hud-sound').addEventListener('click', () => { options.sound = !options.sound; sound.unlock(); sound.setMuted(); saveOptions(); });
$('reload-button').addEventListener('click', () => game?.reload()); $('grenade-button').addEventListener('click', () => game?.throwGrenade()); $('switch-button').addEventListener('click', switchGun);
$('jump-button').addEventListener('click', () => game?.jump());
$('aim-button').addEventListener('click', () => { if (game && !game.frozen) toggleAim = !toggleAim; });
$('interact-button').addEventListener('click', () => game?.interact());
$('cycle-optic').addEventListener('click', () => { if (game?.weapon === 'rifle') { const values = ['red', 'x4', 'x8']; setOptic(values[(values.indexOf(game.optic) + 1) % 3]); } });
document.addEventListener('keydown', event => {
  if (event.target.closest?.('input,select,textarea')) return;
  const key = event.key.toLowerCase(); if (!game || !['w', 'a', 's', 'd', ' ', 'q', 'r', 'e', 'g', '1', '2', 'p', 'escape', 'arrowleft', 'arrowright'].includes(key)) return; event.preventDefault();
  if (event.repeat) return;
  if (key === 'p') { if (game.paused) resume(); else pause(); return; }
  if (key === 'escape') { pause(); return; }
  if (game.frozen) return;
  if (key === ' ') game.jump();
  if (key === 'q') toggleAim = !toggleAim;
  if (key === 'r') game.reload(); if (key === 'g') game.throwGrenade(); if (key === 'e') game.interact(); if (key === '1') game.switchWeapon('rifle'); if (key === '2') game.switchWeapon('pistol'); keys.add(key);
});
document.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
$('fire-button').addEventListener('pointerdown', event => { if (!game || game.frozen) return; event.preventDefault(); manualFire = true; event.currentTarget.setPointerCapture(event.pointerId); });
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) $('fire-button').addEventListener(event, () => { manualFire = false; });

document.addEventListener('pointerlockchange', () => { const locked = document.pointerLockElement === $('world'); $('pointer-hint').hidden = locked || touchMode; if (lastLocked && !locked && game && !game.frozen) pause('鼠标已解锁，点击继续后重新进入战斗。'); lastLocked = locked; });
function activateTouch() { if (!touchMode) { touchMode = true; document.body.classList.add('touch-mode'); } }
$('joystick').addEventListener('pointerdown', event => { if (!game || game.frozen) return; event.preventDefault(); activateTouch(); joystickPointer = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); updateJoystick(event); });
function updateJoystick(event) { const rect = $('joystick').getBoundingClientRect(), dx = event.clientX - rect.left - rect.width / 2, dy = event.clientY - rect.top - rect.height / 2, r = Math.max(1, Math.hypot(dx, dy)), max = 35, ratio = Math.min(1, max / r); joystickInput = { x: dx * ratio / max, forward: -dy * ratio / max }; $('joystick-knob').style.transform = `translate(${dx * ratio}px,${dy * ratio}px)`; }
$('joystick').addEventListener('pointermove', event => { if (event.pointerId === joystickPointer) { event.preventDefault(); updateJoystick(event); } });
const releaseJoystick = event => { if (event.pointerId === joystickPointer) { joystickPointer = null; joystickInput = { x: 0, forward: 0 }; $('joystick-knob').style.transform = ''; } };
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) $('joystick').addEventListener(event, releaseJoystick);
$('look-pad').addEventListener('pointerdown', event => { if (!game || game.frozen || lookPointer != null) return; event.preventDefault(); activateTouch(); lookPointer = event.pointerId; lastLook = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); });
$('look-pad').addEventListener('pointermove', event => { if (event.pointerId !== lookPointer || !game || game.frozen) return; event.preventDefault(); const sensitivity = .004 / (toggleAim ? (game.weapon === 'rifle' ? OPTICS[game.optic].zoom : 1.25) : 1); game.look(-(event.clientX - lastLook.x) * sensitivity, -(event.clientY - lastLook.y) * sensitivity); lastLook = { x: event.clientX, y: event.clientY }; });
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) $('look-pad').addEventListener(event, e => { if (e.pointerId === lookPointer) lookPointer = null; });
document.addEventListener('pointerdown', event => { if (event.pointerType === 'touch') activateTouch(); }, { passive: true });
window.addEventListener('blur', () => { clearInput(); pause('页面失去焦点，已自动暂停。'); }); document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); pause('已离开页面，返回后点击继续。'); } });
window.addEventListener('resize', () => { view.resize(); const nowPortrait = innerHeight > innerWidth; if (touchMode && portrait !== nowPortrait) pause('屏幕方向已变化，请检查握持方向后继续。'); portrait = nowPortrait; });
$('world').addEventListener('webglcontextlost', event => { event.preventDefault(); pause('图形上下文暂时中断，恢复后可尝试继续；必要时重新加载。'); });
updateMenu(); window.bootProgress(100, '总站已就绪'); view.render(null, 0, 0); $('load-screen').hidden = true; $('menu').hidden = false; requestAnimationFrame(frame);
