// 3D characters: sculpted meshes with a hand-written anime shader (ink outline, rim light, cloth and hair
// that trail behind the body, ash dissolve) and procedural acting. The 2D standee shows until a model arrives.
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Board height of each figure, and how wide its 2D placeholder is.
const CAST = {
  alice_a: { h: 1.3, aspect: 433 / 720 }, alice_b: { h: 1.3, aspect: 460 / 720 },
  soldier: { h: 1.3, aspect: 368 / 720 }, hollow: { h: 1.3, aspect: 341 / 720 },
  rook: { h: 1.55, aspect: 435 / 720 }, cat: { h: 1.25, aspect: 473 / 720 }, knight: { h: 1.6, aspect: 445 / 720 },
  queen: { h: 1.8, aspect: 465 / 720 }, shadow: { h: 1.75, aspect: 472 / 720 },
};
// Each world lights its dolls differently: cold porcelain above the glass, ember below it.
const WORLD = [
  { rim: '#bcd6ff', rimPow: .55, ink: '#1b1020', glow: 0, ash: '#ffe9c4' },
  { rim: '#ff2a4d', rimPow: 1.15, ink: '#ff1d3a', glow: .55, ash: '#ff3b2f' },
];

const DEFORM = /* glsl */`
  attribute float _sway;
  uniform float uTime, uPhase, uSquash, uTwist, uBreath;
  uniform vec3 uLag; uniform vec2 uLean;
  vec3 deform(vec3 p, float grow) {
    float y = p.y;
    // breathing and a slow weight shift
    float chest = smoothstep(.25, .6, y) * (1. - smoothstep(.6, .8, y));
    p.xz *= 1. + chest * .022 * sin(uTime * 1.9 + uPhase) * uBreath;
    p.x += sin(uTime * 1.05 + uPhase) * .014 * y * y * uBreath;
    p.y += sin(uTime * 1.9 + uPhase) * .006 * smoothstep(.3, 1., y) * uBreath;
    // hair, skirts and ribbons: wind plus inertia, so they trail the body and overshoot when it stops
    float w = _sway;
    vec3 wind = vec3(sin(uTime * 2.3 + y * 7. + uPhase), 0., cos(uTime * 1.7 + y * 5. + uPhase * 1.3)) * .012;
    p += (wind * uBreath + uLag * (.35 + y * .9)) * w;
    p.y -= length(uLag.xz) * w * .25;
    // whole-body acting
    float a = uTwist * y, c = cos(a), s = sin(a); p.xz = mat2(c, -s, s, c) * p.xz;
    p.xz += uLean * y * y;
    p.y *= 1. - uSquash; p.xz *= 1. + uSquash * .55 * (1. - y * .5);
    return p;
  }`;
const VERT = /* glsl */`
  ${DEFORM}
  uniform float uInk;
  varying vec2 vUv; varying vec3 vN, vV, vP;
  void main() {
    vUv = uv; vP = position;
    vec3 p = deform(position, 0.);
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
    #ifdef INK
      // inverted hull, kept the same width on screen at any distance
      vec4 clip = projectionMatrix * mv; vec3 n = normalize(normalMatrix * normal);
      vec2 off = normalize((projectionMatrix * vec4(n, 0.)).xy + 1e-5);
      // thin strands get a hairline, solid forms the full stroke; pushed back so the line never crosses the face
      clip.xy += off * uInk * (1. - .75 * _sway) * clip.w; clip.z += .0015 * clip.w; gl_Position = clip;
    #else
      gl_Position = projectionMatrix * mv;
    #endif
  }`;
