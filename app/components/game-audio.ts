type Sound='step'|'jump'|'land'|'throw'|'splash'|'slip'|'knife'|'hit'|'hide'|'start'|'end';
export class GameAudio{
 private context:AudioContext|null=null;
 private master:GainNode|null=null;
 private volume=.6;
 private closed=false;
 unlock(){
  if(this.closed)return;
  try{if(!this.context){this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=this.volume;this.master.connect(this.context.destination);}if(this.context.state==='suspended')void this.context.resume().catch(()=>{});}catch{/* Sound is optional if the browser does not support Web Audio. */}
 }
 setVolume(value:number){this.volume=Math.max(0,Math.min(1,value));if(this.master&&this.context)this.master.gain.setTargetAtTime(this.volume,this.context.currentTime,.025);}
 pause(){if(this.context?.state==='running')void this.context.suspend().catch(()=>{});}
 play(kind:Sound,gain=1,pan=0){
  const c=this.context,m=this.master;if(!c||!m||c.state!=='running'||!this.volume||this.closed)return;
  const specs:Record<Sound,[number,number,number,number,OscillatorType]>={step:[95,45,.075,.16,'triangle'],jump:[180,420,.15,.13,'sine'],land:[100,40,.12,.17,'triangle'],throw:[550,190,.16,.09,'sine'],splash:[240,65,.28,.13,'triangle'],slip:[650,100,.28,.12,'sine'],knife:[450,80,.12,.09,'sawtooth'],hit:[110,35,.16,.18,'triangle'],hide:[160,90,.12,.1,'square'],start:[440,880,.35,.12,'sine'],end:[660,330,.6,.14,'sine']};
  const [from,to,duration,level,type]=specs[kind],now=c.currentTime;
  const oscillator=c.createOscillator(),envelope=c.createGain(),stereo=c.createStereoPanner();
  oscillator.type=type;oscillator.frequency.setValueAtTime(from,now);oscillator.frequency.exponentialRampToValueAtTime(to,now+duration);
  envelope.gain.setValueAtTime(.0001,now);envelope.gain.linearRampToValueAtTime(level*Math.max(0,Math.min(1,gain)),now+.008);envelope.gain.exponentialRampToValueAtTime(.0001,now+duration);
  stereo.pan.value=Math.max(-1,Math.min(1,pan));oscillator.connect(envelope);envelope.connect(stereo);stereo.connect(m);oscillator.start();oscillator.stop(now+duration+.01);
  oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect();stereo.disconnect();};
  if(['step','splash','knife','hit','land'].includes(kind)){
   const length=kind==='splash'?.24:.09,buffer=c.createBuffer(1,Math.ceil(c.sampleRate*length),c.sampleRate),samples=buffer.getChannelData(0);
   for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*(1-i/samples.length);
   const noise=c.createBufferSource(),filter=c.createBiquadFilter(),level=c.createGain();noise.buffer=buffer;filter.type='lowpass';filter.frequency.value=kind==='step'?700:kind==='splash'?2800:1600;
   level.gain.setValueAtTime(.12*gain,now);level.gain.exponentialRampToValueAtTime(.0001,now+length);noise.connect(filter);filter.connect(level);level.connect(m);noise.start();noise.onended=()=>{noise.disconnect();filter.disconnect();level.disconnect();};
  }
 }
 dispose(){this.closed=true;if(this.context)void this.context.close().catch(()=>{});this.context=null;this.master=null;}
}
