"use client";
import {useEffect,useRef} from 'react';
export type GameSettings={volume:number;joystick:number};
export const defaultSettings:GameSettings={volume:60,joystick:100};
export function loadSettings():GameSettings{
 try{const value=JSON.parse(localStorage.getItem('xingue-settings-v1')||'null');return {volume:typeof value?.volume==='number'&&Number.isFinite(value.volume)?Math.max(0,Math.min(100,value.volume)):60,joystick:typeof value?.joystick==='number'&&Number.isFinite(value.joystick)?Math.max(80,Math.min(150,value.joystick)):100};}catch{return {...defaultSettings};}
}
export default function SettingsPanel({value,onChange,onClose}:{value:GameSettings;onChange:(next:GameSettings)=>void;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{dialog.current?.showModal();return ()=>dialog.current?.close();},[]);
 return <dialog ref={dialog} className="settings-dialog" onCancel={e=>{e.preventDefault();onClose();}}><header><h2>Configurações</h2><button onClick={onClose} aria-label="Fechar configurações" autoFocus>✕</button></header><label htmlFor="game-volume">Volume do jogo e voz <b>{value.volume}%</b></label><input id="game-volume" type="range" min="0" max="100" value={value.volume} onChange={e=>onChange({...value,volume:Number(e.target.value)})}/><label htmlFor="joystick-size">Tamanho do joystick <b>{value.joystick}%</b></label><input id="joystick-size" type="range" min="80" max="150" step="5" value={value.joystick} onChange={e=>onChange({...value,joystick:Number(e.target.value)})}/><div className="joystick-preview" style={{width:value.joystick*.75,height:value.joystick*.75}}><i/></div><button className="settings-save" onClick={onClose}>Concluído</button><small>Salvo neste aparelho. A rodada local pausa enquanto você ajusta.</small></dialog>;
}
