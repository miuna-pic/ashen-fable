// Characters: each figure is its illustration pressed into a relief. A depth map sculpted from the same drawing
// pushes the body out of the card, so it catches rim light and turns with real parallax, while the line art stays
// exactly as drawn. A second channel says which parts swing (hair, ribbons, hems); everything else is procedural acting.
import * as T from 'three';

// Board height of each figure, how wide its illustration is, and how deep its relief is (in figure heights).
const CAST = {
  alice_a: { h: 1.3, aspect: 433 / 720, depth: .22 }, alice_b: { h: 1.3, aspect: 460 / 720, depth: .24 },
  soldier: { h: 1.3, aspect: 368 / 720, depth: .3 }, hollow: { h: 1.3, aspect: 341 / 720, depth: .27 },
  rook: { h: 1.55, aspect: 435 / 720, depth: .32 }, cat: { h: 1.25, aspect: 473 / 720, depth: .38 }, knight: { h: 1.6, aspect: 445 / 720, depth: .26 },
  queen: { h: 1.8, aspect: 465 / 720, depth: .33 }, shadow: { h: 1.75, aspect: 472 / 720, depth: .33 },
};
// Each world lights its dolls differently: cold porcelain above the glass, ember below it.
const WORLD = [
  { rim: '#bcd6ff', rimPow: .5, ash: '#ffe9c4' },
  { rim: '#ff2a4d', rimPow: .6, ash: '#ff3b2f' },
];

const POSE = /* glsl */`
  uniform sampler2D relief; uniform float uTime, uPhase, uSquash, uTwist, uBreath, uDepth, uAspect;
  uniform vec3 uLag; uniform vec2 uLean;
  vec3 posed(out vec3 rest) {
    vec4 r = texture2D(relief, uv);
    float y = uv.y, w = r.g * smoothstep(0., .08, y);
    vec3 p = vec3((uv.x - .5) * uAspect, y, (r.r - .5) * uDepth);
    rest = p;
    // breathing and a slow weight shift
    float chest = smoothstep(.25, .6, y) * (1. - smoothstep(.6, .8, y));
    p.x *= 1. + chest * .045 * sin(uTime * 1.9 + uPhase) * uBreath;
    p.x += sin(uTime * 1.05 + uPhase) * .022 * y * y * uBreath;
    p.y += sin(uTime * 1.9 + uPhase) * .014 * smoothstep(.3, 1., y) * uBreath;
    // hair, skirts and ribbons: wind plus inertia, so they trail the body and overshoot when it stops
    vec3 wind = vec3(sin(uTime * 2.3 + y * 7. + uPhase), 0., cos(uTime * 1.7 + y * 5. + uPhase * 1.3)) * .034;
    p += (wind * uBreath + uLag * (.35 + y * .9)) * w;
    p.y -= length(uLag.xz) * w * .25;
    // whole-body acting
    float a = uTwist * y, c = cos(a), s = sin(a); p.xz = mat2(c, -s, s, c) * p.xz;
    p.xz += uLean * y * y;
    p.y *= 1. - uSquash; p.xz *= 1. + uSquash * .55 * (1. - y * .5);
    return p;
  }`;
