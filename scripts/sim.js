// 平衡性自检：一个只看两步的贪心机器人能否通关。
import * as R from '../src/rules.js';
const d=(a,b)=>Math.abs(R.X(a)-R.X(b))+Math.abs(R.Y(a)-R.Y(b));
function evalS(s){
  if(s.result) return s.result.winner==='ember'?1e6-s.turn:-1e6;
  const g=R.piece(s,'match'), q=R.piece(s,'queen');
  let v=-s.queenHp*400 + s.matches*14 + s.voice*5;
  v-= d(g.at,q.at)*6;
  if(R.isLit(s,q.at)) v+=60;
  if(!R.isLit(s,g.at)&&R.threats(s).includes(g.at)) v-=5000;
  for(const id of ['mermaid','karen']){const p=R.piece(s,id); if(!p){v-=120;continue} if(!R.isLit(s,p.at)&&R.threats(s).includes(p.at)) v-=80;}
  v-=s.pieces.filter(p=>p.kind==='shard').length*25;
  return v;
}
function best(s,depth){
  let bv=-Infinity,ba=null;
  for(const a of R.allActions(s)){
    const n=R.play(s,a).state; let v=evalS(n);
    if(depth>1&&!n.result){v=best(n,depth-1).v}
    v+=Math.random()*rnd;
    if(v>bv){bv=v;ba=a}
  }
  return {v:bv,a:ba};
}
let rnd=0; const depth=+process.argv[2]||2, games=+process.argv[3]||1;
let wins=0,saved=false;const turns=[]; // 只保存第一局胜局的行动序列
for(let gme=0;gme<games;gme++){
  rnd=gme?30:0; let s=R.start(); const log=[];
  while(!s.result&&s.turn<80){const {a}=best(s,depth); if(!a)break; log.push({id:a.id,type:a.type,to:a.to}); s=R.play(s,a).state;}
  if(s.result?.winner==='ember'&&process.argv[4]&&!saved){saved=true;(await import('node:fs')).writeFileSync(process.argv[4],JSON.stringify(log));}
  if(s.result?.winner==='ember')wins++; turns.push((s.result?.winner??'none')[0]+s.turn+'/'+(s.result?.reason??'')+' m'+s.matches+' v'+s.voice);
}
console.log(wins+'/'+games, turns.join('  '));
