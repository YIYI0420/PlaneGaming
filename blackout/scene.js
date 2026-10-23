import { applyMeleePose } from './melee-pose.js?v=4';
import * as THREE from './vendor/three.module.min.js';
import { applyWeaponPose, applyCameraPose, RED_SIGHT_CENTER, QUALITY } from './presentation.js?v=4';
import { beveledBox, upgradeEnvironment, applyQuality } from './graphics.js?v=4';
import { buildMeleeModels, updateMeleeArms, spawnBossActor, BossEffects } from './combat-visuals.js?v=4';
const B = window.Blackout;
const { OBSTACLES, GRID, TURRET, BOX, PORTALS, ENEMIES, direction, clamp } = B;
const TAU = Math.PI * 2;
const geometries = {
  box: new THREE.BoxGeometry(1, 1, 1), bevel: beveledBox(), cylinder: new THREE.CylinderGeometry(1, 1, 1, 16), sphere: new THREE.IcosahedronGeometry(1, 2), cone: new THREE.ConeGeometry(1, 1, 8), plane: new THREE.PlaneGeometry(1, 1),
};
const materials = new Map();
function material(color, basic = false) {
  const key = color + '/' + basic;
  if (!materials.has(key)) materials.set(key, basic ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshStandardMaterial({ color, roughness: ['#193c49','#214852','#234852'].includes(color) ? .14 : .64, metalness: ['#193c49','#214852','#234852'].includes(color) ? .65 : .18, envMapIntensity:1.15 }));
  return materials.get(key);
}
function part(parent, shape, size, position, color, rotation = [0, 0, 0], basic = false) {
  const object = new THREE.Mesh(geometries[shape], color?.isMaterial ? color : material(color, basic)); object.scale.set(...size); object.position.set(...position); object.rotation.set(...rotation); parent.add(object); return object;
}
export class World {
  constructor(canvas, quality = 'low') {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.12;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#243541'); this.scene.fog = new THREE.Fog('#49534f', 28, 78);
    this.camera = new THREE.PerspectiveCamera(78, 1, .055, 100); this.camera.rotation.order = 'YXZ'; this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight('#b5d3ed', '#626452', 1.15));
    const sun = this.sun = new THREE.DirectionalLight('#ffcf92', 3.1); sun.position.set(-13, 24, 9); this.scene.add(sun); sun.shadow.camera.left=-29;sun.shadow.camera.right=29;sun.shadow.camera.top=30;sun.shadow.camera.bottom=-30;sun.shadow.camera.near=.5;sun.shadow.camera.far=75;sun.shadow.bias=-.00025;sun.shadow.normalBias=.035;
    this.batches = new Map(); this.actors = new Map(); this.corpses = []; this.pickupModels = []; this.grenadeModels = new Map(); this.effects = []; this.tracers = [];
    this.lastWeapon = ''; this.lastOptic = ''; this.fov = 78; this.clock = 0; this.isMenu = true; this.quality = quality;
    this.buildDepot(); this.flushBatches(); this.buildFacilities(); this.buildWeapons(); this.buildParticles(); this.bossEffects=new BossEffects(this.scene); upgradeEnvironment(this); for(const [key,m]of materials)if(['#596865','#667672','#879289','#465b5b','#465f5b'].some(c=>key===c+'/false')){m.map=this.textures.concrete;m.roughness=.94;} applyQuality(this, quality);
    this.camera.position.set(19, 13, 22); this.camera.lookAt(0, .8, -3); this.renderer.compile(this.scene, this.camera);
  }
  staticPart(shape, size, position, color, rotation = [0, 0, 0], basic = false) {
    const key = shape + '/' + color + '/' + basic;
    if (!this.batches.has(key)) this.batches.set(key, { shape, color, basic, matrices: [] });
    const object = new THREE.Object3D(); object.position.set(...position); object.rotation.set(...rotation); object.scale.set(...size); object.updateMatrix(); this.batches.get(key).matrices.push(object.matrix.clone());
  }
  flushBatches() {
    for (const { shape, color, basic, matrices } of this.batches.values()) { const batch = new THREE.InstancedMesh(geometries[shape], material(color, basic), matrices.length); matrices.forEach((m, i) => batch.setMatrixAt(i, m)); batch.instanceMatrix.needsUpdate = true; batch.computeBoundingSphere(); this.scene.add(batch); }
    this.batches.clear();
  }
  sign(text, x, y, z, width = 4, height = .8, foreground = '#ecddb5', background = '#233a3c', rotation = 0) {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 160; const ctx = canvas.getContext('2d');
    ctx.fillStyle = background; ctx.fillRect(0, 0, 768, 160); ctx.strokeStyle = foreground; ctx.lineWidth = 3; ctx.strokeRect(12, 12, 744, 136); ctx.fillStyle = foreground; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '600 54px "Segoe UI","Microsoft YaHei",sans-serif'; ctx.fillText(text, 384, 81);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(geometries.plane, new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })); mesh.position.set(x, y, z); mesh.scale.set(width, height, 1); mesh.rotation.y = rotation; this.scene.add(mesh); return mesh;
  }
  buildDepot() {
    const box = (size, pos, color, rotation) => this.staticPart('box', size, pos, color, rotation);
    box([36, .2, 44], [0, -.15, 0], '#38494d');
    for (let i = -3; i <= 3; i++) box([.055, .012, 40], [i * 4.5, -.038, 0], '#75816b');
    for (let z = -17; z < 17; z += 4) { box([.13, .015, 1.9], [0, -.025, z], '#bcc0a1'); for (const x of [-11.8, 11.8]) box([2.7, .012, .06], [x, -.03, z], '#9e9b69'); }
    for (const z of [9.5, -12.5]) { box([.15, .015, 2.5], [0, -.025, z], '#b2b69f'); box([.15, .015, 1.2], [-.38, -.025, z - .8], '#b2b69f', [0, -.7, 0]); box([.15, .015, 1.2], [.38, -.025, z - .8], '#b2b69f', [0, .7, 0]); }
    // Wall segments and clear, recognizable spawn entrances.
    for (const x of [-18, 18]) {
      for (const [z, depth] of [[-16, 12], [7.5, 22]]) { box([.35, 1.1, depth], [x, .5, z], '#596865'); box([.13, 1.15, depth], [x, 1.6, z], '#394e50'); }
      for (let z = -21; z <= 21; z += 3) { this.staticPart('cylinder', [.055, 2.7, .055], [x, 1.3, z], '#738480'); box([.05, .04, 3], [x, 2.3, z + 1.5], '#91a09b'); }
    }
    for (const x of [-10.5, 10.5]) { box([14.5, 1.3, .4], [x, .6, -22], '#667672'); box([14.5, 1.3, .12], [x, 1.9, -22], '#425a5b'); }
    box([36, 1.1, .4], [0, .5, 22], '#4e6462');
    this.sign('← 西侧入口 / 01', -17.7, 3, -5.7, 4.6, .75, '#e4c394', '#263a3b', Math.PI / 2);
    this.sign('02 / 东侧入口 →', 17.7, 3, -7.1, 4.6, .75, '#e4c394', '#263a3b', -Math.PI / 2);
    for (const [i, o] of OBSTACLES.entries()) {
      if (o.id.startsWith('bus')) this.bus(o, i);
      else if (o.id.startsWith('crates')) { const w = o.x2 - o.x1, d = o.z2 - o.z1, x = (o.x1 + o.x2) / 2, z = (o.z1 + o.z2) / 2; box([w, o.height, d], [x, o.height / 2, z], '#7f8062'); for (const offset of [-.34, .34]) box([w + .04, .08, .075], [x, o.height * (offset + .6), z + d / 2 + .01], '#414f45'); box([.08, o.height, d + .04], [x, o.height / 2, z], '#a0a286'); }
      else if (o.id === 'cover-center') { box([3.6, .7, .9], [0, .35, -3.25], '#879289'); for (let x = -1.5; x < 2; x += .6) box([.25, .03, .93], [x, .72, -3.25], '#c2b586', [0, .3, 0]); }
      else box([o.x2 - o.x1, o.height, o.z2 - o.z1], [(o.x1 + o.x2) / 2, o.height / 2, (o.z1 + o.z2) / 2], '#465b5b');
    }
    // Repair shed: a roof and pillars, without blocking the player's starting area.
    box([14, .25, 5.4], [1.2, 4.2, 18.5], '#3b565b');
    for (const x of [-5.5, 7.9]) for (const z of [16.1, 20.8]) box([.18, 4.2, .18], [x, 2.1, z], '#607a78');
    box([4.1, .1, .1], [1.2, 4, 17], '#e1c293'); this.sign('维修区 / SERVICE', 1.2, 3.6, 15.95, 5.8, .65, '#bed0ba');
    // Background silhouettes frame the arena without increasing playable space.
    for (let i = 0; i < 11; i++) { const x = (i - 5) * 6.5, height = 7 + (i * 17 % 7); box([5.2, height, 4.5], [x, height / 2, -30 - (i % 3) * 2], '#2d434b'); for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) box([.8, .7, .025], [x - 1.6 + j * 1.6, 2.5 + k * 2, -27.73 - (i % 3) * 2], (i + j + k) % 4 ? '#40564f' : '#a29871'); }
    for (const [x, z] of [[-13, 8], [13, -12], [-3, -15], [13.2, 17]]) { this.staticPart('cylinder', [.065, 5.2, .065], [x, 2.6, z], '#8a9a8d'); box([1.1, .15, .48], [x, 5.15, z], '#43595c'); this.staticPart('box', [.85, .05, .35], [x, 5.06, z], '#e8d9ae', [0, 0, 0], true); box([3, .014, 3], [x, -.029, z], '#606653'); }
    // Generator platform and visible power routing.
    box([5, .13, 5], [11.5, .015, 13.4], '#687368');
    for (let x = 9.3; x < 14; x += .55) box([.25, .02, .5], [x, .095, 11], '#b6a277', [0, .4, 0]);
    box([1.25, 1.9, .65], [BOX.x, .99, BOX.z], '#526b65'); box([1.1, 1.65, .035], [BOX.x, 1, BOX.z + .35], '#213b3b');
    this.staticPart('box', [.42, .18, .05], [BOX.x, 1.48, BOX.z + .39], '#ddaa67', [0, 0, 0], true);
    this.sign('ϟ 配电箱 / POWER', BOX.x, 2.55, BOX.z + .38, 3.1, .55, '#eccc91');
    for (let z = -8; z < 14; z += 1.4) box([.035, .018, .9], [14.8, -.025, z], '#ac925e');
    for (let x = -12; x < 14.8; x += 1.4) box([.9, .018, .035], [x, -.025, 9], '#ac925e');
    this.powerLamp = part(this.scene, 'sphere', [.16, .16, .16], [BOX.x, 2.02, BOX.z], '#db865a', [0, 0, 0], true);
    // Small environmental clutter, outside the movement routes.
    for (let i = 0; i < 12; i++) { const x = (i % 2 ? 1 : -1) * (15 + (i % 3) * .4), z = -15 + i * 2.6; this.staticPart('cylinder', [.23, .7, .23], [x, .35, z], i % 3 ? '#4b675b' : '#9c7552'); }
    for (const x of [-3.3, 3.3]) { box([.25, 4, .35], [x, 2, -19.3], '#69857a'); this.staticPart('box', [.1, 3.5, .1], [x, 1.8, -19.0], '#9c6c47', [0, 0, 0], true); }
    box([6.85, .3, .65], [0, 3.9, -19.3], '#465f5b'); this.sign('撤离出口 / EXIT ↑', 0, 4.6, -19.25, 6.2, .85, '#d0e4b1', '#264138');
  }
  bus(o, index) {
    const horizontal = o.id === 'bus-south', x = (o.x1 + o.x2) / 2, z = (o.z1 + o.z2) / 2, length = horizontal ? o.x2 - o.x1 : o.z2 - o.z1, width = horizontal ? o.z2 - o.z1 : o.x2 - o.x1, yaw = horizontal ? Math.PI / 2 : 0;
    const colors = ['#3b7776', '#b4a072', '#566c72'], color = colors[index % colors.length];
    const add = (shape, size, p, c, r = [0, 0, 0], basic = false) => { const px = x + p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw), pz = z - p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw); this.staticPart(shape, size, [px, p[1], pz], c, [r[0], r[1] + yaw, r[2]], basic); };
    add('box', [width, 1.05, length], [0, .9, 0], color); add('box', [width - .12, 1.32, length - .15], [0, 2.02, 0], '#627f7c'); add('box', [width + .05, .15, length + .05], [0, 2.77, 0], '#a0b1a1'); add('box', [width - .15, .35, length - .1], [0, .33, 0], '#304a4d');
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) add('box', [.045, .82, length * .15], [side * width * .496, 2.05, -length * .36 + i * length * .18], '#193c49');
      add('box', [.055, .13, length - .2], [side * width * .5, 1.38, 0], '#c0c2a4');
      for (const zz of [-length * .34, length * .34]) { add('cylinder', [.54, .23, .54], [side * (width / 2 + .02), .55, zz], '#1e2b30', [0, 0, Math.PI / 2]); add('cylinder', [.27, .245, .27], [side * (width / 2 + .03), .55, zz], '#778b87', [0, 0, Math.PI / 2]); }
    }
    add('box', [width - .35, .95, .05], [0, 2.05, -length / 2 - .015], '#214852'); add('box', [width - .35, .75, .05], [0, 2.08, length / 2 + .01], '#234852');
    for (const side of [-1, 1]) { add('box', [.6, .17, .055], [side * .98, .96, -length / 2 - .02], '#e6cf96', [0, 0, 0], true); add('box', [.3, .14, .055], [side * 1.1, .9, length / 2 + .02], '#9c5145', [0, 0, 0], true); }
    add('box', [1.2, .16, 1.8], [0, 2.95, 0], '#6d8380');
    add('box',[width+.07,.16,.13],[0,.5,-length/2-.08],'#283d42');
    for(let i=0;i<5;i++)add('box',[.9,.035,.025],[0,.72+i*.07,-length/2-.045],'#30464a');
    for(const side of [-1,1]){
      add('box',[.035,.48,.68],[side*width*.505,.94,-length*.27],'#4b6260');
      for(let i=0;i<6;i++)add('box',[.048,.025,.57],[side*width*.51,.75+i*.065,length*.31],'#314d4e');
      add('box',[.055,1.45,.055],[side*width*.51,1.65,-length*.12],'#a5b5aa');
      add('box',[.055,1.45,.055],[side*width*.51,1.65,-length*.02],'#a5b5aa');
    }
    for(const side of [-1,1])add('box',[.025,.46,.025],[side*.67,1.92,-length/2-.05],'#728b85',[0,0,side*.35]);
    if (!horizontal) this.sign(`0${index + 1} / 暂停运营`, x, 2.57, z - length / 2 - .06, width * .7, .28, '#d1b879', '#18343b', Math.PI);
  }
  buildFacilities() {
    this.gate = new THREE.Group(); this.gate.position.set(0, 0, -19.28); this.scene.add(this.gate);
    for (let i = -5; i <= 5; i++) part(this.gate, 'box', [.09, 3.6, .14], [i * .56, 1.8, 0], '#8b9d8b');
    for (const y of [.65, 2.9]) part(this.gate, 'box', [6, .12, .17], [0, y, 0], '#607e74');
    const exitMat = new THREE.MeshBasicMaterial({ color: '#b9e99b', transparent: true, opacity: .12, depthWrite: false });
    this.exitZone = part(this.scene, 'box', [5.1, .04, 2.7], [0, -.015, -20.5], exitMat); this.exitZone.visible = false;
    this.objectiveBeacon = part(this.scene, 'cylinder', [.07, 6, .07], [BOX.x, 3, BOX.z], new THREE.MeshBasicMaterial({ color: '#ffd08c', transparent: true, opacity: .5, depthWrite: false })); this.objectiveBeacon.visible = false;
    this.gridFloor = part(this.scene, 'box', [GRID.x2 - GRID.x1, .025, GRID.z2 - GRID.z1], [(GRID.x1 + GRID.x2) / 2, -.01, (GRID.z1 + GRID.z2) / 2], new THREE.MeshBasicMaterial({ color: '#71dce9', transparent: true, opacity: .08, depthWrite: false }));
    for (const x of [GRID.x1, GRID.x2]) for (const z of [GRID.z1, GRID.z2]) { part(this.scene, 'cylinder', [.08, 1.3, .08], [x, .65, z], '#5f7c7b'); part(this.scene, 'sphere', [.12, .12, .12], [x, 1.36, z], '#7da7ab', [0, 0, 0], true); }
    this.gridWire = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#a6f6ff', transparent: true, opacity: .9 })); this.scene.add(this.gridWire); this.gridWire.visible = false;
    const wirePoints = [];
    for (let k = 0; k < 6; k++) { const z = GRID.z1 + k / 5 * (GRID.z2 - GRID.z1); for (let i = 0; i < 6; i++) { const a = i / 6, b = (i + 1) / 6; wirePoints.push(GRID.x1 + a * (GRID.x2 - GRID.x1), .3 + (i % 2) * .22, z, GRID.x1 + b * (GRID.x2 - GRID.x1), .3 + ((i + 1) % 2) * .22, z); } }
    this.gridWire.geometry.setAttribute('position', new THREE.Float32BufferAttribute(wirePoints, 3));
    this.turret = new THREE.Group(); this.turret.position.set(TURRET.x, 0, TURRET.z); this.scene.add(this.turret);
    part(this.turret, 'cylinder', [.5, .3, .5], [0, .15, 0], '#3a5254'); part(this.turret, 'cylinder', [.14, 1, .14], [0, .7, 0], '#8d9d82');
    for (let i = 0; i < 3; i++) part(this.turret, 'box', [.09, .1, 1.2], [Math.sin(i * TAU / 3) * .25, .1, Math.cos(i * TAU / 3) * .25], '#87967d', [0, i * TAU / 3, 0]);
    this.turretHead = new THREE.Group(); this.turretHead.position.y = 1.2; this.turret.add(this.turretHead);
    part(this.turretHead, 'box', [.55, .45, .9], [0, 0, 0], '#688368'); part(this.turretHead, 'box', [.15, .14, .9], [0, .05, -.8], '#243d45');
    this.turretLamp = part(this.turretHead, 'sphere', [.055, .055, .055], [.25, .18, -.3], '#9c6f52', [0, 0, 0], true);
    for (const pickup of B.PICKUPS) {
      const group = new THREE.Group(); group.position.set(pickup.x, 0, pickup.z); this.scene.add(group);
      part(group, 'box', [.64, .45, .42], [0, .23, 0], pickup.type === 'ammo' ? '#8b9a63' : '#b1b29c');
      if (pickup.type === 'health') { part(group, 'box', [.13, .23, .02], [0, .27, .22], '#d98065', [0, 0, 0], true); part(group, 'box', [.3, .07, .025], [0, .27, .22], '#d98065', [0, 0, 0], true); }
      else for (let i = -1; i <= 1; i++) part(group, 'box', [.05, .17, .025], [i * .13, .27, .22], '#cfc49a');
      const glow = part(group, 'sphere', [.06, .06, .06], [0, .78, 0], pickup.type === 'ammo' ? '#dfd18e' : '#badeaf', [0, 0, 0], true); group.userData.glow = glow; this.pickupModels.push(group);
    }
  }
  buildWeapons() {
    this.weaponScene = new THREE.Scene(); this.weaponCamera = new THREE.PerspectiveCamera(78,1,.035,6); this.weaponScene.add(this.weaponCamera);
    this.weaponScene.add(new THREE.HemisphereLight('#c6d9ed','#4e5646',1.35)); const key=new THREE.DirectionalLight('#ffe0b5',3.0); key.position.set(-3,5,2); this.weaponScene.add(key);
    this.viewRoot = new THREE.Group(); this.weaponCamera.add(this.viewRoot); this.guns = {}; this.weaponMaterials=new Map();
    this.weaponMaterial = color => {if(!this.weaponMaterials.has(color))this.weaponMaterials.set(color,new THREE.MeshStandardMaterial({color,roughness:color==='#9a6747'?.8:.44,metalness:color==='#9a6747'?.03:.55}));return this.weaponMaterials.get(color);};
    const gunPart = (g, shape, size, position, color, rotation = [0, 0, 0]) => { const m = part(g, shape === 'box' ? 'bevel' : shape, size, position, this.weaponMaterial(color), rotation); return m; };
    for (const kind of ['m4', 'ak', 'awm', 'pistol']) {
      const group = new THREE.Group(); group.visible = false; this.viewRoot.add(group); this.guns[kind] = group;
      const color = kind === 'awm' ? '#526958' : '#253a3e', wood = kind === 'ak' ? '#9a6747' : color;
      gunPart(group, 'box', [.12, .1, kind === 'awm' ? .66 : .4], [0, 0, -.13], color);
      gunPart(group, 'box', [.08, .1, .29], [0, -.01, .19], wood); gunPart(group, 'box', [.07, .16, .08], [0, -.11, .10], '#1c2b30', [.25, 0, 0]);
      const barrelLength = kind === 'awm' ? .59 : kind === 'pistol' ? .13 : .31;
      const barrelZ = kind === 'awm' ? -.65 : kind === 'pistol' ? -.28 : -.46;
      gunPart(group, 'cylinder', [.022, barrelLength, .022], [0, .025, barrelZ], '#71827f', [Math.PI / 2, 0, 0]);
      if (kind !== 'pistol') {
        gunPart(group, 'box', [.105, .075, kind === 'awm' ? .38 : .24], [0, -.01, kind === 'awm' ? -.32 : -.21], wood);
        const magazine = gunPart(group, 'box', [.065, kind === 'awm' ? .085 : .2, .10], [0, kind === 'awm' ? -.08 : -.13, -.02], '#4e5c58', [kind === 'ak' ? -.22 : .08, 0, 0]); group.userData.magazine = magazine;
        if (kind === 'm4') for (let i = 0; i < 6; i++) gunPart(group, 'box', [.13, .018, .015], [0, .064, -.31 + i * .055], '#677b73');
        if (kind === 'ak') { gunPart(group, 'box', [.02, .055, .1], [.09, .04, -.05], '#86968a'); gunPart(group, 'box', [.05, .075, .055], [0, .07, -.4], '#3d5455'); }
        if (kind === 'awm') { group.userData.bolt = gunPart(group, 'sphere', [.032, .032, .032], [.10, .02, .03], '#91a18d'); gunPart(group, 'cylinder', [.012, .10, .012], [.06, .02, .03], '#879c8c', [0, 0, Math.PI / 2]); }
      } else { gunPart(group, 'box', [.095, .065, .29], [0, .067, -.075], '#8d9a8d'); gunPart(group, 'box', [.08, .16, .09], [0, -.1, .09], '#384a46', [.2, 0, 0]); }
      gunPart(group, 'box', [.09, .09, .12], [.01, -.085, .135], '#738779', [.2, 0, -.15]);
      gunPart(group, 'box', [.09, .08, .30], [.04, -.13, .29], '#455b58', [-.15, 0, -.10]);
      if (kind !== 'pistol') { gunPart(group, 'box', [.095, .07, .16], [-.015, -.07, -.27], '#6d8070', [0, 0, .25]); gunPart(group, 'box', [.085, .08, .35], [.055, -.14, -.12], '#485e58', [.25, -.2, .2]); }
      if(kind!=='pistol'){
        for(let j=0;j<7;j++){gunPart(group,'box',[.112,.012,.014],[0,.062,-.34+j*.045],'#7d8986');gunPart(group,'box',[.003,.012,.07],[.035,-.10-j*.012,-.02],'#1c2b30');}
        for(const z of [-.12,.10])gunPart(group,'cylinder',[.008,.005,.008],[.063,.005,z],'#a2aca6',[0,0,Math.PI/2]);
        gunPart(group,'box',[.028,.06,.018],[-.042,-.09,.06],'#1c2b30');gunPart(group,'box',[.075,.015,.10],[0,-.125,.06],'#263636');
        gunPart(group,'box',[.09,.10,.035],[0,-.01,.345],'#18282b');
        gunPart(group,'cylinder',[.030,.055,.030],[0,.025,barrelZ-barrelLength*.5],'#25383a',[Math.PI/2,0,0]);
        if(kind==='ak')gunPart(group,'cylinder',[.014,.26,.014],[0,.065,-.32],'#62746f',[Math.PI/2,0,0]);
        if(kind==='awm')for(const side of [-1,1])gunPart(group,'cylinder',[.009,.28,.009],[side*.055,-.065,-.49],'#374c4b',[Math.PI/2,.2*side,0]);
      }
      group.userData.muzzleZ = barrelZ - barrelLength * .5 - .035;
      const flashMat = new THREE.MeshBasicMaterial({ color: '#ffd48f', transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
      const flash = part(group, 'sphere', [.065, .065, .1], [0, .025, group.userData.muzzleZ], flashMat); flash.renderOrder = 30; group.userData.flash = flash;
    }
    this.opticMount = new THREE.Group(); this.viewRoot.add(this.opticMount);
    buildMeleeModels(this,part);
    this.viewRoot.position.set(.31, -.27, -.57);
  }
  mountOptic(optic, kind) {
    while (this.opticMount.children.length) { const child=this.opticMount.children[0];if(child.userData.ownMaterial)child.material.dispose();this.opticMount.remove(child); }
    if (kind === 'pistol'||kind==='melee') { this.opticMount.visible = false; return; } this.opticMount.visible = true;
    const add = (shape,size,pos,color,rotation=[0,0,0]) => part(this.opticMount,shape==='box'?'bevel':shape,size,pos,this.weaponMaterial(color),rotation);
    if (optic === 'red') {
      add('box', [.10, .06, .10], [0, .08, .02], '#586f65', [0, 0, 0], true);
      add('box', [.025, .12, .065], [-.056, .16, .02], '#283d42', [0, 0, 0], true); add('box', [.025, .12, .065], [.056, .16, .02], '#283d42', [0, 0, 0], true); add('box', [.13, .02, .065], [0, .22, .02], '#283d42', [0, 0, 0], true);
      const glass = new THREE.Mesh(geometries.plane,new THREE.MeshPhysicalMaterial({color:'#91d3ba',metalness:.1,roughness:.12,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide}));glass.scale.set(.093,.102,1);glass.position.copy(RED_SIGHT_CENTER);glass.position.z+=.035;glass.userData.ownMaterial=true;this.opticMount.add(glass);
    } else {
      add('box', [.07, .10, .13], [0, .11, .01], '#445c55', [0, 0, 0], true);
      add('cylinder', [optic === 'x8' ? .062 : .05, optic === 'x8' ? .36 : .26, optic === 'x8' ? .062 : .05], [0, .19, -.005], '#243b42', [Math.PI / 2, 0, 0], true);
      add('cylinder', [.048, .01, .048], [0, .19, .18], '#73a293', [Math.PI / 2, 0, 0], true);
    }
  }
  buildParticles() {
    this.particlePositions = new Float32Array(220 * 3); this.particleColors = new Float32Array(220 * 3);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3)); geometry.setDrawRange(0, 0);
    this.particlePoints = new THREE.Points(geometry, new THREE.PointsMaterial({ size: .1, vertexColors: true, transparent: true, opacity: .85, sizeAttenuation: true, depthWrite: false })); this.particlePoints.frustumCulled = false; this.scene.add(this.particlePoints);
    this.tracePositions = new Float32Array(24 * 6); const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(this.tracePositions, 3)); tg.setDrawRange(0, 0);
    this.traceLines = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: '#ffe0a5', transparent: true, opacity: .65, depthWrite: false })); this.traceLines.frustumCulled = false; this.scene.add(this.traceLines);
  }
  spawnActor(enemy) {
    if(enemy.kind==='boss')return spawnBossActor(this,enemy,part);
    const group = new THREE.Group(), kind = enemy.kind, info = ENEMIES[kind], heightScale = info.height / 1.8;
    const bodyColor = kind === 'walker' ? '#7a8c6a' : kind === 'runner' ? '#a8684e' : '#536b72';
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, map:this.textures.fabric, roughness:.94 }), skinMat = new THREE.MeshStandardMaterial({ color: kind === 'runner' ? '#a9ac8b' : '#a8b48f', roughness:.8 });
    const torso = part(group, 'bevel', [kind === 'armor' ? .67 : .49, .64, .35], [0, 1.08 * heightScale, 0], bodyMat); torso.rotation.x = kind === 'runner' ? .18 : -.04;
    part(group, 'box', [.38, .20, .28], [0, .68 * heightScale, 0], '#45534c');
    const head = part(group, 'sphere', [kind === 'armor' ? .245 : .215, .235, .205], [0, info.height - .2, kind === 'runner' ? .11 : 0], skinMat);
    for (const side of [-1, 1]) { const eye = part(head, 'sphere', [.13, .075, .06], [side * .37, .12, .85], kind === 'runner' ? '#ffbd72' : '#dce896', [0, 0, 0], true); eye.userData.eye = true; }
    const limbs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(side * .14, .69 * heightScale, 0); group.add(leg); part(leg, 'bevel', [.17, .59 * heightScale, .20], [0, -.28 * heightScale, 0], '#354d4a'); part(leg, 'box', [.20, .11, .33], [0, -.58 * heightScale, .07], '#263d3c'); limbs.push(leg);
      const arm = new THREE.Group(); arm.position.set(side * (kind === 'armor' ? .41 : .32), 1.35 * heightScale, 0); group.add(arm); part(arm, 'bevel', [.14, .48 * heightScale, .16], [0, -.20 * heightScale, 0], bodyMat); part(arm, 'box', [.14, .21 * heightScale, .16], [0, -.50 * heightScale, .01], skinMat); limbs.push(arm);
    }
    if (kind === 'armor') { part(group, 'box', [.70, .66, .1], [0, 1.12, .25], '#2e414c'); for (let i = 0; i < 3; i++) part(group, 'box', [.61, .025, .025], [0, .94 + i * .18, .32], '#8a9e94'); part(group, 'box', [.18, .13, .04], [0, 1.9, .20], '#d8906c', [0, 0, 0], true); }
    group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    this.scene.add(group); const actor = { group, limbs, head, torso, bodyMat, skinMat, bodyColor, kind, dying: false, age: 0 }; this.actors.set(enemy.id, actor); return actor;
  }
  burst(x, y, z, color, count = 10, speed = 2) {
    for (let i = 0; i < count && this.effects.length < 210; i++) this.effects.push({ x, y, z, vx: (Math.random() - .5) * speed, vy: Math.random() * speed, vz: (Math.random() - .5) * speed, life: .25 + Math.random() * .4, color: new THREE.Color(color) });
  }
  handleEvents(events) {
    for (const event of events) {
      this.bossEffects.event(event);
      if(event.type==='bossdown')this.burst(event.x,2,event.z,'#e4b17a',60,7);
      if(event.type==='bossslam')this.burst(event.x,.25,event.z,'#e8bd83',40,5);
      if (event.type === 'hit') this.burst(event.point.x, event.point.y, event.point.z, event.armor ? '#b4dbe6' : event.head ? '#e9c28c' : '#a9af8b', 6, 1.4);
      if (event.type === 'shoot') { const gun = this.guns[this.currentGun]; if (gun) gun.userData.flash.material.opacity = .95; this.tracers.push({ from: [event.origin.x+event.dir.x*.3, event.origin.y+event.dir.y*.3, event.origin.z+event.dir.z*.3], to: [event.point.x, event.point.y, event.point.z], life: .06 }); }
      if (event.type === 'turretshot') { this.tracers.push({ from: [TURRET.x, 1.25, TURRET.z - 1], to: [event.x, event.y, event.z], life: .10 }); this.turretHead.rotation.y = Math.atan2(-(event.x - TURRET.x), -(event.z - TURRET.z)); this.burst(TURRET.x, 1.2, TURRET.z - 1.15, '#f9d694', 3, .5); }
      if (event.type === 'explosion') this.burst(event.x, event.y, event.z, event.shock ? '#95e7eb' : '#ffbb6d', 50, 7);
      if (event.type === 'death') { const actor = this.actors.get(event.id); if (actor) { actor.dying = true; actor.age = 0; this.corpses.push(event.id); this.burst(event.x, .85, event.z, '#81977d', 7, 1.6); } }
    }
    while (this.corpses.length > 6) this.removeActor(this.corpses.shift());
  }
  removeActor(id) { const actor = this.actors.get(id); if (!actor) return; this.scene.remove(actor.group); actor.bodyMat.dispose(); actor.skinMat.dispose();actor.ownedMaterials?.forEach(m=>m.dispose()); this.actors.delete(id); }
  reset() { this.bossEffects.reset(); for (const id of [...this.actors.keys()]) this.removeActor(id); this.corpses = []; this.effects = []; this.tracers = []; for (const obj of this.grenadeModels.values()) this.scene.remove(obj); this.grenadeModels.clear(); this.gate.position.y = 0; this.lastWeapon = ''; this.lastOptic = ''; this.fov = 78; }
  setQuality(value) { applyQuality(this,value); }
  resize() { const w = window.innerWidth, h = window.innerHeight; const p=QUALITY[this.quality]||QUALITY.standard;this.renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio || 1,p.minimum),p.ratio)); this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.weaponCamera.aspect=w/h;this.weaponCamera.updateProjectionMatrix(); }
  render(game, dt, menuTime = 0) {
    const now = game ? game.time : menuTime; this.clock = now;
    if (!game) { this.viewRoot.visible = false; this.camera.fov = 65; this.camera.position.set(19 + Math.sin(menuTime * .08) * 1.5, 12.8, 23); this.camera.lookAt(-1, .8, -3); this.camera.updateProjectionMatrix(); this.sky.position.copy(this.camera.position);this.renderer.render(this.scene, this.camera); return; }
    this.viewRoot.visible = true;
    applyCameraPose(this.camera,game.player);
    const targetFov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(78 / 2)) / game.zoom))+(game.player.sprinting?5:0);
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 13); this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); this.weaponCamera.fov=this.fov;this.weaponCamera.updateProjectionMatrix();
    const gun = game.weapon==='melee' ? 'melee' : game.weapon === 'pistol' ? 'pistol' : game.primary;
    if (gun !== this.currentGun || this.lastOptic !== game.optic) { Object.entries(this.guns).forEach(([kind, model]) => { model.visible = kind === gun; }); this.currentGun = gun; this.lastOptic = game.optic; this.mountOptic(game.optic, gun); }
    Object.entries(this.meleeModels).forEach(([id,m])=>{m.visible=game.weapon==='melee'&&id===game.melee;});
    const reload = applyWeaponPose(this.viewRoot, game, now);
    if(game.weapon==='melee'){
      applyMeleePose(this.viewRoot,game.melee,game.meleeAction,now);
      const model=this.meleeModels[game.melee],a=game.meleeAction;
      model.userData.support.visible=game.melee==='katana'||(game.melee==='axe'&&a?.type==='heavy');
      model.userData.trail.material.opacity=a&&a.elapsed>=a.windup&&a.elapsed<=a.windup+a.active?.12:0;
    }
    if(game.player.sprinting){this.viewRoot.position.y-=.10;this.viewRoot.rotation.z+=.25;this.viewRoot.position.x+=Math.sin(now*15)*.009;}
    updateMeleeArms(this,game.weapon==='melee'?game.melee:null,game.meleeAction?.type==='heavy');
    this.bossEffects.update(game,dt);
    for (const model of Object.values(this.guns)) { model.userData.flash.material.opacity = Math.max(0, model.userData.flash.material.opacity - dt * 15); if (model.userData.magazine) model.userData.magazine.position.y = (model === this.guns.awm ? -.08 : -.13) - reload * .12; }
    if (this.guns.awm.userData.bolt) this.guns.awm.userData.bolt.position.z = .03 + Math.max(0, Math.sin(game.fireCooldown / 1.12 * Math.PI * 2)) * .09;
    const alive = new Map(game.enemies.map(e => [e.id, e]));
    for (const enemy of game.enemies) {
      let actor = this.actors.get(enemy.id); if (!actor) actor = this.spawnActor(enemy);
      actor.group.position.set(enemy.x, Math.sin(enemy.phase * 2) * .015, enemy.z); actor.group.rotation.y = Math.atan2(enemy.fx, enemy.fz);
      actor.limbs[0].rotation.x = Math.sin(enemy.phase) * .48; actor.limbs[2].rotation.x = -Math.sin(enemy.phase) * .48;
      actor.limbs[1].rotation.x = (enemy.windup > 0 ? -1.45 : -.6) + Math.sin(enemy.phase) * .13; actor.limbs[3].rotation.x = (enemy.windup > 0 ? -1.45 : -.6) - Math.sin(enemy.phase) * .13;
      actor.bodyMat.color.set(enemy.hit > 0 ? '#d8d8be' : actor.bodyColor); actor.head.scale.y = (actor.baseHeadY||.235) * (enemy.hit > 0 ? .85 : 1); actor.group.scale.setScalar(enemy.kind === 'armor' ? 1.03 : 1);
      if(enemy.kind==='boss'){
        const raised=enemy.skill&&enemy.skill.type!=='rush';if(raised){actor.limbs[1].rotation.x=actor.limbs[3].rotation.x=-1.7;}
        actor.torso.rotation.x=enemy.skill?.type==='rush'?.18:0;actor.coreMat.emissive.set(enemy.exposed>0?'#83ffb7':enemy.enraged?'#ff2f15':'#ec782d');actor.plates.forEach((plate,i)=>plate.visible=enemy.phaseNumber<=(i===0?1:2));actor.coreMat.emissiveIntensity=1+Math.sin(now*6)*.35;
      }
    }
    for (const [id, actor] of this.actors) {
      if (alive.has(id)) continue;
      if (!actor.dying) { this.removeActor(id); continue; }
      actor.age += dt; actor.group.rotation.x = Math.min(Math.PI / 2, actor.age * 5); actor.group.position.y = Math.max(-.9, .13 - Math.max(0, actor.age - 2.2) * .55);
      if (actor.age > 3.7) this.removeActor(id);
    }
    for (const p of game.projectiles) { let obj = this.grenadeModels.get(p.id); if (!obj) { obj = part(this.scene, 'sphere', [.12, .16, .12], [p.x, p.y, p.z], '#718462'); this.grenadeModels.set(p.id, obj); } obj.position.set(p.x, p.y, p.z); obj.rotation.x = now * 8; }
    for (const [id, obj] of this.grenadeModels) if (!game.projectiles.some(p => p.id === id)) { this.scene.remove(obj); this.grenadeModels.delete(id); }
    this.pickupModels.forEach((obj, i) => { obj.visible = !game.pickups[i].taken; obj.userData.glow.position.y = .8 + Math.sin(now * 3 + i) * .08; });
    this.powerLamp.material.color.set(game.facility ? '#b7df9a' : '#db865a'); this.turretLamp.material.color.set(game.facility === 'turret' && game.turretAmmo > 0 ? '#c6ecac' : '#9c6f52');
    this.gridFloor.material.opacity = game.facility === 'grid' ? .12 + game.gridFlash * .4 : .025; this.gridWire.visible = game.facility === 'grid' && game.gridFlash > 0;
    this.gate.position.y += ((game.gateOpen ? 4.1 : game.stage === 'evac' ? (18 - game.gateTime) / 18 * 2.2 : 0) - this.gate.position.y) * Math.min(1, dt * 3);
    this.exitZone.visible = game.gateOpen; this.exitZone.material.opacity = .16 + Math.sin(now * 4) * .04;
    const objective = game.objectivePoint; this.objectiveBeacon.visible = !!objective;
    if (objective) { this.objectiveBeacon.position.set(objective.x, 3, objective.z); this.objectiveBeacon.material.color.set(game.stage === 'facilityTravel' ? '#ffd08c' : '#b7ed9a'); this.objectiveBeacon.material.opacity = .23 + Math.sin(now * 3) * .1; }
    this.effects = this.effects.filter(p => p.life > 0); let n = 0;
    for (const p of this.effects) { p.life -= dt; p.vy -= dt * 6; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const i = n++ * 3; this.particlePositions[i] = p.x; this.particlePositions[i + 1] = p.y; this.particlePositions[i + 2] = p.z; this.particleColors[i] = p.color.r * Math.min(1, p.life * 3); this.particleColors[i + 1] = p.color.g * Math.min(1, p.life * 3); this.particleColors[i + 2] = p.color.b * Math.min(1, p.life * 3); }
    this.particlePoints.geometry.setDrawRange(0, n); this.particlePoints.geometry.attributes.position.needsUpdate = true; this.particlePoints.geometry.attributes.color.needsUpdate = true;
    this.tracers = this.tracers.filter(t => t.life > 0).slice(-24); n = 0; for (const t of this.tracers) { t.life -= dt; this.tracePositions.set([...t.from, ...t.to], n++ * 6); } this.traceLines.geometry.setDrawRange(0, n * 2); this.traceLines.geometry.attributes.position.needsUpdate = true;
    this.sky.position.copy(this.camera.position);this.renderer.render(this.scene, this.camera);
    if(this.viewRoot.visible){this.renderer.autoClear=false;this.renderer.clearDepth();this.renderer.render(this.weaponScene,this.weaponCamera);this.renderer.autoClear=true;}
  }
}
