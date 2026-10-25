/* Catch errors at the pointer-lock request itself. Other game errors remain visible. */
(function(root){
  function createBlackoutPointerCapture(canvas,callbacks={}){
    const doc=canvas.ownerDocument,original=canvas.requestPointerLock;
    let flight=null,blocked=false,locked=doc.pointerLockElement===canvas;
    const notify=(name,value)=>{if(typeof callbacks[name]==='function')callbacks[name](value);};
    function failed(error,ticket){
      if(ticket&&flight!==ticket)return;
      flight=null;
      if(doc.pointerLockElement===canvas)return;
      blocked=true;
      console.warn('Mouse capture was cancelled or unavailable:',error&&error.message||error);
      notify('onReleased',error);
    }
    function request(options){
      if(doc.pointerLockElement===canvas)return Promise.resolve();
      if(flight)return flight.promise;
      const activation=doc.defaultView&&doc.defaultView.navigator&&doc.defaultView.navigator.userActivation;
      if(blocked||(doc.hasFocus&&!doc.hasFocus())||(activation&&!activation.isActive)){
        failed(new Error('Click the game to capture the mouse again.'));return Promise.resolve();
      }
      const ticket={promise:undefined};flight=ticket;
      try{
        if(typeof original!=='function')throw new Error('Pointer lock is not supported by this browser.');
        const result=original.call(canvas,options);
        if(result&&typeof result.then==='function'){
          ticket.promise=Promise.resolve(result).then(()=>{if(flight===ticket)flight=null;},error=>failed(error,ticket));
          return ticket.promise;
        }
        // Older implementations report their result only through document events.
        return undefined;
      }catch(error){failed(error,ticket);return Promise.resolve();}
    }
    function gesture(event){if(event.isTrusted)blocked=false;}
    function change(){
      const now=doc.pointerLockElement===canvas;flight=null;
      if(now&&!locked){blocked=false;notify('onCaptured');}
      else if(!now&&locked){blocked=true;notify('onReleased');}
      locked=now;
    }
    function error(){failed(new Error('The browser declined mouse capture.'));}
    canvas.requestPointerLock=request;
    canvas.addEventListener('pointerdown',gesture,true);
    canvas.addEventListener('mousedown',gesture,true);
    doc.addEventListener('pointerlockchange',change);
    doc.addEventListener('pointerlockerror',error);
    return {
      setCallbacks(value){callbacks=value||{};},
      dispose(){canvas.requestPointerLock=original;canvas.removeEventListener('pointerdown',gesture,true);canvas.removeEventListener('mousedown',gesture,true);doc.removeEventListener('pointerlockchange',change);doc.removeEventListener('pointerlockerror',error);}
    };
  }
  if(typeof module==='object'&&module.exports)module.exports=createBlackoutPointerCapture;
  else root.createBlackoutPointerCapture=createBlackoutPointerCapture;
})(typeof globalThis!=='undefined'?globalThis:this);
