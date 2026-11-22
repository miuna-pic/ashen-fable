import * as T from 'three';
import { col, row, SIZE, THRONE } from './game.js';
import { randomGenerator } from './art.js';
import { mesh, miniature, pillar } from './sculpt.js';

const step = 1.06;
const top = .075;
const pos = (tile) => [(col(tile)-2)*step,(row(tile)-2)*step];
const obsidian = new T.MeshStandardMaterial({color:'#152421',roughness:.89,metalness:.11});
const oxidized = new T.MeshStandardMaterial({color:'#344841',roughness:.71,metalness:.24});
const bronze = new T.MeshStandardMaterial({color:'#95714c',roughness:.51,metalness:.43});
const bone = new T.MeshStandardMaterial({color:'#a8946b',roughness:.84,metalness:.12});
const slab = new T.BoxGeometry(1,1,1);

function texture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx,size);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

function slateTexture(seed, light) {
  const rand = randomGenerator(seed);
  return texture(192,(c,s) => {
    const g = c.createLinearGradient(0,0,s,s);
    g.addColorStop(0, light?'#78817a':'#586761');
    g.addColorStop(.56, light?'#66716a':'#445851');
    g.addColorStop(1, light?'#575d54':'#364841');
    c.fillStyle=g; c.fillRect(0,0,s,s);
    for (let i=0;i<2500;i++) {
      const shade = rand()>.6 ? '255,243,219':'9,19,14';
      c.fillStyle='rgba('+shade+','+rand()*.23+')';
      c.fillRect(rand()*s,rand()*s,1+rand()*7,1+rand()*1.7);
    }
    for (let i=0;i<24;i++) {
      let x=rand()*s,y=rand()*s;
      c.strokeStyle=i%5===0?'#d6d7b134':'#101c1633';
      c.beginPath(); c.moveTo(x,y);
      for(let j=0;j<5;j++) {x+=rand()*14-5;y+=rand()*11;c.lineTo(x,y);}
      c.stroke();
    }
    c.strokeStyle=light?'#e1d5ac54':'#bdab7954'; c.strokeRect(2.5,2.5,s-5,s-5);
    c.strokeStyle='#14181493'; c.strokeRect(7.5,7.5,s-15,s-15);
    c.strokeStyle='#cfb37a38';
    for (const [x,y] of [[14,14],[s-14,14],[14,s-14],[s-14,s-14]]) {
      c.beginPath(); c.moveTo(x-4,y); c.lineTo(x,y+4); c.lineTo(x+4,y); c.lineTo(x,y-4); c.closePath(); c.stroke();
    }
  });
}

function flatMap(map, opacity=1) {
  return new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,opacity,polygonOffset:true,polygonOffsetFactor:-2});
}

function floorGraphic(parent, material, x, y, z, radius=1) {
  const plane = mesh(parent, new T.PlaneGeometry(radius,radius), material, x,y,z);
  plane.rotation.x = -Math.PI/2;
  return plane;
}

function seal(c,s){
  c.translate(s/2,s/2);
  c.strokeStyle='#f0cd8599';
  c.lineWidth=2;
  for (const r of [54,68,73]) {c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();}
  c.lineWidth=1.2;
  for(let i=0;i<16;i++){
    c.rotate(Math.PI/8);
    c.beginPath(); c.moveTo(59,0); c.lineTo(66,0); c.stroke();
  }
  c.beginPath();c.moveTo(0,-49);c.lineTo(34,0);c.lineTo(0,49);c.lineTo(-34,0);c.closePath();c.stroke();
  c.beginPath();c.moveTo(-29,0);c.lineTo(29,0);c.moveTo(0,-42);c.lineTo(0,42);c.stroke();
  c.fillStyle='#c68e4771';c.beginPath();c.arc(0,0,10,0,Math.PI*2);c.fill();
}

