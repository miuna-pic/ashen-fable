import * as T from 'three';

const standard = (color, roughness=.74, metalness=.12, flatShading=false) => new T.MeshStandardMaterial({ color, roughness, metalness, flatShading });
const glow = (color) => new T.MeshBasicMaterial({color});
export const pillar = (top,bottom,h,n=8) => new T.CylinderGeometry(top,bottom,h,n);
const stoneFace = new T.IcosahedronGeometry(1,0);
const oval = new T.SphereGeometry(1,12,8);
const panel = new T.BoxGeometry(1,1,1);

export function mesh(group, geometry, material, x=0,y=0,z=0, sx=1,sy=1,sz=1) {
  const item = new T.Mesh(geometry,material);
  item.position.set(x,y,z);
  item.scale.set(sx,sy,sz);
  group.add(item);
  return item;
}

export function lathe(points,n=14) {
  return new T.LatheGeometry(points.map(([r, y]) => new T.Vector2(r,y)), n);
}

function jewel(group,material,x,y,z,scale=.06) {
  return mesh(group,stoneFace,material,x,y,z,scale,scale*1.5,scale*.5);
}

const makePalette = (side) => {
  const ash = side === 'ash';
  return {
    base: standard(ash ? '#3f3226' : '#223832', .53, .22),
    skin: standard(ash ? '#eee2be' : '#83a99b', .56, .15, true),
    seam: standard(ash ? '#d2b282' : '#4d8980', .48, .25, true),
    dark: standard(ash ? '#5c4332' : '#2d4841', .68, .14, true),
    trim: standard(ash ? '#c99355' : '#6e9c8a', .48, .38),
    face: standard(ash ? '#251c16' : '#121e1d', .55, .1, true),
    light: glow(ash ? '#ffce86' : '#acf8d9'),
  };
};
const palettes = { ash: makePalette('ash'), thorn: makePalette('thorn') };

function pedestal(group,m) {
  mesh(group,pillar(.36,.395,.11,8),m.base,0,.055);
  mesh(group,pillar(.33,.36,.035,8),m.trim,0,.126);
  mesh(group,pillar(.27,.33,.042,8),m.dark,0,.157);
  mesh(group,pillar(.27,.27,.023,8),m.seam,0,.185);
}

function crown(group,m) {
  const outline = lathe([[.19,.19],[.245,.21],[.23,.26],[.18,.41],[.14,.52],[.18,.68],[.13,.78],[0,.79]],10);
  mesh(group,outline,m.skin,0,0,0,1,1,.78);
  for (let i=-3;i<=3;i++) {
    const fold = mesh(group,stoneFace, i%2===0?m.dark:m.seam, i*.053,.395,.135 - Math.abs(i)*.022,.028,.214,.035);
    fold.rotation.z = i*.104;
  }
  mesh(group,oval,m.dark,0,.774,0,.153,.195,.12);
  mesh(group,oval,m.skin,0,.811,.018,.123,.151,.103);
  mesh(group,oval,m.face,0,.82,.091,.076,.096,.042);
  mesh(group,oval,m.skin,0,.79,.126,.041,.068,.024);
  for (const sign of [-1,1]) {
    jewel(group,m.light,sign*.042,.833,.125,.012);
    mesh(group,stoneFace,m.seam,sign*.139,.624,.013,.09,.095,.13).rotation.z = sign*.52;
    mesh(group,stoneFace,m.trim,sign*.14,.636,.097,.049,.047,.039);
  }
  mesh(group,pillar(.132,.116,.047,10),m.trim,0,.95,0);
  for (let i=0;i<6;i++) {
    const a = i*Math.PI/3;
    const spike=mesh(group,new T.ConeGeometry(.043, i===0 ? .18:.126, 3),m.skin,Math.sin(a)*.112,1.01,Math.cos(a)*.112);
    spike.rotation.y=a;
    spike.rotation.z=Math.sin(a)*-.21;
  }
  jewel(group,m.light,0,.948,.135,.025);
  mesh(group,pillar(.016,.022,.53,6),m.trim,.235,.478,.075).rotation.z=.103;
  jewel(group,m.light,.208,.764,.075,.045);
}

