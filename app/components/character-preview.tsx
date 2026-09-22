"use client";
import {useEffect,useRef} from 'react';
import * as THREE from 'three';
import {makePerson} from './factory-game';
export default function CharacterPreview({id}:{id:string}){
 const host=useRef<HTMLSpanElement>(null);
 useEffect(()=>{const el=host.current;if(!el)return;let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});}catch{return;}
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,20);camera.position.set(2,2.3,5);camera.lookAt(0,1.3,0);scene.add(new THREE.HemisphereLight(0xdaf0ff,0x384144,2.4));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(2,4,3);scene.add(light);const model=makePerson(id,id);model.rotation.y=-.15;scene.add(model);
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));el.appendChild(renderer.domElement);const draw=()=>{renderer.setSize(el.clientWidth,el.clientHeight);camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.render(scene,camera);};const obs=new ResizeObserver(draw);obs.observe(el);draw();return()=>{obs.disconnect();renderer.dispose();renderer.domElement.remove();scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}});};},[id]);
 return <span className="model-preview" ref={host} aria-hidden="true"/>;
}
