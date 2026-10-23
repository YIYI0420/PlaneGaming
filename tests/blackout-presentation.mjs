import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as THREE from '../blackout/vendor/three.module.min.js';
import {applyWeaponPose,applyCameraPose,RED_SIGHT_CENTER,QUALITY} from '../blackout/presentation.js';
const require=createRequire(import.meta.url),{Game,direction}=require('../blackout/engine.js');
for(const [width,height]of [[1280,720],[844,390],[390,844]])for(const primary of ['m4','ak','awm'])for(const optic of ['red','x4','x8']){
 const g=new Game({primary,optic});g.aiming=true;Object.assign(g.player,{x:3,z:9,y:2.3,yaw:.8,pitch:.3});const camera=new THREE.PerspectiveCamera(78,width/height,.035,100);applyCameraPose(camera,g.player);camera.updateMatrixWorld(true);
 const d=direction(g.player.yaw,g.player.pitch),p=new THREE.Vector3(g.player.x+d.x*15,g.player.y+d.y*15,g.player.z+d.z*15).project(camera);assert.ok(Math.abs(p.x)<1e-10&&Math.abs(p.y)<1e-10,'camera and bullet ray must share centre');
 const root=new THREE.Group(),weaponCamera=new THREE.PerspectiveCamera(65,width/height,.035,6);weaponCamera.add(root);applyWeaponPose(root,g,8);weaponCamera.updateMatrixWorld(true);
 if(optic==='red'){const sight=RED_SIGHT_CENTER.clone();root.localToWorld(sight);sight.project(weaponCamera);assert.ok(Math.abs(sight.x)<1e-10&&Math.abs(sight.y)<1e-10,'3D red sight must project to screen centre');assert.equal(root.visible,true);}else assert.equal(root.visible,false);
}
assert.ok(QUALITY.high.shadows&&QUALITY.high.shadowSize>QUALITY.standard.shadowSize&&!QUALITY.low.shadows);
console.log('PASS: camera/bullet alignment and ADS projection across 27 viewport / primary / optic combinations; three distinct quality profiles.');