function overlayStyles() {
  const hot = flatMap(texture(128,(c,s)=>{
    const g=c.createRadialGradient(64,64,7,64,64,85);
    g.addColorStop(0,'#6e1e15aa');g.addColorStop(.87,'#b33a28b2');g.addColorStop(1,'#d76b43e5');
    c.fillStyle=g;c.fillRect(0,0,s,s);c.lineWidth=3;c.strokeStyle='#ff9c6ee3';c.strokeRect(4,4,120,120);
    c.strokeStyle='#140807ab';c.lineWidth=3;
    c.beginPath();c.moveTo(0,12);c.lineTo(32,44);c.lineTo(39,65);c.lineTo(67,63);c.lineTo(84,86);c.lineTo(101,93);c.lineTo(116,128);
    c.moveTo(39,65);c.lineTo(30,83);c.lineTo(0,100);c.moveTo(68,64);c.lineTo(92,46);c.lineTo(105,46);c.lineTo(128,32);c.stroke();
    c.strokeStyle='#f5ad7ab3';c.lineWidth=1;c.stroke();
    c.strokeStyle='#ffa374ba';c.lineWidth=2;c.beginPath();c.moveTo(53,49);c.lineTo(74,76);c.moveTo(76,50);c.lineTo(52,76);c.stroke();
  }));
  const look = flatMap(texture(96,(c,s)=>{
    c.fillStyle='#eab6622e';c.fillRect(0,0,s,s);c.strokeStyle='#ffc478';c.setLineDash([6,5]);c.lineWidth=2;c.strokeRect(5,5,86,86);
  }));
  const legal = flatMap(texture(96,(c)=>{
    const g=c.createRadialGradient(48,48,3,48,48,27);g.addColorStop(0,'#bcffdf78');g.addColorStop(1,'#bcffdf00');
    c.fillStyle=g;c.fillRect(0,0,96,96);c.fillStyle='#d8fff3';c.beginPath();c.moveTo(48,39);c.lineTo(57,48);c.lineTo(48,57);c.lineTo(39,48);c.closePath();c.fill();
    c.strokeStyle='#d0f7e192';c.lineWidth=2;c.beginPath();c.arc(48,48,18,0,Math.PI*2);c.stroke();
  }));
  const edges = (color) => flatMap(texture(96,(c)=>{
    c.lineWidth=3;c.strokeStyle=color;
    for(let i=0;i<4;i++){
      c.beginPath();c.moveTo(7,26);c.lineTo(7,7);c.lineTo(26,7);c.stroke();
      c.translate(96,0);c.rotate(Math.PI/2);
    }
  }));
  return [
    ['hot',hot,.011], ['look',look,.017], ['legal',legal,.023],
    ['capture',edges('#c9e5ac'),.027], ['selected',edges('#ffcf89'),.031], ['strike',edges('#fff4c7'),.036],
  ];
}

function overlays(parent,tile,styles) {
  const [x,z]=pos(tile);
  return Object.fromEntries(styles.map(([key,material,offset])=>{
    const item=floorGraphic(parent,material,x,top+offset,z,.995);
    item.visible=false;item.renderOrder=offset*1000;
    return [key,item];
  }));
}

