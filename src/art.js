export function randomGenerator(seed) {
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function forest() {
  const rand = randomGenerator(97);
  const range = (a,b) => a + rand()*(b-a);
  const tree = (x,ground,width,height,fill) => {
    const bend = range(-55,55), top = ground-height;
    const center = (t) => x + bend*t*t - width*.2*Math.sin(t*5);
    const limbs = Array.from({length: 12}, (_,i) => {
      const t = range(.25,.96), y = ground - t*height, mid = center(t);
      const direction = i%2 ? 1 : -1, reach = direction*range(20,132)*(1-.35*t);
      const lift = range(22,119);
      return `M${mid} ${y} q${reach*.55} ${-lift*.17} ${reach} ${-lift} q${-reach*.26} ${lift*.73} ${-reach*.93} ${lift+width*.29}Z`;
    }).join(' ');
    return `<path fill="${fill}" d="M${x-width*1.55} ${ground+18} Q${x-width*.38} ${ground-11} ${x-width*.42} ${ground-height*.25} Q${center(.68)-width*.27} ${ground-height*.70} ${center(1)} ${top} Q${center(.76)+width*.61} ${ground-height*.77} ${center(.38)+width*.56} ${ground-height*.35} Q${x+width*.65} ${ground-20} ${x+width*1.67} ${ground+16} Z ${limbs}"/>`;
  };
  const mistTrees = Array.from({length:47},(_,i)=>tree(i*36-60+range(-20,20),range(458,676),range(6,20),range(170,650),i%4?'#52675f':'#5b6d62')).join('');
  const middle = Array.from({length:39},(_,i)=>tree(i*43-108+range(-26,26),range(566,730),range(10,29),range(340,820),i%3?'#273d35':'#23332e')).join('');
  const foreground = [12,79,174,248,370,450,1060,1195,1288,1380,1500,1570].map((x,i)=>tree(x,range(650,885),range(18,51),range(580,1000),i%3?'#111d19':'#0e1814')).join('');
  const flecks = Array.from({length:100},(_,i)=>`<circle cx="${range(0,1500)}" cy="${range(70,750)}" r="${range(.32,1.7)}" opacity="${range(.12,.50)}" fill="${i%5?'#d6cfab':'#c7905c'}"/>`).join('');
  return `<svg viewBox="0 0 1500 850" preserveAspectRatio="xMidYMid slice" focusable="false">
    <defs>
      <radialGradient id="fog"><stop stop-color="#b6c5ab" stop-opacity=".55"/><stop offset=".76" stop-color="#8a9c8e" stop-opacity=".13"/><stop offset="1" stop-color="#829288" stop-opacity="0"/></radialGradient>
      <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency=".78" numOctaves="3" stitchTiles="stitch"/></filter>
      <linearGradient id="forest-base" x2="0" y2="1"><stop stop-color="#0e1716"/><stop offset=".55" stop-color="#3b4e44"/><stop offset=".73" stop-color="#27352c"/><stop offset="1" stop-color="#101612"/></linearGradient>
    </defs>
    <rect width="1500" height="850" fill="url(#forest-base)"/>
    <ellipse cx="727" cy="382" rx="720" ry="433" fill="url(#fog)"/>
    <g opacity=".42">${mistTrees}</g><g opacity=".81">${middle}</g>
    <ellipse cx="714" cy="447" rx="502" ry="293" fill="url(#fog)" opacity=".55"/>
    <g opacity=".93">${foreground}</g>
    <path d="M0 719 128 674 255 696 388 667 530 686 687 659 878 679 1035 657 1184 692 1290 665 1500 710v140H0z" fill="#111915" opacity=".66"/>
    <path d="m0 787 121-52 57 11 68-36 146 26 124-16 158 21 92-24 169 15 75-11 114 26 129-30 70 33 177 28v72H0z" fill="#0e1411" opacity=".77"/>
    ${flecks}<rect width="100%" height="100%" filter="url(#paper)" opacity=".12" style="mix-blend-mode:soft-light"/>
  </svg>`;
}

export function halo() {
  const point = (r,a) => [280 + r*Math.cos(a),234 + r*Math.sin(a)];
  const ticks = Array.from({length:120},(_,i) => {
    const a=i/120*Math.PI*2, long=i%10===0;
    if (i>=93 && i<=105 || i>=44 && i<=52) return '';
    const [x,y]=point(long?170:175,a), [xx,yy]=point(181,a);
    return `<path d="M${x} ${y}L${xx} ${yy}" opacity="${long?.95:.42}"/>`;
  }).join('');
  const diamonds = Array.from({length:12},(_,i) => {
    const [x,y]=point(198,i/12*Math.PI*2);
    return `<path d="M${x} ${y-4}l2.5 4-2.5 4-2.5-4Z" opacity=".6"/>`;
  }).join('');
  return `<svg viewBox="0 0 560 515" fill="none" focusable="false">
    <defs><radialGradient id="eclipse"><stop offset=".4" stop-color="#101b18" stop-opacity=".65"/><stop offset=".86" stop-color="#17231b" stop-opacity=".65"/><stop offset="1" stop-color="#bc8754" stop-opacity=".49"/></radialGradient></defs>
    <circle cx="280" cy="234" r="140" fill="url(#eclipse)"/>
    <g stroke="#d2a57a" stroke-width=".65">
      <circle cx="280" cy="234" r="140" opacity=".7" stroke-dasharray="150 6 326 2 53 9"/>
      <circle cx="280" cy="234" r="147" opacity=".42" stroke-dasharray="377 12 403 7"/>
      <circle cx="280" cy="234" r="161" opacity=".61" stroke-dasharray="576 5 230 18"/>
      <circle cx="280" cy="234" r="183" opacity=".46" stroke-dasharray="358 12 23 26 507 25"/>
      <circle cx="280" cy="234" r="202" opacity=".34"/>
      ${ticks}${diamonds}
      <path d="M280 13v48m0 330v61m-224-218h64m326 0h58M280 38 471 234 280 430 89 234Z" opacity=".32"/>
      <path d="M280 70 412 310H148Z" opacity=".38"/>
      <path d="m280 52 4 8-4 8-4-8z" fill="#e8be8c"/>
      <path d="m280 16 3 7-3 6-3-6z" fill="#e8be8c" opacity=".84"/>
    </g>
  </svg>`;
}