const VERT = /* glsl */`${POSE}
  varying vec2 vUv; varying vec3 vV, vP; varying mat3 vNM;
  void main() {
    vUv = uv; vNM = normalMatrix; vec3 p = posed(vP);
    vec4 mv = modelViewMatrix * vec4(p, 1.); vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
// The same acting for a figure seen through the glass, feeding the board's see-through material.
const VERT_FAR = /* glsl */`${POSE}
  varying vec3 wp, wn; varying vec2 vuv;
  void main() { vuv = uv; vec3 rest; vec4 p = modelMatrix * vec4(posed(rest), 1.); wp = p.xyz; wn = normalize(mat3(modelMatrix) * vec3(0., 0., 1.)); gl_Position = projectionMatrix * viewMatrix * p; }`;

const FRAG = /* glsl */`
  uniform sampler2D map, relief; uniform vec3 uRim, uTint, uAsh; uniform float uRimPow, uFlash, uDissolve, uGrey, uDepth, uAspect; uniform vec2 uTexel;
  varying vec2 vUv; varying vec3 vV, vP; varying mat3 vNM;
  float h(vec3 v){ return fract(sin(dot(v, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float n3(vec3 v){ vec3 i = floor(v), f = fract(v); f = f*f*(3.-2.*f);
    return mix(mix(mix(h(i), h(i+vec3(1,0,0)), f.x), mix(h(i+vec3(0,1,0)), h(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(h(i+vec3(0,0,1)), h(i+vec3(1,0,1)), f.x), mix(h(i+vec3(0,1,1)), h(i+vec3(1,1,1)), f.x), f.y), f.z); }
  void main() {
    vec4 c = texture2D(map, vUv);
    if (c.a < .35) discard;
    // burn away from the feet up, in flakes
    float burn = n3(vP * 14.) * .6 + n3(vP * 41.) * .25 + (1. - vP.y) * .15;
    float edge = burn - uDissolve * 1.15;
    if (uDissolve > 0. && edge < 0.) discard;
    vec3 col = c.rgb;
    // the relief's own slope, in view space, lights the edges of each form
    float dx = texture2D(relief, vUv + vec2(uTexel.x, 0.)).r - texture2D(relief, vUv - vec2(uTexel.x, 0.)).r;
    float dy = texture2D(relief, vUv + vec2(0., uTexel.y)).r - texture2D(relief, vUv - vec2(0., uTexel.y)).r;
    vec3 n = normalize(vec3(-dx * uDepth / (2. * uTexel.x * uAspect), -dy * uDepth / (2. * uTexel.y), 1.));
    n = normalize(vNM * (gl_FrontFacing ? n : -n));
    float lit = smoothstep(-.35, .25, dot(n, normalize(vec3(.3, .8, .5))));
    col *= mix(vec3(.86, .83, .93), vec3(1.), lit);
    float grey = dot(col, vec3(.3, .6, .1)); col = mix(col, vec3(grey), uGrey) * uTint;
    float fr = pow(1. - clamp(dot(n, vV), 0., 1.), 2.2), silhouette = 1. - smoothstep(.35, .95, c.a);
    col += uRim * (fr * .8 + silhouette * .25) * uRimPow * smoothstep(-.3, .5, n.y + .35);
    col = mix(col, vec3(1.6), uFlash);
    if (uDissolve > 0.) col += uAsh * 3. * (1. - smoothstep(0., .07, edge));
    gl_FragColor = vec4(col, 1.);
    #include <colorspace_fragment>
  }`;

const loader = new T.TextureLoader(), cache = new Map();
// ?flat=all or ?flat=cat,queen keeps the named figures as plain cards, to compare the two side by side.
const FLAT = new Set((new URLSearchParams(globalThis.location?.search || '').get('flat') || '').split(','));
const fetchRelief = (name) => {
  if (!cache.has(name)) cache.set(name, loader.loadAsync(`./models/${name}.png`).then((t) => { t.colorSpace = T.NoColorSpace; t.generateMipmaps = false; t.minFilter = T.LinearFilter; return t; }));
  return cache.get(name);
};
export const preload = (names) => Promise.all(names.map((n) => fetchRelief(n).catch(() => null)));
// One sheet for every figure: its vertices are placed by the shader from the uv alone.
const SHEET = new T.PlaneGeometry(1, 1, 56, 96); SHEET.translate(0, .5, 0);

export function createCharacters({ world, shadow, placeholder, through }) {
  const live = new Set();
  const tmp = new T.Vector3(), prev = new T.Vector3(), quat = new T.Quaternion();

  function spawn(name, face) {
    const cast = CAST[name], look = WORLD[face], g = new T.Group(), inner = new T.Group(), rig = new T.Group();
    const stand = placeholder(name, cast.h, cast.aspect);
    const shade = shadow(face); shade.position.y = .004;
    rig.add(stand); inner.add(rig, shade); if (face) inner.rotation.z = Math.PI; g.add(inner); world.add(g);
    const u = {
      map: { value: stand.material.map }, relief: { value: null }, uTexel: { value: new T.Vector2() }, uDepth: { value: cast.depth * .8 }, uAspect: { value: cast.aspect },
      uTime: { value: 0 }, uPhase: { value: Math.random() * 6.283 }, uSquash: { value: 0 }, uTwist: { value: 0 }, uBreath: { value: 1 },
      uLag: { value: new T.Vector3() }, uLean: { value: new T.Vector2() }, uRim: { value: new T.Color(look.rim) }, uRimPow: { value: look.rimPow },
      uTint: { value: new T.Color('#ffffff') }, uAsh: { value: new T.Color(look.ash) }, uFlash: { value: 0 }, uDissolve: { value: 0 }, uGrey: { value: 0 },
    };
    // `pose` is what the stage animates; `update` turns it into bones-free acting every frame.
    const pose = { lift: 0, squash: 0, twist: 0, lean: new T.Vector2(), yaw: 0, fall: 0, flash: 0, dissolve: 0, grey: 0, still: false, spin: 0 };
    const c = { g, inner, rig, stand, shade, here: stand.material, far: null, body: null, u, pose, face, name, h: cast.h, model: null, lag: new T.Vector3(), vel: new T.Vector3(), last: null, gone: false, near: true };
    g.userData = { inner, h: cast.h, pose, face, char: c };
    live.add(c);
    if (FLAT.has(name) || FLAT.has('all')) return g;
    fetchRelief(name).then((relief) => {
      if (c.gone) return;
      u.relief.value = relief; u.uTexel.value.set(1 / relief.image.width, 1 / relief.image.height);
      const body = new T.Mesh(SHEET, new T.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, side: T.DoubleSide }));
      body.frustumCulled = false;
      const model = new T.Group(); model.add(body); model.scale.setScalar(cast.h); model.position.y = -.03; model.rotation.x = -.16;
      rig.remove(stand); c.here.dispose(); c.far?.dispose(); rig.add(model); Object.assign(c, { model, stand: null, body, here: body.material, far: null }); setNear(g, c.near);
    }).catch(() => {});
    return g;
  }

  // Figures of the far world are drawn over the glass with its see-through material; their ground shadow is hidden.
  function setNear(g, near) {
    const c = g.userData.char, body = c.stand || c.body; c.near = near; c.shade.visible = near;
    if (!near && !c.far) { c.far = through(body.material.map || c.u.map.value); c.far.uniforms.tint.value.copy(c.u.uTint.value); if (c.body) { Object.assign(c.far.uniforms, c.u); c.far.vertexShader = VERT_FAR; } }
    body.material = near ? c.here : c.far; body.renderOrder = near ? 0 : -2.5;
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
      // a relief has no back: a spin is a swing from side to side, never edge-on
      c.rig.rotation.set(-pose.fall * 1.45, pose.yaw + Math.sin(pose.spin) * .7, 0); c.rig.position.set(0, pose.fall * .16, pose.fall * .3);
      if (c.stand) c.stand.position.y = c.h / 2 - .03 + Math.sin(t * 1.6 + u.uPhase.value) * .018;
      c.shade.scale.setScalar(.95 * (1 - Math.min(.5, pose.lift * .5)) * (1 - pose.dissolve));
    }
  }
  return { spawn, remove, update, setNear };
}