function altar(scene) {
  const group=new T.Group();
  scene.add(group);
  for(const [size,y,h,material] of [[5.92,-.53,.16,obsidian],[5.78,-.39,.17,oxidized],[5.64,-.28,.06,bronze],[5.58,-.16,.19,obsidian],[5.53,-.057,.052,bronze],[5.41,-.035,.13,oxidized]]){
    mesh(group,slab,material,0,y,0,size,h,size);
  }
  const trim=new T.BoxGeometry(.34,.07,.34);
  for(const x of [-2.69,2.69])for(const z of [-2.69,2.69]){
    mesh(group,trim,obsidian,x,-.002,z,1,1,1);
    const gem=mesh(group,new T.OctahedronGeometry(.093),bronze,x,.072,z);
    gem.scale.y=.5;
  }
  for(let i=-9;i<=9;i++){
    mesh(group,slab,bronze,i*.282,-.376,2.902,.036,.063,.014).rotation.z=Math.PI/4;
    mesh(group,slab,bronze,2.902,-.376,i*.282,.014,.063,.036).rotation.x=Math.PI/4;
  }
  const bodyMat = Array.from({length:8},(_,i)=>new T.MeshStandardMaterial({map:slateTexture(263+i*23,i%2===0),color:'#b6c1ba',roughness:.88,metalness:.05}));
  const tileGeo = new T.BoxGeometry(1.015,.114,1.015);
  for(let i=0;i<SIZE*SIZE;i++){
    const [x,z]=pos(i);
    const mat = bodyMat[((i*17+Math.floor(i/3)*2)%8)];
    const tile = mesh(group,tileGeo,[obsidian,obsidian,mat,obsidian,obsidian,obsidian],x,top-.057,z);
    tile.receiveShadow=true;
  }
  floorGraphic(group,flatMap(texture(180,seal)),0,top+.008,0,1.04);
  const glyph = (char) => flatMap(texture(64,(c)=>{
    c.font='40px Georgia';c.fillStyle='#e0c78c';c.textAlign='center';c.textBaseline='middle';c.fillText(char,32,33);
  }),.82);
  for(let i=0;i<5;i++){
    floorGraphic(group,glyph('ABCDE'[i]),(i-2)*step,.025,2.69,.255);
    floorGraphic(group,glyph(String(5-i)),-2.69,.025,(i-2)*step,.255);
  }
  return group;
}

function surroundings(scene){
  const rand = randomGenerator(211);
  const surface = flatMap(texture(192,(c,s)=>{
    const v=c.createRadialGradient(s/2,s/2,14,s/2,s/2,95);
    v.addColorStop(0,'#080c09e8');v.addColorStop(.61,'#080c09d4');v.addColorStop(1,'#080c0900');
    c.fillStyle=v;c.fillRect(0,0,s,s);
  }));
  floorGraphic(scene,surface,0,-.66,.28,9.7).scale.z=.9;
  const trunk = new T.ConeGeometry(.15,1,5);
  for(let i=0;i<38;i++){
    const x = (rand()>.5?1:-1)*(3.01+rand()*.58);
    const z = rand()*6.6-3.6;
    const h = .1+rand()*.72;
    const spike=mesh(scene,trunk,i%3===0?oxidized:obsidian,x,-.63+h/2,z,.4+rand()*.4,h,.3+rand()*.7);
    spike.rotation.z = (x>0?1:-1)*(.3+rand()*.93);
    spike.rotation.x=-.5+rand();
  }
  const flameMat=new T.MeshBasicMaterial({color:'#ffc27c'});
  const wickMat=new T.MeshBasicMaterial({color:'#fff0c2'});
  const lightmap = flatMap(texture(64,(c)=>{
    const v=c.createRadialGradient(32,32,1,32,32,31);
    v.addColorStop(0,'#f7a246d0');v.addColorStop(.3,'#e18e4166');v.addColorStop(1,'#d77f3e00');
    c.fillStyle=v;c.fillRect(0,0,64,64);
  }));
  for(const [x,z,h] of [[-3.24,-2.29,.5],[-3.35,-1.95,.32],[3.26,-2.43,.66],[3.49,-2.18,.38],[-3.37,2.11,.37],[3.34,1.89,.47],[3.44,2.13,.28]]){
    mesh(scene,pillar(.12,.18,.07,7),obsidian,x,-.611,z);
    mesh(scene,pillar(.065,.09,h,8),bone,x,-.57+h*.5,z);
    mesh(scene,new T.SphereGeometry(1,8,5),flameMat,x,-.522+h,z,.041,.085,.041);
    mesh(scene,new T.SphereGeometry(1,8,5),wickMat,x,-.537+h,z,.022,.041,.022);
    const aura=mesh(scene,new T.PlaneGeometry(.53,.53),lightmap,x,-.52+h,z);
    aura.material.side=T.DoubleSide;
    aura.renderOrder=30;
  }
  const points=[];
  for(let i=0;i<105;i++) points.push((rand()-.5)*9,rand()*4-.55,(rand()-.5)*7.5);
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));
  const dust=new T.Points(geometry,new T.PointsMaterial({color:'#e8c691',size:.026,transparent:true,opacity:.57,depthWrite:false}));
  scene.add(dust);
  return dust;
}

