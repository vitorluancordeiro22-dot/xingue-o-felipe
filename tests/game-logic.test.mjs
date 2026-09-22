import test from 'node:test';
import assert from 'node:assert/strict';
import {bounds,canMove,clearLine,findPath,hideSpots,smokeSpawns,spawn,botSpawns,patrolPoints,obstacles} from '../app/components/factory-layout.ts';
import {taunts,createTauntDeck} from '../app/components/taunts.ts';
import {createTrainingRound} from '../app/components/round-roles.ts';

test('every character can draw Felipe without losing its lobby selection',()=>{
 for(const selected of ['luan','lucas','joao','vitin','matheus']){
  for(let seat=0;seat<6;seat++){
   const round=createTrainingRound(selected,()=>(seat+.5)/6);
   assert.equal(round.felipeSeat,seat);
   assert.equal(round.hunterRole,seat===0);
   assert.equal(round.playerSkin,seat===0?'felipe':selected);
   assert.equal(round.survivors.length+(round.hunterRole?0:1),5);
   assert.equal(new Set(round.survivors).size,round.survivors.length);
  }
  assert.equal(createTrainingRound(selected,()=>.5).playerSkin,selected);
 }
});

test('factory is four times the original area with 18 different hides',()=>{
 assert.equal(bounds.x*2*bounds.z*2,3200);
 assert.equal(hideSpots.length,18);
 assert.equal(new Set(hideSpots.map(h=>h.kind)).size,3);
});
test('every spawn, patrol point and hide entrance is navigable and connected',()=>{
 const points=[spawn,...botSpawns,...patrolPoints,...smokeSpawns,...hideSpots.map(h=>h.entry)];
 for(const p of points){
  assert.ok(canMove(p.x,p.z),JSON.stringify(p)+' blocked');
  const path=findPath(spawn,p);assert.ok(path.length,JSON.stringify(p)+' disconnected');
  assert.deepEqual(path.at(-1),p);
  let previous=spawn;
  for(const next of path){assert.ok(clearLine(previous,next,.42),JSON.stringify({previous,next}));previous=next;}
 }
});
test('patrol routes have collision-free segments',()=>{
 for(const a of patrolPoints)for(const b of patrolPoints){
  const path=findPath(a,b);assert.ok(path.length);let prev=a;
  for(const p of path){assert.ok(clearLine(prev,p,.42),JSON.stringify({prev,p}));prev=p;}
 }
});
test('walls and furniture block movement and sight',()=>{
 for(const o of obstacles){assert.equal(canMove(o.x,o.z),false);assert.equal(clearLine({x:o.x-o.w/2-1,z:o.z},{x:o.x+o.w/2+1,z:o.z}),false);}
 assert.equal(canMove(32,0),false);assert.equal(canMove(0,25),false);
});
test('periodically replanned movement reaches hides without sticking to corners',()=>{
 const dt=.05,speed=4.35;
 for(const target of hideSpots.map(h=>h.entry)){
  const pos={...spawn};let elapsed=0,pathAt=0,step=0,path=[];
  while(elapsed<100&&Math.hypot(pos.x-target.x,pos.z-target.z)>.2){
   elapsed+=dt;
   if(!path.length||elapsed>pathAt){path=findPath(pos,target);pathAt=elapsed+.9;step=0;}
   while(step<path.length&&Math.hypot(path[step].x-pos.x,path[step].z-pos.z)<.15)step++;
   if(step>=path.length)continue;
   const p=path[step],dx=p.x-pos.x,dz=p.z-pos.z,len=Math.hypot(dx,dz),distance=Math.min(speed*dt,len);
   const nx=pos.x+dx/len*distance,nz=pos.z+dz/len*distance;
   if(canMove(nx,pos.z))pos.x=nx;if(canMove(pos.x,nz))pos.z=nz;
  }
  assert.ok(elapsed<100,JSON.stringify({target,pos}));
 }
});
test('taunt deck exhausts unique phrases before repeating, including across boundaries',()=>{
 assert.ok(taunts.length>=200);
 const next=createTauntDeck();let last;
 for(let round=0;round<5;round++){
  const seen=new Set();for(let i=0;i<taunts.length;i++){const value=next();assert.notEqual(value,last);assert.ok(!seen.has(value));seen.add(value);last=value;}
  assert.equal(seen.size,taunts.length);
 }
});
