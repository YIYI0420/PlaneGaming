import * as THREE from './vendor/three.module.min.js';

export function buildMeleeModels(world, part) {
  world.meleeModels={};world.meleeArms=[0,1].map(()=>{const arm=part(world.weaponCamera||world.viewRoot,'bevel',[.10,.11,1],[0,0,0],world.weaponMaterial('#354b48'));arm.visible=false;return arm;});
  const profiles={
    combat:[[-.035,0],[-.035,.25],[0,.45],[.045,.28],[.035,0]],
    machete:[[-.04,0],[-.065,.4],[.025,.56],[.1,.5],[.08,.08],[.035,0]],
    katana:[[-.025,0],[-.02,.55],[.055,.91],[.095,.97],[.055,.54],[.025,0]],
    axe:[[-.04,.28],[-.10,.44],[-.085,.62],[.10,.61],[.24,.54],[.20,.36],[.06,.39],[.035,.27]]
  };
  for(const [id,info]of Object.entries(window.Blackout.MELEE)){
    const group=new THREE.Group();world.viewRoot.add(group);group.visible=false;world.meleeModels[id]=group;
    const bladeMaterial=new THREE.MeshStandardMaterial({color:info.color,roughness:.25,metalness:.83});
    const shape=new THREE.Shape();
    if(id==='karambit'){shape.moveTo(-.03,0);shape.bezierCurveTo(-.11,.17,-.08,.34,.16,.37);shape.bezierCurveTo(.04,.25,.015,.12,.035,0);shape.closePath();}
    else {profiles[id].forEach(([x,y],i)=>{if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);});shape.closePath();}
    // The wrist is the animation pivot; the blade rotates inside the grip, not around its tip.
    const grip=new THREE.Group();group.add(grip);const reverse=id==='combat'||id==='karambit';
    grip.rotation.z=reverse?Math.PI:0;grip.position.y=reverse?-.10:.10;
    const blade=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.014,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:2,steps:1,curveSegments:12}),bladeMaterial);grip.add(blade);
    const add=(shape,size,pos,color,r=[0,0,0])=>part(grip,shape,size,pos,world.weaponMaterial(color),r);
    const handle=id==='katana'?.32:id==='axe'?.48:.17;
    add('bevel',[.06,handle,.055],[0,-handle*.46,0],id==='axe'?'#735849':'#263b3b');
    for(let i=0;i<6;i++)add('bevel',[.067,.012,.061],[0,-.03-i*handle*.13,0],id==='katana'?'#9b8060':'#52665f');
    if(id==='karambit'){
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.037,.009,8,20),world.weaponMaterial('#889c96'));ring.position.set(0,-.20,0);grip.add(ring);
    }else if(id!=='axe')add('bevel',[id==='katana'?.15:.11,.024,.075],[0,.015,0],'#aaa789');
    const hand=(parent,x,y,z)=>{
      part(parent,'bevel',[.11,.10,.12],[x,y,z],world.weaponMaterial('#687c6c'));
      for(let i=0;i<3;i++)part(parent,'bevel',[.025,.055,.10],[x-.034+i*.032,y+.015,z-.025],world.weaponMaterial('#354a40'));

    };
    hand(group,0,0,.035);
    const support=new THREE.Group();group.add(support);hand(support,-.02,-.17,.045);support.visible=id==='katana';
    group.userData.support=support;group.userData.grip=grip;group.userData.reverse=reverse;
    if(id==='katana')group.scale.setScalar(.68);else if(id==='axe')group.scale.setScalar(.85);
    const trail=new THREE.Mesh(blade.geometry,new THREE.MeshBasicMaterial({color:info.color,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));trail.position.z=-.025;trail.rotation.z=.12;grip.add(trail);group.userData.trail=trail;

  }
}

const handPoint=new THREE.Vector3(),elbow=new THREE.Vector3();
export function updateMeleeArms(world,id,heavy=false){
 const model=world.meleeModels[id];world.viewRoot.updateWorldMatrix(true,true);
 world.meleeArms.forEach((arm,i)=>{
   arm.visible=!!id&&(i===0||id==='katana'||(id==='axe'&&heavy));if(!arm.visible)return;
   handPoint.set(i?-.02:0,i?-.17:0,.07);model.localToWorld(handPoint);world.weaponCamera.worldToLocal(handPoint);
   elbow.set(i?-.55:.62,-.67,-.20);arm.position.copy(handPoint).lerp(elbow,.5);arm.scale.set(.10,.11,handPoint.distanceTo(elbow));arm.lookAt(elbow);
 });
}