const FRAG = /* glsl */`
  uniform sampler2D map; uniform vec3 uRim, uInkColor, uTint, uAsh; uniform float uRimPow, uFlash, uDissolve, uGlow, uGrey, uTime;
  varying vec2 vUv; varying vec3 vN, vV, vP;
  float h(vec3 v){ return fract(sin(dot(v, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float n3(vec3 v){ vec3 i = floor(v), f = fract(v); f = f*f*(3.-2.*f);
    return mix(mix(mix(h(i), h(i+vec3(1,0,0)), f.x), mix(h(i+vec3(0,1,0)), h(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(h(i+vec3(0,0,1)), h(i+vec3(1,0,1)), f.x), mix(h(i+vec3(0,1,1)), h(i+vec3(1,1,1)), f.x), f.y), f.z); }
  void main() {
    // burn away from the feet up, in flakes
    float burn = n3(vP * 14.) * .6 + n3(vP * 41.) * .25 + (1. - vP.y) * .15;
    float edge = burn - uDissolve * 1.15;
    if (uDissolve > 0. && edge < 0.) discard;
    #ifdef INK
      vec3 col = uInkColor * (1. + uGlow);
    #else
      vec3 col = texture2D(map, vUv).rgb;
      vec3 n = normalize(gl_FrontFacing ? vN : -vN);
      // two-tone cel shade from a key light over the camera's shoulder
      float lit = smoothstep(-.05, .12, dot(n, normalize(vec3(.35, .75, .6))));
      col *= mix(vec3(.74, .7, .86), vec3(1.), lit);
      float grey = dot(col, vec3(.3, .6, .1)); col = mix(col, vec3(grey), uGrey) * uTint;
      float fr = pow(1. - clamp(dot(n, vV), 0., 1.), 2.6);
      col += uRim * fr * uRimPow * smoothstep(-.2, .5, n.y + .35);
    #endif
    col = mix(col, vec3(1.6), uFlash);
    if (uDissolve > 0.) col += uAsh * 3. * (1. - smoothstep(0., .07, edge));
    gl_FragColor = vec4(col, 1.);
    #include <colorspace_fragment>
  }`;

const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
// ?flat=all or ?flat=cat,queen keeps the named figures as their illustrations, to compare the two side by side.
const FLAT = new Set((new URLSearchParams(globalThis.location?.search || '').get('flat') || '').split(','));
const fetchModel = (name) => {
  if (!cache.has(name)) cache.set(name, gltf.loadAsync(`./models/${name}.glb`).then((g) => {
    let mesh = null; g.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
    // The files are quantised; bake the node transform back into plain floats so the shader sees unit-height figures.
    g.scene.updateMatrixWorld(true);
    const geometry = mesh.geometry, q = geometry.attributes.position, pos = new Float32Array(q.count * 3), v = new T.Vector3();
    for (let i = 0; i < q.count; i++) v.fromBufferAttribute(q, i).applyMatrix4(mesh.matrixWorld).toArray(pos, i * 3);
    geometry.setAttribute('position', new T.BufferAttribute(pos, 3));
    const map = mesh.material.map; map.anisotropy = 4;
    return { geometry, map };
  }));
  return cache.get(name);
};
export const preload = (names) => Promise.all(names.map((n) => fetchModel(n).catch(() => null)));

