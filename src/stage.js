// The 3D stage: one glass board with a world on each side. Flipping rotates the whole universe.
import * as T from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { W, H, X, Y, KINDS } from './rules.js';
import { createQuality } from './quality.js';

const ease = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const out = (t) => 1 - Math.pow(1 - t, 3);
const local = (s) => new T.Vector3(X(s) - (W - 1) / 2, 0, Y(s) - (H - 1) / 2);
const loader = new T.TextureLoader();
const tex = (name) => { const t = loader.load(`./art/${name}.webp`); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; };
const ASPECT = { alice_a: 433 / 720, alice_b: 460 / 720, soldier: 368 / 720, hollow: 341 / 720, rook: 435 / 720, cat: 473 / 720, knight: 445 / 720, queen: 465 / 720, shadow: 472 / 720 };
const HEIGHT = { queen: 1.75, shadow: 1.7, rook: 1.5, knight: 1.5 };

function glyph(draw, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  g.translate(size / 2, size / 2); draw(g, size); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
const heart = (g, r) => { g.beginPath(); g.moveTo(0, r * .9); g.bezierCurveTo(-r * 1.5, -r * .2, -r * .6, -r * 1.2, 0, -r * .4); g.bezierCurveTo(r * .6, -r * 1.2, r * 1.5, -r * .2, 0, r * .9); };
const GLYPH = {
  aim: glyph((g, s) => { g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(-s / 2, -s / 2, s, s); g.strokeStyle = '#fff'; g.lineWidth = 10; g.strokeRect(-s / 2 + 8, -s / 2 + 8, s - 16, s - 16); g.fillStyle = '#fff'; heart(g, 46); g.fill(); }),
  ghost: glyph((g, s) => { g.strokeStyle = '#fff'; g.lineWidth = 7; g.setLineDash([18, 14]); g.strokeRect(-s / 2 + 14, -s / 2 + 14, s - 28, s - 28); g.setLineDash([]); g.lineWidth = 8; g.beginPath(); g.moveTo(-34, -34); g.lineTo(34, 34); g.moveTo(34, -34); g.lineTo(-34, 34); g.stroke(); }),
  move: glyph((g) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 26, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 46, 0, 7); g.stroke(); }),
  take: glyph((g, s) => { g.strokeStyle = '#fff'; g.lineWidth = 14; const a = s / 2 - 14, b = 44; for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.beginPath(); g.moveTo(x * a, y * (a - b)); g.lineTo(x * a, y * a); g.lineTo(x * (a - b), y * a); g.stroke(); } }),
  goal: glyph((g) => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-70, 50); g.lineTo(-84, -40); g.lineTo(-40, 0); g.lineTo(0, -66); g.lineTo(40, 0); g.lineTo(84, -40); g.lineTo(70, 50); g.closePath(); g.fill(); g.fillRect(-70, 62, 140, 16); }),
  hint: glyph((g) => { g.strokeStyle = '#fff'; g.lineWidth = 12; for (const r of [30, 60, 90]) { g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); } }),
  blob: glyph((g, s) => { const r = g.createRadialGradient(0, 0, 0, 0, 0, s / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(-s / 2, -s / 2, s, s); }),
  card: glyph((g, s) => { g.fillStyle = '#fff'; g.beginPath(); g.roundRect(-s * .32, -s * .46, s * .64, s * .92, 18); g.fill(); g.fillStyle = '#c0102c'; heart(g, 50); g.fill(); g.save(); g.translate(-s * .22, -s * .34); heart(g, 14); g.fill(); g.restore(); }),
};

