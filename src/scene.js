import * as T from 'three';
import { SIZE, CENTER, HOURS, col, row, formOf } from './game.js';

const FONT = '"Noto Serif SC", serif';
const DAY = {
  tileA: 0xfff6e6, tileB: 0xc9ad84, frame: 0x7a0c20, dial: 0xe8dcc6, ink: 0x2a1418, hand: 0x9b0f26,
  ambient: 0xfff4e2, ambientI: 1.25, key: 0xfff0d8, keyI: 1.7, rim: 0xb3122d, rimI: 0.0, page: 0xfaf3e6,
};
const NIGHT = {
  tileA: 0x5a2a4c, tileB: 0x1c0d1c, frame: 0x30060f, dial: 0x0c070d, ink: 0xe0183c, hand: 0xff2a4d,
  ambient: 0x8a6cc0, ambientI: 1.5, key: 0xff5a6e, keyI: 2.6, rim: 0xff1f45, rimI: 1.6, page: 0x7a1026,
};
const SIDE_COLOR = { crimson: 0xc4122f, gold: 0xe2ad2f };

const lerpHex = (a, b, t, out) => out.setHex(a).lerp(tmp.setHex(b), t);
const tmp = new T.Color();
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const cellPos = (i) => new T.Vector3(col(i) - 2, 0, row(i) - 2);

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// 纸面：细纹 + 压印边框
function paperTexture() {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(60,30,30,${Math.random() * 0.07})`;
      g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1);
    }
    g.strokeStyle = 'rgba(40,10,20,.8)'; g.lineWidth = 5; g.strokeRect(10, 10, s - 20, s - 20);
    g.strokeStyle = 'rgba(40,10,20,.45)'; g.lineWidth = 1.5; g.strokeRect(20, 20, s - 40, s - 40);
    g.strokeStyle = 'rgba(40,10,20,.16)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(s / 2, 34); g.lineTo(s - 34, s / 2); g.lineTo(s / 2, s - 34); g.lineTo(34, s / 2); g.closePath(); g.stroke();
    for (const [x, y] of [[20, 20], [s - 20, 20], [20, s - 20], [s - 20, s - 20]]) {
      g.fillStyle = 'rgba(40,10,20,.8)'; g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-9, -9, 18, 18); g.restore();
    }
  });
}

function dialTexture() {
  const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  return canvasTexture(2048, (g, s) => {
    const c = s / 2;
    g.translate(c, c);
    g.strokeStyle = g.fillStyle = '#fff';
    for (const [r, w] of [[1000, 10], [975, 3], [760, 3], [735, 8]]) { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); }
    for (let i = 0; i < 144; i++) {
      g.save(); g.rotate((i / 144) * Math.PI * 2);
      g.lineWidth = i % 12 === 0 ? 9 : 2; g.beginPath(); g.moveTo(0, -975); g.lineTo(0, i % 12 === 0 ? -900 : -950); g.stroke(); g.restore();
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    numerals.forEach((n, i) => {
      g.save(); g.rotate((i / 12) * Math.PI * 2); g.translate(0, -845);
      g.font = `900 ${i === 0 ? 150 : 112}px ${FONT}`; g.fillText(n, 0, 0); g.restore();
    });
    // 外圈碎语
    const text = '从前从前有一个女孩她在钟响之前还是童话钟响之后她终于变回了自己';
    g.font = `700 34px ${FONT}`;
    [...text.repeat(3)].forEach((ch, i, all) => {
      g.save(); g.rotate((i / all.length) * Math.PI * 2); g.globalAlpha = 0.55; g.fillText(ch, 0, -705); g.restore();
    });
  });
}

function glyphTexture(glyph) {
  return canvasTexture(256, (g, s) => {
    g.strokeStyle = g.fillStyle = '#fff'; g.lineWidth = 5;
    g.beginPath(); g.arc(s / 2, s / 2, 104, 0, 7); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.arc(s / 2, s / 2, 92, 0, 7); g.stroke();
    g.font = `900 132px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(glyph, s / 2, s / 2 + 6);
  });
}

