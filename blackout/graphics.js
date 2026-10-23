import * as THREE from './vendor/three.module.min.js';
import { QUALITY } from './presentation.js';

export function beveledBox() {
  const s = new THREE.Shape(); s.moveTo(-.44,-.44); s.lineTo(.44,-.44); s.lineTo(.44,.44); s.lineTo(-.44,.44); s.closePath();
  const g = new THREE.ExtrudeGeometry(s,{depth:.88,steps:1,bevelEnabled:true,bevelThickness:.06,bevelSize:.06,bevelSegments:2,curveSegments:1}); g.center(); g.computeVertexNormals(); return g;
}
function texture(size, draw, repeat = 1) {
  const canvas = document.createElement('canvas'); canvas.width=canvas.height=size; draw(canvas.getContext('2d'),size);
  const t=new THREE.CanvasTexture(canvas); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(repeat,repeat); return t;
}
export function surfaceTextures() {
  let seed=34571; const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const asphalt=texture(512,(c,n)=>{
    c.fillStyle='#5f6869';c.fillRect(0,0,n,n);
    for(let i=0;i<37000;i++){const v=50+Math.floor(rand()*82);c.fillStyle=`rgba(${v},${v+3},${v+5},${.15+rand()*.42})`;c.fillRect(rand()*n,rand()*n,rand()*2+ .5,rand()*2+.5);}
    for(let i=0;i<7;i++){let x=rand()*n,y=rand()*n;c.strokeStyle='#222f3365';c.lineWidth=.5+rand();c.beginPath();c.moveTo(x,y);for(let j=0;j<8;j++){x+=(rand()-.5)*40;y+=12+rand()*15;c.lineTo(x,y);}c.stroke();}
  },8);
  const concrete=texture(256,(c,n)=>{c.fillStyle='#a8aca6';c.fillRect(0,0,n,n);for(let i=0;i<5000;i++){c.fillStyle=rand()>.5?'#d2d4ca22':'#2737331a';c.fillRect(rand()*n,rand()*n,1+rand()*5,1+rand()*8);}c.fillStyle='#243f3525';c.fillRect(0,n*.84,n,n*.16);},3);
  const fabric=texture(128,(c,n)=>{c.fillStyle='#c9cec0';c.fillRect(0,0,n,n);for(let y=0;y<n;y+=3){c.strokeStyle='#384b432f';c.beginPath();c.moveTo(0,y);c.lineTo(n,y);c.stroke();}for(let x=0;x<n;x+=3){c.strokeStyle='#5f74641e';c.beginPath();c.moveTo(x,0);c.lineTo(x,n);c.stroke();}});
  const contact=texture(128,(c,n)=>{const g=c.createRadialGradient(n/2,n/2,n*.06,n/2,n/2,n*.5);g.addColorStop(0,'rgba(0,0,0,.48)');g.addColorStop(.45,'rgba(0,0,0,.24)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,n,n);});
  return { asphalt,concrete,fabric,contact };
}
function skyMaterial() {
  return new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{sunStrength:{value:1},topColor:{value:new THREE.Color('#0e1a2b')},horizonColor:{value:new THREE.Color('#70614a')}},vertexShader:`varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float sunStrength;uniform vec3 topColor;uniform vec3 horizonColor;varying vec3 vDirection;void main(){vec3 d=normalize(vDirection);float h=max(d.y,0.);vec3 top=topColor,horizon=horizonColor;vec3 sky=mix(horizon,top,pow(h,.4));float sun=max(dot(d,normalize(vec3(-.55,.30,-.64))),0.);sky+=(vec3(1.,.52,.19)*pow(sun,64.)*.36+vec3(2.2,1.35,.6)*pow(sun,1400.))*sunStrength;float cloud=sin(d.x*23.+d.z*18.)*sin(d.z*13.-d.x*8.);sky+=vec3(.09,.10,.12)*smoothstep(.20,.65,cloud)*smoothstep(.04,.32,d.y)*.28;gl_FragColor=vec4(sky,1.);}`});
}
export function upgradeEnvironment(world) {
  const {scene,renderer}=world; world.textures=surfaceTextures();
  const sky=world.sky=new THREE.Mesh(new THREE.SphereGeometry(60,32,16),skyMaterial());sky.renderOrder=-100;sky.frustumCulled=false;sky.userData.noShadow=true;scene.add(sky);
  const envScene=new THREE.Scene();envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50,24,12),skyMaterial()));
  const pmrem=new THREE.PMREMGenerator(renderer);world.environment=pmrem.fromScene(envScene,.04).texture;scene.environment=world.environment;pmrem.dispose();envScene.children[0].geometry.dispose();envScene.children[0].material.dispose();
  const ground=world.ground=new THREE.Mesh(new THREE.PlaneGeometry(36,44),new THREE.MeshStandardMaterial({color:'#89918c',map:world.textures.asphalt,bumpMap:world.textures.asphalt,bumpScale:.025,roughness:.93,metalness:.04}));ground.rotation.x=-Math.PI/2;ground.position.y=-.043;ground.receiveShadow=true;scene.add(ground);
  world.contactMaterial=new THREE.MeshBasicMaterial({map:world.textures.contact,transparent:true,depthWrite:false,opacity:.85,polygonOffset:true,polygonOffsetFactor:-1});
  for(const o of window.Blackout.OBSTACLES){
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(o.x2-o.x1+2,o.z2-o.z1+2),world.contactMaterial);mesh.rotation.x=-Math.PI/2;mesh.position.set((o.x1+o.x2)/2,-.034,(o.z1+o.z2)/2);world.mapRoot.add(mesh);
  }
  // Soft emergency lighting and glossy shallow oil patches add depth without remote assets.
  for(const [x,z,color] of [[11.6,13.5,'#ffb16d'],[-14,17,'#ffd6a0'],[0,-19,'#b6e6b6']]){
    const lamp=new THREE.PointLight(color,8,10,2);lamp.position.set(x,2.8,z);scene.add(lamp);
    const glow=new THREE.Mesh(new THREE.PlaneGeometry(5,5),new THREE.MeshBasicMaterial({map:world.textures.contact,color,transparent:true,opacity:.17,depthWrite:false,blending:THREE.AdditiveBlending}));glow.rotation.x=-Math.PI/2;glow.position.set(x,-.02,z);scene.add(glow);
  }
  for(const [x,z,sx,sz]of [[-3.8,7.4,1.5,.7],[9.8,-9,1.3,2],[2,13,.9,.5],[-11,-11,.8,.6]]){
    const shape=new THREE.Shape();for(let i=0;i<14;i++){const a=i/14*Math.PI*2,r=.78+Math.sin(i*8.3)*.17;const px=Math.cos(a)*sx*r,pz=Math.sin(a)*sz*r;if(!i)shape.moveTo(px,pz);else shape.lineTo(px,pz);}shape.closePath();
    const m=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshStandardMaterial({color:'#304349',roughness:.13,metalness:.45,transparent:true,opacity:.64}));m.rotation.x=-Math.PI/2;m.position.set(x,-.03,z);m.receiveShadow=true;scene.add(m);
  }
  // Bus-stop seats, steel fence mesh and scattered documents stay outside the playable paths.
  const detail=new THREE.Group();scene.add(detail);
  const add=(w,h,d,x,y,z,color)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.6,metalness:.3}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;detail.add(m);return m;};
  for(const z of [-15,1,12]){add(.55,.10,2.4,16.2,.62,z,'#485b5b');add(.10,.75,2.4,16.48,.95,z,'#738681');for(const dz of [-.9,.9])add(.08,.6,.12,16.2,.3,z+dz,'#273a40');}
  const wirePositions=[];for(const side of [-18,18])for(let z=-21;z<21;z+=.5){wirePositions.push(side,.8,z,side,2.4,z+1.2,side,2.4,z,side,.8,z+1.2);}const wire=new THREE.BufferGeometry();wire.setAttribute('position',new THREE.Float32BufferAttribute(wirePositions,3));scene.add(new THREE.LineSegments(wire,new THREE.LineBasicMaterial({color:'#82918b',transparent:true,opacity:.25})));
  for(let i=0;i<18;i++){const x=(i%2?1:-1)*(10+(i%4)*1.7),z=-17+i*1.9;const m=add(.14,.005,.22,x,-.025,z,'#adaf99');m.rotation.y=i*1.72;}
}
export function applyQuality(world, value) {
  const p=QUALITY[value]||QUALITY.standard;world.quality=value;
  world.renderer.shadowMap.enabled=p.shadows;world.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  if(world.sun.shadow.mapSize.x!==p.shadowSize){world.sun.shadow.map?.dispose();world.sun.shadow.map=null;world.sun.shadow.mapSize.set(p.shadowSize,p.shadowSize);}
  world.sun.castShadow=p.shadows;
  world.scene.environment=value==='low'?null:world.environment;world.weaponScene.environment=world.scene.environment;
  if(world.textures)for(const [key,t]of Object.entries(world.textures)){if(key==='contact')continue;t.anisotropy=Math.min(p.anisotropy,world.renderer.capabilities.getMaxAnisotropy());t.needsUpdate=true;}
  world.sun.shadow.camera.updateProjectionMatrix();
  world.scene.traverse(o=>{if(o.isMesh){o.receiveShadow=!o.userData.noShadow;o.castShadow=!o.material.transparent&&!o.material.isShaderMaterial&&!o.userData.noShadow&&o!==world.particlePoints;}});
  world.scene.traverse(o=>{if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.needsUpdate=true;}});
  world.weaponScene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});
  world.resize();
}