const SKY = {
  uniforms: { time: { value: 0 } },
  vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `varying vec3 p; uniform float time;
    float h(vec2 v){ return fract(sin(dot(v, vec2(127.1,311.7))) * 43758.5453); }
    float n(vec2 v){ vec2 i=floor(v), f=fract(v); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
    float fbm(vec2 v){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*n(v); v*=2.03; a*=.5; } return s; }
    void main(){ vec3 d = normalize(p); float y = d.y; vec2 uv = vec2(atan(d.z,d.x)*1.6, y*4.);
      vec3 col;
      if (y > 0.) { float c = fbm(uv*1.4 + vec2(time*.01, 0.));
        col = mix(vec3(1.,.93,.95), vec3(.66,.76,.95), smoothstep(0.,.75,y));
        col = mix(col, vec3(1.,.72,.82), smoothstep(.45,.8,c) * (1.-smoothstep(.0,.6,y)) * .9);
      } else { float r = fbm(uv*2.2 - vec2(time*.015, time*.02));
        col = mix(vec3(.42,.02,.07), vec3(.012,.004,.012), smoothstep(0.,.5,-y));
        col += vec3(.9,.08,.12) * pow(smoothstep(.5,.95,r), 3.) * (1.-smoothstep(0.,.7,-y)) * .8; }
      col += vec3(1.,.9,.9) * exp(-abs(y)*60.) * .9;
      gl_FragColor = vec4(col,1.); }`,
};
const FINAL = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, punch: { value: 0 }, dark: { value: 0 }, hurt: { value: 0 } },
  vertexShader: 'varying vec2 u; void main(){ u = uv; gl_Position = vec4(position.xy,0.,1.); }',
  fragmentShader: `varying vec2 u; uniform sampler2D tDiffuse; uniform float time, punch, dark, hurt;
    float h(vec2 v){ return fract(sin(dot(v, vec2(12.9898,78.233))+time) * 43758.5453); }
    void main(){ vec2 c = u-.5; float r = dot(c,c); vec2 o = c * (.0022 + punch*.06) * (1.+r*4.);
      vec2 w = u + c * punch * .12 * sin(r*30.-time*20.);
      vec3 col = vec3(texture2D(tDiffuse, w+o).r, texture2D(tDiffuse, w).g, texture2D(tDiffuse, w-o).b);
      float lum = dot(col, vec3(.3,.6,.1));
      col = mix(col, mix(vec3(lum), col, 1.25), 1.);
      col = mix(col, vec3(lum) * vec3(1.,.12,.16) * 1.6, hurt);
      col *= 1. - r * mix(.9, 1.9, dark);
      col += (h(u*900.)-.5) * mix(.03,.045,dark);
      col = mix(col, 1.-col, step(.5, punch) * step(fract(time*24.), .5) * .0);
      gl_FragColor = vec4(col,1.); }`,
};