export function createScene(holder, onResize, onUnavailable) {
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setClearColor(0x000000,0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.26;
  holder.append(renderer.domElement);
  const scene=new T.Scene();
  const camera=new T.PerspectiveCamera(36,1,.25,100);
  const ambient=new T.HemisphereLight('#dce3d2','#434c3d',2.24);
  scene.add(ambient);
  for(const [color,power,position] of [['#ffe4b2',3.15,[-4,8,4]],['#a8e7d9',2.33,[4,4,-6]],['#efd2bc',.61,[2,3,6]]]){
    const light=new T.DirectionalLight(color,power); light.position.set(...position);scene.add(light);
  }
  const platform=altar(scene);
  const dust=surroundings(scene);
  const styles=overlayStyles();
  const tiles=Array.from({length:SIZE*SIZE},(_,i)=>overlays(platform,i,styles));
  const softShadow=flatMap(texture(80,(c)=>{
    const g=c.createRadialGradient(40,40,3,40,40,39);
    g.addColorStop(0,'#070806ee');g.addColorStop(.54,'#070806bb');g.addColorStop(1,'#07100a00');
    c.fillStyle=g;c.fillRect(0,0,80,80);
  }));
  const figures=new Map();
  const raycaster = new T.Raycaster();
  const pointer = new T.Vector2();
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let seen=null, struck=[], flashUntil=0, drawId=0, lastDraw=0;
  let visible=true, unavailable=false;

  const ndc=(x,y,z)=>new T.Vector3(x,y,z).project(camera);
  function resize(){
    if (unavailable) return;
    const {width,height}=holder.getBoundingClientRect();
    if(!width || !height) return;
    const narrow=width<560;
    renderer.setSize(width,height,false);
    camera.aspect=width/height;
    camera.position.set(narrow?.95:2.38,narrow?9.9:8.75,11.25);
    camera.lookAt(0,narrow?.43:.31,-.12);
    camera.updateMatrixWorld();
    camera.zoom=1;camera.updateProjectionMatrix();
    const box=[[-3.15,-.62,-3.12],[3.15,-.62,-3.12],[-3.15,-.62,3.12],[3.15,-.62,3.12],[-2.85,1.1,-2.85],[2.85,1.1,-2.85]]
      .map(([x,y,z])=>ndc(x,y,z));
    const maxX=Math.max(...box.map((p)=>Math.abs(p.x)));
    const maxY=Math.max(...box.map((p)=>Math.abs(p.y)));
    camera.zoom=Math.min((narrow?.975:1.01)/maxX,(narrow?.88:.99)/maxY);
    camera.updateProjectionMatrix();
    const points=tiles.map((_,i)=>{
      const [x,z]=pos(i);
      const center=ndc(x,top,z);
      const left=ndc(x-step*.45,top,z), right=ndc(x+step*.45,top,z);
      const front=ndc(x,top,z+step*.47), back=ndc(x,top,z-step*.47);
      return {
        x:(1+center.x)*width/2,y:(1-center.y)*height/2,
        w:Math.abs(right.x-left.x)*width*.52,h:Math.abs(front.y-back.y)*height*.51,
      };
    });
    onResize(points);
    schedule();
  }

  function draw(now) {
    drawId=0;
    if(!visible)return;
    const fastFrame = now < flashUntil || [...figures.values()].some(({ since }) => now-since < 300);
    if(!motion.matches && now-lastDraw<(fastFrame ? 25 : 66)){schedule();return;}
    lastDraw=now;
    const complete=motion.matches || now>=flashUntil;
    if(complete && struck.length){
      struck.forEach((i)=>{tiles[i].strike.visible=false;});struck=[];
    }
    for(const [id,data] of figures){
      const elapsed = motion.matches ? 1 : Math.min(1,(now-data.since)/300);
      const t=1-Math.pow(1-elapsed,3);
      if(data.dead){
        data.group.scale.setScalar(Math.max(.01,1-t));
        data.group.position.y=top-t*.21;
        if(elapsed===1){scene.remove(data.group,data.shadow);figures.delete(id);}
      }else{
        data.group.position.set(T.MathUtils.lerp(data.fromX,data.x,t),top+Math.sin(Math.PI*elapsed)*.21,T.MathUtils.lerp(data.fromZ,data.z,t));
        data.shadow.position.x=data.group.position.x;data.shadow.position.z=data.group.position.z;
      }
    }
    if (!motion.matches) {
      dust.position.y=Math.sin(now*.00048)*.17;
      dust.position.x=Math.sin(now*.00019)*.135;
    }
    renderer.render(scene,camera);
    if(!motion.matches) schedule();
  }
  function schedule(){if(!drawId && visible && !unavailable)drawId=requestAnimationFrame(draw);}
  function setState(state,ui) {
    const now=performance.now();
    if (seen!==state) {
      for(const [id,data] of figures){
        if(!data.dead && !state.pieces.some((piece)=>piece.id===id)){
          data.dead=true;data.since=now;
        }
      }
      for(const piece of state.pieces){
        const [x,z]=pos(piece.at);
        const data=figures.get(piece.id);
        if(!data){
          const group=miniature(piece);
          group.position.set(x,top,z);scene.add(group);
          const shadow=floorGraphic(scene,softShadow,x,top+.004,z,.83);
          shadow.renderOrder=8;
          figures.set(piece.id,{group,shadow,x,z,fromX:x,fromZ:z,since:now-400,dead:false,at:piece.at});
        }else if(data.x!==x || data.z!==z){
          data.fromX=data.group.position.x;data.fromZ=data.group.position.z;
          data.x=x;data.z=z;data.since=now;data.at=piece.at;
        }
      }
      struck.forEach((i)=>{tiles[i].strike.visible=false;});
      struck=state.last?.struck ?? [];
      flashUntil=now+360;
      if(!motion.matches)struck.forEach((i)=>{tiles[i].strike.visible=true;});
      seen=state;
    }
    tiles.forEach((tile,i)=>{
      const occupied=state.pieces.some((p)=>p.at===i);
      tile.hot.visible=ui.pending?.tiles.includes(i) ?? false;
      tile.look.visible=ui.forecast?.tiles.includes(i) ?? false;
      tile.legal.visible=ui.destinations.includes(i) && !occupied;
      tile.capture.visible=ui.destinations.includes(i) && occupied;
      tile.selected.visible=ui.selected===i || ui.target===i || (i===THRONE && occupied);
    });
    schedule();
  }
  function reset(){
    for(const data of figures.values()) scene.remove(data.group,data.shadow);
    figures.clear();
    seen=null;
  }

  function hitPieceAt(x,y) {
    if (unavailable) return null;
    const rect=holder.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointer.set(2*(x-rect.left)/rect.width-1, 1-2*(y-rect.top)/rect.height);
    raycaster.setFromCamera(pointer,camera);
    const visibleFigures=[...figures.values()].filter(({ dead }) => !dead);
    const [hit]=raycaster.intersectObjects(visibleFigures.map(({ group }) => group),true);
    if (!hit) return null;
    return visibleFigures.find(({ group }) => group === hit.object.parent)?.at ?? null;
  }

  new ResizeObserver(resize).observe(holder);
  new IntersectionObserver(([entry])=>{
    visible=entry.isIntersecting && !document.hidden;
    if(visible)schedule();
  }).observe(holder);
  document.addEventListener('visibilitychange',()=>{
    const rect=holder.getBoundingClientRect();
    visible=!document.hidden && rect.bottom>0 && rect.top<window.innerHeight;
    if(visible)schedule();
  });
  motion.addEventListener('change',schedule);
  renderer.domElement.addEventListener('webglcontextlost',() => {
    unavailable=true;
    cancelAnimationFrame(drawId);
    drawId=0;
    onUnavailable();
  });
  resize();
  return {setState,reset,hitPieceAt};
}
