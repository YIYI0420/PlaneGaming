(function () {
  'use strict';
  const { SEGMENT, ROAD_WIDTH, CAMERA_HEIGHT, CAMERA_DEPTH, PLAYER_Z, clamp, mod, mix, CARS } = Apex;
  const TAU = Math.PI * 2;
  const shade = (hex, factor) => '#' + hex.slice(1).match(/../g).map(s => clamp(Math.round(parseInt(s, 16) * factor), 0, 255).toString(16).padStart(2, '0')).join('');
  function poly(ctx, points, fill, stroke) {
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function ellipse(ctx, x, y, rx, ry, color) { if (rx <= 0 || ry <= 0) return; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fillStyle = color; ctx.fill(); }
  function roundRect(ctx, x, y, w, h, radius, color) { ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fillStyle = color; ctx.fill(); }
  function carSprite(ctx, x, y, width, config, options = {}) {
    const car = CARS.find(c => c.id === config.car), body = options.body || car?.body || 'sport';
    const color = config.color || '#c7f36a', h = width * (body === 'rally' ? .78 : .64), lean = options.steer || 0, time = options.time || 0;
    ctx.save(); ctx.translate(x, y); ctx.rotate(lean * .035); ctx.scale(width / 200, h / 125);
    ellipse(ctx, 0, 0, 116, 17, '#00000050');
    if (config.skin === 'neon') { ctx.shadowColor = color; ctx.shadowBlur = 14; ellipse(ctx, 0, -3, 94, 6, color + '70'); ctx.shadowBlur = 0; }
    if (options.boost) {
      for (const side of [-1, 1]) { const flame = 25 + Math.sin(time * 54) * 14; poly(ctx, [[side * 50 - 8, -8], [side * 50, flame], [side * 50 + 8, -8]], '#81e3ff90'); poly(ctx, [[side * 50 - 4, -8], [side * 50, flame * .7], [side * 50 + 4, -8]], '#e8ffff'); }
    }
    ctx.fillStyle = '#10181f'; ctx.fillRect(-101, -49, 27, 45); ctx.fillRect(74, -49, 27, 45);
    if (config.wheels === 'rally') { ctx.strokeStyle = '#8b9292'; ctx.lineWidth = 3; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-99, -42 + i * 8); ctx.lineTo(-79, -47 + i * 8); ctx.stroke(); ctx.beginPath(); ctx.moveTo(79, -42 + i * 8); ctx.lineTo(99, -47 + i * 8); ctx.stroke(); } }
    const tip = body === 'hyper' ? -129 : body === 'rally' ? -118 : -124;
    poly(ctx, [[-93, -6], [-97, -46], [-67, -85], [-48, tip], [48, tip], [67, -85], [97, -46], [93, -6]], shade(color, .7), shade(color, 1.13));
    poly(ctx, [[-91, -44], [-64, -89], [-45, tip], [45, tip], [64, -89], [91, -44]], color);
    poly(ctx, [[-62, -82], [-45, tip + 8], [45, tip + 8], [62, -82]], '#263e48', '#91aeb2');
    poly(ctx, [[-52, -86], [-38, tip + 15], [35, tip + 15], [47, -86]], '#b8e0e21a');
    poly(ctx, [[-85, -41], [-61, -75], [61, -75], [85, -41]], config.skin === 'carbon' ? '#243031' : shade(color, .92));
    if (config.skin === 'stripe') { poly(ctx, [[-9, -43], [-7, -79], [-2, -116], [7, -116], [11, -79], [13, -43]], '#101c1ecc'); }
    if (config.skin === 'racing') { poly(ctx, [[-60, -44], [-20, -79], [6, -79], [-32, -44]], '#f2f5e8'); poly(ctx, [[-33, -44], [8, -79], [18, -79], [-22, -44]], '#101c20'); }
    if (config.skin === 'carbon') { ctx.strokeStyle = '#8ca2a729'; ctx.lineWidth = 1; for (let i = -60; i < 60; i += 9) { ctx.beginPath(); ctx.moveTo(i, -44); ctx.lineTo(i + 23, -73); ctx.stroke(); } }
    poly(ctx, [[-91, -42], [91, -42], [90, -14], [69, -5], [-69, -5], [-90, -14]], shade(color, .63));
    poly(ctx, [[-76, -38], [76, -38], [70, -25], [-70, -25]], '#172329');
    ctx.fillStyle = '#fa7775'; ctx.shadowColor = '#ff5656'; ctx.shadowBlur = options.brake ? 16 : 6;
    ctx.fillRect(-82, -34, 37, options.brake ? 9 : 6); ctx.fillRect(45, -34, 37, options.brake ? 9 : 6); ctx.shadowBlur = 0;
    poly(ctx, [[-71, -16], [71, -16], [50, -6], [-50, -6]], '#111b23');
    for (const px of [-44, -22, 0, 22, 44]) poly(ctx, [[px - 3, -15], [px + 3, -15], [px + 1, -3], [px - 1, -3]], '#32444a');
    ctx.fillStyle = '#c9d1c8'; ctx.fillRect(-15, -24, 30, 10); ctx.fillStyle = '#263a3a'; ctx.font = 'bold 6px monospace'; ctx.textAlign = 'center'; ctx.fillText('APEX', 0, -17);
    if (body !== 'electric') { ctx.fillStyle = '#384449'; ctx.fillRect(-69, -11, 19, 9); ctx.fillRect(50, -11, 19, 9); ctx.fillStyle = '#11181e'; ctx.fillRect(-66, -9, 13, 5); ctx.fillRect(53, -9, 13, 5); }
    if (body === 'hyper' || body === 'rally') { ctx.fillStyle = '#192629'; ctx.fillRect(-62, -65, 8, 19); ctx.fillRect(54, -65, 8, 19); poly(ctx, [[-107, -68], [107, -68], [99, -58], [-99, -58]], shade(color, .42), shade(color, .9)); }
    ctx.restore();
  }
  function garageCar(ctx, config, width, height, time) {
    ctx.clearRect(0, 0, width, height);
    const car = CARS.find(c => c.id === config.car), color = config.color;
    const cx = width * .5, cy = height * .55, scale = Math.min(width / 6.8, height / 4.1);
    const yaw = -.57 + Math.sin(time * .23) * .07, cos = Math.cos(yaw), sin = Math.sin(yaw);
    const project = ([x, y, z]) => [cx + (x * cos - z * sin) * scale, cy + (x * sin + z * cos) * scale * .43 - y * scale];
    const face = (verts, fill, stroke) => poly(ctx, verts.map(project), fill, stroke);
    ctx.strokeStyle = '#b1cc8610'; ctx.lineWidth = 1;
    for (let i = -8; i <= 8; i++) { const a = project([i, -.1, -8]), b = project([i, -.1, 8]); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); const c = project([-8, -.1, i]), d = project([8, -.1, i]); ctx.beginPath(); ctx.moveTo(...c); ctx.lineTo(...d); ctx.stroke(); }
    ellipse(ctx, cx, cy + scale * .85, scale * 2.7, scale * .8, '#080f0870');
    ctx.strokeStyle = '#b9de7c24'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, cy + scale * .82, scale * 2.65, scale * .78, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#c7f36a80'; ctx.beginPath(); ctx.ellipse(cx, cy + scale * .82, scale * 2.65, scale * .78, 0, .25, 1.12); ctx.stroke();
    ellipse(ctx, cx + scale * .13, cy + scale * .35, scale * 1.9, scale * .65, '#030a08a0');
    const long = car.body === 'hyper' ? 2.05 : car.body === 'rally' ? 1.72 : 1.9;
    const high = car.body === 'rally' ? .64 : .47;
    function wheel(x, z) {
      const p = project([x, .18, z]);
      ctx.save(); ctx.translate(...p); ctx.rotate(-.13); ellipse(ctx, 0, 0, scale * .20, scale * .34, '#0a1116'); ellipse(ctx, -1, -1, scale * .14, scale * .25, '#81918e'); ellipse(ctx, -1, -1, scale * .11, scale * .21, config.wheels === 'aero' ? '#adbcb3' : '#1b2b30');
      const spokes = config.wheels === 'rally' ? 8 : 5;
      if (config.wheels !== 'aero') { ctx.strokeStyle = '#a6b5ad'; ctx.lineWidth = scale * .025; for (let i = 0; i < spokes; i++) { const a = i / spokes * TAU + .2; ctx.beginPath(); ctx.moveTo(-1, -1); ctx.lineTo(Math.cos(a) * scale * .12, Math.sin(a) * scale * .22); ctx.stroke(); } }
      ellipse(ctx, -1, -1, scale * .035, scale * .06, color); ctx.restore();
    }
    wheel(1.02, -1.13); wheel(1.02, 1.12);
    const frontWidth = car.body === 'hyper' ? .85 : .94;
    face([[-frontWidth, .15, -long], [frontWidth, .15, -long], [1.02, .15, long], [-1.02, .15, long]], '#172322');
    face([[-frontWidth, .15, -long], [-1.02, .15, long], [-.95, high, long - .1], [-frontWidth, high, -long + .12]], shade(color, .6));
    face([[frontWidth, .15, -long], [frontWidth, high, -long + .12], [.95, high, long - .1], [1.02, .15, long]], shade(color, .68));
    face([[-frontWidth, high, -long + .12], [-.95, high, long - .1], [.95, high, long - .1], [frontWidth, high, -long + .12]], color, shade(color, 1.15));
    face([[-.95, high, long - .1], [-1.02, .15, long], [1.02, .15, long], [.95, high, long - .1]], shade(color, .7));
    face([[-frontWidth, .15, -long], [-frontWidth, high, -long + .12], [frontWidth, high, -long + .12], [frontWidth, .15, -long]], shade(color, .8));
    const roofHeight = car.body === 'rally' ? 1.2 : .98;
    face([[-.72, high, -.72], [-.5, roofHeight, -.27], [.5, roofHeight, -.27], [.72, high, -.72]], '#9dc7cf', '#b9dbe0');
    face([[-.72, high, -.72], [-.68, high, .92], [-.5, roofHeight, .55], [-.5, roofHeight, -.27]], '#203b44', '#63898f');
    face([[.72, high, -.72], [.5, roofHeight, -.27], [.5, roofHeight, .55], [.68, high, .92]], '#1c333c', '#63898f');
    face([[-.68, high, .92], [.68, high, .92], [.5, roofHeight, .55], [-.5, roofHeight, .55]], '#2e4b53');
    face([[-.5, roofHeight, -.27], [-.5, roofHeight, .55], [.5, roofHeight, .55], [.5, roofHeight, -.27]], config.skin === 'carbon' ? '#253430' : shade(color, .9), shade(color, 1.12));
    if (config.skin === 'stripe' || config.skin === 'racing') {
      const stripe = config.skin === 'racing' ? '#f1f3df' : '#142c27';
      face([[-.12, high + .012, -long + .13], [-.12, high + .012, -.75], [.12, high + .012, -.75], [.12, high + .012, -long + .13]], stripe);
      face([[-.12, roofHeight + .012, -.27], [-.12, roofHeight + .012, .55], [.12, roofHeight + .012, .55], [.12, roofHeight + .012, -.27]], stripe);
      face([[-.12, high + .012, .94], [-.12, high + .012, long - .1], [.12, high + .012, long - .1], [.12, high + .012, .94]], stripe);
    }
    if (config.skin === 'neon') { face([[1.025, .19, -1.5], [1.025, .19, 1.5], [1.025, .24, 1.5], [1.025, .24, -1.5]], '#baf7ef'); face([[-frontWidth, .2, -long - .01], [frontWidth, .2, -long - .01], [frontWidth, .25, -long - .01], [-frontWidth, .25, -long - .01]], '#e9ffd5'); }
    if (config.skin === 'carbon') for (let j = 0; j < 8; j++) face([[.19, high + .013, -1.7 + j * .11], [.7, high + .013, -1.7 + j * .11], [.7, high + .013, -1.66 + j * .11], [.19, high + .013, -1.66 + j * .11]], '#365044');
    face([[-.79, high - .06, -long - .01], [-.34, high - .06, -long - .01], [-.34, high - .16, -long - .01], [-.79, high - .16, -long - .01]], '#e9fff3');
    face([[.34, high - .06, -long - .01], [.79, high - .06, -long - .01], [.79, high - .16, -long - .01], [.34, high - .16, -long - .01]], '#e9fff3');
    face([[-.28, .27, -long - .012], [.28, .27, -long - .012], [.35, .17, -long - .012], [-.35, .17, -long - .012]], '#152326');
    if (car.body !== 'electric') {
      face([[-.9, high + .14, long - .35], [.9, high + .14, long - .35], [1.03, high + .14, long - .06], [-1.03, high + .14, long - .06]], '#293c2b', shade(color, .8));
    }
    wheel(-1.02, -1.13); wheel(-1.02, 1.12);
    const lineStart = project([1.1, high, .1]); ctx.strokeStyle = '#d1ef8b44'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(...lineStart); ctx.lineTo(width * .86, height * .59); ctx.lineTo(width * .93, height * .59); ctx.stroke();
    ctx.fillStyle = '#a7ba8a'; ctx.font = '7px Consolas,monospace'; ctx.textAlign = 'right'; ctx.fillText('CUSTOM / ' + String(config.engine) + String(config.turbo) + String(config.tires), width * .93, height * .59 - 6);
  }
  class Renderer {
    constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.width = 1280; this.height = 720; this.projected = []; this.rain = Array.from({ length: 65 }, (_, i) => ({ x: (i * .61803) % 1, y: (i * .377) % 1, size: (i % 3 + 1) })); this.resize(); }
    resize() { const rect = this.canvas.getBoundingClientRect(); this.width = Math.max(1, rect.width); this.height = Math.max(1, rect.height); const dpr = Math.min(window.devicePixelRatio || 1, 1.5); this.canvas.width = Math.round(this.width * dpr); this.canvas.height = Math.round(this.height * dpr); }
    project(x, y, z, cameraX, cameraY, cameraZ) {
      const depth = z - cameraZ, scale = CAMERA_DEPTH / Math.max(.001, depth);
      return { z: depth, scale, x: this.width * .5 + scale * (x - cameraX) * this.width * .5, y: this.height * .44 - scale * (y - cameraY) * this.height * .5, w: scale * ROAD_WIDTH * this.width * .5 };
    }
    backdrop(race, clock) {
      const c = this.ctx, w = this.width, h = this.height, meta = race.track, horizon = h * .45;
      const sky = c.createLinearGradient(0, 0, 0, horizon + h * .1); sky.addColorStop(0, meta.sky[0]); sky.addColorStop(1, meta.sky[1]); c.fillStyle = sky; c.fillRect(0, 0, w, h);
      const scroll = race.distance * .000025 + race.x * .02;
      if (meta.scenery === 'city') {
        for (let i = 0; i < 65; i++) { c.fillStyle = '#c9ddff77'; c.fillRect(mod(i * 133.7 + scroll * 10, w), (i * 33.2) % (h * .3), i % 3 === 0 ? 2 : 1, 1); }
        ellipse(c, w * .73, h * .16, h * .035, h * .035, '#cbd4ec'); ellipse(c, w * .74, h * .15, h * .034, h * .034, meta.sky[0]);
        for (let i = -2; i < 24; i++) {
          const x = mod(i * w / 20 - scroll * 120, w + 150) - 75, bh = (Math.sin(i * 7.3) * .5 + .5) * h * .23 + 30, bw = w / 26;
          c.fillStyle = i % 2 === 0 ? '#171b3c' : '#20244c'; c.fillRect(x, horizon - bh, bw, bh + 20);
          c.fillStyle = i % 3 === 0 ? '#ba83ea70' : '#66c8e555'; for (let yy = horizon - bh + 10; yy < horizon; yy += 12) for (let xx = x + 4; xx < x + bw - 3; xx += 8) if (Math.sin(xx + yy) > -.1) c.fillRect(xx, yy, 2, 4);
          c.fillStyle = '#e194ce70'; c.fillRect(x + bw * .5, horizon - bh - 15, 1, 15);
        }
      } else {
        const sunColor = meta.scenery === 'canyon' ? '#ffdb9d' : '#f5f4d4';
        const sun = c.createRadialGradient(w * .78, h * .22, 5, w * .78, h * .22, h * .17); sun.addColorStop(0, sunColor + 'bb'); sun.addColorStop(1, sunColor + '00'); c.fillStyle = sun; c.fillRect(w * .78 - h * .2, h * .02, h * .4, h * .4); ellipse(c, w * .78, h * .22, h * .052, h * .052, sunColor);
        for (let layer = 0; layer < 3; layer++) {
          const points = [[0, horizon + 50]];
          for (let x = 0; x <= w + 20; x += 20) { const t = x / w * 9 + scroll * (layer + 1) * .2; let y = horizon - (Math.sin(t + layer * 2) * .5 + Math.sin(t * 2.3 + layer) * .25 + .75) * h * (.10 + layer * .035); points.push([x, y]); }
          points.push([w + 20, horizon + 50]); const colors = meta.scenery === 'alpine' ? ['#a6b9c9', '#91a9bc', '#718ba3'] : meta.scenery === 'canyon' ? ['#bb8179', '#9a5e66', '#784a58'] : ['#8bb8bd', '#6ea9ac', '#528f96']; poly(c, points, colors[layer]);
          if (meta.scenery === 'alpine' && layer === 1) for (let i = 1; i < points.length - 2; i++) if (points[i][1] < h * .30) poly(c, [[points[i][0] - 17, points[i][1] + 18], points[i], [points[i][0] + 17, points[i][1] + 18], [points[i][0] + 5, points[i][1] + 12], [points[i][0] - 5, points[i][1] + 16]], '#e6eff1');
        }
        if (meta.scenery === 'coast') { c.fillStyle = '#58aebd'; c.fillRect(0, horizon - 5, w, h * .22); c.strokeStyle = '#bdedf04a'; for (let i = 0; i < 10; i++) { const y = horizon + i * i * .8; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } }
      }
      c.fillStyle = meta.ground[0]; c.fillRect(0, h * .56, w, h * .44);
    }
    road(race) {
      const c = this.ctx, w = this.width, h = this.height, track = race.track, pos = race.position;
      const base = Math.floor(pos / SEGMENT), percent = (pos % SEGMENT) / SEGMENT;
      const playerSegment = race.segmentAt(pos + PLAYER_Z), playerPercent = mod(pos + PLAYER_Z, SEGMENT) / SEGMENT;
      const cameraY = mix(playerSegment.y1, playerSegment.y2, playerPercent) + CAMERA_HEIGHT;
      let x = 0, dx = -track.segments[base].curve * percent, maxY = h;
      this.projected = [];
      for (let n = 0; n < 165; n++) {
        const index = (base + n) % track.segments.length, seg = track.segments[index], loop = index < base;
        const z1 = index * SEGMENT, z2 = (index + 1) * SEGMENT, cameraZ = pos - (loop ? track.length : 0);
        const p1 = this.project(0, seg.y1, z1, race.x * ROAD_WIDTH - x, cameraY, cameraZ);
        const p2 = this.project(0, seg.y2, z2, race.x * ROAD_WIDTH - x - dx, cameraY, cameraZ);
        x += dx; dx += seg.curve;
        const clip = maxY;
        if (p1.z <= 0 || p2.y >= maxY || p2.y >= p1.y) { this.projected.push({ index, p1, p2, seg, visible: false, clip }); continue; }
        c.fillStyle = track.ground[Math.floor(index / 4) % 2]; c.fillRect(0, p2.y, w, Math.min(p1.y, h) - p2.y + 1);
        if (track.scenery === 'coast') { c.fillStyle = '#46a4b6'; c.fillRect(0, p2.y, Math.max(0, p2.x - p2.w * 1.6), Math.min(p1.y, h) - p2.y + 1); }
        const edge = Math.floor(index / 3) % 2 ? (track.scenery === 'city' ? '#7f75a6' : '#e6dbce') : (track.scenery === 'alpine' ? '#6799b5' : '#d77d6e');
        poly(c, [[p1.x - p1.w * 1.1, p1.y], [p1.x + p1.w * 1.1, p1.y], [p2.x + p2.w * 1.1, p2.y], [p2.x - p2.w * 1.1, p2.y]], edge);
        poly(c, [[p1.x - p1.w, p1.y], [p1.x + p1.w, p1.y], [p2.x + p2.w, p2.y], [p2.x - p2.w, p2.y]], track.road[Math.floor(index / 3) % 2]);
        for (const side of [-1, 1]) poly(c, [[p1.x + side * p1.w * .96 - p1.w * .006, p1.y], [p1.x + side * p1.w * .96 + p1.w * .006, p1.y], [p2.x + side * p2.w * .96 + p2.w * .006, p2.y], [p2.x + side * p2.w * .96 - p2.w * .006, p2.y]], '#d8e8e6a0');
        if (Math.floor(index / 4) % 2 === 0) for (const lane of [-1 / 3, 1 / 3]) poly(c, [[p1.x + p1.w * (lane - .006), p1.y], [p1.x + p1.w * (lane + .006), p1.y], [p2.x + p2.w * (lane + .006), p2.y], [p2.x + p2.w * (lane - .006), p2.y]], '#d9e1de9c');
        if (index === Math.floor(PLAYER_Z / SEGMENT) || index === Math.floor(PLAYER_Z / SEGMENT) + 1) for (let i = 0; i < 16; i++) poly(c, [[p1.x + p1.w * (-1 + i / 8), p1.y], [p1.x + p1.w * (-1 + (i + 1) / 8), p1.y], [p2.x + p2.w * (-1 + (i + 1) / 8), p2.y], [p2.x + p2.w * (-1 + i / 8), p2.y]], (i + index) % 2 ? '#e6ece7' : '#263036');
        if (race.weather === 'rain' && Math.floor(index / 9) % 3 === 0) poly(c, [[p1.x - p1.w * .7, p1.y], [p1.x + p1.w * .5, p1.y], [p2.x + p2.w * .7, p2.y], [p2.x - p2.w * .4, p2.y]], '#adcde410');
        if (n > 85) { c.globalAlpha = Math.pow((n - 85) / 80, 2) * .75; poly(c, [[p1.x - p1.w * 1.1, p1.y], [p1.x + p1.w * 1.1, p1.y], [p2.x + p2.w * 1.1, p2.y], [p2.x - p2.w * 1.1, p2.y]], track.sky[1]); c.globalAlpha = 1; }
        this.projected.push({ index, p1, p2, seg, visible: true, clip }); maxY = p2.y;
      }
      const botSegments = new Map();
      for (const bot of race.bots) { const z = mod(bot.distance + PLAYER_Z, track.length), index = Math.floor(z / SEGMENT); if (!botSegments.has(index)) botSegments.set(index, []); botSegments.get(index).push({ bot, percent: z % SEGMENT / SEGMENT }); }
      for (let i = this.projected.length - 1; i >= 0; i--) {
        const p = this.projected[i]; if (p.p1.z <= 0 || p.p1.y > h * 1.4 || p.p1.w < 1) continue;
        c.save(); c.beginPath(); c.rect(0, 0, w, Math.min(h, p.clip)); c.clip();
        if (p.seg.index % 14 === 0) this.scenery(track.scenery, p.p1.x + p.p1.w * 1.5, p.p1.y, p.p1.w * .44, p.seg.scenery, race.time);
        if (p.seg.index % 19 === 0) this.scenery(track.scenery, p.p1.x - p.p1.w * 1.5, p.p1.y, p.p1.w * .48, p.seg.scenery + 5, race.time);
        if (Math.abs(p.seg.curve) > .45 && p.seg.index % 45 === 0) this.sign(p.p1.x + p.p1.w * (p.seg.curve > 0 ? -1.22 : 1.22), p.p1.y, p.p1.w * .25, p.seg.curve);
        const cars = botSegments.get(p.index);
        if (cars) for (const { bot, percent: t } of cars.sort((a, b) => b.percent - a.percent)) {
          const carX = mix(p.p1.x, p.p2.x, t) + mix(p.p1.w, p.p2.w, t) * bot.x, carY = mix(p.p1.y, p.p2.y, t), carW = mix(p.p1.w, p.p2.w, t) * .19;
          if (carW > 1 && carY <= h + carW) carSprite(c, carX, carY, carW, { color: bot.color, skin: 'stripe', wheels: 'sport' }, { body: bot.body, time: race.time });
        }
        c.restore();
      }
    }
    sign(x, y, size, curve) { const c = this.ctx; if (size < 3 || size > this.width) return; c.fillStyle = '#68757a'; c.fillRect(x - size * .04, y - size * 1.3, size * .08, size * 1.3); roundRect(c, x - size * .7, y - size * 1.5, size * 1.4, size * .65, size * .04, '#eac75a'); c.fillStyle = '#353b36'; c.font = `bold ${size * .52}px monospace`; c.textAlign = 'center'; c.fillText(curve > 0 ? '››' : '‹‹', x, y - size * 1.01); }
    scenery(type, x, y, size, seed, time) {
      const c = this.ctx; if (size < 2 || size > this.width * 2 || x < -size * 2 || x > this.width + size * 2 || y < 0) return;
      if (type === 'coast') {
        poly(c, [[x - size * .05, y], [x + size * .06, y], [x + size * .23, y - size * 1.65], [x + size * .14, y - size * 1.65]], '#6d7f58');
        const top = [x + size * .18, y - size * 1.65];
        for (let i = 0; i < 6; i++) { const angle = i / 6 * TAU; poly(c, [top, [top[0] + Math.cos(angle) * size * .9, top[1] + Math.sin(angle) * size * .42 + size * .2], [top[0] + Math.cos(angle + .2) * size * .47, top[1] + Math.sin(angle + .2) * size * .28 - size * .09]], i % 2 ? '#397b64' : '#4a9472'); }
      } else if (type === 'city') {
        const bw = size * .9, bh = size * (2.2 + seed % 5 * .25);
        poly(c, [[x - bw * .5, y], [x - bw * .5, y - bh], [x + bw * .5, y - bh - size * .2], [x + bw * .5, y]], '#222a42', '#425174');
        for (let row = 0; row < 8; row++) for (let col = 0; col < 3; col++) { c.fillStyle = (row + col + seed) % 3 === 0 ? '#c388da75' : '#78b7df50'; c.fillRect(x - bw * .37 + col * bw * .28, y - bh + size * .15 + row * bh * .105, bw * .14, bh * .04); }
        c.fillStyle = seed % 2 ? '#c789ff' : '#6ce5de'; c.shadowBlur = Math.min(12, size * .1); c.shadowColor = c.fillStyle; c.fillRect(x - bw * .5, y - bh * .55, bw, size * .14); c.shadowBlur = 0;
      } else if (type === 'canyon') {
        poly(c, [[x - size, y], [x - size * .8, y - size * 1.7], [x - size * .35, y - size * 2.3], [x + size * .25, y - size * 2.25], [x + size * .8, y - size * 1.5], [x + size, y]], '#955343');
        poly(c, [[x - size * .35, y - size * 2.3], [x + size * .25, y - size * 2.25], [x + size * .8, y - size * 1.5], [x + size, y], [x + size * .1, y]], '#bc7755');
        c.strokeStyle = '#663e3d44'; c.lineWidth = Math.max(1, size * .025); for (let j = 0; j < 4; j++) { c.beginPath(); c.moveTo(x - size * .8, y - size * (.3 + j * .4)); c.lineTo(x + size * .75, y - size * (.25 + j * .4)); c.stroke(); }
      } else {
        c.fillStyle = '#60706d'; c.fillRect(x - size * .07, y - size * .4, size * .14, size * .4);
        for (let i = 0; i < 3; i++) { const yy = y - size * (.1 + i * .5), half = size * (.7 - i * .16); poly(c, [[x - half, yy], [x, yy - size * 1.1], [x + half, yy]], '#4b7373'); poly(c, [[x - half * .75, yy - size * .24], [x, yy - size * 1.1], [x + half * .65, yy - size * .32], [x + half * .1, yy - size * .42]], '#e1ecec'); }
      }
    }
    render(race, clock) {
      const c = this.ctx, w = this.width, h = this.height; c.setTransform(this.canvas.width / w, 0, 0, this.canvas.height / h, 0, 0);
      this.backdrop(race, clock); this.road(race);
      const carW = Math.min(w * .19, h * .29, 220), carX = w * .5 + race.lastSteer * carW * .1 + (race.drifting ? race.driftDirection * carW * .12 : 0), carY = h * (w < 600 ? .80 : .88);
      if (race.drifting) {
        for (let i = 0; i < 10; i++) { const t = mod(clock * 1.5 + i * .1, 1); c.globalAlpha = (1 - t) * .27; ellipse(c, carX + (i % 2 ? 1 : -1) * carW * .42 + race.driftDirection * t * 40, carY + t * 65, carW * (.08 + t * .25), carW * (.05 + t * .12), '#e3edf0'); } c.globalAlpha = 1;
        c.strokeStyle = '#16242d55'; c.lineWidth = carW * .075; for (const side of [-1, 1]) { c.beginPath(); c.moveTo(carX + side * carW * .4, carY); c.lineTo(carX + side * carW * .4 + race.lastSteer * 35, h); c.stroke(); }
      }
      const bounce = race.offroad ? Math.sin(clock * 53) * h * .004 : Math.sin(clock * 18) * race.speed / race.stats.maxSpeed * .8;
      carSprite(c, carX, carY + bounce, carW, race.config, { steer: race.lastSteer * (race.drifting ? 4 : 1), time: clock, boost: race.boosting, brake: race.braking });
      if (race.boosting) {
        c.strokeStyle = '#e7fcff55'; c.lineWidth = 1;
        for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, r = mod(clock * 1.4 + i * .09, 1), cx = w * .5, cy = h * .45; c.beginPath(); c.moveTo(cx + Math.cos(a) * w * (.4 + r * .4), cy + Math.sin(a) * h * (.4 + r * .4)); c.lineTo(cx + Math.cos(a) * w * (.42 + r * .45), cy + Math.sin(a) * h * (.42 + r * .45)); c.stroke(); }
      }
      if (race.weather === 'rain' || race.weather === 'snow') {
        c.fillStyle = race.weather === 'rain' ? '#24375526' : '#d7e8f00a'; c.fillRect(0, 0, w, h);
        c.strokeStyle = '#d2efff65'; c.lineWidth = 1;
        for (const p of this.rain) { const x = mod(p.x * w + clock * (race.weather === 'rain' ? -130 : 20), w), y = mod(p.y * h + clock * (race.weather === 'rain' ? 850 : 75) * (.5 + p.size * .25), h); if (race.weather === 'rain') { c.beginPath(); c.moveTo(x, y); c.lineTo(x - 5, y + 18); c.stroke(); } else ellipse(c, x, y, p.size, p.size, '#f1fcffb0'); }
      }
      if (race.flash > 0) { c.fillStyle = '#ffa477' + Math.round(race.flash * 150).toString(16).padStart(2, '0'); c.fillRect(0, 0, w, h); }
      const vignette = c.createRadialGradient(w / 2, h / 2, h * .3, w / 2, h / 2, Math.max(w, h) * .7); vignette.addColorStop(0, '#00000000'); vignette.addColorStop(1, '#030b224a'); c.fillStyle = vignette; c.fillRect(0, 0, w, h);
    }
  }
  function miniPoint(t, w, h, seed = 0) {
    const a = t * TAU - Math.PI / 2, r = 1 + Math.sin(a * 3 + seed) * .13 + Math.sin(a * 5 + seed) * .07;
    return [w * .5 + Math.cos(a) * w * .35 * r, h * .5 + Math.sin(a) * h * .33 * r];
  }
  function drawMiniMap(canvas, race) {
    const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height, seed = ['coast', 'city', 'canyon', 'alpine'].indexOf(race.track.id);
    c.clearRect(0, 0, w, h); c.beginPath(); for (let i = 0; i <= 120; i++) { const p = miniPoint(i / 120, w, h, seed); if (i) c.lineTo(...p); else c.moveTo(...p); }
    c.closePath(); c.strokeStyle = '#0c1c2d66'; c.lineWidth = 9; c.stroke(); c.strokeStyle = '#e1ede59c'; c.lineWidth = 3; c.stroke();
    race.bots.forEach(bot => { const p = miniPoint(mod(bot.distance / race.track.length, 1), w, h, seed); ellipse(c, ...p, 2.5, 2.5, bot.color); });
    const p = miniPoint(mod(race.distance / race.track.length, 1), w, h, seed); c.shadowColor = '#c7f36a'; c.shadowBlur = 9; ellipse(c, ...p, 4, 4, '#c7f36a'); c.shadowBlur = 0;
    c.fillStyle = '#ffffff77'; c.font = '7px Consolas,monospace'; c.textAlign = 'center'; c.fillText('赛道示意图', w / 2, h - 2);
  }
  function mapThumbnail(canvas, map) {
    const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    const sky = c.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, map.sky[0]); sky.addColorStop(1, map.sky[1]); c.fillStyle = sky; c.fillRect(0, 0, w, h);
    if (map.scenery !== 'city') ellipse(c, w * .72, h * .30, h * .12, h * .12, '#fff1bd');
    for (let layer = 0; layer < 2; layer++) {
      const p = [[0, h]]; for (let x = 0; x <= w; x += 10) p.push([x, h * (.48 + layer * .08) - Math.sin(x / w * 8 + layer * 2) * h * .15 - Math.sin(x / w * 21) * h * .04]); p.push([w, h]); poly(c, p, map.scenery === 'alpine' ? layer ? '#96aeb9' : '#d6e7e9' : map.scenery === 'canyon' ? layer ? '#a15a4a' : '#c88b6b' : map.scenery === 'city' ? layer ? '#28284c' : '#38325c' : layer ? '#609d9b' : '#7ab6bb');
    }
    c.fillStyle = map.ground[0]; c.fillRect(0, h * .72, w, h * .28);
    if (map.scenery === 'coast') { c.fillStyle = '#49aabd'; c.fillRect(0, h * .57, w * .55, h * .43); }
    if (map.scenery === 'city') for (let i = 0; i < 13; i++) { const bh = (Math.sin(i * 5) * .5 + .7) * h * .6; c.fillStyle = i % 2 ? '#282341' : '#1c2340'; c.fillRect(i * w / 12, h * .75 - bh, w / 17, bh); c.fillStyle = '#d397ee80'; for (let j = 0; j < 5; j++) c.fillRect(i * w / 12 + 5, h * .75 - bh + 7 + j * 10, w / 30, 2); }
    const horizon = h * .55;
    for (let i = 0; i < 60; i++) { const t = i / 60, t2 = (i + 1) / 60, y = horizon + t * t * (h - horizon), y2 = horizon + t2 * t2 * (h - horizon), center = w * (.5 + Math.sin(t * 3.4 + 1) * .17), center2 = w * (.5 + Math.sin(t2 * 3.4 + 1) * .17), rw = 2 + t * w * .4, rw2 = 2 + t2 * w * .4; poly(c, [[center - rw, y], [center + rw, y], [center2 + rw2, y2], [center2 - rw2, y2]], i % 6 < 3 ? '#e1d4b7' : '#c17d6b'); poly(c, [[center - rw * .9, y], [center + rw * .9, y], [center2 + rw2 * .9, y2], [center2 - rw2 * .9, y2]], map.road[Math.floor(i / 5) % 2]); if (i % 8 < 4) poly(c, [[center - rw * .015, y], [center + rw * .015, y], [center2 + rw2 * .015, y2], [center2 - rw2 * .015, y2]], '#e3ece2'); }
  }
  window.ApexRender = { Renderer, garageCar, carSprite, drawMiniMap, mapThumbnail };
})();
