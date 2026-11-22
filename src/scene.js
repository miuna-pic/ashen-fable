import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { N, X, Y, isLit } from './rules.js';

const HALF = (N - 1) / 2;
const tilePos = (i) => new THREE.Vector3(X(i) - HALF, 0, Y(i) - HALF);
const ease = (k) => k * k * (3 - 2 * k);
const C = (hex) => new THREE.Color(hex);
const PALETTE = {
  snowA: C('#8f9bc4'), snowB: C('#66719c'), ice: C('#7fdcff'), litA: C('#f7c57e'), litB: C('#d99a52'), foam: C('#b9fff0'),
  eIce: C('#1a86c4'), eLit: C('#ff7417'), eFoam: C('#2fd6b4'), eNone: C('#000000'),
};
const ART = { match: 1.95, mermaid: 1.95, karen: 2.0, queen: 2.9 };

function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }

function canvasTex(size, draw, w = size, h = size) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function markerTextures() {
  const S = 128, m = S / 2;
  const tex = (fn) => canvasTex(S, (g) => { g.lineCap = 'round'; g.lineJoin = 'round'; fn(g); });
  return {
    move: tex((g) => {
      g.strokeStyle = '#ffd98a'; g.lineWidth = 5; g.beginPath(); g.arc(m, m, 26, 0, 7); g.stroke();
      g.fillStyle = '#fff3cf'; g.beginPath(); g.arc(m, m, 9, 0, 7); g.fill();
    }),
    strike: tex((g) => {
      const gr = g.createRadialGradient(m, m + 10, 4, m, m, 54);
      gr.addColorStop(0, '#fff7d6'); gr.addColorStop(0.35, '#ffb347'); gr.addColorStop(1, 'rgba(255,90,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(m, 22); g.bezierCurveTo(m + 30, 60, m + 16, 96, m, 98); g.bezierCurveTo(m - 16, 96, m - 30, 60, m, 22); g.fill();
    }),
    hit: tex((g) => {
      g.strokeStyle = '#ff3b4f'; g.lineWidth = 7; g.beginPath(); g.arc(m, m, 34, 0, 7); g.stroke();
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; g.beginPath(); g.moveTo(m + Math.cos(a) * 20, m + Math.sin(a) * 20); g.lineTo(m + Math.cos(a) * 54, m + Math.sin(a) * 54); g.stroke(); }
      g.fillStyle = '#fff'; g.beginPath(); g.arc(m, m, 8, 0, 7); g.fill();
    }),
    dance: tex((g) => {
      g.fillStyle = '#ff2d46'; g.beginPath(); g.moveTo(m, 20); g.lineTo(m + 30, 62); g.lineTo(m + 11, 62); g.lineTo(m + 11, 104); g.lineTo(m - 11, 104); g.lineTo(m - 11, 62); g.lineTo(m - 30, 62); g.closePath(); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
    }),
    sel: tex((g) => { g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.setLineDash([22, 14]); g.strokeRect(10, 10, S - 20, S - 20); }),
    threat: tex((g) => {
      g.strokeStyle = 'rgba(120,225,255,.9)'; g.lineWidth = 4;
      for (const [x, y] of [[14, 14], [S - 14, 14], [14, S - 14], [S - 14, S - 14]]) {
        g.beginPath(); g.moveTo(x, y + Math.sign(m - y) * 26); g.lineTo(x, y); g.lineTo(x + Math.sign(m - x) * 26, y); g.stroke();
      }
      g.fillStyle = 'rgba(160,235,255,.95)'; g.beginPath(); g.moveTo(m, m - 16); g.lineTo(m + 9, m); g.lineTo(m, m + 16); g.lineTo(m - 9, m); g.closePath(); g.fill();
    }),
    frost: tex((g) => {
      g.strokeStyle = 'rgba(235,248,255,.95)'; g.lineWidth = 4; g.translate(m, m);
      for (let k = 0; k < 6; k++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -34); g.moveTo(0, -20); g.lineTo(9, -29); g.moveTo(0, -20); g.lineTo(-9, -29); g.stroke(); }
    }),
    path: tex((g) => { g.fillStyle = '#ff2d46'; g.beginPath(); g.arc(m, m, 13, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 3; g.stroke(); }),
    glow: tex((g) => {
      const gr = g.createRadialGradient(m, m, 0, m, m, m);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
    }),
    blob: tex((g) => {
      const gr = g.createRadialGradient(m, m, 0, m, m, m);
      gr.addColorStop(0, 'rgba(0,0,10,.75)'); gr.addColorStop(1, 'rgba(0,0,10,0)');
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
    }),
  };
}

