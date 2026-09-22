export const ATTACK_RANGE=2.6;
type Position={x:number;z:number};
export function captureTarget<T extends {alive:boolean;hidden:boolean;position:Position}>(origin:Position,targets:T[],inspect:boolean,line:(a:Position,b:Position)=>boolean):T|undefined{
 return targets.filter(t=>t.alive&&t.hidden===inspect&&Math.hypot(t.position.x-origin.x,t.position.z-origin.z)<=ATTACK_RANGE&&line(origin,t.position))
  .sort((a,b)=>Math.hypot(a.position.x-origin.x,a.position.z-origin.z)-Math.hypot(b.position.x-origin.x,b.position.z-origin.z))[0];
}
export function detergentLanding(origin:Position,direction:Position,walkable:(x:number,z:number)=>boolean,line:(a:Position,b:Position)=>boolean):Position{
 const length=Math.hypot(direction.x,direction.z)||1;
 for(let distance=1.7;distance>=.2;distance-=.15){const p={x:origin.x+direction.x/length*distance,z:origin.z+direction.z/length*distance};if(walkable(p.x,p.z)&&line(origin,p))return p;}
 return {...origin};
}
