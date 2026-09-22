import * as THREE from 'three';
import {bounds,obstacles,hideSpots,sectors} from './factory-layout';
export function buildFactory(scene:THREE.Scene){
 const materials=new Map<number,THREE.MeshStandardMaterial>();
 const mat=(c:number)=>{if(!materials.has(c))materials.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.78}));return materials.get(c)!;};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:number)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));m.position.set(x,y,z);m.castShadow=h>.2;m.receiveShadow=true;scene.add(m);return m;};
 box(0,-.15,0,64,.3,50,0x303e46);
 for(const x of [-bounds.x,bounds.x])box(x,2.2,0,.5,4.4,50,0x3a4853);
 for(const z of [-bounds.z,bounds.z])box(0,2.2,z,64,4.4,.5,0x3a4853);
 for(const s of sectors){
  box(s.x,.008,s.z,18,.014,20,0x34434b);
  // Color-coded aisle stripes and overhead functional sector signs.
  box(s.x-8,.025,s.z,.1,.02,20,s.color);box(s.x+8,.025,s.z,.1,.02,20,s.color);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#14212a';ctx.fillRect(0,0,512,96);ctx.fillStyle='#d9e7e4';ctx.font='bold 32px Arial';ctx.fillText(s.name,18,59);
  const texture=new THREE.CanvasTexture(canvas);const sign=new THREE.Mesh(new THREE.PlaneGeometry(5.2,.95),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));sign.position.set(s.x,3.3,s.z<0?-3:3);scene.add(sign);
  for(const z of [s.z-5,s.z+5]){box(s.x,3.9,z,3,.08,.22,0xc3d7d6);const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,18,8),mat(s.color));pipe.rotation.z=Math.PI/2;pipe.position.set(s.x,4.1,z+2);scene.add(pipe);}
 }
 // Only three non-shadowing local lights; the flashlight does the close-up work.
 for(const [x,z,c] of [[-22,0,0x70b9b0],[0,-13,0xe4ae67],[22,0,0x7b9ed0]]){const light=new THREE.PointLight(c,18,28,1.3);light.position.set(x,3.6,z);scene.add(light);}
 for(const o of obstacles){
  if(o.kind==='tank'){
   const tank=new THREE.Mesh(new THREE.CylinderGeometry(o.w/2,o.w/2,o.h,14),mat(o.color));tank.position.set(o.x,o.h/2,o.z);tank.castShadow=true;scene.add(tank);
   for(const y of [.35,o.h-.35]){const ring=new THREE.Mesh(new THREE.TorusGeometry(o.w/2+.02,.055,5,14),mat(0x293d49));ring.rotation.x=Math.PI/2;ring.position.set(o.x,y,o.z);scene.add(ring);}box(o.x,o.h+.18,o.z,.45,.35,.45,0x607986);
  } else if(o.kind==='shelf'){
   for(const dx of [-o.w/2,o.w/2])for(const dz of [-o.d/2,o.d/2])box(o.x+dx,o.h/2,o.z+dz,.1,o.h,.1,0x32444d);
   for(let k=0;k<3;k++){const y=.25+k*(o.h-.5)/2;box(o.x,y,o.z,o.w,.1,o.d,0x556b70);box(o.x,y+.35,o.z,o.w*.75,.6,o.d*.78,o.color);}
  } else if(o.kind==='desk'){
   box(o.x,o.h,o.z,o.w,.15,o.d,o.color);for(const dx of [-o.w/2+.12,o.w/2-.12])for(const dz of [-o.d/2+.12,o.d/2-.12])box(o.x+dx,o.h/2,o.z+dz,.16,o.h,.16,0x25343f);
   box(o.x-.4,o.h+.25,o.z,.45,.4,.4,0x7198ac);box(o.x+.4,o.h+.2,o.z,.3,.3,.3,0xaebc8a);
  }else{box(o.x,o.h/2,o.z,o.w,o.h,o.d,o.color);if(o.kind==='crate'){for(const y of [.2,o.h-.2])box(o.x,y,o.z+o.d/2+.015,o.w,.14,.05,0x342d23);}}
 }
 const doors=new Map<number,THREE.Group>();
 hideSpots.forEach(h=>{
  const pivot=new THREE.Group();pivot.position.set(h.x-.78,0,h.z+.62);scene.add(pivot);doors.set(h.id,pivot);
  if(h.kind==='armário'){const door=new THREE.Mesh(new THREE.BoxGeometry(1.56,2.65,.05),mat(0x4b6970));door.position.set(.78,1.35,0);pivot.add(door);for(let i=0;i<4;i++)box(h.x,2.1+i*.1,h.z+.66,.7,.035,.03,0x17232a);}
  const marker=new THREE.Mesh(new THREE.BoxGeometry(.55,.12,.025),new THREE.MeshBasicMaterial({color:0x7bd6b4}));marker.position.set(h.x,h.kind==='armário'?2.85:1.85,h.z+.64);scene.add(marker);
 });
 return {doors};
}