export function spawnBossActor(world,enemy,part) {
  const group=new THREE.Group(),bodyColor='#4d5e65';
  const bodyMat=new THREE.MeshStandardMaterial({color:bodyColor,metalness:.4,roughness:.57});
  const skinMat=new THREE.MeshStandardMaterial({color:'#8a8e70',roughness:.88});
  const coreMat=new THREE.MeshStandardMaterial({color:'#e9a570',emissive:'#ec5e30',emissiveIntensity:1.1,roughness:.3});
  const torso=part(group,'bevel',[1.2,1.35,.66],[0,2.23,0],bodyMat);
  part(group,'bevel',[.78,.42,.55],[0,1.45,0],bodyMat);part(group,'cylinder',[.29,.40,.25],[0,3.06,0],skinMat);
  const head=part(group,'sphere',[.41,.37,.35],[0,3.6,0],skinMat);
  for(const side of [-1,1]){
    part(head,'bevel',[.28,.12,.10],[side*.37,.08,.86],coreMat);
    part(group,'bevel',[.40,.27,.72],[side*.73,2.9,0],bodyMat,[0,0,-side*.15]);
    part(group,'cone',[.16,.4,.16],[side*.70,3.23,.02],bodyMat,[0,0,-side*.5]);
    part(group,'bevel',[.18,.65,.10],[side*.38,2.2,.39],bodyMat,[0,0,-side*.2]);
  }
  part(head,'bevel',[.72,.12,.12],[0,-.50,.70],world.weaponMaterial('#2c383a'));
  for(let i=-2;i<=2;i++)part(head,'bevel',[.06,.10,.04],[i*.11,-.49,.84],world.weaponMaterial('#c2b895'));
  const core=part(group,'sphere',[.21,.24,.12],[0,2.35,.41],coreMat);
  const plates=[];for(const side of [-1,1])plates.push(part(group,'bevel',[.42,.78,.13],[side*.35,2.30,.43],bodyMat,[0,0,-side*.12]));
  const limbs=[];
  for(const side of [-1,1]){
    const leg=new THREE.Group();leg.position.set(side*.30,1.36,0);group.add(leg);
    part(leg,'bevel',[.38,1.12,.40],[0,-.52,0],bodyMat);part(leg,'bevel',[.43,.20,.60],[0,-1.18,.11],world.weaponMaterial('#253a3d'));limbs.push(leg);
    const arm=new THREE.Group();arm.position.set(side*.79,2.82,0);group.add(arm);
    part(arm,'bevel',[.37,.93,.38],[0,-.40,0],bodyMat);part(arm,'bevel',[.42,.39,.38],[0,-1.05,.05],skinMat);limbs.push(arm);
    for(let i=-1;i<=1;i++)part(arm,'cone',[.05,.24,.05],[i*.11,-1.31,.13],world.weaponMaterial('#c0bc99'),[Math.PI,0,0]);
  }
  group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});world.scene.add(group);
  const actor={group,limbs,head,torso,bodyMat,skinMat,bodyColor,kind:'boss',dying:false,age:0,baseHeadY:.37,core,coreMat,plates,ownedMaterials:[coreMat]};world.actors.set(enemy.id,actor);return actor;
}

export class BossEffects {
  constructor(scene) {
    this.scene=scene;this.pool=new Map();this.ringGeometry=new THREE.RingGeometry(.94,1,64);this.discGeometry=new THREE.CircleGeometry(.98,48);
    const mat=new THREE.MeshBasicMaterial({color:'#eeac65',side:THREE.DoubleSide,transparent:true,opacity:.75,depthWrite:false});
    this.slam=new THREE.Mesh(this.ringGeometry,mat);this.slam.rotation.x=-Math.PI/2;this.slam.visible=false;scene.add(this.slam);
    this.lane=new THREE.Mesh(new THREE.BoxGeometry(1,.025,1),new THREE.MeshBasicMaterial({color:'#e77e57',transparent:true,opacity:.24,depthWrite:false}));this.lane.visible=false;scene.add(this.lane);
    this.impact=this.slam.clone();this.impact.material=mat.clone();this.impact.visible=false;scene.add(this.impact);this.impactAge=0;
  }
  event(e){if(e.type==='bossslam'){this.impact.position.set(e.x,.045,e.z);this.impactAge=.5;}}
  reset(){for(const id of [...this.pool.keys()])this.remove(id);this.slam.visible=this.lane.visible=this.impact.visible=false;this.impactAge=0;}
  remove(id){const g=this.pool.get(id);if(!g)return;this.scene.remove(g);g.children.forEach(m=>m.material.dispose());this.pool.delete(id);}
  update(game,dt){
    const b=game.boss,s=b?.skill;this.slam.visible=s?.type==='slam';this.lane.visible=s?.type==='charge'||s?.type==='rush';
    if(this.slam.visible){this.slam.position.set(s.x,.035,s.z);this.slam.scale.setScalar(s.radius);this.slam.material.opacity=.5+Math.sin(game.time*14)*.22;this.slam.material.color.set(b.enraged?'#ff6655':'#f2b966');}
    if(this.lane.visible){this.lane.scale.set(1.9,1,s.length);this.lane.position.set(s.x+s.dx*s.length*.5,.03,s.z+s.dz*s.length*.5);this.lane.rotation.y=Math.atan2(s.dx,s.dz);this.lane.material.opacity=s.type==='rush'?.12:.22+Math.sin(game.time*15)*.08;}
    const alive=new Set(game.hazards.map(h=>h.id));
    for(const h of game.hazards){let g=this.pool.get(h.id);if(!g){g=new THREE.Group();const m=new THREE.Mesh(this.discGeometry,new THREE.MeshBasicMaterial({color:'#d7c16d',side:THREE.DoubleSide,transparent:true,opacity:.1,depthWrite:false}));m.rotation.x=-Math.PI/2;g.add(m);const ring=new THREE.Mesh(this.ringGeometry,m.material.clone());ring.rotation.x=-Math.PI/2;g.add(ring);this.scene.add(g);this.pool.set(h.id,g);}
      g.position.set(h.x,.04,h.z);g.scale.setScalar(h.type==='shockwave'&&h.warning>0?h.maxRadius:h.radius);g.children[0].visible=h.type!=='shockwave';g.children[0].material.color.set(h.type==='shockwave'?'#ffad65':h.warning>0?'#eeb663':'#8acb4d');g.children[1].material.color.copy(g.children[0].material.color);g.children[0].material.opacity=h.warning>0?.10:.22;g.children[1].material.opacity=h.warning>0?.5+Math.sin(game.time*15)*.25:.6*Math.min(1,h.life);}
    for(const id of this.pool.keys())if(!alive.has(id))this.remove(id);
    this.impactAge=Math.max(0,this.impactAge-dt);this.impact.visible=this.impactAge>0;if(this.impact.visible){this.impact.scale.setScalar((1-this.impactAge/.5)*5.5);this.impact.material.opacity=this.impactAge;}
  }
}
