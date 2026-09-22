"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient, type RealtimeChannel, type Session } from "@supabase/supabase-js";
import { FlaskConical, Gamepad2, LogOut, Play, ShieldAlert } from "lucide-react";
import FactoryGame from "./factory-game";
import CharacterPreview from './character-preview';
import SettingsPanel,{defaultSettings,loadSettings,type GameSettings} from './game-settings';
import {GameAudio} from './game-audio';

const characters = [
  { id: "luan", name: "Luan", detail: "Altão, barbudo e de óculos", color: "#f5a623", initials: "LU" },
  { id: "lucas", name: "Lucas", detail: "Bigode lendário e topete", color: "#56c7ff", initials: "LC" },
  { id: "joao", name: "João", detail: "Magrelo e orelhudo", color: "#c8ff55", initials: "JO" },
  { id: "vitin", name: "Vitin", detail: "Cacheado e trapper", color: "#bd76ff", initials: "VI" },
  { id: "matheus", name: "Matheus", detail: "Barbudo e barrigudinho", color: "#ff667f", initials: "MT" },
];

// Realtime only uses the public publishable key. No database tables or secrets
// are exposed to the browser; rooms live in Supabase's ephemeral channels.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kwfzkzgsofjaebmhmcsr.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_99GQbr_UnXYaL1NNHpyPGw_LUOIdXCs";

type RoomPlayer = { id:string; name:string; skin:string; ready:boolean };
type OnlineMatch = { code:string; channel:RealtimeChannel; clientId:string; players:RoomPlayer[]; roles:Record<string,'felipe'|'inocente'> };

