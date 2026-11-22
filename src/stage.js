// The 3D stage: one glass board with a world on each side. Flipping rotates the whole universe.
import * as T from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { W, H, X, Y, KINDS } from './rules.js';
import { createScenery } from './scenery.js';
import { createVfx, HUE } from './vfx.js';

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

// Framing: low enough that the horizon and its skyline sit above the far edge of the board.
const CAM = { fov: 48, pitch: .56, dist: 11.7, wide: 19, back: 0, ly: -1.2, lz: -4 };
const TALL = { fov: 50, pitch: .62, dist: 12, wide: 9.5, back: 0, ly: -.3, lz: -4 };
const FINAL = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, punch: { value: 0 }, dark: { value: 0 }, hurt: { value: 0 }, flash: { value: 0 } },
  vertexShader: 'varying vec2 u; void main(){ u = uv; gl_Position = vec4(position.xy,0.,1.); }',
  fragmentShader: `varying vec2 u; uniform sampler2D tDiffuse; uniform float time, punch, dark, hurt, flash;
    float h(vec2 v){ return fract(sin(dot(v, vec2(12.9898,78.233))+time) * 43758.5453); }
    void main(){ vec2 c = u-.5; float r = dot(c,c);
      vec2 o = c * (r * .010 + punch * .05);                       // lens fringe only toward the corners, and on impact
      vec2 w = u + c * punch * .10 * sin(r*30.-time*20.);
      vec3 col = vec3(texture2D(tDiffuse, w+o).r, texture2D(tDiffuse, w).g, texture2D(tDiffuse, w-o).b);
      float lum = dot(col, vec3(.3,.6,.1));
      col = mix(vec3(lum), col, mix(1.12, 1.18, dark));
      vec3 lo = clamp(col, 0., 1.); col += (lo * lo * (3. - 2. * lo) - lo) * .55;        // gentle s-curve
      col *= mix(vec3(1.02, .99, 1.01), vec3(1.05, .96, .97), dark);
      col = mix(col, lum * lum * vec3(1.,.08,.12) * 1.25, hurt * .8);       // the kill drains the frame to blood without flattening it
      col *= 1. - r * mix(.5, 1.25, dark);
      col += flash * mix(vec3(1., .97, .95) * (1. - lum), vec3(1., .25, .3), dark);   // never past white on the bright side
      col += (h(u*900.)-.5) * mix(.012, .007, dark);
      gl_FragColor = vec4(col,1.); }`,
};

