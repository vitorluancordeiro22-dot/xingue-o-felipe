"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {buildFactory} from './factory-scenery';
import {canMove,clearLine,findPath,hideSpots,spawn,botSpawns,patrolPoints,sectorAt,type HideSpot,type Point} from './factory-layout';
import {createTauntDeck} from './taunts';
import {createTrainingRound} from './round-roles';
import {captureTarget,detergentLanding} from './game-actions';
import {makeBottle,makeSpill,makeKnife} from './game-props';
import {RoundScores,ROUND_SECONDS,type RankingRow} from "./round-scores";
import type {GameAudio} from "./game-audio";
import type {GameSettings} from "./game-settings";
import { ArrowLeft, Eye, RotateCcw, SprayCan, Volume2, Settings } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";

type GameState = "playing" | "spectating" | "won" | "lost";
type OnlinePlayer = { id:string; name:string; skin:string };
type MultiplayerConfig = { channel:RealtimeChannel; clientId:string; players:OnlinePlayer[]; roles:Record<string,'felipe'|'inocente'>; role:'felipe'|'inocente'; roomCode:string };
type Props = { selectedCharacter: string; onExit: () => void; onReplay:()=>void;settings:GameSettings;settingsOpen:boolean;onSettings:()=>void;audio:GameAudio|null;multiplayer?:MultiplayerConfig };
type Vec = { x: number; z: number };

const nextTaunt=createTauntDeck();
const FELIPE_SIGHT=12;
const FELIPE_CROUCH_SIGHT=6;
const REVIVE_SECONDS=10;
const DOWNED_SECONDS=20;

const charData: Record<string, { skin: number; shirt: number; scale: [number, number, number]; hair: number }> = {
  luan: { skin: 0x9f6342, shirt: 0xf5a623, scale: [1.05, 1.18, 1.05], hair: 0x17110f },
  lucas: { skin: 0xf0c5aa, shirt: 0x56c7ff, scale: [1.12, 1, 1.05], hair: 0x3b2419 },
  joao: { skin: 0xe8c4ad, shirt: 0xc8ff55, scale: [0.82, 1.1, 0.82], hair: 0x4a3025 },
  vitin: { skin: 0x6d3b28, shirt: 0xbd76ff, scale: [0.95, 1.03, 0.95], hair: 0x16100f },
  matheus: { skin: 0xe0ad8d, shirt: 0xff667f, scale: [1.2, 0.98, 1.12], hair: 0x291914 },
  felipe: { skin: 0xe4b99e, shirt: 0x2d6cdf, scale: [1, 1.05, 1], hair: 0x2b2019 },
};

export function makePerson(id: string, name: string) {
  const d = charData[id];
  const g = new THREE.Group();
  g.name = name;
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.48, 18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .24 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .015; shadow.scale.y = .55; g.add(shadow);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.38, .72, 5, 10), new THREE.MeshStandardMaterial({ color: d.shirt, roughness: .78 }));
  body.position.y = 1.12; body.scale.set(...d.scale); body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.34, 16, 12), new THREE.MeshStandardMaterial({ color: d.skin, roughness: .8 }));
  head.position.y = 1.97; head.scale.set(1, id === "joao" ? 1.28 : 1, 1); head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(
    id === "vitin" ? new THREE.SphereGeometry(.42, 12, 9) : new THREE.BoxGeometry(.56, .18, .54),
    new THREE.MeshStandardMaterial({ color: d.hair, roughness: 1 }),
  );
  hair.position.set(id === "felipe" ? .07 : 0, id === "vitin" ? 2.25 : 2.23, id === "vitin" ? 0 : -.02);
  if (id !== "vitin") hair.rotation.z = id === "lucas" ? -.18 : .08;
  g.add(hair);
  const legMat = new THREE.MeshStandardMaterial({ color: id === "vitin" ? 0x17131d : 0x24303b });
  [-.2, .2].forEach((x) => { const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.11, .52, 3, 7), legMat); leg.position.set(x, .47, 0); leg.castShadow = true; g.add(leg); });
  if (id === "luan") {
    const glasses = new THREE.Mesh(new THREE.BoxGeometry(.72, .14, .07), new THREE.MeshStandardMaterial({ color: 0x171717 }));
    glasses.position.set(0, 2.02, .31); g.add(glasses);
  }
  if (id === "lucas" || id === "matheus" || id === "luan") {
    const beard = new THREE.Mesh(new THREE.SphereGeometry(id === "lucas" ? .18 : .27, 10, 6), new THREE.MeshStandardMaterial({ color: d.hair }));
    beard.scale.set(id === "lucas" ? 1.8 : 1, .5, .35); beard.position.set(0, 1.86, .3); g.add(beard);
  }
  if (id === "joao") [-.39, .39].forEach((x) => { const ear = new THREE.Mesh(new THREE.SphereGeometry(.14, 8, 6), new THREE.MeshStandardMaterial({ color: d.skin })); ear.scale.x = .5; ear.position.set(x, 2.02, 0); g.add(ear); });
  // Articulated arms, gloves, boots and facial features.
  const part = (geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color, roughness:.65}));
    mesh.position.set(x,y,z); mesh.castShadow=true; g.add(mesh); return mesh;
  };
  for (const side of [-1,1]) {
    const arm = new THREE.Group(); arm.position.set(side*.43,1.5,0); arm.name='arm';
    const sleeve=new THREE.Mesh(new THREE.CapsuleGeometry(.14,.4,4,8),new THREE.MeshStandardMaterial({color:d.shirt})); sleeve.position.y=-.2; arm.add(sleeve);
    const hand=new THREE.Mesh(new THREE.SphereGeometry(.15,10,8),new THREE.MeshStandardMaterial({color:0x344748}));hand.position.y=-.58;arm.add(hand);g.add(arm);
    part(new THREE.BoxGeometry(.26,.22,.43),0x151a20,side*.2,.13,.09);
    part(new THREE.SphereGeometry(.08,10,8),0xf9eee0,side*.14,2.02,.3);
    part(new THREE.SphereGeometry(.038,8,6),id==='lucas'?0x5f8dad:0x1b1513,side*.14,2.02,.369);
    const brow=part(new THREE.BoxGeometry(.18,.045,.04),d.hair,side*.14,2.13,.32);brow.rotation.z=side*(id==='felipe'?.2:-.1);
  }
  part(new THREE.SphereGeometry(.085,10,8),d.skin,0,1.96,.37);
  part(new THREE.BoxGeometry(.16,.038,.04),0x6b3430,0,1.82,.31);
  part(new THREE.BoxGeometry(.2,.25,.025),0xe9e1c8,.19,1.34,.37);
  part(new THREE.BoxGeometry(.13,.035,.03),d.shirt,.19,1.4,.39);
  if(id==='matheus'||id==='luan'){const belly=part(new THREE.SphereGeometry(.37,14,10),d.shirt,0,.98,.18);belly.scale.set(id==='matheus'?1.23:1.05,.85,.8);}
  if(id==='vitin') { for(let i=0;i<13;i++) {const a=i/13*Math.PI*2;part(new THREE.SphereGeometry(.12,7,6),d.hair,Math.cos(a)*.31,2.22+Math.sin(i*3)*.05,Math.sin(a)*.3);}const chain=part(new THREE.TorusGeometry(.23,.025,5,16),0xe1b95e,0,1.5,.34);chain.scale.y=.8; }
  if(id==='luan'||id==='matheus'){const beard=part(new THREE.SphereGeometry(.26,10,7),d.hair,0,1.74,.18);beard.scale.set(1,id==='luan'?1.2:.7,.85);}
  if(id==='lucas'){const pomp=part(new THREE.SphereGeometry(.3,12,8),d.hair,0,2.27,.13);pomp.scale.set(1,.7,1.2);}
  g.scale.y=id==='luan'?1.12:id==='joao'?1.06:1;
  return g;
}