export default function GameShell() {
  const supabase = useMemo(
    () => (supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null),
    [],
  );
  const [session, setSession] = useState<Session | null>(null);
  const [guest, setGuest] = useState(false);
  const [screen, setScreen] = useState<"login" | "lobby" | "waiting" | "game">("login");
  const [ready,setReady]=useState(false);
  const [countdown,setCountdown]=useState<number|null>(null);
  const [settings,setSettings]=useState(defaultSettings);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [roomCodeInput,setRoomCodeInput]=useState('');
  const [roomCode,setRoomCode]=useState('');
  const [roomPlayers,setRoomPlayers]=useState<RoomPlayer[]>([]);
  const [roomChannel,setRoomChannel]=useState<RealtimeChannel|null>(null);
  const [onlineMatch,setOnlineMatch]=useState<OnlineMatch|null>(null);
  const roomClientId=useRef(typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2));
  const audioRef=useRef<GameAudio|null>(null);
  useEffect(()=>{
    setSettings(loadSettings());
    const unlock=()=>{if(!audioRef.current)audioRef.current=new GameAudio();audioRef.current.setVolume(loadSettings().volume/100);audioRef.current.unlock();};
    document.addEventListener('pointerdown',unlock,true);document.addEventListener('keydown',unlock,true);
    return ()=>{document.removeEventListener('pointerdown',unlock,true);document.removeEventListener('keydown',unlock,true);audioRef.current?.dispose();audioRef.current=null;};
  },[]);
  const changeSettings=(next:GameSettings)=>{setSettings(next);audioRef.current?.setVolume(next.volume/100);window.speechSynthesis?.cancel();try{localStorage.setItem('xingue-settings-v1',JSON.stringify(next));}catch{}};
  const settingsPanel=settingsOpen?<SettingsPanel value={settings} onChange={changeSettings} onClose={()=>setSettingsOpen(false)}/>:null;
  const [selected, setSelected] = useState("vitin");
  const [authLoading, setAuthLoading] = useState(Boolean(supabaseUrl&&supabaseKey));

  const roomTopic=(code:string)=>'xingue-o-felipe:room:'+code.toUpperCase();
  const readPresence=(channel:RealtimeChannel):RoomPlayer[]=>Object.values(channel.presenceState()).flatMap((entries:any)=>entries.map((entry:any)=>entry as RoomPlayer)).filter((p,index,all)=>p?.id&&all.findIndex(x=>x.id===p.id)===index);
  const leaveRoom=()=>{roomChannel?.unsubscribe();setRoomChannel(null);setRoomCode('');setRoomPlayers([]);setOnlineMatch(null);setCountdown(null);try{history.replaceState(null,'',location.pathname);}catch{}};
  const createOrJoinRoom=async(code:string)=>{
    if(!supabase)return;
    const normalized=(code||Math.random().toString(36).slice(2,8)).replace(/[^a-z0-9]/gi,'').slice(0,8).toUpperCase();
    if(normalized.length<4)return;
    roomChannel?.unsubscribe();
    const channel=supabase.channel(roomTopic(normalized),{config:{presence:{key:roomClientId.current}}});
    channel.on('presence',{event:'sync'},()=>setRoomPlayers(readPresence(channel)));
    channel.on('broadcast',{event:'room_start'},({payload})=>{
      const roles=payload.roles as Record<string,'felipe'|'inocente'>;
      const players=payload.players as RoomPlayer[];
      setOnlineMatch({code:normalized,channel,clientId:roomClientId.current,players,roles});
      setRoomPlayers(players);setCountdown(3);
    });
    channel.on('broadcast',{event:'room_reset'},()=>{setOnlineMatch(null);setCountdown(null);setScreen('waiting');});
    channel.subscribe(async status=>{if(status==='SUBSCRIBED'){await channel.track({id:roomClientId.current,name:playerName,skin:selected,ready:false});setRoomPlayers(readPresence(channel));}});
    setRoomChannel(channel);setRoomCode(normalized);setScreen('waiting');
    try{history.replaceState(null,'',location.pathname+'?sala='+normalized);}catch{}
  };
  const updateReady=async(next:boolean)=>{setReady(next);if(roomChannel)await roomChannel.track({id:roomClientId.current,name:playerName,skin:selected,ready:next});};
  const startOnlineMatch=async()=>{
    if(!roomChannel||roomPlayers.length<2||!roomPlayers.every(p=>p.ready))return;
    const players=roomPlayers.slice(0,6);const felipe=players[Math.floor(Math.random()*players.length)];
    const roles=Object.fromEntries(players.map(p=>[p.id,p.id===felipe.id?'felipe':'inocente'])) as Record<string,'felipe'|'inocente'>;
    await roomChannel.send({type:'broadcast',event:'room_start',payload:{players,roles}});
    setOnlineMatch({code:roomCode,channel:roomChannel,clientId:roomClientId.current,players,roles});setCountdown(3);
  };

  useEffect(()=>{
    if(screen!=='waiting'||countdown===null||settingsOpen)return;
    const timer=window.setTimeout(()=>{if(countdown<=1){setCountdown(null);setScreen('game');}else setCountdown(countdown-1);},1000);
    return ()=>window.clearTimeout(timer);
  },[screen,countdown,settingsOpen]);

  useEffect(()=>{
    const code=new URLSearchParams(location.search).get('sala');
    if(code&&screen==='lobby'&&!roomChannel)void createOrJoinRoom(code);
    // The URL is only a convenience for joining a friend; the channel owns the room state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[screen]);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) setScreen("lobby");
      setAuthLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) setScreen("lobby");
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  async function googleLogin() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }

  async function signOut() {
    if (supabase && session) await supabase.auth.signOut();
    setGuest(false);
    setSession(null);
    setScreen("login");
  }

  const playerName = session?.user.user_metadata?.full_name?.split(" ")[0] || "Convidado";

  if (authLoading) {
    return <main className="boot-screen"><div className="boot-mark"><FlaskConical /></div><p>Preparando a fábrica…</p></main>;
  }

  if (screen === "game") {
    return <><FactoryGame selectedCharacter={selected} settings={settings} settingsOpen={settingsOpen} onSettings={()=>setSettingsOpen(true)} audio={audioRef.current} multiplayer={onlineMatch ? {channel:onlineMatch.channel,clientId:onlineMatch.clientId,players:onlineMatch.players,roles:onlineMatch.roles,role:onlineMatch.roles[onlineMatch.clientId],roomCode:onlineMatch.code} : undefined} onExit={() => {if(onlineMatch)leaveRoom();setScreen("lobby");}} onReplay={()=>{setReady(false);setCountdown(null);setScreen('waiting');}} />{settingsPanel}</>;
  }

  if(screen==='waiting')return <main className="waiting-room"><section><small>{roomCode?'SALA ONLINE · '+roomCode:'TREINO LOCAL · SALA DE ESPERA'}</small><h1>{countdown===null?'Tudo pronto?':'Começando em '+countdown}</h1><p>{roomCode?'Compartilhe o código da sala com seu amigo. O Felipe será sorteado para apenas um jogador.':'O Felipe só é sorteado depois da contagem.'}</p>{roomCode?<ul>{roomPlayers.map(p=><li key={p.id}><b>{p.name} · {p.skin}</b><span>{p.ready?'Pronto':'Aguardando'}</span></li>)}</ul>:<ul><li><b>Você · {selected}</b><span>{ready?'Pronto':'Aguardando você'}</span></li>{Array.from({length:5},(_,i)=><li key={i}><b>Bot {i+1}</b><span>Pronto · computador</span></li>)}</ul>}<button className="guest-button" disabled={countdown!==null} aria-pressed={ready} onClick={()=>roomCode?void updateReady(!ready):setReady(!ready)}>{ready?'PRONTO ✓':'ESTOU PRONTO'}</button><button className="play-button" disabled={!ready||countdown!==null||(roomCode?roomPlayers.length<2||!roomPlayers.every(p=>p.ready):false)} onClick={()=>roomCode?void startOnlineMatch():setCountdown(3)}>{roomCode?'INICIAR PARTIDA ONLINE':'INICIAR TREINO'}</button><button className="waiting-back" onClick={()=>{if(roomCode)leaveRoom();setCountdown(null);setScreen('lobby');}}>Voltar à escolha</button><small>{roomCode?'Online via Supabase Realtime · até 6 jogadores':'Esta sala usa bots. Crie uma sala online para chamar um amigo.'}</small></section></main>;

  if (screen === "login" && !session && !guest) {
    return (
      <main className="login-screen">
        <div className="factory-stripes" />
        <section className="login-card">
          <div className="brand-lockup">
            <div className="brand-icon"><FlaskConical size={30} /></div>
            <div><span>Fábrica 07 apresenta</span><h1>XINGUE<br />O FELIPE</h1></div>
          </div>
          <p className="login-copy">Provoque. Arme a emboscada. Corra antes que ele te pegue.</p>
          <div className="warning-ticket"><ShieldAlert size={19} /><span>Um Felipe. Cinco funcionários. Nenhuma maturidade.</span></div>
          {supabase ? (
            <button className="google-button" onClick={googleLogin}>
              <span className="google-g">G</span> Entrar com Google
            </button>
          ) : (
            <div className="auth-note">O login Google será ativado quando as chaves do projeto forem conectadas.</div>
          )}
          <button className="guest-button" onClick={() => { setGuest(true); const code=new URLSearchParams(location.search).get('sala'); if(code)void createOrJoinRoom(code); else setScreen("lobby"); }}>
            Testar como convidado
          </button>
          <small>Protótipo privado para jogar entre amigos.</small>
        </section>
      </main>
    );
  }

  return (
    <main className="lobby-screen">
      <header className="lobby-header">
        <div className="mini-brand"><FlaskConical size={20} /><b>XINGUE O FELIPE</b><span>ALPHA</span></div>
        <div className="player-chip"><button className="settings-open" onClick={()=>setSettingsOpen(true)}>⚙ Configurações</button><span className="online-dot" />{playerName}<button aria-label="Sair" onClick={signOut}><LogOut size={17} /></button></div>
      </header>
      <section className="lobby-content">
        <div className="lobby-title"><p>ESCOLHA SEU FUNCIONÁRIO</p><h1>Quem vai encarar o Felipe?</h1></div>
        <div className="character-grid">
          {characters.map((character) => (
            <button
              key={character.id}
              className={"character-card " + (selected === character.id ? "selected" : "")}
              style={{ "--character-color": character.color } as React.CSSProperties}
              onClick={() => setSelected(character.id)}
            >
              <CharacterPreview id={character.id}/>
              <span className="character-copy"><b>{character.name}</b><small>{character.detail}</small></span>
              <span className="select-ring" />
            </button>
          ))}
        </div>
        <div className="mission-card">
          <div><span>5 MINUTOS · DISPUTA POR PONTOS · CONTRA BOTS</span><b>Seu papel é sorteado. Quem fizer mais pontos vence!</b></div>
          <div className="mission-pills"><span>6 setores</span><span>18 esconderijos</span><span>Pulo + emotes</span></div>
        </div>
        <button className="play-button" onClick={() => {setReady(false);setCountdown(null);setScreen("waiting");if(window.matchMedia('(pointer:coarse)').matches){document.documentElement.requestFullscreen?.().then(()=>{const o=screenOrientation();o?.lock?.('landscape').catch(()=>{});}).catch(()=>{});}}}><Play fill="currentColor" size={22} /> TREINO COM BOTS</button>
        <div className="online-room-create"><button className="guest-button" onClick={()=>void createOrJoinRoom('')}>CRIAR SALA ONLINE</button><div><input aria-label="Código da sala" placeholder="Código da sala" value={roomCodeInput} onChange={e=>setRoomCodeInput(e.target.value.toUpperCase())}/><button className="guest-button" onClick={()=>void createOrJoinRoom(roomCodeInput)}>ENTRAR NA SALA</button></div></div>
        <p className="control-hint"><Gamepad2 size={18} /> Celular deitado · Joystick à esquerda · Arraste à direita para olhar</p>
        <p className="multiplayer-note">Online: crie uma sala, mande o código para seu amigo e os dois marquem “Pronto”.</p>
        <details className="score-rules"><summary>Como ganhar pontos</summary><p>Inocente: +1 por segundo vivo, +10 ao provocar a até 15 m do Felipe, +40 ao fazê-lo escorregar e +50 por chegar vivo ao fim dos 5 minutos. Felipe: +100 por eliminação. Eliminação mantém seus pontos e ativa espectador. Empates dividem a colocação. A rodada acaba antes se todos os inocentes forem eliminados.</p></details>
      </section>
      {settingsPanel}
    </main>
  );
}

function screenOrientation(){return window.screen.orientation as ScreenOrientation & {lock?:(value:string)=>Promise<void>};}