export function createStage(canvas) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const dpr = Math.min(devicePixelRatio || 1, 2); renderer.setPixelRatio(dpr);
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(40, 1, .1, 80);
  const world = new T.Group(); scene.add(world);


  const scenery = createScenery(world), vfx = createVfx(world, scenery.blob);
  const plane = new T.PlaneGeometry(1, 1);
  const flat = (map, color, opacity = 1, extra = {}) => new T.MeshBasicMaterial({ map, color, transparent: true, opacity, depthWrite: false, toneMapped: false, ...extra });
  const lay = (mat, face, size = 1) => { const m = new T.Mesh(plane, mat); m.rotation.x = face ? Math.PI / 2 : -Math.PI / 2; m.scale.setScalar(size); return m; };

  // Tiles.
  const tiles = [], marks = [new T.Group(), new T.Group()]; world.add(...marks);
  for (let s = 0; s < W * H; s++) {
    const p = local(s), dark = (X(s) + Y(s)) % 2, pair = [];
    for (const face of [0, 1]) {

      const mk = (z) => { const m = lay(flat(GLYPH.move, '#fff', 0, { blending: T.AdditiveBlending }), face, .9); m.position.set(p.x, (face ? -1 : 1) * z, p.z); m.renderOrder = -2; m.visible = false; marks[face].add(m); return m; };
      pair.push({ aim: mk(.012), move: mk(.02), goal: mk(.016) });
    }
    tiles.push(pair);
  }


  // Pieces are standees: face 0 stands on the glass, face 1 hangs beneath it.
  const pieces = new Map(); const textures = {};
  function standee(name, face) {
    textures[name] ||= tex(name);
    const h = HEIGHT[name] || 1.34, g = new T.Group(), body = new T.Mesh(plane, new T.MeshBasicMaterial({ map: textures[name], transparent: true, alphaTest: .35, side: T.DoubleSide, toneMapped: false }));
    body.scale.set(h * ASPECT[name], h, 1); body.position.y = h / 2 - .03; body.rotation.x = -.16;
    const shade = lay(flat(GLYPH.blob, face ? '#ff1d3a' : '#27304d', face ? .5 : .45), 0, .95); shade.position.y = .004;
    const inner = new T.Group(); inner.add(body, shade); if (face) inner.rotation.z = Math.PI; g.add(inner); g.userData = { body, inner, h, face, shade, here: body.material, far: scenery.through(textures[name]) }; world.add(g); return g;
  }
  // Whoever hangs in the far world is drawn over the glass with the see-through material.
  function order(face) {
    for (const g of [...pieces.values(), ...corpses, ...(alice || [])]) { const near = g.userData.face === face; const u = g.userData; u.body.material = near ? u.here : u.far; u.body.renderOrder = near ? 0 : -2.5; u.shade.visible = near; }
    marks.forEach((m, side) => { m.visible = side === face; });
  }
  let alice = null, corpses = [], flipped = 0, state = null, busy = 0;
  const clear = () => { for (const g of [...pieces.values(), ...corpses, ...(alice || [])]) world.remove(g); pieces.clear(); corpses = []; alice = null; };
  function load(st) {
    clear(); state = st;
    alice = [standee('alice_a', 0), standee('alice_b', 1)]; alice.forEach((g) => g.position.copy(local(st.alice)));
    for (const e of st.enemies) { const g = standee(KINDS[e.kind].key, e.face); g.position.copy(local(e.at)); pieces.set(e.id, g); }
    for (const c of st.corpses) for (const face of [0, 1]) { const g = standee('alice_a', face); g.position.copy(local(c)); const b = g.userData.body; b.material.color.set(face ? '#7a0d1c' : '#3b3340'); g.userData.far.uniforms.tint.value.copy(b.material.color); b.rotation.z = 1.25; b.scale.multiplyScalar(.8); b.position.set(.1, .34, 0); corpses.push(g); }
    scenery.setBoard(st); order(flipped);
    tiles.forEach((pair, s) => pair.forEach((f) => { f.goal.visible = s === st.goal; f.goal.material.map = GLYPH.goal; f.goal.material.color.set('#ffd774'); f.goal.material.opacity = .95; }));
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
      if (mv) { f.move.material.map = mv.capture !== null ? GLYPH.take : GLYPH.move; f.move.material.color.set(side ? '#ffffff' : '#1c4fd6'); f.move.material.blending = side ? T.AdditiveBlending : T.NormalBlending; f.move.material.opacity = hint === s ? 1 : mv.capture !== null ? .95 : side ? .6 : .8; f.move.scale.setScalar(hint === s ? 1.05 : mv.capture !== null ? .96 : side ? .36 : .56); }
    }));
  }

  const tweens = new Set();
  const tween = (ms, fn, curve = ease) => new Promise((done) => { const t = { t0: performance.now(), ms, fn, curve, done }; tweens.add(t); });
  const fx = { punch: 0, hurt: 0, flash: 0 };
  const kick = (v, ms = 260) => { fx.punch = v; return tween(ms, (k) => { fx.punch = v * (1 - k); }, out); };
  const flare = (v, ms = 320) => { fx.flash = v; return tween(ms, (k) => { fx.flash = v * (1 - k); }, out); };
  const mid = new T.Vector3();
  async function flip(face) {
    busy++; const from = world.rotation.z, to = face ? Math.PI : 0; flipped = face;
    const side = face ? -1 : 1;
    vfx.ring(mid, -side, face ? '#c9902f' : '#ff2a3c', 7, 700, face ? .1 : 1, .05);
    let swapped = false; await tween(900, (k) => { world.rotation.z = from + (to - from) * k; if (!swapped && k >= .5) { swapped = true; order(face); flare(face ? .1 : .06, 500); } fx.punch = Math.sin(k * Math.PI) * .7; camera.userData.dolly = Math.sin(k * Math.PI) * 2.6; });
    vfx.ring(mid, side, face ? '#8f1420' : '#c9902f', 6.5, 800, face ? 1 : .1, .025);
    for (let i = 0; i < 4; i++) vfx.burst(local([0, W - 1, W * (H - 1), W * H - 1][i]), side, { count: 14, speed: 1.4, up: 1.2, y: .2, life: 1.1, size: .09, g: -.6, colors: face ? HUE.ember : HUE.gold, add: face ? 1 : .5 });
    fx.punch = 0; busy--;
  }
  const hop = (g, a, b, ms, lift) => tween(ms, (k) => { g.position.lerpVectors(a, b, k); g.userData.inner.position.y = Math.sin(k * Math.PI) * lift; });
  async function animate(ev, hooks) {
    busy++;
    for (const e of ev) {
      if (e.t === 'move') { const a = local(e.from), b = local(e.to), far = a.distanceTo(b) > 1.6, side = e.face ? -1 : 1;
        if (e.face === 1) { hooks.sfx('slide'); vfx.streak(a, b, -1, { count: 10 + a.distanceTo(b) * 9, life: .7, size: .12, h: 1.2, colors: HUE.ember, drag: 1 }); vfx.streak(a, b, 1, { count: 6, life: .5, size: .1, h: .2, colors: HUE.ink, add: 0 }); }
        else { hooks.sfx('step'); vfx.ring(a, 1, '#3d6bff', .7, 380); }
        await Promise.all(alice.map((g) => hop(g, a, b, far ? 300 : 260, e.face ? 0 : .28)));
        vfx.ring(b, side, e.face ? '#ff2a3c' : '#2f5cff', e.face ? 1.5 : 1.0, 480); vfx.ring(b, -side, e.face ? '#b9c6ff' : '#ff2a3c', .7, 420);
        vfx.burst(b, side, { count: e.face ? 16 : 8, speed: e.face ? 1.6 : .9, up: .5, y: .1, h: .1, life: .55, size: .09, colors: e.face ? HUE.ember : HUE.snow, add: e.face ? 1 : .25 });
        if (e.face === 1) kick(.22); }
      if (e.t === 'capture') { const g = pieces.get(e.id), at = g.position, side = e.face ? -1 : 1; hooks.sfx('kill'); hooks.cutin(e.face); kick(.5, 420); flare(.22);
        vfx.ring(at, side, e.face ? '#ffffff' : '#ff1f3d', 2.4, 600, e.face ? 1 : .3, .07);
        vfx.burst(at, side, { count: 46, speed: 3.4, up: .5, spread: 1.2, y: .7, h: 1, life: .8, size: .13, g: 5, colors: e.face ? HUE.ghost : HUE.blood, add: e.face ? 1 : .05 });
        vfx.burst(at, side, { count: 14, speed: 1.2, up: 1.5, y: .6, life: 1.3, size: .2, g: -.5, colors: e.face ? HUE.ember : HUE.gold, add: e.face ? 1 : .5 });
        await tween(420, (k) => { g.userData.here.color.setScalar(1 + 6 * (1 - k)); g.scale.set(1 + k * .5, 1 - k, 1); }, out); g.visible = false; }
      if (e.t === 'shift') { const g = pieces.get(e.id), b = local(e.to); hooks.sfx('tick'); await hop(g, local(e.from), b, 240, .22); vfx.ring(b, g.userData.face ? -1 : 1, g.userData.face ? '#ff2a3c' : '#c21733', .8, 360); }
      if (e.t === 'strike') { const g = pieces.get(e.id), a = g.position.clone(), b = local(e.at); hooks.sfx('death');
        await tween(170, (k) => { g.position.lerpVectors(a, b, k * .8); }, out); fx.hurt = 1; kick(.8, 700); flare(.2);
        for (const side of [1, -1]) { vfx.ring(b, side, '#ff1030', 3.2, 800, side < 0 ? 1 : .2, .06); vfx.burst(b, side, { count: 44, speed: 3.6, up: .7, spread: 1.4, y: .6, h: .9, life: 1, size: .14, g: 4, colors: side < 0 ? HUE.ember : HUE.blood, add: side < 0 ? 1 : .05 }); }
        await tween(700, (k) => { alice.forEach((al) => { al.userData.body.rotation.z = k * 1.25; al.userData.body.position.y = al.userData.h / 2 - k * .4; }); g.position.lerpVectors(b, a, k).lerp(b, .8 * (1 - k)); }, out);
        await tween(500, (k) => { fx.hurt = 1 - k; }); }
      if (e.t === 'win') { hooks.sfx('win'); const at = alice[0].position; flare(.3, 900);
        for (const side of [1, -1]) { vfx.ring(at, side, side > 0 ? '#ffd774' : '#ffb04a', 3.5, 1000, side < 0 ? 1 : .6, .05); vfx.burst(at, side, { count: 60, speed: 1.3, up: 2.4, spread: 2, y: .3, h: .4, r: .7, life: 1.6, size: .13, g: -1.2, drag: .8, colors: HUE.gold, add: side < 0 ? 1 : .6 }); }
        await tween(700, (k) => { alice.forEach((g) => { g.userData.inner.position.y = k * 1.2; g.userData.here.color.setScalar(1 + k * 4); }); fx.punch = k * .5; }); fx.punch = 0; }
    }
    busy--;
  }

  const ray = new T.Raycaster(), ground = new T.Plane(new T.Vector3(0, 1, 0), 0), hit = new T.Vector3();
  function pick(cx, cy) {
    const r = canvas.getBoundingClientRect(); ray.setFromCamera(new T.Vector2((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1), camera);
    if (!ray.ray.intersectPlane(ground, hit)) return -1; world.worldToLocal(hit);
    const x = Math.round(hit.x + (W - 1) / 2), y = Math.round(hit.z + (H - 1) / 2); return x >= 0 && y >= 0 && x < W && y < H ? y * W + x : -1;
  }

  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new T.Vector2(256, 256), .2, .6, .9); composer.addPass(bloom);
  const final = new ShaderPass(FINAL); composer.addPass(final); composer.addPass(new OutputPass());
  let portrait = false, lift = 0; const edge = new T.Vector3();
  const pose = (c, d, sway) => { camera.position.set(sway, Math.sin(c.pitch) * d, Math.cos(c.pitch) * d + c.back); camera.lookAt(0, c.ly - lift, c.lz); };
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; portrait = w / h < .8; const c = portrait ? TALL : CAM;
    camera.fov = c.fov; camera.updateProjectionMatrix();
    // tilt down, then pull back, until the near edge of the board clears whatever HUD sits at the bottom centre (the flip button)
    const hud = document.getElementById('flip')?.getBoundingClientRect(), limit = (hud && hud.height ? hud.top : h) - 6;
    let d = Math.max(c.dist, c.wide / (w / h));
    const clear = () => { pose(c, d, 0); camera.updateMatrixWorld(); return (1 - edge.set(0, 0, H / 2).project(camera).y) / 2 * h <= limit; };
    for (lift = 0; lift < 3 && !clear(); lift += .25);
    for (; d < 40 && !clear(); d += .25);
    camera.userData.base = d;
  }
  addEventListener('resize', resize); resize();
  if (import.meta.env.DEV) window.__cam = CAM;
  const m4 = new T.Object3D(); let last = performance.now();
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now; const t = now / 1000;
    for (const tw of [...tweens]) { const k = Math.min(1, (now - tw.t0) / tw.ms); tw.fn(tw.curve(k)); if (k >= 1) { tweens.delete(tw); tw.done(); } }
    const c = portrait ? TALL : CAM, d = (camera.userData.base || 13) + (camera.userData.dolly || 0);
    pose(c, d, Math.sin(t * .13) * .3);
    scenery.update(t, dt); vfx.update(dt, canvas.clientHeight);
    const pulse = .5 + .5 * Math.sin(t * 4);
    tiles.forEach((pair) => pair.forEach((f) => { if (f.goal.visible) f.goal.material.opacity = .6 + .4 * pulse; }));
    for (const g of pieces.values()) g.userData.body.position.y = g.userData.h / 2 - .03 + Math.sin(t * 1.6 + g.position.x * 2 + g.position.z) * .018;
    final.uniforms.time.value = t; final.uniforms.punch.value = fx.punch; final.uniforms.hurt.value = fx.hurt; final.uniforms.flash.value = fx.flash;
    final.uniforms.dark.value += ((flipped ? 1 : 0) - final.uniforms.dark.value) * .08; bloom.strength = .14 + final.uniforms.dark.value * .3; bloom.threshold = .9 - final.uniforms.dark.value * .25;
    composer.render(); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { load, paint, flip, animate, pick, resize, get busy() { return busy > 0; } };
}
