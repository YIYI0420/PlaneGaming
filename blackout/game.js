import { World } from './scene.js?v=5';
const B = window.Blackout;
const { Game, LEVELS, WEAPONS, OPTICS, MELEE, MELEE_ATTACKS, OBSTACLES, GRID, TURRET, BOX, EXIT, PORTALS, clamp, direction, distance, formatTime } = B;
const $ = id => document.getElementById(id);
const touchQuery = matchMedia('(pointer:coarse)');
let touchMode = touchQuery.matches, options = { level:0,primary: 'm4', melee:'combat', optic: 'red', quality: touchMode ? 'low' : 'high', renderRevision: 2, sound: true, auto: true };
let storageAvailable = true;
function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; } }
function save(key, data) { try { localStorage.setItem(key, JSON.stringify(data)); } catch (_) { storageAvailable = false; } }
const stored = read('blackout-loadout-v1', {});
if(Number.isInteger(stored.level)&&LEVELS[stored.level])options.level=stored.level;
if (['m4', 'ak', 'awm'].includes(stored.primary)) options.primary = stored.primary;
if (Object.hasOwn(MELEE,stored.melee)) options.melee=stored.melee;
if (OPTICS[stored.optic]) options.optic = stored.optic;
if (stored.renderRevision === 2 && ['low', 'standard', 'high'].includes(stored.quality)) options.quality = stored.quality;
for (const key of ['sound', 'auto']) if (typeof stored[key] === 'boolean') options[key] = stored[key];
let history = read('blackout-results-v1', []); if (!Array.isArray(history)) history = [];
history = history.filter(r => r && typeof r.won === 'boolean' && Number.isFinite(r.time) && r.time >= 0).slice(-50);
document.body.classList.toggle('touch-mode', touchMode);
window.bootProgress(65, '正在构建公交总站、武器和导航…');
const view = new World($('world'), options.quality);view.setLevel(options.level);let runResults=[];
let game = null, lastTimestamp = 0, menuTime = 0, hudTimer = 0, aimTimer = 0, lastStage = '', resultSaved = false, manualFire = false, manualHeavy = false, toggleAim = false, toggleSprint = false;
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
      if(e.type==='slash'){this.noiseBurst(e.heavy?.18:.1,3600,e.heavy?.13:.09);this.tone(options.melee==='axe'?120:260,e.heavy?.18:.09,.035,'triangle',80);}
      if(e.type==='bossintro'||e.type==='enrage'){this.noiseBurst(.5,400,.25);this.tone(55,.8,.16,'sawtooth',35);}
      if(e.type==='bossskill')this.tone(e.skill==='slam'?120:220,.5,.12,'sawtooth',60);
      if(e.type==='bossslam'||e.type==='bossdown'){this.noiseBurst(.6,900,.5);this.tone(65,.45,.2,'triangle',25);}
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
  const level=LEVELS[options.level];
  document.querySelectorAll('[data-level]').forEach(b=>{const selected=Number(b.dataset.level)===options.level;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
  $('level-description').textContent=level.story;$('boss-training').querySelector('span').textContent='直接挑战'+level.bossName+' ↗';$('world').setAttribute('aria-label',level.name+'三维游戏场景');$('radar').setAttribute('aria-label',level.name+'示意图与目标方向');$('chapter-heading').textContent='CHAPTER 0'+(options.level+1)+' / '+level.name;
  $('menu-story').textContent=level.story;$('start-button').firstChild.textContent='进入第 '+(options.level+1)+' 关 ';

  document.querySelectorAll('[data-weapon]').forEach(b => { const selected = b.dataset.weapon === options.primary; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); });
  document.querySelectorAll('[data-optic]').forEach(b => { const selected = b.dataset.optic === options.optic; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); });
  $('weapon-description').textContent = weaponDescriptions[options.primary]; $('quality-setting').value = options.quality; $('pause-quality').value = options.quality; $('sound-setting').checked = options.sound; $('auto-setting').checked = options.auto;
  document.querySelectorAll('[data-melee]').forEach(b=>{const selected=b.dataset.melee===options.melee;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});const blade=MELEE[options.melee];$('melee-description').textContent=`轻击 ${blade.damage} / 重击 ${Math.round(blade.damage*MELEE_ATTACKS[options.melee].heavy.damage)} · ${blade.range} 米 · ${blade.desc} · 重击消耗 18 体力`;
  const wins = history.filter(r => r.won && r.mode!=='bossTraining' && r.bossDefeated && (r.levelIndex??0)===options.level), best = wins.length ? Math.min(...wins.map(r => r.time)) : null;
  $('career-label').textContent = !storageAvailable ? '浏览器存储不可用，本次仍可游玩。' : wins.length ? `${level.name} · ${wins.length} 次撤离 / 最佳 ${formatTime(best)}` : '准备好，活着回来。';
}
function saveOptions() { save('blackout-loadout-v1', options); }
function clearInput() { keys.clear(); manualFire = false; manualHeavy = false; toggleSprint = false; mouse.reset(); toggleAim = false; lookPointer = null; joystickPointer = null; joystickInput = { x: 0, forward: 0 }; $('joystick-knob').style.transform = ''; }
function releasePointer() { if (document.pointerLockElement) document.exitPointerLock(); }
function requestPointer() {
  if (touchMode || !game || game.frozen) return;
  try { const result = $('world').requestPointerLock(); result?.catch?.(() => { $('pointer-hint').hidden = false; }); } catch (_) { $('pointer-hint').hidden = false; }
}
function start(mode = 'campaign',levelIndex=options.level,keepRun=false,prepared=null) {
  if(!keepRun)runResults=[];options.level=levelIndex;saveOptions();updateMenu();
  clearInput(); sound.unlock();view.setLevel(levelIndex); view.reset(); view.setQuality(options.quality); game = prepared||new Game({ level:levelIndex,primary: options.primary, melee:options.melee, mode:mode==='bossTraining'?'bossTraining':'campaign', optic: options.optic, seed: Date.now() % 2147483647 });
  if(game.mode==='bossTraining')game.startBossEncounter();
  lastStage = ''; resultSaved = false; hitFlash = hurtFlash = 0; hudTimer = 1; $('menu').hidden = true; $('hud').hidden = false; $('pause-overlay').hidden = true; $('result-overlay').hidden = true; $('selection-overlay').hidden = true;
  $('tutorial-copy').textContent = touchMode ? '摇杆移动 · ⇧ 奔跑 · ↑ 跳跃 · ⇄ 切枪/刀' : 'WASD 移动 · Shift 奔跑 · 空格跳跃 · 3 / V 持刀 · 左轻 / 右重';
  requestPointer(); syncStage(); updateHUD();
}
function pause(reason = '游戏已暂停，准备好了再继续。') {
  if (!game || game.frozen) return; game.pause(); clearInput(); releasePointer(); $('pause-description').textContent = reason; $('pause-overlay').hidden = false; $('scope-overlay').hidden = true;
  document.querySelectorAll('[data-pause-optic]').forEach(b => b.classList.toggle('selected', b.dataset.pauseOptic === game.optic));
}
function resume() { if (!game) return; game.resume(); clearInput(); $('pause-overlay').hidden = true; sound.unlock(); requestPointer(); }
function backToMenu() { clearInput(); releasePointer(); game = null; view.reset(); $('menu').hidden = false; $('hud').hidden = true; for (const id of ['pause-overlay', 'selection-overlay', 'result-overlay']) $(id).hidden = true; updateMenu(); }
function setOptic(value) { if (!OPTICS[value]) return; options.optic = value; if (game) game.optic = value; saveOptions(); updateMenu(); document.querySelectorAll('[data-pause-optic]').forEach(b => b.classList.toggle('selected', b.dataset.pauseOptic === value)); }
function switchGun() { if (!game || game.frozen) return; toggleAim=false;const slots=['rifle','pistol','melee'];game.switchWeapon(slots[(slots.indexOf(game.weapon)+1)%3]); }
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
  const result = game.result, previousWins = history.filter(r => r.won && r.mode===result.mode && (r.levelIndex??0)===result.levelIndex && r.bossDefeated && r.primary === result.primary && r.facility === result.facility), record = result.won && result.mode!=='bossTraining' && (!previousWins.length || result.time < Math.min(...previousWins.map(r => r.time)));
  history.push({ ...result, date: new Date().toISOString() }); history = history.slice(-50); save('blackout-results-v1', history);
  $('result-tag').textContent = result.mode==='bossTraining' ? 'BOSS TRAINING / 首领训练' : result.won ? record ? '✦ NEW RECORD / 成功撤离' : 'EXTRACTION COMPLETE' : 'SIGNAL LOST / 任务失败';
  $('result-symbol').textContent = result.won ? '↗' : '✕'; $('result-title').textContent = result.mode==='bossTraining' ? (result.won?'训练完成，守门者倒下。':'训练结束，再试一次。') : result.won ? '你等到了天亮。' : '信号，在这里中断。';
  $('result-description').textContent = result.mode==='bossTraining' ? '首领训练单独结算，不计入完整撤离纪录。' : result.won ? '走出了总站。下一次，试试另一种防守方式。' : `抵达第 ${Math.max(1, result.wave)} 波。调整枪械、倍率或路线，再试一次。`;
  const next=game.mode==='campaign'&&result.won&&game.levelIndex<LEVELS.length-1;
  $('next-level-button').hidden=!next;$('next-level-button').textContent=next?'继续第 '+(game.levelIndex+2)+' 关 · '+LEVELS[game.levelIndex+1].name+' →':'';
  $('retry-button').className=next?'secondary-button':'start-button';$('retry-button').textContent='重试本关 ↗';
  if(game.mode==='campaign'){
    const cleared=[...runResults,...(result.won?[result]:[])],all=cleared.length===3&&cleared.every((r,i)=>r.levelIndex===i);
    $('result-title').textContent=result.won?(all?'三关突破，天亮了。':game.level.name+' · 撤离成功'):'信号，在这里中断。';
    $('result-description').textContent=result.won?(next?'下一处撤离信号已定位。前往新区域时恢复生命与弹药，保留枪械和刀具选择。':all?'已连续完成三关，用时 '+formatTime(cleared.reduce((n,r)=>n+r.time,0))+'，总击杀 '+cleared.reduce((n,r)=>n+r.kills,0)+'。':'已通过最后区域。可从整备界面选择其他关卡或重试。'):'第 '+(game.levelIndex+1)+' 关 · '+game.level.name+' / 抵达第 '+Math.max(1,result.wave)+' 波。';
  }
  $('result-stats').replaceChildren();
  for (const [value, label] of [[formatTime(result.time), '本局用时'], [result.kills, '总击杀'], [result.headshots, '爆头击杀'], [result.facilityKills, '设施击杀'], [result.assists || 0, '设施助攻'], [result.meleeKills || 0, '近战击杀'], [result.accuracy + '%', '射击命中率']]) { const d = document.createElement('div'), strong = document.createElement('strong'), span = document.createElement('span'); strong.textContent = value; span.textContent = label; d.append(strong, span); $('result-stats').appendChild(d); }
  $('result-build').textContent = `${WEAPONS[result.primary].short} + ${MELEE[result.melee||'combat'].short} / ${OPTICS[result.optic].short} / ${facilityNames[result.facility] || '未接通设施'} / ${perkNames[result.perk] || '未获得强化'}`;
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
  $('chapter-label').textContent='0'+(game.levelIndex+1)+' / 03 · '+game.level.name;
  $('wave-label').textContent = ['bossIntro','boss'].includes(game.stage) ? 'BOSS / α' : game.wave ? `${String(game.wave).padStart(2, '0')} / 03` : '引导';
  $('remaining-label').textContent = ['bossIntro','boss'].includes(game.stage)?'最终首领':game.stage === 'wave' ? `${game.remaining} 个目标` : ['evac', 'escape'].includes(game.stage) ? '撤离阶段' : game.stage === 'tutorial' ? `${Math.max(0, Math.ceil(15 - game.stageTime))} 秒后开始` : '区域清空';
  [...$('wave-dots').children].forEach((dot, i) => { dot.classList.toggle('active', game.wave === i + 1 && game.stage === 'wave'); dot.classList.toggle('done', game.wave > i + 1 || game.wave === i + 1 && game.stage !== 'wave'); });
  $('objective-tag').textContent = game.stage === 'escape' ? '立即撤离' : game.stage === 'wave' ? '当前目标 / 保持移动' : '当前目标'; $('objective-text').textContent = game.objective;
  $('elapsed-time').textContent = formatTime(game.time); $('gate-progress').hidden = !['evac', 'escape'].includes(game.stage); $('gate-fill').style.width = (game.level.evacSeconds - game.gateTime) / game.level.evacSeconds * 100 + '%';
  $('hp-label').textContent = game.player.hp; $('hp-fill').style.width = game.player.hp + '%'; $('hp-fill').style.background = game.player.hp < 35 ? '#dd8b67' : '#b7cf91'; $('hp-status').textContent = game.player.hp < 35 ? 'CRITICAL / 寻找医疗补给' : 'VITALS STABLE';
  $('ammo-label').textContent = game.weapon==='melee'?'∞':String(game.ammo[game.weapon]).padStart(2, '0'); $('reserve-label').textContent = game.weapon==='melee' ? '近战' : game.weapon === 'pistol' ? '∞' : game.reserve;
  $('current-weapon').textContent = game.weaponInfo.short; $('reload-label').textContent = game.weapon==='melee' ? (game.meleeAction?`${game.meleeAction.type==='heavy'?'重击':'轻击'} · ${game.meleeAction.elapsed<game.meleeAction.windup?'蓄力':game.meleeAction.hitDone?'收势':'出刀'}`:'左键轻击 · 右键 / F 重击') : game.reloadTime > 0 ? `装填 ${game.reloadTime.toFixed(1)}s` : game.weapon === 'rifle' && game.primary === 'awm' && game.fireCooldown > .2 ? '拉栓中' : '';
  $('reload-fill').style.width = game.reloadTime > 0 ? (1 - game.reloadTime / game.reloadDuration) * 100 + '%' : '0%';
  $('grenade-count').textContent = game.grenades; $('grenade-button').disabled = game.grenades <= 0;
  $('cycle-optic').textContent = game.weapon==='melee'?'刀具':game.weapon === 'pistol' ? '铁瞄' : OPTICS[game.optic].short; $('cycle-optic').disabled = game.weapon !== 'rifle';
  const scoped = game.aiming && !game.frozen; $('scope-overlay').hidden = !scoped; $('scope-overlay').classList.toggle('red-optic', game.optic === 'red' || game.weapon === 'pistol'); $('scope-label').textContent = game.weapon === 'pistol' ? '铁瞄' : OPTICS[game.optic].short;
  $('reticle').hidden = scoped; $('aim-button').classList.toggle('active', game.aiming); $('aim-button').querySelector('small').textContent = game.weapon==='melee'?'重击':game.aiming ? '关镜' : '开镜';$('aim-button').setAttribute('aria-label',game.weapon==='melee'?'按住重击，消耗18体力':'开镜或关闭瞄准镜');
  $('interact-button').hidden = !game.interaction || game.frozen; $('interact-label').textContent = game.interaction;
  $('notice').textContent = game.notice; $('notice').classList.toggle('visible', game.noticeTime > 0 && !game.frozen && game.stage !== 'tutorial');
  $('facility-state').hidden = !game.facility; if (game.facility) { $('facility-name').textContent = facilityNames[game.facility]; $('facility-detail').textContent = game.facility === 'grid' ? `下次脉冲 ${Math.max(0, game.gridTimer).toFixed(1)}s` : `剩余 ${game.turretAmmo} / 120 发`; }
  const point = game.objectivePoint; $('objective-arrow').hidden = !point;
  if (point) { const angle = Math.atan2(point.x - game.player.x, -(point.z - game.player.z)) + game.player.yaw; $('objective-arrow').querySelector('span').style.transform = `rotate(${angle}rad)`; $('objective-distance').textContent = Math.round(distance(point, game.player)) + ' M'; }
  const target = game.weapon==='melee' ? (game.meleeTargets()[0]?{enemy:game.meleeTargets()[0]}:null) : game.trace().hits[0]; $('reticle').classList.toggle('on-target', !!target); $('target-label').textContent = target ? target.enemy.kind==='boss' ? (game.level.bossName+(game.boss?.exposed>0?' / 弱点暴露！':' / 护甲防守')) : target.enemy.kind === 'armor' ? '护甲目标 / 头部弱点' : target.enemy.kind === 'runner' ? '奔袭者' : '感染者' : '';
  $('hud-sound').setAttribute('aria-label', options.sound ? '关闭音效' : '开启音效'); $('hud-sound').style.opacity = options.sound ? '1' : '.45';
  const boss=game.boss;document.body.classList.toggle('boss-active',!!boss);$('boss-hud').hidden=!boss;
  if(boss){$('boss-title').textContent=game.level.bossName+' / 阶段 '+boss.phaseNumber+' · '+(boss.exposed>0?'弱点暴露':'护甲防守');$('boss-stagger').style.width=boss.stagger+'%';$('boss-hud').classList.toggle('exposed',boss.exposed>0);$('boss-health').textContent=Math.ceil(Math.max(0,boss.hp))+' / '+boss.maxHp;$('boss-fill').style.width=(boss.hp/boss.maxHp*100)+'%';$('boss-hud').classList.toggle('enraged',!!boss.enraged);$('boss-warning').textContent=game.bossStatus;}
  $('stamina-fill').style.width=game.player.stamina+'%';$('stamina-label').textContent=game.player.sprinting?'奔跑中':game.player.exhausted?'体力耗尽 · 恢复中':'体力 '+Math.round(game.player.stamina)+' / 100';$('sprint-button').classList.toggle('active',game.player.sprinting||toggleSprint);$('sprint-button').setAttribute('aria-pressed',String(toggleSprint));$('reload-button').disabled=game.weapon==='melee';$('aim-button').disabled=false;$('fire-button').querySelector('small').textContent=game.weapon==='melee'?'轻击':'射击';
  drawRadar();
}
function drawRadar() {
  const {obstacles:OBSTACLES,grid:GRID,turret:TURRET,portals:PORTALS}=game.level;
  const canvas = $('radar'), c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  c.clearRect(0, 0, w, h); c.fillStyle = '#0e2028bb'; c.fillRect(6, 5, w - 12, h - 16); c.strokeStyle = '#a3b38c40'; c.lineWidth = 1; c.strokeRect(6, 5, w - 12, h - 16);
  const px = x => 75 + x * 3.55, pz = z => 79 + z * 3.25;
  c.fillStyle = '#698279aa'; for (const o of OBSTACLES) c.fillRect(px(o.x1), pz(o.z1), (o.x2 - o.x1) * 3.55, (o.z2 - o.z1) * 3.25);
  if (game.facility === 'grid') { c.fillStyle = '#73d9e060'; c.fillRect(px(GRID.x1), pz(GRID.z1), (GRID.x2 - GRID.x1) * 3.55, (GRID.z2 - GRID.z1) * 3.25); }
  else if (game.facility === 'turret') { c.fillStyle = '#9bd3cf'; c.fillRect(px(TURRET.x) - 2, pz(TURRET.z) - 2, 4, 4); }
  for (const portal of PORTALS) { c.fillStyle = '#dba57a70'; c.fillRect(px(portal.x) - 2, pz(portal.z) - 2, 4, 4); }
  for (const e of game.enemies) { c.fillStyle = e.kind==='boss'?'#f19b7f':e.kind === 'runner' ? '#e99565' : e.kind === 'armor' ? '#c8d8ee' : '#b7c88b'; c.beginPath(); c.arc(px(e.x), pz(e.z), e.kind==='boss'?3:1.5, 0, TAU); c.fill(); }
  const target = game.objectivePoint; if (target) { c.strokeStyle = '#f1cb8c'; c.strokeRect(px(target.x) - 3, pz(target.z) - 3, 6, 6); }
  c.save(); c.translate(px(game.player.x), pz(game.player.z)); c.rotate(-game.player.yaw); c.fillStyle = '#f9d99e'; c.beginPath(); c.moveTo(0, -5); c.lineTo(-3.5, 4); c.lineTo(3.5, 4); c.closePath(); c.fill(); c.restore();
  c.fillStyle = '#b1c59e8a'; c.font = '7px Consolas,monospace'; c.textAlign = 'center'; c.fillText('N ↑ / '+game.level.name, 75, 166);
}
const TAU = Math.PI * 2;
function inputs() {
  return { x: joystickInput.x + Number(keys.has('d')) - Number(keys.has('a')), forward: joystickInput.forward + Number(keys.has('w')) - Number(keys.has('s')), turn: Number(keys.has('arrowleft')) - Number(keys.has('arrowright')), sprint:keys.has('shift')||toggleSprint,heavy:game?.weapon==='melee'&&(mouse.aim||keys.has('f')||manualHeavy),fire: mouse.fire || manualFire, autoFire: touchMode && options.auto, aim: game?.weapon!=='melee'&&(mouse.aim || toggleAim) };
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

const bladeIcons={combat:'M20 38 L62 8 55 30 28 44 20 60 13 56 19 42Z',karambit:'M19 52 C9 28 32 5 64 13 C37 18 29 35 33 47 L29 61 20 59Z',machete:'M13 48 L66 8 69 24 27 51 19 64 11 58Z',katana:'M12 56 Q30 24 68 6 Q42 37 27 53 L22 65 15 61Z',axe:'M24 61 L35 14 42 16 31 64Z M28 19 Q61 1 68 29 L42 36 30 29Z'};
for(const [index,level]of LEVELS.entries()){const button=document.createElement('button');button.dataset.level=index;button.setAttribute('aria-pressed',String(index===options.level));button.innerHTML=`<small>CHAPTER 0${index+1}</small><strong>${level.name}</strong><span>${level.subtitle}</span>`;button.addEventListener('click',()=>{options.level=index;view.setLevel(index);saveOptions();updateMenu();});$('level-options').append(button);}
for(const [id,m] of Object.entries(MELEE)){const button=document.createElement('button');button.dataset.melee=id;button.setAttribute('aria-pressed',String(id===options.melee));button.innerHTML=`<svg viewBox="0 0 80 70" aria-hidden="true"><path d="${bladeIcons[id]}"/></svg><strong>${m.name}</strong><small>${m.desc.split(' · ')[0]}</small>`;button.style.setProperty('--blade',m.color);button.addEventListener('click',()=>{options.melee=id;saveOptions();updateMenu();});$('melee-options').append(button);}
document.querySelectorAll('[data-weapon]').forEach(b => b.addEventListener('click', () => { options.primary = b.dataset.weapon; saveOptions(); updateMenu(); }));
document.querySelectorAll('[data-optic]').forEach(b => b.addEventListener('click', () => setOptic(b.dataset.optic)));
document.querySelectorAll('[data-pause-optic]').forEach(b => b.addEventListener('click', () => setOptic(b.dataset.pauseOptic)));
for (const id of ['quality-setting', 'pause-quality']) $(id).addEventListener('change', e => { options.quality = e.target.value; saveOptions(); view.setQuality(options.quality); updateMenu(); });
$('sound-setting').addEventListener('change', e => { options.sound = e.target.checked; sound.unlock(); sound.setMuted(); saveOptions(); });
$('auto-setting').addEventListener('change', e => { options.auto = e.target.checked; saveOptions(); });
$('start-button').addEventListener('click',()=>start());$('boss-training').addEventListener('click',()=>start('bossTraining'));  $('pause-button').addEventListener('click', () => pause()); $('resume-button').addEventListener('click', resume);
$('restart-button').addEventListener('click',()=>start(game?.mode,game?.levelIndex,true)); $('next-level-button').addEventListener('click',()=>{const next=game?.nextLevel();if(!next)return;runResults.push(game.result);start('campaign',next.levelIndex,true,next);});
$('retry-button').addEventListener('click',()=>start(game?.mode,game?.levelIndex,true)); $('back-menu').addEventListener('click', backToMenu); $('change-loadout').addEventListener('click', backToMenu);
$('skip-tutorial').addEventListener('click', () => { game?.skipTutorial(); requestPointer(); });
$('guide-button').addEventListener('click', () => $('guide-dialog').showModal()); $('close-guide').addEventListener('click', () => $('guide-dialog').close());
$('hud-sound').addEventListener('click', () => { options.sound = !options.sound; sound.unlock(); sound.setMuted(); saveOptions(); });
$('reload-button').addEventListener('click', () => game?.reload()); $('grenade-button').addEventListener('click', () => game?.throwGrenade()); $('switch-button').addEventListener('click', switchGun);
$('sprint-button').addEventListener('click',()=>{if(game&&!game.frozen)toggleSprint=!toggleSprint;});
$('jump-button').addEventListener('click', () => game?.jump());
$('aim-button').addEventListener('click', () => { if (game && !game.frozen && game.weapon!=='melee') toggleAim = !toggleAim; });
$('aim-button').addEventListener('pointerdown',event=>{if(!game||game.frozen||game.weapon!=='melee')return;event.preventDefault();manualHeavy=true;event.currentTarget.setPointerCapture(event.pointerId);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('aim-button').addEventListener(event,()=>{manualHeavy=false;});
$('interact-button').addEventListener('click', () => game?.interact());
$('cycle-optic').addEventListener('click', () => { if (game?.weapon === 'rifle') { const values = ['red', 'x4', 'x8']; setOptic(values[(values.indexOf(game.optic) + 1) % 3]); } });
document.addEventListener('keydown', event => {
  if (event.target.closest?.('input,select,textarea')) return;
  const key = event.key.toLowerCase(); if (!game || !['w', 'a', 's', 'd', ' ', 'q', 'r', 'e', 'g', '1', '2', '3', 'v', 'f', 'shift', 'p', 'escape', 'arrowleft', 'arrowright'].includes(key)) return; event.preventDefault();
  if (event.repeat) return;
  if (key === 'p') { if (game.paused) resume(); else pause(); return; }
  if (key === 'escape') { pause(); return; }
  if (game.frozen) return;
  if (key === ' ') game.jump();
  if (key === 'q' && game.weapon!=='melee') toggleAim = !toggleAim;
  if (key === 'r') game.reload(); if (key === 'g') game.throwGrenade(); if (key === 'e') game.interact(); if (key === '1') game.switchWeapon('rifle'); if (key === '2') game.switchWeapon('pistol'); if(key==='3'||key==='v'){game.switchWeapon('melee');toggleAim=false;} keys.add(key);
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
