const assert=require('node:assert/strict');
const create=require('../Assets/WebGLTemplates/Blackout/pointer-capture.js');
class Events{
  constructor(){this.events=new Map();}
  addEventListener(type,fn){if(!this.events.has(type))this.events.set(type,new Set());this.events.get(type).add(fn);}
  removeEventListener(type,fn){this.events.get(type)?.delete(fn);}
  emit(type,event={}){for(const fn of this.events.get(type)||[])fn(event);}
}
function fixture(native){
  const doc=new Events(),canvas=new Events();let releases=0,captures=0;
  doc.hasFocus=()=>true;doc.defaultView={navigator:{userActivation:{isActive:true}}};doc.pointerLockElement=null;
  canvas.ownerDocument=doc;canvas.requestPointerLock=native;
  const controller=create(canvas,{onReleased:()=>releases++,onCaptured:()=>captures++});
  return {doc,canvas,controller,get releases(){return releases;},get captures(){return captures;}};
}
async function main(){
  const unhandled=[];const listener=e=>unhandled.push(e);process.on('unhandledRejection',listener);
  try{
    let calls=0;let f=fixture(()=>{calls++;return Promise.reject(Object.assign(new Error('The user has exited the lock before this request was completed.'),{name:'SecurityError'}));});
    await f.canvas.requestPointerLock();await new Promise(r=>setImmediate(r));
    assert.equal(f.releases,1);assert.equal(unhandled.length,0);
    await f.canvas.requestPointerLock();assert.equal(calls,1,'must not retry a cancelled request automatically');
    f.canvas.emit('pointerdown',{isTrusted:false});await f.canvas.requestPointerLock();assert.equal(calls,1,'synthetic input must not clear the retry guard');
    f.canvas.emit('pointerdown',{isTrusted:true});await f.canvas.requestPointerLock();assert.equal(calls,2);f.controller.dispose();

    let resolve;calls=0;f=fixture(()=>{calls++;return new Promise(r=>resolve=r);});
    const first=f.canvas.requestPointerLock(),second=f.canvas.requestPointerLock();assert.equal(first,second);assert.equal(calls,1);
    f.doc.pointerLockElement=f.canvas;f.doc.emit('pointerlockchange');resolve();await first;
    assert.equal(f.captures,1);f.doc.emit('pointerlockchange');assert.equal(f.captures,1);
    f.doc.pointerLockElement=null;f.doc.emit('pointerlockchange');assert.equal(f.releases,1);
    await f.canvas.requestPointerLock();assert.equal(calls,1,'Esc release must wait for a new genuine click');f.controller.dispose();

    f=fixture(()=>{throw Object.assign(new Error('Denied'),{name:'SecurityError'});});await f.canvas.requestPointerLock();assert.equal(f.releases,1);f.controller.dispose();
    calls=0;f=fixture(()=>{calls++;});assert.equal(f.canvas.requestPointerLock(),undefined);f.canvas.requestPointerLock();assert.equal(calls,1);
    f.doc.emit('pointerlockerror');assert.equal(f.releases,1);f.controller.dispose();
    calls=0;f=fixture(()=>{calls++;return Promise.resolve();});f.doc.defaultView.navigator.userActivation.isActive=false;
    await f.canvas.requestPointerLock();assert.equal(calls,0,'never call the native API without activation');assert.equal(f.releases,1);f.controller.dispose();
    f=fixture(undefined);await f.canvas.requestPointerLock();assert.equal(f.releases,1);f.controller.dispose();
    await new Promise(r=>setImmediate(r));assert.equal(unhandled.length,0);
    console.log('PASS: rejected/cancelled requests, duplicate requests, Esc release, trusted retry, sync errors, event-only browsers, inactive gesture and unsupported browsers. No unhandled rejection.');
  }finally{process.removeListener('unhandledRejection',listener);}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
