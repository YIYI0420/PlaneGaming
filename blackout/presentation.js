import * as THREE from './vendor/three.module.min.js';
export const QUALITY = {
  low: { ratio: 1, minimum: 1, shadows: false, shadowSize: 512, anisotropy: 2 },
  standard: { ratio: 1.5, minimum: 1, shadows: true, shadowSize: 1024, anisotropy: 4 },
  high: { ratio: 2, minimum: 1.5, shadows: true, shadowSize: 2048, anisotropy: 8 }
};
export const RED_SIGHT_CENTER = new THREE.Vector3(0, .16, .02);
export function applyCameraPose(camera, player) {
  camera.position.set(player.x, player.y, player.z); camera.rotation.set(player.pitch,player.yaw,0,'YXZ');
}
export function applyWeaponPose(root, game, time) {
  const reload = game.reloadTime > 0 ? Math.sin((1 - game.reloadTime / game.reloadDuration) * Math.PI) : 0;
  const sight = game.weapon === 'pistol' ? { x: 0, y: .105 } : RED_SIGHT_CENTER;
  const aim = game.aiming && game.weapon!=='melee';
  // In ADS, the sight centre sits on the camera's -Z ray. Recoil moves the weapon along Z only.
  root.position.set(aim ? -sight.x : .245, (aim ? -sight.y : -.235 + Math.sin(time * 7) * .002) - reload * .26, -.64 + game.player.recoil * .35);
  root.rotation.set(-reload * .16, .03 * reload, -.52 * reload);
  root.visible = !(aim && game.weapon === 'rifle' && game.optic !== 'red');
  return reload;
}