export function createStage(canvas) {
  // No MSAA: everything is drawn through the composer, where a default-framebuffer sample buffer is wasted memory.
  const renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  canvas.addEventListener('webglcontextlost', (e) => e.preventDefault()); // phones drop the context in the background; three restores it
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(40, 1, .1, 200);
  const world = new T.Group(); scene.add(world);
  const sky = new T.Mesh(new T.SphereGeometry(90, 48, 32), new T.ShaderMaterial({ ...SKY, side: T.BackSide, depthWrite: false })); world.add(sky);

  // The sea of glass around the board: pale from above, black from below.
  const seaTex = glyph((g, s) => { const r = g.createRadialGradient(0, 0, s * .08, 0, 0, s / 2); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(.6, 'rgba(255,255,255,.8)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(-s / 2, -s / 2, s, s); }, 512);
  const plane = new T.PlaneGeometry(1, 1);
  const flat = (map, color, opacity = 1, extra = {}) => new T.MeshBasicMaterial({ map, color, transparent: true, opacity, depthWrite: false, toneMapped: false, ...extra });
  const lay = (mat, face, size = 1) => { const m = new T.Mesh(plane, mat); m.rotation.x = face ? Math.PI / 2 : -Math.PI / 2; m.scale.setScalar(size); return m; };
  const seaA = lay(flat(seaTex, '#ecdbe6', .6), 0, 120), seaB = lay(flat(seaTex, '#5a0816', .95), 1, 60);
  seaA.position.y = -.02; seaB.position.y = -.03; seaA.renderOrder = seaB.renderOrder = -5; world.add(seaA, seaB); const pit = lay(flat(null, '#060104', 1), 1, 400); pit.position.y = .04; pit.renderOrder = -6; world.add(pit);

  // Tiles.
  const tileTex = glyph((g, s) => { g.fillStyle = '#fff'; g.fillRect(-s / 2, -s / 2, s, s); const r = g.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(.48, 'rgba(0,0,0,.0)'); r.addColorStop(1, 'rgba(0,0,0,.28)'); g.fillStyle = r; g.fillRect(-s / 2, -s / 2, s, s); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 6; g.strokeRect(-s / 2, -s / 2, s, s); });
  const PAL = [['#f3ecf1', '#8fa9e0'], ['#4a0a14', '#0d0a10']];
  const tiles = [], marks = [];
  for (let s = 0; s < W * H; s++) {
    const p = local(s), dark = (X(s) + Y(s)) % 2, pair = [];
    for (const face of [0, 1]) {
      const t = lay(flat(tileTex, PAL[face][dark], face ? .86 : .8), face, .97); t.position.set(p.x, face ? -.001 : .001, p.z); t.renderOrder = -3; world.add(t);
      const mk = (z) => { const m = lay(flat(GLYPH.move, '#fff', 0, { blending: T.AdditiveBlending }), face, .9); m.position.set(p.x, (face ? -1 : 1) * z, p.z); m.renderOrder = -2; m.visible = false; world.add(m); return m; };
      pair.push({ tile: t, aim: mk(.012), move: mk(.02), goal: mk(.016) });
    }
    tiles.push(pair);
  }
  const rim = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(W + .16, .05, H + .16)), new T.LineBasicMaterial({ color: '#f6d28a', toneMapped: false })); world.add(rim);

  // Drifting set dressing: cards and petals above, embers and a dead clock below.
  const cards = new T.InstancedMesh(plane, new T.MeshBasicMaterial({ map: GLYPH.card, transparent: true, alphaTest: .4, side: T.DoubleSide, toneMapped: false }), 46);
  const cardSeed = Array.from({ length: 46 }, (_, i) => ({ a: i * 2.4, r: 7 + (i * 37 % 17), y: 1.5 + (i * 53 % 23) * .5, s: .5 + (i % 5) * .22, w: .2 + (i % 7) * .07 }));
  world.add(cards);
  const dust = (count, color, size, sign) => { const pos = new Float32Array(count * 3); for (let i = 0; i < count; i++) { pos[i * 3] = (Math.random() - .5) * 30; pos[i * 3 + 1] = sign * Math.random() * 12; pos[i * 3 + 2] = (Math.random() - .5) * 30; }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
    const pts = new T.Points(g, new T.PointsMaterial({ color, size, map: GLYPH.blob, transparent: true, depthWrite: false, blending: sign > 0 ? T.NormalBlending : T.AdditiveBlending, toneMapped: false })); world.add(pts); return pts; };
  const petals = dust(260, '#ffffff', .13, 1), embers = dust(320, '#ff3b2f', .12, -1);
  const clock = new T.Group(); clock.position.set(0, -16, -6); world.add(clock);
  const red = new T.MeshBasicMaterial({ color: '#b3122a', toneMapped: false });
  clock.add(new T.Mesh(new T.TorusGeometry(15, .12, 8, 96), red), new T.Mesh(new T.TorusGeometry(13.6, .04, 8, 96), red));
  for (let i = 0; i < 12; i++) { const m = new T.Mesh(new T.BoxGeometry(.18, 1.6, .18), red); m.position.set(Math.sin(i / 12 * 6.283) * 14.3, Math.cos(i / 12 * 6.283) * 14.3, 0); m.rotation.z = -i / 12 * 6.283; clock.add(m); }
  const hands = [9, 12.5].map((l) => { const m = new T.Mesh(new T.BoxGeometry(.22, l, .22).translate(0, l / 2, 0), red); clock.add(m); return m; }); clock.rotation.x = Math.PI / 2;
  const spires = new T.Group(); world.add(spires);
  for (let i = 0; i < 26; i++) { const up = i % 2 === 0, h = 5 + (i * 29 % 13); const m = new T.Mesh(new T.ConeGeometry(.5 + (i % 4) * .3, h, 4), new T.MeshBasicMaterial({ color: up ? '#d9c9e6' : '#1c0308', toneMapped: false })); const a = i * .9 + 1; m.position.set(Math.cos(a) * (24 + i % 5 * 4), (up ? 1 : -1) * h / 2, -Math.abs(Math.sin(a)) * 30 - 10); if (!up) m.rotation.x = Math.PI; spires.add(m); }

  // Framing. `safe` is the part of the screen the HUD leaves free (CSS px insets); the board is fitted into it.
  // Tall free areas get a steep camera, so standees lean back towards it and grow a little on small screens.
  const view = { pitch: .5, lean: .16, scale: 1, d: 13, tile: 80, board: [-1, 1, -1, 1], safe: [{ l: 0, t: 0, r: 0, b: 0 }] };

  // Pieces are standees: face 0 stands on the glass, face 1 hangs beneath it.
  const pieces = new Map(); const textures = {};
  function standee(name, face) {
    textures[name] ||= tex(name);
    const h = HEIGHT[name] || 1.34, g = new T.Group(), body = new T.Mesh(plane, new T.MeshBasicMaterial({ map: textures[name], transparent: true, alphaTest: .35, side: T.DoubleSide, toneMapped: false }));
    body.scale.set(h * ASPECT[name], h, 1); body.position.y = h / 2 - .03; body.rotation.x = -.16;
    const shade = lay(flat(GLYPH.blob, face ? '#ff1d3a' : '#27304d', face ? .5 : .45), 0, .95); shade.position.y = .004;
    const tilt = new T.Group(); tilt.add(body); tilt.rotation.x = .16 - view.lean; tilt.scale.setScalar(view.scale);
    const inner = new T.Group(); inner.add(tilt, shade); if (face) inner.rotation.z = Math.PI; g.add(inner); g.userData = { body, inner, tilt, h, face }; world.add(g); return g;
  }
  let alice = null, corpses = [], flipped = 0, state = null, busy = 0;
  const clear = () => { for (const g of [...pieces.values(), ...corpses, ...(alice || [])]) world.remove(g); pieces.clear(); corpses = []; alice = null; };
  function load(st) {
    clear(); state = st;
    alice = [standee('alice_a', 0), standee('alice_b', 1)]; alice.forEach((g) => g.position.copy(local(st.alice)));
    for (const e of st.enemies) { const g = standee(KINDS[e.kind].key, e.face); g.position.copy(local(e.at)); pieces.set(e.id, g); }
    for (const c of st.corpses) for (const face of [0, 1]) { const g = standee('alice_a', face); g.position.copy(local(c)); const b = g.userData.body; b.material.color.set(face ? '#7a0d1c' : '#3b3340'); b.rotation.z = 1.25; b.scale.multiplyScalar(.8); b.position.set(.1, .34, 0); corpses.push(g); }
    for (const s of st.holes) tiles[s].forEach((f) => { f.tile.visible = false; });
    tiles.forEach((pair, s) => pair.forEach((f) => { if (!st.holes.has(s)) f.tile.visible = true; f.goal.visible = s === st.goal; f.goal.material.map = GLYPH.goal; f.goal.material.color.set('#ffd774'); f.goal.material.opacity = .95; }));
  }
  // Threats of the facing world are filled; threats from the far side show as dashed ghosts.
  function paint(st, face, moves, aims, hint) {
    state = st;
    tiles.forEach((pair, s) => pair.forEach((f, side) => {
      const own = aims.some((a) => a.face === side && a.squares.includes(s)), far = aims.some((a) => a.face !== side && a.squares.includes(s));
      f.aim.visible = own || far; f.aim.material.map = own ? GLYPH.aim : GLYPH.ghost; f.aim.material.color.set(own ? (side ? '#ff2a4d' : '#ff2a4d') : (side ? '#ffd9e2' : '#8a1fff')); f.aim.material.opacity = own ? .95 : .9;
      f.aim.material.blending = side ? T.AdditiveBlending : T.NormalBlending;
      const mv = side === face && moves.find((m) => m.to === s);
      f.move.visible = !!mv || (hint === s && side === face);
      if (mv) { f.move.material.map = mv.capture !== null ? GLYPH.take : GLYPH.move; f.move.material.color.set(side ? '#ffffff' : '#1c4fd6'); f.move.material.blending = side ? T.AdditiveBlending : T.NormalBlending; f.move.material.opacity = hint === s ? 1 : .8; f.move.scale.setScalar(hint === s ? 1.05 : mv.capture !== null ? .96 : Math.min(.86, .62 * view.scale ** 1.5)); }
    }));
  }

  const tweens = new Set();
  const tween = (ms, fn, curve = ease) => new Promise((done) => { const t = { t0: performance.now(), ms, fn, curve, done }; tweens.add(t); });
  const fx = { punch: 0, hurt: 0 };
  async function flip(face) {
    busy++; const from = world.rotation.z, to = face ? Math.PI : 0; flipped = face;
    await tween(900, (k) => { world.rotation.z = from + (to - from) * k; fx.punch = Math.sin(k * Math.PI) * .9; camera.userData.dolly = Math.sin(k * Math.PI) * 2.2; });
    fx.punch = 0; busy--;
  }
  const hop = (g, a, b, ms, lift) => tween(ms, (k) => { g.position.lerpVectors(a, b, k); g.userData.inner.position.y = Math.sin(k * Math.PI) * lift; });
  async function animate(ev, hooks) {
    busy++;
    for (const e of ev) {
      if (e.t === 'move') { const a = local(e.from), b = local(e.to), far = a.distanceTo(b) > 1.6;
        if (e.face === 1) hooks.sfx('slide'); else hooks.sfx('step');
        await Promise.all(alice.map((g) => hop(g, a, b, far ? 300 : 260, e.face ? 0 : .28)));
        if (e.face === 1) { fx.punch = .25; tween(260, (k) => { fx.punch = .25 * (1 - k); }); } }
      if (e.t === 'capture') { const g = pieces.get(e.id); hooks.sfx('kill'); hooks.cutin(e.face); fx.punch = .5;
        await tween(420, (k) => { g.userData.body.material.color.setScalar(1 + 6 * (1 - k)); g.scale.set(1 + k * .5, 1 - k, 1); fx.punch = .5 * (1 - k); }, out); g.visible = false; }
      if (e.t === 'shift') { const g = pieces.get(e.id); hooks.sfx('tick'); await hop(g, local(e.from), local(e.to), 240, .22); }
      if (e.t === 'strike') { const g = pieces.get(e.id), a = g.position.clone(), b = local(e.at); hooks.sfx('death');
        await tween(170, (k) => { g.position.lerpVectors(a, b, k * .8); }, out); fx.hurt = 1; fx.punch = .8;
        await tween(700, (k) => { alice.forEach((al) => { al.userData.body.rotation.z = k * 1.25; al.userData.body.position.y = al.userData.h / 2 - k * .4; }); fx.punch = .8 * (1 - k); g.position.lerpVectors(b, a, k).lerp(b, .8 * (1 - k)); }, out);
        await tween(500, (k) => { fx.hurt = 1 - k; }); }
      if (e.t === 'win') { hooks.sfx('win'); await tween(700, (k) => { alice.forEach((g) => { g.userData.inner.position.y = k * 1.2; g.userData.body.material.color.setScalar(1 + k * 4); }); fx.punch = k * .5; }); fx.punch = 0; }
    }
    busy--;
  }

  const ray = new T.Raycaster(), ground = new T.Plane(new T.Vector3(0, 1, 0), 0), hit = new T.Vector3();
  function pick(cx, cy) {
    const r = canvas.getBoundingClientRect(); ray.setFromCamera(new T.Vector2((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1), camera);
    if (!ray.ray.intersectPlane(ground, hit)) return -1; world.worldToLocal(hit);
    const x = Math.round(hit.x + (W - 1) / 2), y = Math.round(hit.z + (H - 1) / 2); return x >= 0 && y >= 0 && x < W && y < H ? y * W + x : -1;
  }

  const projected = new T.Vector3();
  const toScreen = (x, y, z) => { const r = canvas.getBoundingClientRect(); world.localToWorld(projected.set(x, y, z)).project(camera); return [r.left + (projected.x + 1) / 2 * r.width, r.top + (1 - projected.y) / 2 * r.height]; };
  // A finger aims at the figure, not at the square under its feet: the square of the standee of `face` drawn under the point.
  function pickPiece(cx, cy, face) {
    let found = -1, depth = -1e9;
    for (const g of pieces.values()) {
      if (!g.visible || g.userData.face !== face) continue;
      const p = g.position, l = g.userData.h * view.scale, [ax, ay] = toScreen(p.x, 0, p.z), [bx, by] = toScreen(p.x, (face ? -1 : 1) * l * Math.cos(view.lean), p.z - l * Math.sin(view.lean));
      const dx = bx - ax, dy = by - ay, k = ((cx - ax) * dx + (cy - ay) * dy) / (dx * dx + dy * dy || 1);
      if (k < .15 || k > 1 || Math.hypot(cx - ax - dx * k, cy - ay - dy * k) > view.tile * .3 || p.z < depth) continue;
      depth = p.z; found = Math.round(p.z + (H - 1) / 2) * W + Math.round(p.x + (W - 1) / 2);
    }
    return found;
  }
  function project(s) { const r = canvas.getBoundingClientRect(); world.localToWorld(projected.copy(local(s))).project(camera); return { x: r.left + (projected.x + 1) / 2 * r.width, y: r.top + (1 - projected.y) / 2 * r.height }; }
  // The square under a finger: a ring on the glass plus a beam, so it reads even when the fingertip covers it.
  const cur = new T.Group(); cur.visible = false; world.add(cur);
  const ring = lay(flat(GLYPH.take, '#fff', 1, { blending: T.AdditiveBlending }), 0, 1.08), glow = lay(flat(GLYPH.blob, '#fff', .55, { blending: T.AdditiveBlending }), 0, 1.5);
  const beam = new T.Mesh(plane, flat(GLYPH.blob, '#fff', .5, { blending: T.AdditiveBlending, side: T.DoubleSide })); beam.scale.set(.16, 5, 1); beam.position.y = 2.3;
  ring.position.y = .03; glow.position.y = .025; cur.add(ring, glow, beam); cur.traverse((m) => { m.renderOrder = 3; });
  function cursor(s, face = 0, color = '#ffffff') {
    cur.visible = s >= 0; if (s < 0) return;
    cur.position.copy(local(s)); cur.rotation.z = face ? Math.PI : 0; for (const m of [ring, glow, beam]) m.material.color.set(color);
  }

  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new T.Vector2(256, 256), .2, .6, .9); composer.addPass(bloom);
  const final = new ShaderPass(FINAL); composer.addPass(final); composer.addPass(new OutputPass());
  const pose = (d, sway = 0) => { camera.position.set(sway, Math.sin(view.pitch) * d, Math.cos(view.pitch) * d); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); };
  const restyle = (g) => { g.userData.tilt.rotation.x = .16 - view.lean; g.userData.tilt.scale.setScalar(view.scale); };
  // Try every free rectangle the HUD offers and keep the one that shows the largest squares.
  function frameIn(s, w, h) {
    let best = null; // the steeper the camera, the less of the figures' faces: a steep pitch has to earn it with bigger squares
    for (let p = .44; p < 1.08; p += .04) { view.pitch = p; const f = frameAt(s, w, h); f.score = f.far * (1 - .15 * Math.max(0, p - .52)); if (!best || f.score > best.score) best = f; }
    return best;
  }
  function frameAt(s, w, h) {
    const fw = Math.max(120, w - s.l - s.r), fh = Math.max(120, h - s.t - s.b), head = 1.7 * view.scale;
    const pts = []; for (const x of [-1, 1]) pts.push([x * (W / 2 + .15), 0, H / 2 + .15], [x * (W / 2 + .15), 0, -H / 2 - .15], [x * (W / 2 + .2), head, -H / 2 + .5], [x * W / 2, -.7, H / 2 - .5]);
    const box = (d) => { pose(d); let x0 = 9, x1 = -9, y0 = 9, y1 = -9; for (const p of pts) { projected.set(...p).project(camera); x0 = Math.min(x0, projected.x); x1 = Math.max(x1, projected.x); y0 = Math.min(y0, projected.y); y1 = Math.max(y1, projected.y); } return { x0, x1, y0, y1 }; };
    let lo = 3, hi = 90; for (let i = 0; i < 24; i++) { const d = (lo + hi) / 2, b = box(d); if ((b.x1 - b.x0) / 2 * w <= fw && (b.y1 - b.y0) / 2 * h <= fh) hi = d; else lo = d; }
    const b = box(hi), a = projected.set(-.5, 0, 0).project(camera).x, c = projected.set(.5, 0, 0).project(camera).x;
    const far = (projected.set(.5, 0, .5 - H / 2).project(camera).x - projected.set(-.5, 0, .5 - H / 2).project(camera).x) / 2 * w; // the hardest row to hit
    return { pitch: view.pitch, d: hi, tile: (c - a) / 2 * w, far, ox: (b.x0 + b.x1) / 4 * w - (s.l + fw / 2 - w / 2), oy: -(b.y0 + b.y1) / 4 * h - (s.t + fh / 2 - h / 2) };
  }
  function fit() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    camera.clearViewOffset(); camera.aspect = w / h; camera.updateProjectionMatrix();
    let best = null; for (const s of view.safe) { const f = frameIn(s, w, h); f.score *= s.weight || 1; if (!best || f.score > best.score) best = f; }
    Object.assign(view, { pitch: best.pitch, d: best.d, tile: best.tile, far: best.far, lean: Math.min(.62, Math.max(.16, best.pitch - .4)), scale: Math.min(1.25, Math.max(1, 72 / best.tile)) });
    camera.setViewOffset(w, h, best.ox, best.oy, w, h); pose(view.d);
    const b = view.board = [9, -9, 9, -9]; for (const x of [-1, 1]) for (const z of [-1, 1]) { projected.set(x * W / 2, 0, z * H / 2).project(camera); b[0] = Math.min(b[0], projected.x); b[1] = Math.max(b[1], projected.x); b[2] = Math.min(b[2], projected.y); b[3] = Math.max(b[3], projected.y + .25); }
    clock.position.y = -Math.max(16, Math.sin(view.pitch) * view.d * 1.25 + 4); // the dead clock stays behind a steep camera after the flip
    for (const g of [...pieces.values(), ...corpses, ...(alice || [])]) restyle(g);
  }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); composer.setSize(w, h); fit();
  }
  const quality = createQuality((q) => { renderer.setPixelRatio(q.ratio); composer.setPixelRatio(q.ratio); bloom.enabled = q.bloom; resize(); });
  addEventListener('resize', resize);
  function setSafe(list) { view.safe = list; fit(); }
  const m4 = new T.Object3D(); let last = performance.now(), prev = last;
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now; const t = now / 1000;
    for (const tw of [...tweens]) { const k = Math.min(1, (now - tw.t0) / tw.ms); tw.fn(tw.curve(k)); if (k >= 1) { tweens.delete(tw); tw.done(); } }
    quality.tick(now - prev); prev = now;
    pose(view.d + (camera.userData.dolly || 0) * view.d / 13, Math.sin(t * .13) * .025 * view.d);
    if (cur.visible) { ring.scale.setScalar(1.08 + Math.sin(t * 9) * .05); beam.material.opacity = .35 + .15 * Math.sin(t * 9); }
    SKY.uniforms.time.value = t; sky.material.uniforms.time.value = t;
    cardSeed.forEach((c, i) => { const a = c.a + t * c.w * .08; m4.position.set(Math.cos(a) * c.r, c.y + Math.sin(t * c.w + i) * .4, Math.sin(a) * c.r - 4); m4.rotation.set(t * c.w + i, t * c.w * 1.3, i); world.localToWorld(projected.copy(m4.position)).project(camera); const bd = view.board, clear = Math.max(bd[0] - projected.x, projected.x - bd[1], bd[2] - projected.y, projected.y - bd[3]), k = c.s * Math.min(1, Math.max(0, clear * 5 + .1)); // never drift between the eye and the board
      m4.scale.set(k * .7, k, 1); m4.updateMatrix(); cards.setMatrixAt(i, m4.matrix); }); cards.instanceMatrix.needsUpdate = true;
    for (const [pts, v] of [[petals, -.35], [embers, -.5]]) { const p = pts.geometry.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i) + v * dt * (v === -.35 ? 1 : -1) * (.5 + (i % 5) * .2); if (pts === petals && y < 0) y = 12; if (pts === embers && y < -12) y = 0; p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(t + i) * dt * .15); } p.needsUpdate = true; }
    hands[0].rotation.z = -t * .05; hands[1].rotation.z = -Math.floor(t) * .1047;
    const pulse = .5 + .5 * Math.sin(t * 4);
    tiles.forEach((pair) => pair.forEach((f) => { if (f.goal.visible) f.goal.material.opacity = .6 + .4 * pulse; }));
    for (const g of pieces.values()) g.userData.body.position.y = g.userData.h / 2 - .03 + Math.sin(t * 1.6 + g.position.x * 2 + g.position.z) * .018;
    final.uniforms.time.value = t; final.uniforms.punch.value = fx.punch; final.uniforms.hurt.value = fx.hurt;
    final.uniforms.dark.value += ((flipped ? 1 : 0) - final.uniforms.dark.value) * .08; bloom.strength = .1 + final.uniforms.dark.value * .45; bloom.threshold = .93 - final.uniforms.dark.value * .33;
    composer.render(); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { load, paint, flip, animate, pick, pickPiece, project, cursor, setSafe, resize, view, quality, get busy() { return busy > 0; } };
}