// 落点标记：环 + 所耗时辰；会敲响钟的落点画成钟面
function markTexture(kind, hours, bell) {
  return canvasTexture(256, (g, s) => {
    const c = s / 2;
    const main = kind === 'capture' ? '#ff2848' : kind === 'threat' ? '#9a8fa8' : kind === 'push' ? '#58c8ff' : '#ffffff';
    g.strokeStyle = g.fillStyle = main;
    if (bell) {
      g.fillStyle = 'rgba(255,196,64,.9)'; g.beginPath(); g.arc(c, c, 100, 0, 7); g.fill();
      g.strokeStyle = '#1a0d10'; g.lineWidth = 6; g.beginPath(); g.arc(c, c, 86, 0, 7); g.stroke();
      g.fillStyle = '#1a0d10'; g.font = `900 104px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('钟', c, c + 4);
      if (kind === 'capture') { g.strokeStyle = '#ff2848'; g.lineWidth = 12; g.beginPath(); g.arc(c, c, 112, 0, 7); g.stroke(); }
      return;
    }
    g.lineWidth = kind === 'capture' ? 12 : 8;
    g.setLineDash(kind === 'threat' ? [14, 12] : []);
    g.beginPath(); g.arc(c, c, 96, 0, 7); g.stroke(); g.setLineDash([]);
    if (kind === 'capture') {
      g.lineWidth = 10;
      for (const a of [0, 1, 2, 3]) { g.save(); g.translate(c, c); g.rotate(a * Math.PI / 2 + Math.PI / 4); g.beginPath(); g.moveTo(0, -122); g.lineTo(0, -74); g.stroke(); g.restore(); }
    }
    if (kind === 'threat') return;
    g.globalAlpha = 0.18; g.beginPath(); g.arc(c, c, 92, 0, 7); g.fill(); g.globalAlpha = 1;
    g.font = `900 92px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(kind === 'push' ? '推' : '+' + hours, c, c + 4);
  });
}

function dollTexture(color, night) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 384;
  const g = c.getContext('2d');
  const body = night ? '#140a12' : '#f6efe2';
  const line = night ? color : '#1a0e14';
  g.lineJoin = 'round';
  const shape = () => {
    g.beginPath(); g.arc(128, 86, 50, 0, 7); g.closePath();
    g.moveTo(128, 130); g.lineTo(226, 360); g.lineTo(30, 360); g.closePath();
    g.moveTo(60, 190); g.lineTo(14, 250); g.lineTo(40, 262); g.lineTo(84, 214); g.closePath();
    g.moveTo(196, 190); g.lineTo(242, 250); g.lineTo(216, 262); g.lineTo(172, 214); g.closePath();
  };
  g.strokeStyle = line; g.lineWidth = 16; shape(); g.stroke();
  g.fillStyle = body; shape(); g.fill();
  g.fillStyle = color; g.beginPath(); g.moveTo(128, 150); g.lineTo(196, 340); g.lineTo(60, 340); g.closePath(); g.fill();
  g.strokeStyle = line; g.lineWidth = 7;
  for (const x of [108, 148]) { g.beginPath(); g.moveTo(x - 9, 74); g.lineTo(x + 9, 92); g.moveTo(x + 9, 74); g.lineTo(x - 9, 92); g.stroke(); }
  g.beginPath(); g.moveTo(104, 112); g.lineTo(152, 112); g.stroke();
  for (let x = 100; x <= 156; x += 14) { g.beginPath(); g.moveTo(x, 106); g.lineTo(x, 118); g.stroke(); }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

export async function createScene(canvas, { onPick, onHover }) {
  await Promise.all([document.fonts.load(`900 64px ${FONT}`, '钟终推XII+123'), document.fonts.load(`700 34px ${FONT}`, '从前')]).catch(() => {});
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(30, 1, 0.1, 100);

  const ambient = new T.HemisphereLight(0xffffff, 0x554444, 2);
  const key = new T.DirectionalLight(0xffffff, 2);
  key.position.set(-3.5, 9, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 22 });
  key.shadow.bias = -0.0008; key.shadow.radius = 5;
  const rim = new T.DirectionalLight(0xff2244, 0);
  rim.position.set(4, 3, -6);
  scene.add(ambient, key, rim);

  const world = new T.Group();
  scene.add(world);

  // ── 钟面 ──
  const dialBase = new T.Mesh(new T.CircleGeometry(5.5, 96), new T.MeshStandardMaterial({ roughness: 0.9 }));
  dialBase.rotation.x = -Math.PI / 2; dialBase.position.y = -0.78; dialBase.receiveShadow = true;
  const dialInk = new T.Mesh(new T.CircleGeometry(5.5, 96), new T.MeshBasicMaterial({ map: dialTexture(), transparent: true, depthWrite: false }));
  dialInk.rotation.x = -Math.PI / 2; dialInk.position.y = -0.77;
  const handShape = new T.Shape();
  handShape.moveTo(0, 0); handShape.lineTo(0.2, 2.6); handShape.lineTo(0.34, 3.5); handShape.lineTo(0, 5.05); handShape.lineTo(-0.34, 3.5); handShape.lineTo(-0.2, 2.6); handShape.closePath();
  const hand = new T.Mesh(new T.ShapeGeometry(handShape), new T.MeshBasicMaterial({ side: T.DoubleSide }));
  hand.rotation.x = -Math.PI / 2; hand.position.y = -0.75;
  const handPivot = new T.Group(); handPivot.add(hand);
  world.add(dialBase, dialInk, handPivot);

  // ── 棋盘 ──
  const paper = paperTexture();
  const edges = canvasTexture(256, (g, s) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 4) { g.fillStyle = `rgba(60,30,20,${0.25 + Math.random() * 0.4})`; g.fillRect(0, y, s, 1.4); }
    g.fillStyle = '#5a0a18'; g.fillRect(0, 0, s, 34); g.fillRect(0, s - 34, s, 34);
    g.fillStyle = '#d6a32a'; g.fillRect(0, 34, s, 5); g.fillRect(0, s - 39, s, 5);
  });
  const pageMat = new T.MeshStandardMaterial({ map: edges, roughness: 0.9 });
  const frameMat = new T.MeshStandardMaterial({ roughness: 0.45, metalness: 0.25 });
  const frame = new T.Mesh(new T.BoxGeometry(5.4, 0.62, 5.4), [pageMat, pageMat, frameMat, frameMat, pageMat, pageMat]);
  frame.position.y = -0.46; frame.receiveShadow = true; frame.castShadow = true;
  world.add(frame);
  const tileGeo = new T.BoxGeometry(0.95, 0.16, 0.95);
  const tiles = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    const mat = new T.MeshStandardMaterial({ map: paper, roughness: 0.82 });
    const tile = new T.Mesh(tileGeo, mat);
    tile.position.copy(cellPos(i)); tile.position.y = -0.08;
    tile.receiveShadow = true; tile.userData.cell = i;
    world.add(tile); tiles.push(tile);
  }
  const sigil = new T.Mesh(new T.PlaneGeometry(0.9, 0.9), new T.MeshBasicMaterial({ map: glyphTexture('终'), transparent: true, depthWrite: false }));
  sigil.rotation.x = -Math.PI / 2; sigil.position.set(0, 0.004, 0);
  const beam = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 3.2, 32, 1, true), new T.MeshBasicMaterial({ transparent: true, opacity: 0.12, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
  beam.position.y = 1.6;
  world.add(sigil, beam);

  // ── 落点标记 ──
  const markCache = new Map();
  const markGeo = new T.PlaneGeometry(0.82, 0.82);
  const marks = tiles.map((_, i) => {
    const m = new T.Mesh(markGeo, new T.MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: false }));
    m.rotation.x = -Math.PI / 2; m.position.copy(cellPos(i)); m.position.y = 0.012; m.visible = false; m.renderOrder = 20;
    world.add(m); return m;
  });
  const cursor = new T.Mesh(new T.RingGeometry(0.4, 0.47, 4, 1, Math.PI / 4), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
  cursor.rotation.x = -Math.PI / 2; cursor.position.y = 0.014; cursor.visible = false; cursor.scale.setScalar(1.36);
  world.add(cursor);

  // ── 飘散的书页 ──
  const PAGES = 70;
  const pages = new T.InstancedMesh(new T.PlaneGeometry(0.34, 0.46), new T.MeshBasicMaterial({ side: T.DoubleSide, transparent: true, opacity: 0.85 }), PAGES);
  const pageData = Array.from({ length: PAGES }, () => ({
    x: (Math.random() - 0.5) * 22, y: Math.random() * 9 - 2, z: -3 - Math.random() * 12,
    s: 0.5 + Math.random() * 1.4, v: 0.1 + Math.random() * 0.25, r: Math.random() * 6, w: (Math.random() - 0.5) * 1.6,
  }));
  scene.add(pages);
  const moon = new T.Mesh(new T.CircleGeometry(4.4, 64), new T.MeshBasicMaterial({ color: 0xd4092f, transparent: true, opacity: 0 }));
  moon.position.set(3.2, 2.2, -14);
  scene.add(moon);

  // ── 棋子 ──
  const loader = new T.TextureLoader();
  const texCache = new Map();
  const artTexture = (name) => {
    if (!texCache.has(name)) {
      const t = loader.load(`./art/s_${name}.webp`); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
      texCache.set(name, t);
    }
    return texCache.get(name);
  };
  const HEIGHT = { hood: 1.62, cinder: 1.62, snow: 1.62, rapunzel: 1.66, gretel: 1.56, briar: 1.66, doll: 0.86 };
  const ASPECT = {
    hood_day: 0.65, hood_night: 0.67, cinder_day: 0.67, cinder_night: 0.5, snow_day: 0.46, snow_night: 0.36,
    rapunzel_day: 0.67, rapunzel_night: 0.68, gretel_day: 0.43, gretel_night: 0.58, briar_day: 0.66, briar_night: 0.67,
  };
  const pieces = new Map();
  const baseGeo = new T.CylinderGeometry(0.36, 0.4, 0.07, 40);
  const rimGeo = new T.TorusGeometry(0.39, 0.022, 8, 48);

  function makePlane(tex, w, h, back) {
    const geo = new T.PlaneGeometry(w, h); geo.translate(0, h / 2, 0);
    const mat = new T.MeshBasicMaterial({ map: tex, alphaTest: 0.4, shadowSide: T.DoubleSide });
    const m = new T.Mesh(geo, mat);
    m.customDepthMaterial = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, map: tex, alphaTest: 0.4 });
    if (back) m.rotation.y = Math.PI; else m.position.z = 0.002;
    return m;
  }

  // 回收一枚棋子：共享的底座几何体与缓存的立绘贴图不动
  function discard(p) {
    world.remove(p.root);
    const cached = new Set(texCache.values());
    p.root.traverse((o) => {
      if (!o.isMesh) return;
      if (o.geometry !== baseGeo && o.geometry !== rimGeo) o.geometry.dispose();
      for (const m of [o.material, o.customDepthMaterial]) {
        if (!m) continue;
        if (m.map && !cached.has(m.map)) m.map.dispose();
        m.dispose();
      }
    });
  }

  function makePiece(piece, cell, night) {
    const root = new T.Group(); root.position.copy(cellPos(cell));
    const color = SIDE_COLOR[piece.side];
    const base = new T.Mesh(baseGeo, new T.MeshStandardMaterial({ color: 0x140c10, roughness: 0.35, metalness: 0.6 }));
    base.position.y = 0.035; base.castShadow = true;
    const ring = new T.Mesh(rimGeo, new T.MeshBasicMaterial({ color }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.075;
    const lean = new T.Group(); lean.position.y = 0.07; lean.rotation.x = -0.34;
    const flip = new T.Group(); flip.rotation.y = night ? Math.PI : 0;
    const h = HEIGHT[piece.kind];
    let front, back;
    if (piece.kind === 'doll') {
      front = makePlane(dollTexture('#' + color.toString(16).padStart(6, '0'), false), h * 0.667, h, false);
      back = makePlane(dollTexture('#' + color.toString(16).padStart(6, '0'), true), h * 0.667, h, true);
    } else {
      front = makePlane(artTexture(piece.kind + '_day'), h * ASPECT[piece.kind + '_day'] * 1.02, h, false);
      back = makePlane(artTexture(piece.kind + '_night'), h * ASPECT[piece.kind + '_night'] * 1.02, h, true);
    }
    front.castShadow = !night; back.castShadow = night;
    flip.add(front, back); lean.add(flip); root.add(base, ring, lean);
    world.add(root);
    const p = { piece, root, flip, front, back, ring, cell };
    pieces.set(piece.id, p);
    return p;
  }

  // ── 补间 ──
  const tweens = new Set();
  const tween = (ms, step) => new Promise((done) => { tweens.add({ t0: performance.now(), ms, step, done }); });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // 碎纸
  const shreds = [];
  const shredGeo = new T.PlaneGeometry(0.09, 0.13);
  function burst(pos, color) {
    for (let i = 0; i < 46; i++) {
      const m = new T.Mesh(shredGeo, new T.MeshBasicMaterial({ color: i % 3 ? color : 0xf6efe2, side: T.DoubleSide, transparent: true }));
      m.position.copy(pos); m.position.y += 0.3 + Math.random() * 0.8;
      m.userData = { v: new T.Vector3((Math.random() - 0.5) * 3.4, 1.5 + Math.random() * 3, (Math.random() - 0.5) * 3.4), life: 0, spin: Math.random() * 12 - 6 };
      world.add(m); shreds.push(m);
    }
  }

  let nightT = 0, nightGoal = 0, shake = 0, turnSide = 'crimson';
  const c1 = new T.Color();
  function applyPalette(t) {
    tiles.forEach((tile, i) => lerpHex((col(i) + row(i)) % 2 ? DAY.tileB : DAY.tileA, (col(i) + row(i)) % 2 ? NIGHT.tileB : NIGHT.tileA, t, tile.material.color));
    lerpHex(DAY.frame, NIGHT.frame, t, frameMat.color); lerpHex(0xfff4e0, 0x6a4a52, t, pageMat.color);
    lerpHex(DAY.dial, NIGHT.dial, t, dialBase.material.color);
    lerpHex(DAY.ink, NIGHT.ink, t, dialInk.material.color);
    lerpHex(DAY.hand, NIGHT.hand, t, hand.material.color);
    lerpHex(DAY.ambient, NIGHT.ambient, t, ambient.color); ambient.intensity = T.MathUtils.lerp(DAY.ambientI, NIGHT.ambientI, t);
    lerpHex(DAY.key, NIGHT.key, t, key.color); key.intensity = T.MathUtils.lerp(DAY.keyI, NIGHT.keyI, t);
    rim.intensity = T.MathUtils.lerp(DAY.rimI, NIGHT.rimI, t);
    lerpHex(DAY.page, NIGHT.page, t, pages.material.color);
    marks.forEach((m) => { if (m.userData.tint) lerpHex(0x8a0c22, 0xffffff, t, m.material.color); else m.material.color.setHex(0xffffff); });
    lerpHex(0x1a0e14, 0xffffff, t, cursor.material.color);
    lerpHex(0x9b0f26, 0xffc13a, t, sigil.material.color);
    lerpHex(0xb3122d, 0xffb030, t, beam.material.color);
    moon.material.opacity = t * 0.95;
  }
  applyPalette(0);

  // ── 相机 ──
  const target = new T.Vector3();
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    const portrait = aspect < 0.9;
    const tan = Math.tan((camera.fov / 2) * Math.PI / 180);
    const dist = Math.max((portrait ? 3.1 : 3.9) / (tan * aspect), (portrait ? 4.6 : 3.45) / tan);
    const pitch = (portrait ? 54 : 47) * Math.PI / 180;
    target.set(0, 0.35, portrait ? 0.75 : 0.1);
    camera.position.set(target.x, target.y + Math.sin(pitch) * dist, target.z + Math.cos(pitch) * dist);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // ── 拾取 ──
  const ray = new T.Raycaster(), ptr = new T.Vector2();
  // 立绘透明的部分不算点中，这样才能点到被前排挡住的角色
  const alphaMaps = new WeakMap();
  function solid(hit) {
    const o = hit.object, img = o.material.map?.image;
    if (!o.visible) return false;
    if (!img || !hit.uv || !img.width) return true;
    let a = alphaMaps.get(img);
    if (!a) {
      const c = document.createElement('canvas'); c.width = 64; c.height = 128;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, 64, 128);
      a = g.getImageData(0, 0, 64, 128).data; alphaMaps.set(img, a);
    }
    const x = Math.min(63, Math.floor(hit.uv.x * 64)), y = Math.min(127, Math.floor((1 - hit.uv.y) * 128));
    return a[(y * 64 + x) * 4 + 3] > 60;
  }
  function cellAt(ev) {
    const r = canvas.getBoundingClientRect();
    ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    // 可落子的格子和站着棋子的格子优先；其次才是立牌的身体（点她也算点中她脚下的格子）
    let best = null;
    for (const p of pieces.values()) {
      const hit = ray.intersectObject(p.root, true).find(solid);
      if (hit && (!best || hit.distance < best.d)) best = { d: hit.distance, cell: p.cell };
    }
    const tile = ray.intersectObjects(tiles)[0];
    if (tile) {
      const cell = tile.object.userData.cell;
      if (marks[cell].visible) return cell;
      for (const p of pieces.values()) if (p.cell === cell) return cell;
    }
    if (best) return best.cell;
    return tile ? tile.object.userData.cell : -1;
  }
  let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 14) return;
    down = null; onPick(cellAt(e));
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const c = cellAt(e);
    cursor.visible = c >= 0; if (c >= 0) { cursor.position.x = col(c) - 2; cursor.position.z = row(c) - 2; }
    canvas.style.cursor = c >= 0 ? 'pointer' : 'default';
    onHover?.(c);
  });
  canvas.addEventListener('pointerleave', () => { cursor.visible = false; onHover?.(-1); });

  // ── 帧循环 ──
  const dummy = new T.Object3D();
  let last = performance.now(), selected = null;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (const tw of tweens) {
      const t = Math.min(1, (now - tw.t0) / tw.ms);
      tw.step(t);
      if (t >= 1) { tweens.delete(tw); tw.done(); }
    }
    if (nightT !== nightGoal) { nightT = T.MathUtils.clamp(nightT + Math.sign(nightGoal - nightT) * dt / 1.1, 0, 1); applyPalette(ease(nightT)); }
    const time = now / 1000;
    pageData.forEach((p, i) => {
      p.y += p.v * dt; if (p.y > 8) p.y = -3;
      dummy.position.set(p.x + Math.sin(time * 0.3 + p.r) * 0.6, p.y, p.z);
      dummy.rotation.set(time * p.w * 0.6 + p.r, time * p.w + p.r, p.r);
      dummy.scale.setScalar(p.s); dummy.updateMatrix(); pages.setMatrixAt(i, dummy.matrix);
    });
    pages.instanceMatrix.needsUpdate = true;
    sigil.material.opacity = 0.75 + Math.sin(time * 2.2) * 0.25;
    beam.material.opacity = 0.07 + Math.sin(time * 2.2) * 0.04;
    beam.rotation.y = time * 0.3;
    for (const m of marks) if (m.visible) m.material.opacity = 0.82 + Math.sin(time * 5) * 0.18;
    for (const p of pieces.values()) {
      const lift = p === selected ? 0.16 + Math.sin(time * 4) * 0.03 : 0;
      p.flip.position.y += (lift - p.flip.position.y) * Math.min(1, dt * 12);
      p.ring.scale.setScalar(p.piece.side === turnSide ? 1 + Math.sin(time * 3) * 0.035 : 1);
    }
    for (let i = shreds.length - 1; i >= 0; i--) {
      const m = shreds[i], u = m.userData;
      u.life += dt; u.v.y -= 6.5 * dt; m.position.addScaledVector(u.v, dt);
      m.rotation.x += u.spin * dt; m.rotation.z += u.spin * 0.7 * dt; m.material.opacity = 1 - u.life / 1.3;
      if (u.life > 1.3) { world.remove(m); m.material.dispose(); shreds.splice(i, 1); }
    }
    if (shake > 0) {
      shake = Math.max(0, shake - dt * 1.6);
      world.position.set((Math.random() - 0.5) * shake * 0.22, (Math.random() - 0.5) * shake * 0.12, 0);
    } else world.position.set(0, 0, 0);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  const handAngle = (clock) => -(clock / HOURS) * Math.PI * 2;
  let handNow = 0;

  return {
    resize,
    // 把场景对齐到局面（无动画）
    sync(state) {
      const seen = new Set();
      state.cells.forEach((piece, cell) => {
        if (!piece) return;
        seen.add(piece.id);
        const p = pieces.get(piece.id) || makePiece(piece, cell, state.night);
        p.cell = cell; p.root.position.copy(cellPos(cell)); p.root.scale.setScalar(1);
        p.flip.rotation.y = state.night ? Math.PI : 0;
        p.front.castShadow = !state.night; p.back.castShadow = state.night;
      });
      for (const [id, p] of pieces) if (!seen.has(id)) { discard(p); pieces.delete(id); }
      nightGoal = state.night ? 1 : 0;
      handNow = state.bells * HOURS + state.clock; handPivot.rotation.y = handAngle(handNow);
      turnSide = state.winner ? null : state.turn;
    },
    setNightInstant(night) { nightT = nightGoal = night ? 1 : 0; applyPalette(nightT); },
    select(id) { selected = id ? pieces.get(id) : null; },
    mark(list) {
      marks.forEach((m) => { m.visible = false; });
      // 挡住落点的立牌变成半透明
      const targets = new Set(list.map((m) => m.to));
      for (const p of pieces.values()) {
        const ghost = p !== selected && !targets.has(p.cell) && (targets.has(p.cell - SIZE));
        for (const m of [p.front, p.back]) { m.material.transparent = ghost; m.material.opacity = ghost ? 0.3 : 1; m.material.alphaTest = ghost ? 0.1 : 0.4; m.material.depthWrite = !ghost; }
      }
      for (const { to, kind, hours, bell } of list) {
        const k = kind + hours + (bell ? 'b' : '');
        if (!markCache.has(k)) markCache.set(k, markTexture(kind, hours, bell));
        marks[to].userData.tint = !bell && (kind === 'move' || kind === 'threat'); if (marks[to].userData.tint) lerpHex(0x8a0c22, 0xffffff, ease(nightT), marks[to].material.color); else marks[to].material.color.setHex(0xffffff);
        marks[to].material.map = markCache.get(k); marks[to].material.needsUpdate = true; marks[to].visible = true;
      }
    },
    async move(ev, total) {
      const p = pieces.get(ev.id); if (!p) return;
      const a = p.root.position.clone(), b = cellPos(ev.to);
      p.cell = ev.to;
      const from = handNow; handNow = total;
      await tween(300 + ev.hours * 70, (t) => {
        const e = ease(t);
        p.root.position.lerpVectors(a, b, e); p.root.position.y = Math.sin(Math.PI * t) * 0.42;
        handPivot.rotation.y = handAngle(from + (total - from) * e);
      });
    },
    async push(ev) {
      const p = pieces.get(ev.id); if (!p) return;
      const a = p.root.position.clone(), b = cellPos(ev.to); p.cell = ev.to; shake = 0.5;
      await tween(260, (t) => p.root.position.lerpVectors(a, b, 1 - Math.pow(1 - t, 3)));
    },
    capture(ev) {
      const p = pieces.get(ev.piece.id); if (!p) return;
      pieces.delete(ev.piece.id); shake = 0.9;
      burst(p.root.position, SIDE_COLOR[ev.piece.side]);
      tween(220, (t) => p.root.scale.setScalar(1 - t)).then(() => discard(p));
    },
    tick(total) {
      const from = handNow; handNow = total;
      return tween(300, (t) => { handPivot.rotation.y = handAngle(from + (total - from) * ease(t)); });
    },
    // 钟响：所有立牌翻面，天色倒转
    async bell(night) {
      shake = 1.6; nightGoal = night ? 1 : 0;
      const goal = night ? Math.PI : 0;
      const all = [...pieces.values()].sort((a, b) => a.cell - b.cell);
      all.forEach((p, i) => {
        const startAt = p.flip.rotation.y;
        wait(i * 55).then(() => tween(620, (t) => {
          const e = ease(t);
          p.flip.rotation.y = startAt + (goal + (night ? 0 : Math.PI * 2) - startAt) * e;
          p.root.position.y = Math.sin(Math.PI * t) * 0.5;
          if (t >= 0.5) { p.front.castShadow = !night; p.back.castShadow = night; }
          if (t >= 1) p.flip.rotation.y = goal;
        }));
      });
      await wait(all.length * 55 + 700);
    },
    setTurn(side) { turnSide = side; },
    celebrate(cell) { burst(cellPos(cell), 0xffc13a); shake = 1; },
  };
}
