import test from 'node:test';
import assert from 'node:assert/strict';
import {captureTarget,detergentLanding,ATTACK_RANGE} from '../app/components/game-actions.ts';
import {canMove,clearLine} from '../app/components/factory-layout.ts';
import {makeBottle,makeSpill,makeKnife} from '../app/components/game-props.ts';
const origin={x:0,z:20};
const target=(x,z,extra={})=>({alive:true,hidden:false,position:{x,z},...extra});
test('attack reaches 2.6m and selects nearest living visible target',()=>{
 const near=target(0,21),far=target(0,22.5);
 assert.equal(captureTarget(origin,[far,near],false,()=>true),near);
 assert.equal(captureTarget(origin,[far],false,()=>true),far);
 assert.equal(captureTarget(origin,[target(0,20+ATTACK_RANGE+.01)],false,()=>true),undefined);
 assert.equal(captureTarget(origin,[target(0,21,{alive:false})],false,()=>true),undefined);
});
test('attack cannot hit through walls and inspection targets only hidden survivors',()=>{
 const a={x:0,z:-1},b=target(0,1);
 assert.equal(captureTarget(a,[b],false,clearLine),undefined);
 const hidden=target(0,21,{hidden:true});
 assert.equal(captureTarget(origin,[hidden],false,()=>true),undefined);
 assert.equal(captureTarget(origin,[hidden],true,()=>true),hidden);
});
test('detergent lands ahead, stays reachable and stops before walls',()=>{
 const a={x:-10,z:-10};
 const p=detergentLanding(a,{x:-1,z:0},canMove,(a,b)=>clearLine(a,b,.15));
 assert.ok(canMove(p.x,p.z));assert.ok(clearLine(a,p,.15));assert.ok(p.x> -11);
 const open={x:0,z:15};assert.deepEqual(detergentLanding(open,{x:0,z:-1},canMove,clearLine),{x:0,z:13.3});
});
test('detergent and attack props contain finite geometry',()=>{
 for(const g of [makeBottle(),makeSpill(),makeSpill(true),makeKnife()]){
  assert.ok(g.children.length>=3);
  g.traverse(o=>{if(o.geometry){const vertices=o.geometry.getAttribute('position').array;assert.ok([...vertices].every(Number.isFinite));o.geometry.dispose();o.material.dispose();}});
 }
});