export function createCharacters({ world, shadow, placeholder, through }) {
  const live = new Set();
  const tmp = new T.Vector3(), prev = new T.Vector3(), quat = new T.Quaternion();

  function spawn(name, face) {
    const cast = CAST[name], look = WORLD[face], g = new T.Group(), inner = new T.Group(), rig = new T.Group();
    const stand = placeholder(name, cast.h, cast.aspect);
    const shade = shadow(face); shade.position.y = .004;
    rig.add(stand); inner.add(rig, shade); if (face) inner.rotation.z = Math.PI; g.add(inner); world.add(g);
    const u = {
      map: { value: null }, uTime: { value: 0 }, uPhase: { value: Math.random() * 6.283 }, uSquash: { value: 0 }, uTwist: { value: 0 }, uBreath: { value: 1 },
      uLag: { value: new T.Vector3() }, uLean: { value: new T.Vector2() }, uInk: { value: .0022 },
      uRim: { value: new T.Color(look.rim) }, uRimPow: { value: look.rimPow }, uInkColor: { value: new T.Color(look.ink) }, uGlow: { value: look.glow },
      uTint: { value: new T.Color('#ffffff') }, uAsh: { value: new T.Color(look.ash) }, uFlash: { value: 0 }, uDissolve: { value: 0 }, uGrey: { value: 0 },
    };
    // `pose` is what the stage animates; `update` turns it into bones-free acting every frame.
    const pose = { lift: 0, squash: 0, twist: 0, lean: new T.Vector2(), yaw: 0, fall: 0, flash: 0, dissolve: 0, grey: 0, still: false, spin: 0 };
    const c = { g, inner, rig, stand, shade, here: stand.material, far: null, body: null, ink: null, u, pose, face, name, h: cast.h, model: null, lag: new T.Vector3(), vel: new T.Vector3(), last: null, gone: false, near: true };
    g.userData = { inner, h: cast.h, pose, face, char: c };
    live.add(c);
    if (FLAT.has(name) || FLAT.has('all')) return g;
    fetchModel(name).then(({ geometry, map }) => {
      if (c.gone) return;
      u.map.value = map;
      const body = new T.Mesh(geometry, new T.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, side: T.DoubleSide }));
      const ink = new T.Mesh(geometry, new T.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, side: T.BackSide, defines: { INK: 1 } }));
      body.frustumCulled = ink.frustumCulled = false; ink.userData.ink = true;
      const model = new T.Group(); model.add(body, ink); model.scale.setScalar(cast.h);
      rig.remove(stand); c.here.dispose(); c.far?.dispose(); rig.add(model); Object.assign(c, { model, stand: null, body, ink, here: body.material, far: null }); setNear(g, c.near);
    }).catch(() => {});
    return g;
  }

  // Figures of the far world are drawn over the glass with its see-through material; their ground shadow is hidden.
  function setNear(g, near) {
    const c = g.userData.char, body = c.stand || c.body; c.near = near; c.shade.visible = near;
    if (!near && !c.far) { c.far = through(body.material.map || c.u.map.value); c.far.uniforms.tint.value.copy(c.u.uTint.value); if (c.body) { c.far.side = T.FrontSide; c.far.depthWrite = true; } }
    body.material = near ? c.here : c.far; body.renderOrder = near ? 0 : -2.5;
    if (c.ink) c.ink.visible = near;
  }
  function remove(g) { const c = g.userData.char; if (!c) return; c.gone = true; live.delete(c); world.remove(g); c.g.traverse((o) => { if (o.material) o.material.dispose(); }); c.here.dispose(); c.far?.dispose(); }

  // Springs give every figure follow-through: the body arrives first, the hair and skirt catch up.
  function update(t, dt) {
    for (const c of live) {
      const { u, pose, g } = c;
      c.rig.getWorldPosition(tmp);
      if (!c.last) c.last = tmp.clone();
      prev.copy(tmp).sub(c.last).divideScalar(Math.max(dt, 1e-3)); c.last.copy(tmp);
      // lag opposes velocity, expressed in the model's own frame so it stays right under the glass too
      const target = prev.applyQuaternion(c.rig.getWorldQuaternion(quat).invert()).multiplyScalar(-.035).clampLength(0, .16);
      c.vel.addScaledVector(target.sub(c.lag), 90 * dt).multiplyScalar(Math.exp(-7 * dt)); c.lag.addScaledVector(c.vel, dt);
      u.uLag.value.copy(c.lag).divideScalar(c.h);
      u.uTime.value = t; u.uSquash.value = pose.squash; u.uTwist.value = pose.twist; u.uLean.value.set(pose.lean.x * (c.face ? -1 : 1), pose.lean.y);
      u.uFlash.value = pose.flash; u.uDissolve.value = pose.dissolve; u.uGrey.value = pose.grey; u.uBreath.value = pose.still ? 0 : 1;
      // lift is away from the glass: up in Wonderland, down beneath it
      c.inner.position.y = pose.lift * (c.face ? -1 : 1);
      c.rig.rotation.set(-pose.fall * 1.45, pose.yaw + pose.spin, 0); c.rig.position.set(0, pose.fall * .16, pose.fall * .3);
      if (c.stand) c.stand.position.y = c.h / 2 - .03 + Math.sin(t * 1.6 + u.uPhase.value) * .018;
      c.shade.scale.setScalar(.95 * (1 - Math.min(.5, pose.lift * .5)) * (1 - pose.dissolve));
    }
  }
  return { spawn, remove, update, setNear };
}