function wolf(group,m) {
  mesh(group,oval,m.dark,0,.338,-.05,.225,.16,.23);
  const ribcage = mesh(group,stoneFace,m.skin,0,.455,0,.215,.274,.153);
  ribcage.rotation.x=-.24;
  mesh(group,stoneFace,m.seam,0,.566,.093,.145,.144,.121);
  mesh(group,stoneFace,m.skin,0,.709,.048,.155,.161,.14);
  const snout = mesh(group,stoneFace,m.dark,0,.642,.173,.102,.067,.17);
  snout.rotation.x=.32;
  mesh(group,stoneFace,m.face,0,.634,.295,.043,.032,.045);
  mesh(group,stoneFace,m.seam,0,.601,.176,.069,.027,.108);
  for (const sign of [-1,1]) {
    const ear = mesh(group,new T.ConeGeometry(.092,.262,3),m.skin,sign*.101,.834,.014,.8,1,.57);
    ear.rotation.z = sign*-.27;
    ear.rotation.y = sign*.31;
    const inset = mesh(group,new T.ConeGeometry(.053,.154,3),m.dark,sign*.106,.835,.058);
    inset.rotation.z=sign*-.27;
    jewel(group,m.light,sign*.081,.723,.163,.018);
    mesh(group,stoneFace,m.seam,sign*.133,.292,.138,.074,.116,.127);
    mesh(group,oval,m.skin,sign*.132,.225,.212,.072,.045,.062);
  }
  mesh(group,stoneFace,m.dark,-.184,.322,-.18,.104,.079,.137).rotation.y=.77;
  const cuff = mesh(group,new T.TorusGeometry(.143,.014,5,14),m.trim,0,.575,.041);
  cuff.rotation.x=Math.PI/2+.27;
  jewel(group,m.light,0,.53,.198,.039);
}

function nun(group,m) {
  const dress=lathe([[.23,.19],[.258,.22],[.219,.27],[.15,.44],[.083,.66],[.103,.755],[.12,.78],[0,.79]],12);
  mesh(group,dress,m.skin,0,0,-.002,1,1,.84);
  for(let i=-3;i<=3;i++) {
    const pleat=mesh(group,stoneFace,i%2?m.dark:m.seam,i*.05,.382,.127-Math.abs(i)*.021,.03,.174,.039);
    pleat.rotation.z=i*.10;
  }
  const veil=lathe([[.162,.53],[.165,.65],[.144,.75],[.126,.89],[.089,1.02],[.00,1.19]],12);
  mesh(group,veil,m.dark,0,0,-.025,1,1,.81);
  mesh(group,oval,m.seam,0,.87,.049,.133,.207,.096);
  mesh(group,oval,m.face,0,.879,.117,.076,.106,.045);
  mesh(group,panel,m.skin,0,.9,.156,.148,.033,.018).rotation.z=-.12;
  mesh(group,panel,m.trim,0,.9,.168,.062,.009,.01).rotation.z=-.12;
  const halo = mesh(group,new T.TorusGeometry(.206,.011,5,25,Math.PI*1.76),m.trim,0,.921,-.071);
  halo.rotation.z=.47;
  mesh(group,stoneFace,m.skin,-.074,.585,.115,.062,.14,.052).rotation.z=.58;
  mesh(group,stoneFace,m.seam,.071,.584,.116,.06,.14,.052).rotation.z=-.56;
  jewel(group,m.light,0,.598,.163,.046);
}

export function miniature(piece) {
  const group = new T.Group();
  const palette = palettes[piece.side];
  pedestal(group,palette);
  if (piece.kind === 'crown') crown(group,palette);
  if (piece.kind === 'wolf') wolf(group,palette);
  if (piece.kind === 'nun') nun(group,palette);
  group.rotation.y=piece.side === 'ash' ? .18 : -.29;
  return group;
}
