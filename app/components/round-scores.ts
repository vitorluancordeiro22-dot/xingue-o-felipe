export const ROUND_SECONDS=300;
export type ScorePlayer={id:string;name:string;role:'felipe'|'inocente';alive:boolean;downed:boolean;actions:number;seconds:number};
export type RankingRow=ScorePlayer&{total:number;rank:number};
export function allSurvivorsDown(players:ScorePlayer[]){
 const living=players.filter(p=>p.role==='inocente'&&p.alive);
 return living.length>0&&living.every(p=>p.downed);
}
export class RoundScores{
 elapsed=0;finished=false;
 players:ScorePlayer[];
 constructor(players:ScorePlayer[]){this.players=players;}
 get remaining(){return Math.max(0,ROUND_SECONDS-this.elapsed);}
 get complete(){return this.remaining===0||!this.players.some(p=>p.role==='inocente'&&p.alive);}
 tick(dt:number){if(this.finished)return;const step=Math.min(Math.max(0,dt),this.remaining);this.elapsed+=step;for(const p of this.players)if(p.role==='inocente'&&p.alive&&!p.downed)p.seconds+=step;}
 award(id:string,event:'taunt'|'slip'){const p=this.players.find(p=>p.id===id);if(!this.finished&&p?.alive&&!p.downed&&p.role==='inocente')p.actions+=event==='taunt'?10:40;}
 down(id:string){const p=this.players.find(p=>p.id===id);if(!this.finished&&p?.alive&&p.role==='inocente')p.downed=true;}
 revive(id:string){const p=this.players.find(p=>p.id===id);if(!this.finished&&p?.alive&&p.downed)p.downed=false;}
 eliminate(victim:string,hunter:string){const v=this.players.find(p=>p.id===victim),h=this.players.find(p=>p.id===hunter);if(this.finished||!v?.alive||v.role!=='inocente'||h?.role!=='felipe')return;v.alive=false;v.downed=false;h.actions+=100;}
 finish(){if(this.finished)return;this.finished=true;if(this.remaining===0)for(const p of this.players)if(p.alive&&!p.downed&&p.role==='inocente')p.actions+=50;}
 ranking():RankingRow[]{const rows=this.players.map(p=>({...p,total:p.actions+(p.role==='inocente'?Math.floor(p.seconds+1e-8):0),rank:0})).sort((a,b)=>b.total-a.total||a.id.localeCompare(b.id));rows.forEach((p,i)=>p.rank=i&&p.total===rows[i-1].total?rows[i-1].rank:i+1);return rows;}
}
