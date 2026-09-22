import * as THREE from 'three';
const material=(color:number)=>new THREE.MeshStandardMaterial({color,roughness:.5});
export function makeBottle(){
 const g=new THREE.Group();
 const body=new THREE.Mesh(new THREE.CapsuleGeometry(.12,.3,4,8),material(0x46cba9));body.scale.z=.7;g.add(body);
 const cap=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.1,8),material(0xf5cc47));cap.position.y=.29;g.add(cap);
 const label=new THREE.Mesh(new THREE.BoxGeometry(.19,.18,.012),material(0xe9f8e3));label.position.set(0,-.015,.09);g.add(label);
 const stripe=new THREE.Mesh(new THREE.BoxGeometry(.13,.045,.015),material(0x197b6f));stripe.position.set(0,-.015,.102);g.add(stripe);
 return g;
}
export function makeSpill(blood=false){
 const g=new THREE.Group();
 const mat=new THREE.MeshStandardMaterial({color:blood?0x791f2b:0x46ddbc,transparent:true,opacity:blood?.8:.65,roughness:blood?.85:.12,depthWrite:false});
 for(let i=0;i<7;i++){const a=i*2.4,r=i===0?0:.55;const m=new THREE.Mesh(new THREE.CircleGeometry(i===0?.75:.45,16),mat);m.rotation.x=-Math.PI/2;m.position.set(Math.cos(a)*r,.025+i*.001,Math.sin(a)*r);m.scale.set(1,.65+Math.sin(i)*.2,1);g.add(m);}
 if(!blood)for(let i=0;i<14;i++){const a=i*2.4,r=.25+(i%4)*.2;const foam=new THREE.Mesh(new THREE.SphereGeometry(.035+(i%3)*.012,6,4),material(0xe1fff8));foam.position.set(Math.cos(a)*r,.055,Math.sin(a)*r);g.add(foam);}
 return g;
}
export function makeKnife(){
 const g=new THREE.Group();
 const handle=new THREE.Mesh(new THREE.BoxGeometry(.085,.23,.08),material(0x24252b));g.add(handle);
 const blade=new THREE.Mesh(new THREE.ConeGeometry(.085,.38,3),material(0xb3c3cc));blade.scale.z=.25;blade.position.y=.28;g.add(blade);
 const guard=new THREE.Mesh(new THREE.BoxGeometry(.17,.035,.085),material(0x67757c));guard.position.y=.115;g.add(guard);
 return g;
}
export function makeSmokePickup(){
 const g=new THREE.Group();g.name='smoke-pickup';
 const can=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.32,8),material(0x52666b));can.rotation.z=Math.PI/2;can.castShadow=true;g.add(can);
 const band=new THREE.Mesh(new THREE.CylinderGeometry(.135,.135,.09,8),material(0xc5ed67));band.rotation.z=Math.PI/2;g.add(band);
 const pin=new THREE.Mesh(new THREE.TorusGeometry(.075,.014,5,10),material(0xa9b7b9));pin.position.set(.19,.07,0);pin.rotation.y=Math.PI/2;g.add(pin);
 const glow=new THREE.PointLight(0xbfe96a,.7,2.4);glow.position.y=.25;g.add(glow);
 return g;
}
export function makeSmokeCloud(){
 const g=new THREE.Group();g.name='smoke-cloud';
 const mat=new THREE.MeshStandardMaterial({color:0xb8c4c2,transparent:true,opacity:.72,roughness:1,depthWrite:false,flatShading:true});
 for(let i=0;i<18;i++){
  const a=i*2.399,r=.35+(i%5)*.42;
  const puff=new THREE.Mesh(new THREE.DodecahedronGeometry(.65+(i%4)*.13,0),mat.clone());
  puff.position.set(Math.cos(a)*r,.5+(i%4)*.45,Math.sin(a)*r);puff.scale.set(1.25,.85,1.25);g.add(puff);
 }
 return g;
}
