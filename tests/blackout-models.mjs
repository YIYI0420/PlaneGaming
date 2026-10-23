import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as THREE from '../blackout/vendor/three.module.min.js';
import {buildMeleeModels,updateMeleeArms,spawnBossActor,BossEffects} from '../blackout/combat-visuals.js';
const require=createRequire(import.meta.url),B=require('../blackout/engine.js');globalThis.window={Blackout:B};
const shapes={box:new THREE.BoxGeometry(1,1,1),bevel:new THREE.BoxGeometry(1,1,1),sphere:new THREE.IcosahedronGeometry(1,1),cone:new THREE.ConeGeometry(1,1,8),cylinder:new THREE.CylinderGeometry(1,1,1,8)};
const part=(parent,shape,size,pos,mat,rotation=[0,0,0])=>{const mesh=new THREE.Mesh(shapes[shape],mat);mesh.scale.set(...size);mesh.position.set(...pos);mesh.rotation.set(...rotation);parent.add(mesh);return mesh;};
const mats=new Map(),world={viewRoot:new THREE.Group(),weaponCamera:new THREE.PerspectiveCamera(78,1,.035,6),scene:new THREE.Scene(),actors:new Map(),weaponMaterial:color=>{if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color}));return mats.get(color);}};
world.weaponCamera.add(world.viewRoot);buildMeleeModels(world,part);assert.deepEqual(Object.keys(world.meleeModels),Object.keys(B.MELEE));
for(const id of Object.keys(B.MELEE))for(const heavy of [false,true]){updateMeleeArms(world,id,heavy);assert.ok(world.meleeArms[0].visible);assert.equal(world.meleeArms[1].visible,id==='katana'||id==='axe'&&heavy);for(const arm of world.meleeArms)assert.ok([...arm.position.toArray(),...arm.quaternion.toArray(),...arm.scale.toArray()].every(Number.isFinite));}updateMeleeArms(world,null);assert.ok(world.meleeArms.every(a=>!a.visible));
const heights=[];for(const group of Object.values(world.meleeModels)){assert.equal(group.visible,false);group.updateMatrixWorld(true);group.traverse(o=>{if(o.isMesh){for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));}});heights.push(new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3()).y);}
assert.ok(new Set(heights.map(h=>h.toFixed(3))).size>=4,'different weapon silhouettes');
const g=new B.Game();g.startBossEncounter();const actor=spawnBossActor(world,g.boss,part);actor.group.updateMatrixWorld(true);assert.ok(new THREE.Box3().setFromObject(actor.group).getSize(new THREE.Vector3()).y>3.7);assert.equal(actor.limbs.length,4);
const fx=new BossEffects(world.scene);g.setStage('boss');g.beginBossSkill(g.boss,'slam');fx.update(g,.01);assert.ok(fx.slam.visible);g.beginBossSkill(g.boss,'charge');fx.update(g,.01);assert.ok(fx.lane.visible);assert.equal(fx.slam.visible,false);g.beginBossSkill(g.boss,'toxic');fx.update(g,.01);assert.equal(fx.pool.size,3);fx.reset();assert.equal(fx.pool.size,0);assert.equal(fx.lane.visible,false);
console.log('PASS: five melee meshes, finite geometry, distinct silhouettes, large boss model and bounded skill markers.');
