import * as THREE from './vendor/three.module.min.js';
// Camera-relative wrist poses: position XYZ followed by Euler XYZ, in radians.
export const MELEE_POSES={
 combat:{idle:[.32,-.10,-.98,.10,.10,-.22],light:[[.41,-.16,-.76,.4,-.35,-.4],[.03,-.02,-1.13,1.35,.18,-.12],[-.06,-.1,-1.02,1.5,.35,.2]],heavy:[[.4,-.04,-.65,.8,-.6,-.25],[.00,.02,-1.28,1.6,.05,0],[-.08,-.15,-1.08,1.9,.35,.4]]},
 karambit:{idle:[.34,-.12,-.94,.2,-.3,-.5],light:[[.48,-.08,-.82,.6,-.6,-.8],[.03,-.03,-1.03,1.1,.5,.45],[-.24,-.11,-.94,.5,.8,1.1]],heavy:[[.40,-.37,-.75,.1,-.6,-.9],[.02,.06,-1.12,1.5,.25,.2],[-.16,.27,-.92,2.1,.6,.9]]},
 machete:{idle:[.34,-.26,-1.02,-.35,-.3,-.45],light:[[.53,-.08,-.93,-.5,-.8,-1.05],[.04,-.07,-1.13,-1.05,.1,.2],[-.35,-.2,-1.02,-.9,.8,1.1]],heavy:[[.47,.04,-.85,-.25,-.8,-.9],[.02,-.06,-1.2,-1.4,.1,.15],[-.29,-.35,-1.0,-1.75,.55,.9]]},
 katana:{idle:[.32,-.30,-1.18,-.45,-.25,-.35],light:[[.43,.03,-1.03,-.3,-.45,-.85],[.02,-.04,-1.30,-1.15,.15,.15],[-.22,-.26,-1.17,-1.4,.5,.8]],heavy:[[.24,-.18,-.82,-1.45,.1,-.1],[.00,-.08,-1.48,-1.5,0,0],[-.08,-.12,-1.30,-1.7,.1,.15]]},
 axe:{idle:[.34,-.28,-1.10,-.2,-.3,-.25],light:[[.42,.05,-1.0,-.1,-.4,-.25],[.02,-.09,-1.16,-1.35,.1,.08],[-.08,-.38,-1.02,-1.9,.25,.3]],heavy:[[.24,.23,-.94,.2,-.15,0],[.00,-.09,-1.26,-1.45,.05,0],[-.08,-.42,-1.08,-2.05,.2,.2]]}
};
const v=new THREE.Vector3(),q=new THREE.Quaternion(),euler=new THREE.Euler();
function setPose(root,a){root.position.fromArray(a);root.quaternion.setFromEuler(euler.set(a[3],a[4],a[5]));}
export function applyMeleePose(root,id,action,now=0){
 const profile=MELEE_POSES[id],idle=profile.idle;
 if(!action){setPose(root,idle);root.position.y+=Math.sin(now*5)*.002;return;}
 const path=profile[action.type],times=[0,action.windup,action.impact,action.windup+action.active,action.duration];
 const poses=[idle,...path,idle];let index=0;while(index<3&&action.elapsed>times[index+1])index++;
 let t=THREE.MathUtils.clamp((action.elapsed-times[index])/Math.max(.001,times[index+1]-times[index]),0,1);t=t*t*(3-2*t);
 const mirror=action.type==='light'&&action.combo===1&&['karambit','machete','katana'].includes(id);
 const key=n=>{const pose=poses[n];if(!mirror||n===0||n===4)return pose;return [.07-pose[0],pose[1],pose[2],pose[3],pose[4],-pose[5]];};
 const a=key(index),b=key(index+1);setPose(root,a);v.fromArray(b);q.setFromEuler(euler.set(b[3],b[4],b[5]));root.position.lerp(v,t);root.quaternion.slerp(q,t);
}