export default function FactoryGame({ selectedCharacter, onExit, onReplay,settings,settingsOpen,onSettings,audio,multiplayer }: Props) {
  const settingsRef=useRef(settings);
  const settingsOpenRef=useRef(settingsOpen);
  const [ranking,setRanking]=useState<RankingRow[]>([]);
  useEffect(()=>{settingsRef.current=settings;settingsOpenRef.current=settingsOpen;moveRef.current={x:0,z:0};if(settingsOpen)audio?.pause();else if(!document.hidden)audio?.unlock();},[settings,settingsOpen,audio]);
  const mountRef = useRef<HTMLDivElement>(null);
  const moveRef = useRef<Vec>({ x: 0, z: 0 });
  const joystickCleanup=useRef<()=>void>(()=>{});
  const gameApiRef = useRef({ insult: () => {}, trap: () => {}, hide: () => {}, jump:()=>{}, emote:()=>{}, capture:()=>{}, revive:()=>{} });
  const [isFelipe,setIsFelipe]=useState(false);
  const [revealing,setRevealing]=useState(true);
  const [emoteCooldown,setEmoteCooldown]=useState(0);
  const lookRef=useRef({yaw:0,pitch:0});
  const firstRef=useRef(true);
  const [firstPerson,setFirstPerson]=useState(true);
  const [hidden,setHidden]=useState(false);
  const [hideInfo,setHideInfo]=useState({label:'',seconds:0,available:false});
  const [sector,setSector]=useState('');
  const [danger,setDanger]=useState(false);
  const [crouching,setCrouching]=useState(false);
  const crouchRef=useRef(false);
  const spectateRef=useRef(0);
  const [watching,setWatching]=useState('');
  const pausedRef=useRef(false);
  const [paused,setPaused]=useState(false);
  const [winner,setWinner]=useState('');
  const [time, setTime] = useState(ROUND_SECONDS);
  const [score, setScore] = useState(0);
  const [traps, setTraps] = useState(3);
  const [trapCooldown, setTrapCooldown] = useState(0);
  const [insultCooldown, setInsultCooldown] = useState(0);
  const [message, setMessage] = useState("Ache um esconderijo e provoque o Felipe!");
  const [state, setState] = useState<GameState>("playing");
  const [remaining, setRemaining] = useState(5);
  const [attackReady,setAttackReady]=useState(false);
  const [attackCooldown,setAttackCooldown]=useState(0);
  const [reviveInfo,setReviveInfo]=useState({available:false,name:'',seconds:0});
  const [reviving,setReviving]=useState(false);
  const [renderError, setRenderError] = useState(false);
  const lookPointer=useRef<{id:number;x:number;y:number}|null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let playerCaught = false;
    let gameState: GameState = "playing";
    let elapsed = 0;
    let visualTime=0,lastElimination=-10;
    let lastStep=0,lastHunterStep=0;let wasAirborne=false;
    const previousHunter={x:0,z:0};
    const bodies:{mesh:THREE.Group;at:number;revived?:boolean}[]=[];
    let localTime = ROUND_SECONDS;
    let localTraps = 3;
    let insultCd = 0;
    let trapCd = 0;
    let felipeSlow = 0;
    let lastUi = 0;
    let hiding=false;
    let hidingSince=0;
    let activeHide:HideSpot|null=null;
    const usedSpots=new Map<number,number>();
    let suspected:Point|null=null;
    let searchStarted=0;
    let lastSeen:Point|null=null;
    let lastSeenUntil=0;
    let patrolIndex=0;
    const occupied=new Map<number,string>();
    let captureCd=0;
    let reviveStarted=0;
    let reviveOrigin={x:0,z:0};
    let playerDownedAt=0;
    const round=createTrainingRound(selectedCharacter);
    const hunterRole=multiplayer?multiplayer.role==='felipe':round.hunterRole;
    const localOnlinePlayer=multiplayer?.players.find(p=>p.id===multiplayer.clientId);
    let revealTime=3.5;
    let jumpVelocity=0, emoteUntil=0, emoteCd=0, emoteIndex=-1;
    const velocity={x:0,z:0};
    const emotes=['TCHAUZINHO 👋','DANCINHA 🕺','RISADA 😂'];
    const keys = new Set<string>();

    setTime(ROUND_SECONDS);setRanking([]); setScore(0); setTraps(3); setTrapCooldown(0); setInsultCooldown(0); setRenderError(false);setAttackReady(false);setAttackCooldown(0);setReviveInfo({available:false,name:'',seconds:0});setReviving(false);
    setState("playing"); setRemaining(5); setMessage(hunterRole?'Você é o Felipe! Aproxime-se e aperte MATAR. Confira os esconderijos com F.':'Ache um esconderijo e provoque o Felipe!');
    setHidden(false);setWinner('');setHideInfo({label:'',seconds:0,available:false});setDanger(false);crouchRef.current=false;setCrouching(false);moveRef.current={x:0,z:0};lookRef.current={yaw:0,pitch:0};
    pausedRef.current=false;setPaused(false);setIsFelipe(hunterRole);setRevealing(true);setEmoteCooldown(0);spectateRef.current=0;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080e15);
    scene.fog = new THREE.Fog(0x080e15, 16, 45);
    const camera = new THREE.PerspectiveCamera(hunterRole?52:58, mount.clientWidth / mount.clientHeight, .1, 80);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      // Mirror an external renderer initialization failure in the React fallback.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRenderError(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0x91b3cf, 0x111a20, .9));
    const sun = new THREE.DirectionalLight(0x99b9e0, .7);
    sun.position.set(-8, 15, 7); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); scene.add(sun);
    const hazardLight = new THREE.PointLight(0xffb000, 3, 11); hazardLight.position.set(-8, 4, -6); scene.add(hazardLight);
    const flashlight=new THREE.SpotLight(0xe1f0ff,22,18,.62,.65,1);scene.add(flashlight,flashlight.target);

    const scenery=buildFactory(scene);

    const playerSkin=hunterRole?'felipe':(localOnlinePlayer?.skin||round.playerSkin);
    const player = makePerson(playerSkin, "Você"); player.position.set(hunterRole?0:spawn.x, 0, hunterRole?-20:spawn.z); scene.add(player);
    const survivorIds = multiplayer?[]:round.survivors;
    const bots = survivorIds.map((id, i) => ({ id, role:'inocente' as const, remote:false, mesh: makePerson(id, id), alive: true, target: new THREE.Vector3(-10 + i * 6, 0, i % 2 ? 4 : -2), nextInsult: 8 + i * 3, hiddenUntil:0, hideId:-1, hideAgain:0 }));
    const remoteActors = (multiplayer?.players||[]).filter(p=>p.id!==multiplayer?.clientId).map((p)=>{
      const role=(multiplayer?.roles[p.id]||'inocente') as 'felipe'|'inocente';
      return { id:p.id, role, remote:true, mesh:makePerson(role==='felipe'?'felipe':p.skin,p.name), alive:true, target:new THREE.Vector3(), nextInsult:99, hiddenUntil:0, hideId:-1, hideAgain:0 };
    });
    if(multiplayer){
      remoteActors.forEach((a)=>{a.mesh.position.set(0,0,0);scene.add(a.mesh);});
    }
    const remoteFelipe=remoteActors.find(a=>a.role==='felipe');
    const felipe = hunterRole?player:(remoteFelipe?.mesh||makePerson("felipe", "Felipe"));
    if(!hunterRole&&!remoteFelipe){felipe.position.set(0, 0, -20); felipe.scale.setScalar(1.08); scene.add(felipe);}
    const allActors=[...bots,...remoteActors];
    let reviveTarget:typeof allActors[number]|null=null;
    bots.forEach((b, i) => { const p=botSpawns[i]||spawn;b.mesh.position.set(p.x, 0, p.z); scene.add(b.mesh); });
    player.userData.scoreId=multiplayer?.clientId||'player';felipe.userData.scoreId=hunterRole?(multiplayer?.clientId||'player'):(remoteFelipe?.id||'felipe');bots.forEach(b=>b.mesh.userData.scoreId=b.id);remoteActors.forEach(a=>a.mesh.userData.scoreId=a.id);
    const scoreRoster=multiplayer
      ? multiplayer.players.map(p=>({id:p.id,name:p.name,role:multiplayer.roles[p.id]||'inocente' as const,alive:true,downed:false,actions:0,seconds:0}))
      : [{id:'player',name:'Você · '+(hunterRole?'Felipe':selectedCharacter),role:hunterRole?'felipe' as const:'inocente' as const,alive:true,downed:false,actions:0,seconds:0},...(!hunterRole?[{id:'felipe',name:'Felipe · bot',role:'felipe' as const,alive:true,downed:false,actions:0,seconds:0}]:[]),...bots.map(b=>({id:b.id,name:b.id+' · bot',role:'inocente' as const,alive:true,downed:false,actions:0,seconds:0}))];
    const board=new RoundScores(scoreRoster);
    const localScoreId=multiplayer?.clientId||'player';
    const audible=(obj:THREE.Object3D)=>Math.max(0,1-obj.position.distanceTo(camera.position)/15);
    let lastOnlineState=0;
    const sendOnline=(event:string,payload:Record<string,unknown>)=>{if(multiplayer)void multiplayer.channel.send({type:'broadcast',event,payload:{...payload,from:multiplayer.clientId}});};
    const puddles: { mesh: THREE.Group; bottle:THREE.Group; from:THREE.Vector3; to:THREE.Vector3; age:number; life: number }[] = [];
    const heldKnife=makeKnife();heldKnife.position.set(0,-.6,.12);
    const hunterArm=felipe.children.filter(c=>c.name==='arm')[1];hunterArm.add(heldKnife);
    scene.add(camera);const viewKnife=makeKnife();viewKnife.position.set(.3,-.3,-.65);viewKnife.rotation.z=-.4;camera.add(viewKnife);
    const finishDown=(mesh:THREE.Group,notify=true)=>{
      if(mesh.userData.dead||!mesh.userData.downed)return;
      mesh.userData.dead=true;mesh.userData.downed=false;mesh.visible=true;board.eliminate(mesh.userData.scoreId,felipe.userData.scoreId);audio?.play('hit',audible(mesh));mesh.position.y=0;
      const bot=bots.find(b=>b.mesh===mesh);if(bot)bot.alive=false;
      const remote=remoteActors.find(a=>a.mesh===mesh);if(remote)remote.alive=false;
      if(mesh===player){playerCaught=true;gameState='spectating';setState('spectating');}
      if(multiplayer&&notify)sendOnline('combat',{kind:'eliminate',target:mesh.userData.scoreId});
      lastElimination=elapsed;
    };
    const knockDown=(mesh:THREE.Group,notify=true)=>{
      if(mesh.userData.dead||mesh.userData.downed)return;
      mesh.userData.downed=true;mesh.userData.downedAt=elapsed;mesh.visible=true;board.down(mesh.userData.scoreId);audio?.play('hit',audible(mesh));mesh.position.y=0;
      bodies.push({mesh,at:visualTime});
      if(multiplayer&&notify)sendOnline('combat',{kind:'down',target:mesh.userData.scoreId});
      const blood=makeSpill(true);blood.position.set(mesh.position.x,0,mesh.position.z);blood.scale.setScalar(.65);scene.add(blood);
    };
    const attackAnimation=()=>{felipe.userData.attackUntil=visualTime+.4;audio?.play('knife',hunterRole?1:audible(felipe));};
    const targetFor=(inspect=false)=>captureTarget(player.position,allActors.filter(a=>a.role==='inocente').map(b=>({alive:b.alive&&!b.mesh.userData.downed,hidden:b.hiddenUntil>elapsed,position:b.mesh.position,bot:b})),inspect,clearLine)?.bot;
    const nearbyDowned=()=>allActors.find(b=>b.role==='inocente'&&b.alive&&b.mesh.userData.downed&&Math.hypot(b.mesh.position.x-player.position.x,b.mesh.position.z-player.position.z)<2.3&&clearLine(player.position,b.mesh.position,.42));
    const cancelRevive=(reason='Reviver cancelado.')=>{if(reviveTarget){reviveTarget=null;reviveStarted=0;setReviving(false);setMessage(reason);audio?.play('hide');}};
    const reviveBot=(bot:typeof allActors[number],notify=true)=>{if(!bot.mesh.userData.downed)return;bot.mesh.userData.downed=false;bot.mesh.userData.downedAt=0;board.revive(bot.id);const body=bodies.find(b=>b.mesh===bot.mesh);if(body)body.revived=true;bot.mesh.rotation.x=0;bot.mesh.position.y=0;reviveTarget=null;reviveStarted=0;setReviving(false);setMessage(bot.id.toUpperCase()+' foi revivido!');audio?.play('start');if(multiplayer&&notify)sendOnline('combat',{kind:'revive',target:bot.id});};
    if(multiplayer){
      multiplayer.channel.on('broadcast',{event:'combat'},({payload})=>{
        if(payload?.from===multiplayer.clientId)return;
        if(payload.kind==='trap'){
          const x=Number(payload.x),z=Number(payload.z);if(Number.isFinite(x)&&Number.isFinite(z)){const mesh=makeSpill();mesh.position.set(x,0,z);mesh.visible=false;scene.add(mesh);const bottle=makeBottle();const from=new THREE.Vector3(Number(payload.fromX)||x,1.1,Number(payload.fromZ)||z);const to=new THREE.Vector3(x,.13,z);bottle.position.copy(from);scene.add(bottle);puddles.push({mesh,bottle,from,to,age:.4,life:18});}
          return;
        }
        const target=payload?.target===multiplayer.clientId?player:allActors.find(a=>a.id===payload?.target)?.mesh;
        if(!target)return;
        if(payload.kind==='down')knockDown(target,false);
        if(payload.kind==='revive'){
          if(payload.target===multiplayer.clientId){player.userData.downed=false;player.userData.downedAt=0;board.revive(multiplayer.clientId);const body=bodies.find(b=>b.mesh===player);if(body)body.revived=true;player.rotation.x=0;player.position.y=0;setMessage('Você foi revivido!');audio?.play('start');}
          else{const actor=allActors.find(a=>a.id===payload.target);if(actor)reviveBot(actor,false);}
        }
        if(payload.kind==='eliminate')finishDown(target,false);
      });
      multiplayer.channel.on('broadcast',{event:'state'},({payload})=>{
        if(payload?.from===multiplayer.clientId)return;
        const actor=allActors.find(a=>a.id===payload?.from);if(!actor)return;
        actor.mesh.position.set(Number(payload.x)||0,0,Number(payload.z)||0);actor.mesh.rotation.y=Number(payload.yaw)||0;const wasDowned=Boolean(actor.mesh.userData.downed);actor.mesh.userData.downed=Boolean(payload.downed);if(payload.downed&&!wasDowned)actor.mesh.userData.downedAt=elapsed;if(!payload.downed)actor.mesh.userData.downedAt=0;actor.mesh.userData.dead=!Boolean(payload.alive);actor.hiddenUntil=payload.hidden?elapsed+99999:0;actor.mesh.visible=!Boolean(payload.hidden);
      });
    }

    const moveEntity = (obj: THREE.Object3D, dx: number, dz: number) => {
      const nx = obj.position.x + dx, nz = obj.position.z + dz;
      if (canMove(nx, obj.position.z)) obj.position.x = nx;
      if (canMove(obj.position.x, nz)) obj.position.z = nz;
      if (Math.abs(dx) + Math.abs(dz) > .001) obj.rotation.y = Math.atan2(dx, dz);
    };
    const nearbySpot=()=>hideSpots.filter(h=>!occupied.has(h.id)&&(!usedSpots.has(h.id)||usedSpots.get(h.id)!<=elapsed))
      .find(h=>Math.hypot(player.position.x-h.entry.x,player.position.z-h.entry.z)<1.6&&clearLine(player.position,h.entry,.42));
    const exitHide=(reason='Você saiu do esconderijo.')=>{
      if(activeHide){usedSpots.set(activeHide.id,elapsed+12);occupied.delete(activeHide.id);}
      hiding=false;activeHide=null;setHidden(false);setMessage(reason);audio?.play('hide');
    };
    const moveToward=(actor:THREE.Object3D,target:Point,speed:number,dt:number)=>{
      const data=actor.userData;
      if(!data.path||elapsed>(data.pathAt||0)){
        data.path=findPath(actor.position,target);data.pathAt=elapsed+.9;data.step=0;
      }
      const path:Point[]=data.path;
      while(data.step<path.length&&Math.hypot(path[data.step].x-actor.position.x,path[data.step].z-actor.position.z)<.15)data.step++;
      if(data.step>=path.length)return;
      const p=path[data.step];const dx=p.x-actor.position.x,dz=p.z-actor.position.z,len=Math.hypot(dx,dz);
      const step=Math.min(speed*dt,len);if(len>0)moveEntity(actor,dx/len*step,dz/len*step);
    };
    const sight=(target:THREE.Object3D,limit=FELIPE_SIGHT)=>target.position.distanceTo(felipe.position)<limit&&clearLine(felipe.position,target.position);
    const catchPlayer=()=>{if(hiding)exitHide('Felipe abriu seu esconderijo!');playerDownedAt=elapsed;knockDown(player);attackAnimation();captureCd=1.2;if(multiplayer){setDanger(false);setMessage('Você caiu! Um amigo pode te reviver em 10 segundos.');}else{playerCaught=true;gameState='spectating';setState('spectating');setDanger(false);setMessage('Capturado! Você está assistindo.');}};

    const showInsult = (who: THREE.Object3D, value: string, mine = false) => {
      const tag = document.createElement("div"); tag.className = "world-insult"; tag.textContent = value; mount.appendChild(tag);
      const started = performance.now();
      const place = () => {
        if (!tag.isConnected) return;
        const p = who.position.clone(); p.y += 2.8; p.project(camera);
        tag.style.display=(mine&&firstRef.current)||p.z>1||p.z< -1||!clearLine(camera.position,who.position)?'none':'';
        tag.style.left = ((p.x * .5 + .5) * mount.clientWidth) + "px";
        tag.style.top = ((-p.y * .5 + .5) * mount.clientHeight) + "px";
        if (performance.now() - started < 1550) requestAnimationFrame(place); else tag.remove();
      };
      place();
      if (mine && settingsRef.current.volume>0 && "speechSynthesis" in window) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(value); u.lang = "pt-BR"; u.rate = 1.13; u.pitch = .92; u.volume=settingsRef.current.volume/100; window.speechSynthesis.speak(u); }
      if(Math.hypot(who.position.x-felipe.position.x,who.position.z-felipe.position.z)<=15)board.award(who.userData.scoreId,'taunt');
      felipe.userData.soundTarget = who.position.clone(); felipe.userData.soundUntil = elapsed + 7;
    };

    const doInsult = () => {
      if (gameState !== "playing" || playerCaught || player.userData.downed || insultCd > 0 || pausedRef.current || settingsOpenRef.current || revealTime>0 || hunterRole) return;
      if(hiding)exitHide('Sua provocação revelou o esconderijo!');
      const value = nextTaunt();
      showInsult(player, value, true); insultCd = 4;
      setScore(board.ranking().find(p=>p.id==='player')!.total); setInsultCooldown(4); setMessage(value);
    };
    const doTrap = () => {
      if (gameState !== "playing" || playerCaught || player.userData.downed || hiding || trapCd > 0 || localTraps <= 0 || pausedRef.current || settingsOpenRef.current || revealTime>0 || hunterRole) return;
      const moving=Math.hypot(velocity.x,velocity.z)>.4;
      const direction=moving?{x:velocity.x,z:velocity.z}:firstRef.current?{x:-Math.sin(lookRef.current.yaw),z:-Math.cos(lookRef.current.yaw)}:{x:Math.sin(player.rotation.y),z:Math.cos(player.rotation.y)};
      const landing=detergentLanding(player.position,direction,canMove,(a,b)=>clearLine(a,b,.15));
      const mesh=makeSpill();mesh.position.set(landing.x,0,landing.z);mesh.visible=false;scene.add(mesh);
      const bottle=makeBottle();const from=player.position.clone().add(new THREE.Vector3(0,1.1,0));const to=new THREE.Vector3(landing.x+.2,.13,landing.z);bottle.position.copy(from);scene.add(bottle);
      puddles.push({mesh,bottle,from,to,age:0,life:18});audio?.play('throw');
      localTraps--; trapCd = 9; setTraps(localTraps); setTrapCooldown(9); setMessage("Detergente no chão!");if(multiplayer)sendOnline('combat',{kind:'trap',x:landing.x,z:landing.z,fromX:player.position.x,fromZ:player.position.z});
    };
    const doHide=()=>{
      if(playerCaught||player.userData.downed||gameState!=='playing'||pausedRef.current||settingsOpenRef.current||revealTime>0)return;
      if(hunterRole){doCapture(true);return;}
      if(hiding){exitHide();return;}
      const spot=nearbySpot();
      if(!spot){setMessage('Aproxime-se de um esconderijo livre.');return;}
      const wasSeen=sight(player,crouchRef.current?FELIPE_CROUCH_SIGHT:FELIPE_SIGHT);
      player.position.set(spot.entry.x,0,spot.entry.z);
      jumpVelocity=0;emoteUntil=0;
      audio?.play('hide');hiding=true;activeHide=spot;hidingSince=elapsed;occupied.set(spot.id,'player');setHidden(true);
      lookRef.current.yaw=Math.PI;lookRef.current.pitch=0;
      if(wasSeen){suspected={...spot.entry};searchStarted=0;setMessage('Ele viu você entrar!');}
      else setMessage('Escondido. Xingar entrega sua posição.');
    };
    const doRevive=()=>{
      if(hunterRole||playerCaught||player.userData.downed||gameState!=='playing'||pausedRef.current||settingsOpenRef.current||revealTime>0)return;
      if(reviveTarget){cancelRevive();return;}
      const bot=nearbyDowned();
      if(!bot){setMessage('Chegue perto de um amigo caído.');return;}
      reviveTarget=bot;reviveStarted=elapsed;reviveOrigin={x:player.position.x,z:player.position.z};setReviving(true);setMessage('Revivendo '+bot.id.toUpperCase()+' · fique parado por 10s.');audio?.play('hide');
    };
    const canAct=()=>gameState==='playing'&&!playerCaught&&!player.userData.downed&&!hiding&&!reviveTarget&&!pausedRef.current&&!settingsOpenRef.current&&revealTime<=0;
    const doJump=()=>{if(canAct()&&player.position.y===0){jumpVelocity=5.5;emoteUntil=0;audio?.play('jump');}};
    const doEmote=()=>{if(canAct()&&emoteCd<=0){emoteIndex=(emoteIndex+1)%emotes.length;emoteUntil=elapsed+2.4;emoteCd=5;setEmoteCooldown(5);setMessage(emotes[emoteIndex]);}};
    const doCapture=(inspect=false)=>{
      if(!hunterRole||!canAct()||captureCd>0)return;
      const b=targetFor(inspect);
      attackAnimation();emoteUntil=0;
      captureCd=b?1.2:.3;setAttackCooldown(captureCd);setAttackReady(false);
      if(b){knockDown(b.mesh);if(b.hideId>=0)occupied.delete(b.hideId);setMessage(b.id.toUpperCase()+' caiu!');}
      else setMessage(inspect?'Esconderijo vazio.':'Chegue mais perto.');
    };
    gameApiRef.current = { insult: doInsult, trap: doTrap, hide:doHide, jump:doJump, emote:doEmote, capture:()=>doCapture(), revive:doRevive };

    const onKeyDown = (e: KeyboardEvent) => { if(settingsOpenRef.current)return;const key=e.key.toLowerCase();keys.add(key);if(key===' '){e.preventDefault();if(!e.repeat)doJump();}if(e.repeat)return;if(key==='e'){if(hunterRole)doCapture();else doInsult();}if(key==='q')doTrap();if(key==='f')doHide();if(key==='r')doEmote();if(key==='g')doRevive();if(key==='c'&&canAct()){crouchRef.current=!crouchRef.current;setCrouching(crouchRef.current);} };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown); window.addEventListener("keyup", onKeyUp);
    const clock = new THREE.Clock();
    const visibility=()=>{keys.clear();moveRef.current={x:0,z:0};pausedRef.current=document.hidden;setPaused(document.hidden);if(document.hidden){audio?.pause();window.speechSynthesis?.cancel();}else if(!settingsOpenRef.current)audio?.unlock();};
    const blur=()=>{keys.clear();moveRef.current={x:0,z:0};};
    document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',blur);
    function finish(next: GameState, text: string) { if (gameState !== "playing" && gameState !== "spectating") return; gameState = next; setState(next); setMessage(text); }

    function animate() {
      if (disposed) return;
      requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), .05);
      if(pausedRef.current||document.hidden||settingsOpenRef.current){keys.clear();return;}
      visualTime+=dt;
      if(revealTime>0){revealTime-=dt;if(revealTime<=0){setRevealing(false);audio?.play('start');keys.clear();moveRef.current={x:0,z:0};}return;}
      if(gameState==='playing'||gameState==='spectating'){board.tick(dt);elapsed=board.elapsed;}
      if (gameState === "playing" || gameState === "spectating") {
        localTime = board.remaining; insultCd = Math.max(0, insultCd - dt); trapCd = Math.max(0, trapCd - dt);captureCd=Math.max(0,captureCd-dt);
        emoteCd=Math.max(0,emoteCd-dt);
        if(!playerCaught&&!hiding&&!player.userData.downed){jumpVelocity-=14*dt;player.position.y=Math.max(0,player.position.y+jumpVelocity*dt);if(player.position.y===0)jumpVelocity=0;}
        if(wasAirborne&&player.position.y===0&&!playerCaught)audio?.play('land');wasAirborne=player.position.y>0;
        if(hiding&&activeHide&&elapsed-hidingSince>activeHide.seconds)exitHide('Fôlego acabou. Troque de esconderijo!');
        const input = { x: moveRef.current.x, z: moveRef.current.z };
        if (keys.has("a")) input.x = -1; if (keys.has("d")) input.x = 1;
        if (keys.has("w") || keys.has("arrowup")) input.z = -1; if (keys.has("s") || keys.has("arrowdown")) input.z = 1;
        if(keys.has('arrowleft'))lookRef.current.yaw+=dt*1.7;if(keys.has('arrowright'))lookRef.current.yaw-=dt*1.7;
        if (!playerCaught&&!hiding&&!player.userData.downed) {
          const len=Math.max(1,Math.hypot(input.x,input.z)),a=firstRef.current?lookRef.current.yaw:0,speed=crouchRef.current?2.8:5.3;
          const blend=1-Math.exp(-24*dt);
          velocity.x+=((input.x*Math.cos(a)+input.z*Math.sin(a))/len*speed-velocity.x)*blend;
          velocity.z+=((-input.x*Math.sin(a)+input.z*Math.cos(a))/len*speed-velocity.z)*blend;
          const oldX=player.position.x,oldZ=player.position.z;
          moveEntity(player,velocity.x*dt,velocity.z*dt);
          if(player.position.y===0&&Math.hypot(player.position.x-oldX,player.position.z-oldZ)>.005&&elapsed-lastStep>(crouchRef.current?.58:.32)){audio?.play('step',crouchRef.current?.28:.65);lastStep=elapsed;}
        }else{velocity.x=0;velocity.z=0;}

        if(reviveTarget){
          const moved=Math.hypot(player.position.x-reviveOrigin.x,player.position.z-reviveOrigin.z)>.32;
          const tooFar=!reviveTarget.mesh.userData.downed||Math.hypot(player.position.x-reviveTarget.mesh.position.x,player.position.z-reviveTarget.mesh.position.z)>2.3||!clearLine(player.position,reviveTarget.mesh.position,.42);
          if(moved||tooFar)cancelRevive(moved?'Revive cancelado: você se afastou.':'Revive cancelado.');
          else if(elapsed-reviveStarted>=REVIVE_SECONDS)reviveBot(reviveTarget);
        }
        if(player.userData.downed&&elapsed-playerDownedAt>DOWNED_SECONDS)finishDown(player);

        bots.forEach((b) => {
          if(!b.alive)return;
          if(b.mesh.userData.downed){
            if(elapsed-(b.mesh.userData.downedAt||elapsed)>DOWNED_SECONDS)finishDown(b.mesh);
            return;
          }
          if(b.hiddenUntil>elapsed){b.mesh.visible=false;return;}
          if(b.hideId>=0){occupied.delete(b.hideId);b.hideId=-1;b.mesh.visible=true;b.hideAgain=elapsed+18;}
          if(elapsed>b.hideAgain&&b.mesh.position.distanceTo(felipe.position)<10&&!sight(b.mesh)){
            const h=hideSpots.find(h=>!occupied.has(h.id)&&Math.hypot(h.entry.x-b.mesh.position.x,h.entry.z-b.mesh.position.z)<1.6&&clearLine(b.mesh.position,h.entry,.42));
            if(h){b.hideId=h.id;occupied.set(h.id,b.id);b.hiddenUntil=elapsed+h.seconds;b.mesh.visible=false;return;}
          }
          if(b.mesh.position.distanceTo(b.target)<1||!canMove(b.target.x,b.target.z)||Math.random()<dt*.12){
            const p=patrolPoints[Math.floor(Math.random()*patrolPoints.length)];b.target.set(p.x,0,p.z);
          }
          if(b.mesh.position.distanceTo(felipe.position)<7&&sight(b.mesh)){
            const candidates=patrolPoints.filter(p=>Math.hypot(p.x-b.mesh.position.x,p.z-b.mesh.position.z)<22);
            candidates.sort((a,bp)=>Math.hypot(bp.x-felipe.position.x,bp.z-felipe.position.z)-Math.hypot(a.x-felipe.position.x,a.z-felipe.position.z));
            if(candidates[0])b.target.set(candidates[0].x,0,candidates[0].z);
          }
          // Occasionally head to an actual hide entrance rather than an arbitrary wall.
          if(elapsed>b.hideAgain&&Math.random()<dt*.1){const h=hideSpots[Math.floor(Math.random()*hideSpots.length)];b.target.set(h.entry.x,0,h.entry.z);}
          moveToward(b.mesh,b.target,3.9,dt);
          if(elapsed>b.nextInsult){showInsult(b.mesh,nextTaunt());b.nextInsult=elapsed+14+Math.random()*14;}
        });
        remoteActors.forEach((a)=>{if(a.alive&&a.mesh.userData.downed&&elapsed-(a.mesh.userData.downedAt||elapsed)>DOWNED_SECONDS)finishDown(a.mesh,false);});
        if(multiplayer&&elapsed-lastOnlineState>.08){
          sendOnline('state',{x:player.position.x,z:player.position.z,yaw:player.rotation.y,alive:!player.userData.dead,downed:Boolean(player.userData.downed),hidden:hiding});
          lastOnlineState=elapsed;
        }
        if(!multiplayer){
        const visibleActors:THREE.Object3D[]=bots.filter(b=>b.alive&&!b.mesh.userData.downed&&b.hiddenUntil<=elapsed&&sight(b.mesh)).map(b=>b.mesh);
        if(!hunterRole&&!playerCaught&&!hiding&&sight(player,crouchRef.current?FELIPE_CROUCH_SIGHT:FELIPE_SIGHT))visibleActors.push(player);
        visibleActors.sort((a,b)=>a.position.distanceTo(felipe.position)-b.position.distanceTo(felipe.position));
        const visible=visibleActors[0];
        if(visible){lastSeen={x:visible.position.x,z:visible.position.z};lastSeenUntil=elapsed+6;}
        let destination:Point=patrolPoints[patrolIndex];
        if(suspected)destination=suspected;
        else if(visible)destination=visible.position;
        else if(felipe.userData.soundUntil>elapsed)destination=felipe.userData.soundTarget;
        else if(lastSeen&&lastSeenUntil>elapsed)destination=lastSeen;
        else if(Math.hypot(felipe.position.x-destination.x,felipe.position.z-destination.z)<1.2)patrolIndex=(patrolIndex+1)%patrolPoints.length;
        let speed=Math.min(6.1,4.35+elapsed*.005);
        puddles.forEach(p=>{if(p.age>=.4&&p.life>0&&Math.hypot(felipe.position.x-p.mesh.position.x,felipe.position.z-p.mesh.position.z)<1.25){felipeSlow=3;p.life=0;board.award('player','slip');audio?.play('slip',audible(felipe));setMessage('Felipe escorregou!');}});
        if(felipeSlow>0){felipeSlow-=dt;speed=1.25;felipe.rotation.z=Math.sin(elapsed*15)*.25;}else felipe.rotation.z=0;
        previousHunter.x=felipe.position.x;previousHunter.z=felipe.position.z;
        if(!hunterRole)moveToward(felipe,destination,speed,dt);
        if(!hunterRole&&Math.hypot(felipe.position.x-previousHunter.x,felipe.position.z-previousHunter.z)>.005&&elapsed-lastHunterStep>.38){const relative=felipe.position.clone().sub(camera.position);const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);audio?.play('step',audible(felipe)*.8,relative.dot(right)/10);lastHunterStep=elapsed;}
        if(suspected&&Math.hypot(felipe.position.x-suspected.x,felipe.position.z-suspected.z)<1.4){
          if(!searchStarted)searchStarted=elapsed;
          if(elapsed-searchStarted>2){
            if(hiding&&activeHide&&Math.hypot(activeHide.entry.x-suspected.x,activeHide.entry.z-suspected.z)<.5)catchPlayer();
            suspected=null;searchStarted=0;
          }
        }
        if(!hunterRole&&captureCd===0){
          if(!playerCaught&&!hiding&&Math.hypot(player.position.x-felipe.position.x,player.position.z-felipe.position.z)<.9&&clearLine(felipe.position,player.position))catchPlayer();
          else{const b=bots.find(b=>b.alive&&!b.mesh.userData.downed&&b.hiddenUntil<=elapsed&&b.mesh.position.distanceTo(felipe.position)<.9&&clearLine(felipe.position,b.mesh.position));
            if(b){knockDown(b.mesh);attackAnimation();captureCd=1.2;setMessage(b.id.toUpperCase()+' caiu!');}}
        }
        }
        puddles.forEach((p) => { if(p.age>=.4)p.life-=dt; });
        const aliveCount = (playerCaught||hunterRole||player.userData.downed ? 0 : 1) + (multiplayer?remoteActors:allActors).filter((b) => b.role==='inocente'&&b.alive&&!b.mesh.userData.downed).length;
        if(board.complete&&(board.remaining===0||elapsed-lastElimination>.7)){
          board.finish();const results=board.ranking(),winners=results.filter(p=>p.rank===1);setRanking(results);setWinner(winners.length>1?'Empate':winners[0].name);setScore(results.find(p=>p.id===localScoreId)!.total);setTime(Math.ceil(board.remaining));
          audio?.play('end');window.speechSynthesis?.cancel();
          finish(winners.some(p=>p.id===localScoreId)?'won':'lost',board.remaining===0?'Tempo encerrado!':'Todos os inocentes foram eliminados.');
        }
        if (elapsed - lastUi > .15) {
          setRemaining(aliveCount);setScore(board.ranking().find(p=>p.id===localScoreId)!.total);setSector(sectorAt(player.position));setAttackReady(hunterRole&&captureCd<=0&&!!targetFor());setAttackCooldown(captureCd);
          setDanger(!hunterRole&&!playerCaught&&felipe.position.distanceTo(player.position)<9);setEmoteCooldown(Math.ceil(emoteCd));
          const h=activeHide||nearbySpot();setHideInfo({label:h?.kind||'',seconds:activeHide?Math.max(0,Math.ceil(activeHide.seconds-elapsed+hidingSince)):0,available:!!h});
          const downed=nearbyDowned();setReviveInfo({available:!hunterRole&&!!downed,name:downed?.id||'',seconds:reviveTarget?Math.max(0,Math.ceil(REVIVE_SECONDS-(elapsed-reviveStarted))):0});
          lastUi = elapsed; setTime(Math.ceil(localTime)); setInsultCooldown(Math.ceil(insultCd)); setTrapCooldown(Math.ceil(trapCd)); }
      }

      for(const p of puddles){
        if(p.age<.4&&p.age+dt>=.4)audio?.play('splash',audible(p.bottle));p.age+=dt;const t=Math.min(1,p.age/.4);p.bottle.position.lerpVectors(p.from,p.to,t);p.bottle.position.y+=Math.sin(t*Math.PI)*.5;p.bottle.rotation.z=t*1.5;
        p.mesh.visible=t===1&&p.life>0;if(t===1)p.mesh.scale.setScalar(Math.min(1,.2+(p.age-.4)*4));p.bottle.visible=p.life>0;
      }
      for(const body of bodies){if(body.revived)continue;const t=Math.min(1,(visualTime-body.at)/.45);body.mesh.rotation.x=-Math.PI/2*(1-(1-t)**3);body.mesh.position.y=.32*t;}
      const attackProgress=Math.max(0,(felipe.userData.attackUntil||0)-visualTime)/.4;
      viewKnife.visible=hunterRole&&firstRef.current&&!playerCaught;
      viewKnife.position.set(.3-Math.sin(attackProgress*Math.PI)*.14,-.3+Math.sin(attackProgress*Math.PI)*.12,-.65-Math.sin(attackProgress*Math.PI)*.28);
      const liveBots=(multiplayer?remoteActors:allActors).filter(b=>b.role==='inocente'&&b.alive&&!b.mesh.userData.downed);
      const observed=liveBots[spectateRef.current%Math.max(1,liveBots.length)];
      const focus=playerCaught?(observed?.mesh||felipe):player;
      if(playerCaught)setWatching(observed?observed.id+(observed.hiddenUntil>elapsed?' · escondido':''):'Felipe');
      player.visible=playerCaught||(!firstRef.current&&!hiding);
      if((firstRef.current||hiding)&&!playerCaught){camera.position.set(activeHide?activeHide.x:player.position.x,activeHide?(activeHide.kind==='armário'?1.6:.65):player.position.y+(crouchRef.current?1.15:1.95),activeHide?activeHide.z+.66:player.position.z);camera.rotation.order='YXZ';camera.rotation.set(lookRef.current.pitch,lookRef.current.yaw,0);}
      else {const desired = new THREE.Vector3(focus.position.x, 7, focus.position.z + 6);camera.position.lerp(desired, .075); camera.lookAt(focus.position.x, .9, focus.position.z);}
      flashlight.visible=!hiding;flashlight.position.copy(camera.position);flashlight.target.position.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(10));
      for(const actor of [...new Set([player,felipe,...bots.map(b=>b.mesh)])].filter(a=>!a.userData.dead&&!a.userData.downed))actor.children.filter(c=>c.name==='arm').forEach((arm,i)=>{arm.rotation.z=0;arm.rotation.x=Math.sin(elapsed*7+i*Math.PI)*.35;
        if(actor===player&&elapsed<emoteUntil){if(emoteIndex===0&&i===1){arm.rotation.z=2.4+Math.sin(elapsed*16)*.3;arm.rotation.x=0;}if(emoteIndex===1){arm.rotation.z=(i?1:-1)*(1+Math.sin(elapsed*10)*.5);arm.rotation.x=Math.sin(elapsed*8)*.8;}if(emoteIndex===2){arm.rotation.x=-1.2+Math.sin(elapsed*18)*.2;}}});
      if(!playerCaught)player.rotation.z=elapsed<emoteUntil&&emoteIndex!==0?Math.sin(elapsed*10)*.12:0;
      if(attackProgress>0)hunterArm.rotation.x=-Math.sin(attackProgress*Math.PI)*1.8;
      for(const [id,door] of scenery.doors){const opening=activeHide?.id===id&&elapsed-hidingSince<.5;door.rotation.y=THREE.MathUtils.lerp(door.rotation.y,opening?-1.2:0,.15);}
      renderer.render(scene, camera);
    }
    animate();
    const resize = () => { camera.aspect = mount.clientWidth / mount.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(mount.clientWidth, mount.clientHeight); };
    window.addEventListener("resize", resize);
    return () => {
      disposed = true;document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',blur); window.removeEventListener("resize", resize); window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp);
      joystickCleanup.current();
      window.speechSynthesis?.cancel(); mount.querySelectorAll(".world-insult").forEach((n) => n.remove()); renderer.dispose(); renderer.domElement.remove();
      scene.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials){m.map?.dispose();m.dispose();} } });
    };
  }, [selectedCharacter,audio]);

  const startJoystick = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    joystickCleanup.current();
    const el = e.currentTarget; el.setPointerCapture(e.pointerId); const rect = el.getBoundingClientRect();
    const update = (x: number, y: number) => {
      const dx = x - (rect.left + rect.width / 2), dy = y - (rect.top + rect.height / 2); const max = rect.width * .32; const len = Math.hypot(dx, dy) || 1; const scale = Math.min(1, max / len);
      moveRef.current = { x: (dx * scale) / max, z: (dy * scale) / max };
      const knob = el.querySelector("i") as HTMLElement; knob.style.transform = "translate(" + (dx * scale) + "px," + (dy * scale) + "px)";
    };
    update(e.clientX, e.clientY);
    const move = (ev: PointerEvent) => {if(ev.pointerId===e.pointerId)update(ev.clientX, ev.clientY);};
    const cleanup=()=>{moveRef.current={x:0,z:0};const knob=el.querySelector('i') as HTMLElement;knob.style.transform='translate(0,0)';window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);};
    const up = (ev:PointerEvent) => {if(ev.pointerId===e.pointerId)cleanup();};
    joystickCleanup.current=cleanup;
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);window.addEventListener('pointercancel',up);
  }, []);

  const immediateAction=(action:()=>void)=>({onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();e.stopPropagation();action();},onClick:(e:React.MouseEvent<HTMLButtonElement>)=>{if(e.detail===0)action();}});

  const formatted = Math.floor(time / 60) + ":" + String(time % 60).padStart(2, "0");
  return (
    <main className="game-screen" style={{"--joystick-scale":settings.joystick/100} as React.CSSProperties}>
      <div className="rotate-notice"><b>Gire o celular ↻</b><p>Jogue na horizontal: movimento à esquerda, câmera à direita.</p></div>
      <div ref={mountRef} className="game-canvas" />
      {isFelipe&&!revealing&&<div className="felipe-vision" aria-hidden="true"/>}
      {revealing&&!renderError&&<div className={'role-reveal '+(isFelipe?'hunter':'')} role="status"><small>SEU PAPEL NESTA RODADA</small><h1>{isFelipe?'VOCÊ É O FELIPE':'VOCÊ É INOCENTE'}</h1><p>{isFelipe?'Encontre os funcionários. Use MATAR de perto e VASCULHAR nos esconderijos.':'Some pontos sobrevivendo e provocando. Você tem cinco minutos.'}</p><span>Treino contra bots · Sua escolha no lobby está guardada</span></div>}
      <div className="look-zone" aria-label="Arraste para olhar" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);lookPointer.current={id:e.pointerId,x:e.clientX,y:e.clientY};}} onPointerMove={e=>{const p=lookPointer.current;if(!p||p.id!==e.pointerId)return;lookRef.current.yaw-=(e.clientX-p.x)*.006;lookRef.current.pitch=Math.max(-1.1,Math.min(1.1,lookRef.current.pitch-(e.clientY-p.y)*.005));p.x=e.clientX;p.y=e.clientY;}} onPointerUp={()=>lookPointer.current=null} onPointerCancel={()=>lookPointer.current=null}/>
      {firstPerson&&state==='playing'&&<div className="crosshair">·</div>}
      {renderError && (
        <div className="webgl-fallback">
          <FlaskConicalFallback />
          <h2>O 3D não abriu neste navegador</h2>
          <p>Ative a aceleração gráfica ou abra no Chrome/Safari do celular.</p>
          <button onClick={onExit}>Voltar ao lobby</button>
        </div>
      )}
      <div className="game-hud top-hud">
        <button className="hud-icon" onClick={onExit} aria-label="Voltar"><ArrowLeft /></button>
        <div className="objective"><small>PONTOS</small><b>{score}</b></div>
        <button className="view-button" onClick={()=>{firstRef.current=!firstRef.current;setFirstPerson(firstRef.current);}}>{firstPerson?'1ª pessoa':'3ª pessoa'}</button>
        <button className="hud-icon settings-hud" onClick={()=>{joystickCleanup.current();onSettings();}} aria-label="Configurações"><Settings/></button>
        <div className="timer"><small>RESTANTE</small><b>{formatted}</b></div>
        <div className="survivors"><small>VIVOS</small><b>{remaining}/5</b></div>
      </div>
      {paused&&<div className="pause-label">Jogo pausado</div>}
      {hidden&&<div className={'hiding-mask '+hideInfo.label} aria-hidden="true"/>}
      <div className={'sector-tag '+(danger?'near-danger':'')}>{sector}{danger?' · FELIPE PERTO':''}</div>
      {state==='spectating'&&<button className="spectator-switch" onClick={()=>spectateRef.current++}>Assistindo: {watching} · Trocar</button>}
      {!revealing&&(state==='playing'||state==='spectating')&&<div key={message} className="game-message" role="status">{message}</div>}
      {(state === "won" || state === "lost") && <div className="end-overlay"><section><span>RANKING DA RODADA</span><h2>{winner==='Empate'?'Empate!':winner+' venceu!'}</h2><p>{message}</p><ol className="round-ranking">{ranking.map(p=><li key={p.id} className={p.id==='player'?'my-score':''}><small>{p.rank}º</small><span>{p.name}<small>{p.role==='felipe'?'Felipe':p.downed?'Caído':p.alive?'Sobreviveu':'Eliminado'}</small></span><b>{p.total} pts</b></li>)}</ol><div><button onClick={onReplay}><RotateCcw size={19} />Voltar ao lobby</button><button onClick={onExit}>Trocar personagem</button></div></section></div>}
      <div className="mobile-controls">
        <div className={'joystick '+(state!=='playing'?'inactive':'')} aria-label="Joystick de movimento" onPointerDown={state==='playing'?startJoystick:undefined}><i /></div>
        <div className="control-stack">
          <div className="extra-actions">
            <button disabled={state!=='playing'||hidden} aria-pressed={crouching} onClick={()=>{crouchRef.current=!crouchRef.current;setCrouching(crouchRef.current);}}>{crouching?'LEVANTAR':'AGACHAR'}</button>
            <button disabled={state!=='playing'||hidden||emoteCooldown>0} onClick={()=>gameApiRef.current.emote()}>EMOTE {emoteCooldown>0?emoteCooldown+'s':'☺'}</button>
            <button disabled={state!=='playing'||hidden} onPointerDown={e=>{
              if(e.pointerType==='mouse'&&e.button!==0)return;
              // A second finger does not reliably produce a click while the joystick is held.
              e.preventDefault();e.stopPropagation();gameApiRef.current.jump();
            }} onClick={e=>{if(e.detail===0)gameApiRef.current.jump();}}>PULAR ↑</button>
          </div>
          <div className="action-buttons">
            <button className="hide-button" disabled={state!=='playing'||(!isFelipe&&!hidden&&!hideInfo.available)} {...immediateAction(()=>gameApiRef.current.hide())}><Eye/><b>{isFelipe?'VASCULHAR':hidden?'SAIR':'ESCONDER'}</b>{hidden&&<small className="hide-countdown">{hideInfo.seconds}s</small>}</button>
            {!isFelipe&&(reviveInfo.available||reviving)&&<button className="revive-button" disabled={state!=='playing'||(!reviveInfo.available&&!reviving)} {...immediateAction(()=>gameApiRef.current.revive())}><b>{reviving?'REVIVENDO':'REVIVER'}</b>{reviving?<span>{reviveInfo.seconds}s</span>:<small>{reviveInfo.name}</small>}</button>}
            {!isFelipe&&<button className="trap-button" aria-label="Jogar detergente" disabled={hidden || traps === 0 || trapCooldown > 0 || state !== "playing"} {...immediateAction(()=>gameApiRef.current.trap())}><SprayCan /><b>{traps}</b>{trapCooldown > 0 && <span>{trapCooldown}s</span>}</button>}
            <button className={'insult-button '+(isFelipe&&attackReady?'in-range':'')} aria-label={isFelipe?'Atacar com faca':'Xingar'} disabled={(isFelipe?attackCooldown>0:insultCooldown>0)||state!=='playing'} {...immediateAction(()=>isFelipe?gameApiRef.current.capture():gameApiRef.current.insult())}>{isFelipe?<b aria-hidden="true">🗡</b>:<Volume2/>}<b>{isFelipe?'MATAR':'XINGAR'}</b>{isFelipe&&attackCooldown>0?<span>{attackCooldown.toFixed(1)}s</span>:!isFelipe&&insultCooldown>0?<span>{insultCooldown}s</span>:null}</button>
          </div>
        </div>
      </div>
    </main>
  );
}

function FlaskConicalFallback() {
  return <span className="fallback-flask">⚗</span>;
}
