export type Point={x:number;z:number};
export type Obstacle=Point&{w:number;d:number;h:number;kind:'wall'|'shelf'|'tank'|'desk'|'crate'|'locker';color:number};
export type HideSpot=Point&{id:number;kind:'armário'|'caixote'|'bancada';entry:Point;seconds:number};
export const bounds={x:32,z:25};
export const sectors=[
 {x:-22,z:-13,name:'01 · ESTOQUE',color:0x52958f},
 {x:0,z:-13,name:'02 · MISTURA',color:0xba9856},
 {x:22,z:-13,name:'03 · LABORATÓRIO',color:0x608fae},
 {x:-22,z:13,name:'04 · EXPEDIÇÃO',color:0xb08054},
 {x:0,z:13,name:'05 · ENVASE',color:0x769264},
 {x:22,z:13,name:'06 · MANUTENÇÃO',color:0x927798},
];
export const obstacles:Obstacle[]=[];
const block=(x:number,z:number,w:number,d:number,h:number,kind:Obstacle['kind'],color=0x43525c)=>obstacles.push({x,z,w,d,h,kind,color});
for(const x of [-11,11]) for(const [a,b] of [[-25,-18],[-13,-4],[4,13],[18,25]])block(x,(a+b)/2,.5,b-a,3.6,'wall');
for(const [a,b] of [[-32,-27],[-23,-14],[-8,8],[14,23],[27,32]])block((a+b)/2,0,b-a,.5,3.6,'wall');
// Props define both collision and geometry; all sectors have looping side aisles.
for(const x of [-26,-18])for(const z of [-17,-8])block(x,z,2.2,5,2.8,'shelf',0x45696b);
for(const x of [-5,4])for(const z of [-17,-8])block(x,z,3,3,3,'tank',0x9c9e8b);
for(const x of [18,26])for(const z of [-17,-8])block(x,z,4,1.5,1.2,'desk',0x7795a4);
for(const x of [-26,-18])for(const z of [8,17])block(x,z,3.5,3,2.6,'crate',0x775b3f);
for(const x of [-5,4])for(const z of [8,17])block(x,z,2.4,4,1.6,'shelf',0x547566);
for(const x of [18,26])for(const z of [8,17])block(x,z,3,3,2.4,'tank',0x6f6882);
export const hideSpots:HideSpot[]=[];
for(const sector of sectors){
 for(let k=0;k<3;k++){
  const x=sector.x-6+k*6,z=sector.z<0?-22:22;
  const kind:HideSpot['kind']=k===0?'armário':k===1?'caixote':'bancada';
  const h=kind==='armário'?2.7:kind==='caixote'?1.6:1.4;
  hideSpots.push({id:hideSpots.length,x,z,kind,entry:{x,z:z+1.8},seconds:kind==='armário'?18:kind==='caixote'?14:12});
  block(x,z,kind==='bancada'?2.6:1.6,1.2,h,kind==='armário'?'locker':kind==='caixote'?'crate':'desk',sector.color);
 }
}
export const spawn:Point={x:0,z:20};
export const botSpawns:Point[]=[{x:-22,z:-12},{x:22,z:-12},{x:-22,z:12},{x:22,z:12}];
export const patrolPoints:Point[]=[{x:0,z:-20},{x:-11,z:-16},{x:-22,z:-12},{x:-25,z:0},{x:-22,z:12},{x:-11,z:16},{x:0,z:20},{x:11,z:16},{x:22,z:12},{x:25,z:0},{x:22,z:-12},{x:11,z:-16}];
export function canMove(x:number,z:number,r=.42){return Math.abs(x)<bounds.x-.6&&Math.abs(z)<bounds.z-.6&&!obstacles.some(o=>Math.abs(x-o.x)<o.w/2+r&&Math.abs(z-o.z)<o.d/2+r);}
export function clearLine(a:Point,b:Point,r=0){
 const length=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.ceil(length/.2);
 for(let i=1;i<steps;i++){const t=i/steps;if(!canMove(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,r))return false;}return true;
}
// Precomputed traversable grid keeps path searches bounded on mobile.
const nodes:Point[]=[];const index=new Map<string,number>();
for(let x=-31;x<=31;x++)for(let z=-24;z<=24;z++)if(canMove(x,z)){index.set(x+','+z,nodes.length);nodes.push({x,z});}
const edges=nodes.map(p=>[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz])=>index.get((p.x+dx)+','+(p.z+dz))).filter((n):n is number=>n!==undefined));
export function findPath(from:Point,to:Point):Point[]{
 const closest=(p:Point,visible=false)=>{let best=-1,dist=Infinity;nodes.forEach((n,i)=>{const d=(n.x-p.x)**2+(n.z-p.z)**2;if(d<dist&&(!visible||clearLine(p,n,.42))){best=i;dist=d;}});return best;};
 const start=closest(from,true),goal=closest(to);if(start<0||goal<0)return [];
 const parent=new Int32Array(nodes.length).fill(-1),queue=new Int32Array(nodes.length);let head=0,tail=1;queue[0]=start;parent[start]=start;
 while(head<tail){const n=queue[head++];if(n===goal)break;for(const next of edges[n])if(parent[next]<0){parent[next]=n;queue[tail++]=next;}}
 if(parent[goal]<0)return [];const path:Point[]=[];for(let n=goal;n!==start;n=parent[n])path.push(nodes[n]);path.push(nodes[start]);path.reverse();
 if(canMove(to.x,to.z)&&clearLine(nodes[goal],to,.42))path.push(to);return path;
}
export function sectorAt(p:Point){return sectors.find(s=>(p.x<-11?s.x< -11:p.x>11?s.x>11:s.x===0)&&(p.z<0?s.z<0:s.z>0))!.name;}
