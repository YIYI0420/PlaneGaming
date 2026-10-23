const assert=require('node:assert/strict');
const {MouseControls}=require('../blackout/controls.js');
const {Game}=require('../blackout/engine.js');
class Surface { constructor(){this.listeners={};} addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);} dispatch(name,event){for(const fn of this.listeners[name]||[])fn({clientX:0,clientY:0,preventDefault(){},...event});} }
let cases=0;
for(const locked of [false,true])for(const order of [[2,0],[0,2]])for(const releaseFirst of [0,2]){
  const canvas=new Surface(),doc=new Surface(),g=new Game();if(locked)doc.pointerLockElement=canvas;
  const mouse=new MouseControls(canvas,doc,{enabled:()=>!g.frozen,engage(){},look(){}});
  let mask=0;const bit=b=>b===0?1:2;
  for(const button of order){mask|=bit(button);doc.dispatch('mousedown',{target:canvas,button,buttons:mask});}
  assert.equal(mouse.fire,true);assert.equal(mouse.aim,true);g.step(.02,{fire:mouse.fire,aim:mouse.aim});assert.equal(g.ammo.rifle,29);assert.equal(g.zoom,1.25);
  mask&=~bit(releaseFirst);doc.dispatch('mouseup',{button:releaseFirst,buttons:mask});assert.equal(mouse.fire,releaseFirst!==0);assert.equal(mouse.aim,releaseFirst!==2);
  doc.dispatch('mouseup',{button:releaseFirst===0?2:0,buttons:0});assert.equal(mouse.fire,false);assert.equal(mouse.aim,false);cases++;
}
{
 const canvas=new Surface(),doc=new Surface(),g=new Game(),mouse=new MouseControls(canvas,doc,{enabled:()=>!g.frozen,engage(){},look(){}});
 doc.dispatch('mousedown',{target:canvas,button:2,buttons:2});doc.dispatch('mousemove',{buttons:0});assert.equal(mouse.aim,false);
 doc.dispatch('mousedown',{target:canvas,button:0,buttons:1,sourceCapabilities:{firesTouchEvents:true}});assert.equal(mouse.fire,false);
 doc.dispatch('mousedown',{target:{},button:0,buttons:1});assert.equal(mouse.fire,false);
 doc.dispatch('mousedown',{target:canvas,button:0,buttons:1});mouse.reset();assert.equal(mouse.fire,false);
 g.pause();doc.dispatch('mousedown',{target:canvas,button:0,buttons:1});assert.equal(mouse.fire,false);
}
console.log(`PASS: ${cases} left/right press and release orders, locked/unlocked aim-and-fire, missed release recovery, touch/UI isolation, focus reset and pause.`);
