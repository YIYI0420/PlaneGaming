const assert=require('node:assert/strict');const {Game}=require('../blackout/engine.js');
const step=(g,t,input={})=>{for(let i=0;i<t/.01;i++)g.step(.01,input);};
{
 const g=new Game();assert.ok(g.jump());assert.equal(g.jump(),false);step(g,.34);assert.ok(g.player.feet>.8);const feet=g.player.feet;g.pause();step(g,1);assert.equal(g.player.feet,feet);assert.equal(g.jump(),false);g.resume();step(g,1);assert.equal(g.player.feet,0);assert.equal(g.player.y,1.65);assert.ok(g.player.grounded);
}
{
 const g=new Game();g.player.z=-2.05;g.player.x=0;assert.ok(g.jump());step(g,.25);step(g,.25,{forward:1});step(g,.4);assert.equal(g.player.feet,.7,'land on low cover');assert.equal(g.player.grounded,true);step(g,1,{x:1});step(g,1);assert.equal(g.player.feet,0,'fall from cover onto floor');assert.ok(g.player.grounded);
}
{
 const g=new Game();g.player.x=-7;g.player.z=5;g.jump();step(g,1,{forward:1});assert.ok(g.player.z>=4.32,'jump cannot bypass full bus collision');assert.equal(g.player.feet,0);
}
console.log('PASS: jump arc, no double jump, pause, landing on cover, walking off and bus collision.');