// 安徒生本人是剪纸高手：背景用程序生成的层叠剪纸舞台。
function papercut(seed, color, kind) {
  return canvasTex(0, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = color;
    g.beginPath(); g.moveTo(0, h);
    if (kind === 'spires') {
      let x = 0;
      while (x < w) { const bw = 30 + r() * 90, bh = h * (0.25 + r() * 0.7); g.lineTo(x, h - bh * 0.35); g.lineTo(x + bw / 2, h - bh); g.lineTo(x + bw, h - bh * 0.3); x += bw; }
    } else {
      let x = 0;
      while (x < w) { const bw = 60 + r() * 80, bh = h * (0.3 + r() * 0.5); g.lineTo(x, h - bh * 0.5); g.quadraticCurveTo(x + bw / 2, h - bh * 1.3, x + bw, h - bh * 0.5); x += bw; }
    }
    g.lineTo(w, h); g.closePath(); g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 46; k++) {
      const x = r() * w, y = h * (0.45 + r() * 0.5), s = 6 + r() * 16;
      g.beginPath();
      if (k % 3 === 0) { g.moveTo(x, y - s); g.lineTo(x + s * 0.5, y); g.lineTo(x, y + s); g.lineTo(x - s * 0.5, y); }
      else if (k % 3 === 1) { g.moveTo(x, y + s * 0.6); g.bezierCurveTo(x + s * 1.4, y - s * 0.4, x + s * 0.4, y - s * 1.2, x, y - s * 0.3); g.bezierCurveTo(x - s * 0.4, y - s * 1.2, x - s * 1.4, y - s * 0.4, x, y + s * 0.6); }
      else g.arc(x, y, s * 0.4, 0, 7);
      g.fill();
    }
  }, 1024, 512);
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const scene = new THREE.Scene();
  scene.background = C('#04050c');
  scene.fog = new THREE.Fog('#060a1c', 18, 40);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
  const tex = markerTextures();
  const loader = new THREE.TextureLoader();
  const tweens = [];
  const tween = (ms, fn) => new Promise((res) => tweens.push({ t: 0, ms, fn, res }));
  const wait = (ms) => tween(ms, () => {});

  scene.add(new THREE.HemisphereLight('#8fa6ff', '#0a0a1c', 0.75));
  const moon = new THREE.DirectionalLight('#b9ccff', 1.1);
  moon.position.set(-4, 9, -6);
  scene.add(moon);

  // —— 舞台：台座、镜月、剪纸层 ——
  const stage = new THREE.Group();
  scene.add(stage);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(N + 0.9, 0.5, N + 0.9), new THREE.MeshStandardMaterial({ color: '#0b0d1c', roughness: 0.55, metalness: 0.4 }));
  slab.position.y = -0.33;
  stage.add(slab);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(N + 1.1, 0.06, N + 1.1), new THREE.MeshStandardMaterial({ color: '#b08a4a', roughness: 0.5, metalness: 0.5, emissive: '#3a2408' }));
  trim.position.y = -0.12;
  stage.add(trim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: '#070a18', roughness: 0.7, metalness: 0.2 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.6;
  stage.add(floor);

  const mirror = new THREE.Mesh(new THREE.CircleGeometry(5.2, 64), new THREE.MeshBasicMaterial({
    map: canvasTex(512, (g, w) => {
      const gr = g.createRadialGradient(w / 2, w / 2, 20, w / 2, w / 2, w / 2);
      gr.addColorStop(0, '#dfeaff'); gr.addColorStop(0.7, '#8fa9e8'); gr.addColorStop(1, '#3c4f96');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
      const r = rng(7); g.strokeStyle = 'rgba(8,12,40,.85)'; g.lineWidth = 3;
      for (let k = 0; k < 13; k++) { let a = r() * 7, x = w / 2 + 30 * Math.cos(a), y = w * 0.58 + 30 * Math.sin(a); g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 7; j++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * 44; y += Math.sin(a) * 44; g.lineTo(x, y); } g.stroke(); }
    }), fog: false, toneMapped: false, color: '#7f8fc4', transparent: true,
  }));
  mirror.position.set(0, 1.4, -10.4);
  stage.add(mirror);
  const layers = [
    ['spires', '#1c2a5e', 11, -11.5, 0.6, 44, 9],
    ['spires', '#111a40', 23, -9, 0.3, 38, 6.5],
    ['lace', '#080b1e', 41, -6.5, 0, 34, 4],
  ].map(([kind, color, seed, z, y, w, h]) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: papercut(seed, color, kind), transparent: true, fog: false, depthWrite: false }));
    mesh.position.set(0, y + h / 2 - 1.2, z);
    stage.add(mesh);
    return mesh;
  });

  // —— 棋盘 ——
  const tileGeo = new THREE.BoxGeometry(0.93, 0.14, 0.93);
  const spikeGeo = new THREE.ConeGeometry(0.07, 0.34, 4);
  const spikeMat = new THREE.MeshStandardMaterial({ color: '#c9f3ff', emissive: '#2aa0e0', emissiveIntensity: 0.9, roughness: 0.1, flatShading: true, transparent: true, opacity: 0.9 });
  const markGeo = new THREE.PlaneGeometry(0.86, 0.86);
  const tiles = [];
  for (let i = 0; i < N * N; i++) {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.05 });
    const mesh = new THREE.Mesh(tileGeo, mat);
    mesh.position.copy(tilePos(i)); mesh.position.y = -0.07;
    stage.add(mesh);
    const spikes = new THREE.Group();
    const r = rng(i * 97 + 3);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (r() < 0.3) continue;
      const s = new THREE.Mesh(spikeGeo, spikeMat);
      s.position.set(sx * 0.37, 0.2, sz * 0.37); s.scale.setScalar(0.6 + r() * 0.9); s.rotation.set((r() - 0.5) * 0.5, r() * 3, (r() - 0.5) * 0.5);
      spikes.add(s);
    }
    spikes.scale.setScalar(0.001);
    mesh.add(spikes);
    const marks = ['a', 'b', 'c', 'd'].map((_, k) => {
      const m = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0, toneMapped: false }));
      m.rotation.x = -Math.PI / 2; m.position.copy(tilePos(i)); m.position.y = 0.02 + k * 0.006; m.visible = false; m.renderOrder = 2 + k;
      stage.add(m);
      return m;
    });
    tiles.push({ mesh, mat, spikes, marks, state: 'snow', k: 0, col: (X(i) + Y(i)) % 2 ? PALETTE.snowA.clone() : PALETTE.snowB.clone(), em: C('#000'), ei: 0 });
    mat.color.copy(tiles[i].col);
  }

  // —— 火光 ——
  const flames = Array.from({ length: 5 }, () => {
    const light = new THREE.PointLight('#ff9a3c', 0, 9, 1.4);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color: '#ffb25a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    sprite.scale.setScalar(1.6);
    const g = new THREE.Group(); g.add(light, sprite); g.userData = { light, sprite, target: 0, cur: 0, foam: false };
    stage.add(g);
    return g;
  });

  // —— 棋子 ——
  const units = new Map();
  const portraits = new Map(); // 每个角色的立绘只加载一次，棋子重建时复用
  const SHARED = new Set();
  function dropUnit(u) {
    stage.remove(u.g);
    u.g.traverse((o) => {
      if (!o.isMesh) return;
      if (!SHARED.has(o.geometry)) o.geometry.dispose();
      if (!SHARED.has(o.material)) o.material.dispose();
    });
    units.delete(u.id);
  }
  const shardGeo = new THREE.OctahedronGeometry(0.36, 0);
  for (const shared of [markGeo, spikeGeo, spikeMat, shardGeo]) SHARED.add(shared);
  function makeUnit(p) {
    const g = new THREE.Group();
    g.position.copy(tilePos(p.at));
    const blob = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ map: tex.blob, transparent: true, depthWrite: false, opacity: 0.6 }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; blob.renderOrder = 1;
    g.add(blob);
    const u = { id: p.id, kind: p.kind, g, lit: 0, phase: Math.random() * 6 };
    if (p.kind === 'shard') {
      const mat = new THREE.MeshStandardMaterial({ color: '#efeaff', emissive: '#8a5cff', emissiveIntensity: 1.6, roughness: 0.05, metalness: 0.6, flatShading: true });
      u.body = new THREE.Mesh(shardGeo, mat); u.body.scale.set(0.8, 1.7, 0.8); u.body.position.y = 0.85; u.mat = mat;
      g.add(u.body);
    } else {
      const h = ART[p.kind];
      const mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.08, side: THREE.DoubleSide, toneMapped: false, visible: false });
      const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
      u.body = new THREE.Mesh(geo, mat); u.mat = mat;
      u.pivot = new THREE.Group(); u.pivot.rotation.x = -0.5; u.pivot.add(u.body);
      u.body.scale.set(h * 0.66, h, 1);
      const show = (t) => { mat.map = t; mat.visible = true; mat.needsUpdate = true; u.body.scale.set(h * t.image.width / t.image.height, h, 1); };
      if (portraits.has(p.kind)) show(portraits.get(p.kind));
      else loader.load(`./art/${p.kind}.webp`, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; portraits.set(p.kind, t); show(t); });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.05, 24), new THREE.MeshStandardMaterial({ color: p.kind === 'queen' ? '#9fdcff' : '#e9e2d2', metalness: 0.1, roughness: 0.6, emissive: p.kind === 'queen' ? '#1a6aa8' : '#000' }));
      base.position.y = 0.03;
      g.add(base, u.pivot);
      if (p.kind === 'queen') {
        blob.scale.setScalar(1.5);
        const r = rng(5);
        for (let k = 0; k < 9; k++) {
          const s = new THREE.Mesh(spikeGeo, spikeMat);
          const a = Math.PI * (0.1 + 0.8 * k / 8);
          s.position.set(Math.cos(a) * 0.62, 0.5, -0.25 - Math.sin(a) * 0.3); s.scale.set(2.2, 3 + r() * 5, 2.2); s.rotation.z = (Math.cos(a)) * -0.45;
          g.add(s);
        }
      }
    }
    stage.add(g);
    units.set(p.id, u);
    return u;
  }

  // —— 粒子 ——
  const SNOW = 700, snowGeo = new THREE.BufferGeometry(), snowPos = new Float32Array(SNOW * 3);
  for (let k = 0; k < SNOW; k++) { snowPos[k * 3] = (Math.random() - 0.5) * 22; snowPos[k * 3 + 1] = Math.random() * 11; snowPos[k * 3 + 2] = (Math.random() - 0.5) * 20 - 2; }
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ map: tex.glow, color: '#dfe9ff', size: 0.11, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(snow);
  const P = 500, pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(P * 3).fill(-99), pCol = new Float32Array(P * 3), pVel = new Float32Array(P * 3), pLife = new Float32Array(P);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const sparks = new THREE.Points(pGeo, new THREE.PointsMaterial({ map: tex.glow, size: 0.2, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparks.frustumCulled = false; scene.add(sparks);
  let pNext = 0;
  function burst(i, color, count = 40, power = 1) {
    const base = typeof i === 'number' ? tilePos(i) : i, c = C(color);
    for (let k = 0; k < count; k++) {
      const j = pNext = (pNext + 1) % P, a = Math.random() * 6.283, s = (0.6 + Math.random() * 2.4) * power;
      pPos.set([base.x, 0.5 + Math.random() * 0.6, base.z], j * 3);
      pVel.set([Math.cos(a) * s, 1.5 + Math.random() * 3 * power, Math.sin(a) * s], j * 3);
      const f = 0.5 + Math.random() * 0.7; pCol.set([c.r * f, c.g * f, c.b * f], j * 3); pLife[j] = 0.6 + Math.random() * 0.8;
    }
  }

  // —— 后期 ——
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.6, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const look = new THREE.Vector3();
  const home = new THREE.Vector3();
  const forced = new URLSearchParams(location.search).get('q');
  let quality = forced == null ? 0 : Math.max(0, Math.min(2, +forced || 0));
  let slow = 0, sampled = 0, fpsN = 0, fpsT = 0, fpsLast = performance.now(), fpsEl = null;
  if (new URLSearchParams(location.search).has('fps')) {
    fpsEl = document.createElement('div');
    fpsEl.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:20;font:12px monospace;color:#8fe3ff;background:rgba(0,0,0,.6);padding:2px 6px;pointer-events:none';
    document.body.append(fpsEl);
  }
  let shake = 0, pointer = { x: 0, y: 0 }, portrait = false;
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    const dpr = quality >= 2 ? 1 : Math.min(devicePixelRatio || 1, w < 700 ? 2 : 1.75);
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr); composer.setSize(w, h);
    camera.aspect = w / h; portrait = w / h < 0.9;
    const vf = THREE.MathUtils.degToRad(camera.fov) / 2;
    const hf = Math.atan(Math.tan(vf) * camera.aspect);
    const dist = Math.max(14, (portrait ? 4.1 : 6.4) / Math.tan(hf));
    const el = THREE.MathUtils.degToRad(portrait ? 54 : 41);
    look.set(0, portrait ? 0 : 0.5, portrait ? -0.5 : 1.0);
    home.set(0, Math.sin(el) * dist, look.z + Math.cos(el) * dist);
    camera.updateProjectionMatrix();
  }

  // —— 同步 / 标记 ——
  let board = null;
  function setBoard(s) {
    board = s;
    for (let i = 0; i < N * N; i++) {
      const foam = s.lights.some((l) => l.foam && Math.max(Math.abs(X(l.at) - X(i)), Math.abs(Y(l.at) - Y(i))) <= 1);
      tiles[i].state = s.ice[i] ? 'ice' : isLit(s, i) ? (foam ? 'foam' : 'lit') : 'snow';
    }
    flames.forEach((f, k) => {
      const l = s.lights[k];
      f.userData.target = l ? 1 : 0;
      if (l) { f.position.copy(tilePos(l.at)); f.position.y = l.foam ? 0.35 : 2.25; f.userData.foam = !!l.foam; f.userData.ttl = l.ttl ?? 9; }
    });
  }
  function sync(s) {
    setBoard(s);
    for (const [id, u] of units) if (!s.pieces.some((p) => p.id === id)) dropUnit(u);
    for (const p of s.pieces) { const u = units.get(p.id) ?? makeUnit(p); u.g.position.copy(tilePos(p.at)); u.g.scale.setScalar(1); u.g.visible = true; }
  }
  function setMarks({ actions = [], selected = null, threat = [], frost = [], path = [] } = {}) {
    for (const t of tiles) for (const m of t.marks) m.visible = false;
    const put = (i, layer, map, rot = 0, op = 1) => { const m = tiles[i].marks[layer]; m.material.map = map; m.material.needsUpdate = true; m.userData.op = op; m.material.opacity = op; m.rotation.z = rot; m.visible = true; };
    for (const i of threat) put(i, 1, tex.threat, 0, 0.75);
    for (const i of frost) put(i, 2, tex.frost, 0, 0.6);
    path.forEach((i) => put(i, 3, tex.path, 0, 0.9));
    if (selected != null) put(selected, 0, tex.sel, 0, 0.9);
    for (const a of actions) {
      if (a.type === 'strike') put(a.to, 0, tex.strike);
      else if (a.type === 'dance') put(a.to, 0, tex.dance, Math.atan2(-a.dir[0], -a.dir[1]));
      else put(a.to, 0, a.hit ? tex.hit : tex.move);
    }
  }

  // —— 演出基元 ——
  async function moveUnit(id, path, { ms = 260, hop = 0.35, spin = false } = {}) {
    const u = units.get(id); if (!u) return;
    for (const to of path) {
      const a = u.g.position.clone(), b = tilePos(to);
      await tween(ms, (k) => {
        const e = ease(k);
        u.g.position.lerpVectors(a, b, e); u.g.position.y = Math.sin(k * Math.PI) * hop;
        if (spin && u.pivot) u.pivot.rotation.y = e * Math.PI * 2;
      });
      if (u.pivot) u.pivot.rotation.y = 0;
    }
  }
  async function nudge(id, toward) {
    const u = units.get(id); if (!u) return;
    const a = u.g.position.clone(), b = tilePos(toward).lerp(a, 0.6);
    await tween(240, (k) => u.g.position.lerpVectors(a, b, Math.sin(k * Math.PI)));
    u.g.position.copy(a);
  }
  async function removeUnit(id, color = '#9fe6ff') {
    const u = units.get(id); if (!u) return;
    burst(u.g.position, color, 70, 1.3);
    await tween(260, (k) => u.g.scale.setScalar(1 - ease(k) * 0.999));
    dropUnit(u);
  }
  async function spawnUnit(p) {
    const u = makeUnit(p);
    burst(p.at, '#9fe6ff', 30, 0.7);
    await tween(380, (k) => { u.g.scale.setScalar(ease(k)); u.g.position.y = (1 - ease(k)) * 1.5; });
  }
  function kick(power = 0.3) { shake = Math.max(shake, power); }

  const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitPoint = new THREE.Vector3();
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    let tile = null, unit = null;
    if (ray.ray.intersectPlane(ground, hitPoint)) {
      const x = Math.round(hitPoint.x + HALF), y = Math.round(hitPoint.z + HALF);
      if (x >= 0 && y >= 0 && x < N && y < N) tile = y * N + x;
    }
    const bodies = [...units.values()].filter((u) => u.pivot && u.kind !== 'queen');
    const hit = ray.intersectObjects(bodies.map((u) => u.body), false)[0];
    if (hit) unit = bodies.find((u) => u.body === hit.object).id;
    return { tile, unit };
  }
  function project(i, height = 1.2) {
    const v = tilePos(i); v.y = height; v.project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  }

  const clock = new THREE.Clock();
  const tmp = new THREE.Color(), dim = C('#9aa8dc'), bright = C('#ffffff');
  let time = 0;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1); time += dt;
    if (fpsEl) { const now = performance.now(); fpsN++; fpsT += (now - fpsLast) / 1000; fpsLast = now; if (fpsT >= 1) { fpsEl.textContent = `${Math.round(fpsN / fpsT)} fps · 画质 ${quality}`; fpsN = 0; fpsT = 0; } }
    for (let k = tweens.length - 1; k >= 0; k--) {
      const t = tweens[k]; t.t += dt * 1000; const q = Math.min(1, t.t / t.ms); t.fn(q);
      if (q >= 1) { tweens.splice(k, 1); t.res(); }
    }
    const f = 1 - Math.exp(-dt * 7);
    for (let i = 0; i < N * N; i++) {
      const t = tiles[i], chk = (X(i) + Y(i)) % 2;
      const [col, em, ei, y] = t.state === 'ice' ? [PALETTE.ice, PALETTE.eIce, 0.55, 0.03]
        : t.state === 'lit' ? [chk ? PALETTE.litA : PALETTE.litB, PALETTE.eLit, 0.2 + Math.sin(time * 9 + i) * 0.04, 0]
        : t.state === 'foam' ? [PALETTE.foam, PALETTE.eFoam, 0.45, 0]
        : [chk ? PALETTE.snowA : PALETTE.snowB, PALETTE.eNone, 0, -0.03];
      t.col.lerp(col, f); t.em.lerp(em, f); t.ei += (ei - t.ei) * f;
      t.mat.color.copy(t.col); t.mat.emissive.copy(t.em); t.mat.emissiveIntensity = t.ei;
      t.mat.roughness += ((t.state === 'ice' ? 0.12 : 0.75) - t.mat.roughness) * f;
      t.mesh.position.y += (-0.07 + y - t.mesh.position.y) * f;
      const sp = t.state === 'ice' ? 1 : 0.001; t.spikes.scale.setScalar(t.spikes.scale.x + (sp - t.spikes.scale.x) * f);
      for (const m of t.marks) if (m.visible) m.material.opacity = (m.userData.op ?? 1) * (0.72 + 0.28 * Math.sin(time * 4 + i * 0.4));
    }
    for (const fl of flames) {
      const d = fl.userData; d.cur += (d.target - d.cur) * f;
      const flick = 0.85 + Math.sin(time * 17 + fl.position.x * 3) * 0.08 + Math.sin(time * 29) * 0.07;
      const fade = d.foam ? 1 : d.ttl <= 1 ? 0.55 : 1;
      d.light.intensity = d.cur * flick * (d.foam ? 5 : 16) * fade;
      d.light.color.set(d.foam ? '#5fffd8' : '#ff9a3c'); d.sprite.material.color.set(d.foam ? '#7fffe0' : '#ffb25a');
      d.sprite.material.opacity = d.cur * 0.85 * flick * fade; d.sprite.scale.setScalar((d.foam ? 1.2 : 0.8) * (0.9 + flick * 0.2));
    }
    for (const u of units.values()) {
      const at = Math.round(u.g.position.z + HALF) * N + Math.round(u.g.position.x + HALF);
      const lit = board && at >= 0 && at < N * N && isLit(board, at) ? 1 : 0;
      u.lit += (lit - u.lit) * f;
      if (u.kind === 'shard') {
        u.body.rotation.y += dt * (1.2 + u.lit * 5); u.body.position.y = 0.85 + Math.sin(time * 2 + u.phase) * 0.08;
        u.mat.emissive.set('#8a5cff').lerp(tmp.set('#ff3050'), u.lit); u.mat.emissiveIntensity = 1.3 + u.lit * (1 + Math.sin(time * 14));
      } else {
        const fx = u.kind === 'queen' ? tmp.set('#b9c8f2').lerp(C('#ffd9dc'), u.lit) : tmp.copy(dim).lerp(bright, u.lit);
        u.mat.color.copy(fx).multiplyScalar(0.9);
        u.body.rotation.z = Math.sin(time * 1.3 + u.phase) * 0.025; u.pivot.position.y = Math.abs(Math.sin(time * 1.6 + u.phase)) * 0.03;
      }
    }
    for (let k = 0; k < SNOW; k++) {
      snowPos[k * 3 + 1] -= dt * (0.5 + (k % 7) * 0.09); snowPos[k * 3] += Math.sin(time * 0.7 + k) * dt * 0.25;
      if (snowPos[k * 3 + 1] < -0.5) snowPos[k * 3 + 1] = 11;
    }
    snowGeo.attributes.position.needsUpdate = true;
    for (let j = 0; j < P; j++) {
      if (pLife[j] <= 0) continue;
      pLife[j] -= dt; pVel[j * 3 + 1] -= dt * 7;
      for (let c = 0; c < 3; c++) pPos[j * 3 + c] += pVel[j * 3 + c] * dt;
      if (pLife[j] <= 0) pPos[j * 3 + 1] = -99; else for (let c = 0; c < 3; c++) pCol[j * 3 + c] *= 1 - dt * 1.2;
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
    shake *= Math.exp(-dt * 6);
    camera.position.set(home.x + pointer.x * 0.5 + (Math.random() - 0.5) * shake, home.y + pointer.y * 0.25 + (Math.random() - 0.5) * shake, home.z);
    camera.lookAt(look);
    layers.forEach((l, k) => { l.position.x = -pointer.x * (0.25 + k * 0.3); });
    mirror.material.color.setScalar(0.55 + Math.sin(time * 0.6) * 0.04);
    if (quality === 0) composer.render(); else renderer.render(scene, camera);
    if (forced == null && quality < 2 && time > 2) {
      sampled++; if (dt >= 0.045) slow++;
      if (sampled >= 40) { if (slow > 28) { quality++; resize(); } slow = 0; sampled = 0; }
    }
    requestAnimationFrame(frame);
  }
  addEventListener('resize', resize);
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { pointer.x = e.clientX / innerWidth - 0.5; pointer.y = e.clientY / innerHeight - 0.5; } });
  resize(); requestAnimationFrame(frame);

  return { get quality() { return quality; }, sync, setBoard, setMarks, moveUnit, nudge, removeUnit, spawnUnit, burst, kick, wait, pick, project, resize, tilePos };
}
