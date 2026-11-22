// Everything that is not a piece: the two painted skies, the reflecting sea, the glass board and its frame,
// and the things that drift through each world. Local +y is the surface world, local -y is the mirror world.
import * as T from 'three';
import { W, H, X, Y } from './rules.js';

const loader = new T.TextureLoader();
const paint = (name) => {
  const t = loader.load(`./art/${name}.webp`);
  t.colorSpace = T.SRGBColorSpace; t.wrapS = T.MirroredRepeatWrapping; t.wrapT = T.ClampToEdgeWrapping; t.anisotropy = 4;
  return t;
};

// Shared by every shader here: where the camera is, how the universe is rotated, and the two skies.
export const U = {
  skyA: { value: null }, skyB: { value: null }, inv: { value: new T.Matrix3() }, time: { value: 0 },
  face: { value: 0 }, // 0 surface .. 1 mirror, eased
};

// env(d): the painted sky in local direction d. Azimuth 0 looks at the castle; the painting spans AZ radians.
const ENV = /* glsl */`
  uniform sampler2D skyA, skyB; uniform mat3 inv; uniform float time, face;
  const float AZ = 1.1, EL = .693, R = 26.;
  vec3 env(vec3 d, float blur){
    float m = step(d.y, 0.), x = mix(d.x, -d.x, m), e = atan(abs(d.y), length(vec2(x, d.z)));
    vec2 uv = vec2(.5 + atan(x, -d.z) / AZ, min(e / EL, .995));
    vec3 a = texture2D(skyA, uv, blur).rgb, b = texture2D(skyB, uv, blur).rgb;
    float top = smoothstep(.8, 1.3, e / EL);
    a = mix(a, vec3(.50, .58, .88), top); b = mix(b, vec3(.012, .004, .010), top);
    return mix(a, b, m);
  }
  vec3 env(vec3 d){ return env(d, 0.); }
  // what a ray leaving p in direction r sees: the sky is a painted shell of radius R, not infinitely far
  vec3 envAt(vec3 p, vec3 r, float blur){ float b = dot(p, r), c = dot(p, p) - R * R; return env(p + r * (-b + sqrt(max(b * b - c, 0.))), blur); }
  vec3 envAt(vec3 p, vec3 r){ return envAt(p, r, 0.); }
  float hash(vec2 v){ return fract(sin(dot(v, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 v){ vec2 i = floor(v), f = fract(v); f = f*f*(3.-2.*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
`;
const VERT = /* glsl */`
  varying vec3 wp, wn; varying vec2 vuv;
  void main(){ vuv = uv; vec4 p = modelMatrix * vec4(position, 1.); wp = p.xyz; wn = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * p; }
`;
const shader = (fragmentShader, uniforms = {}, extra = {}) => new T.ShaderMaterial({ uniforms: { ...U, ...uniforms }, vertexShader: VERT, fragmentShader: ENV + fragmentShader, toneMapped: false, ...extra });

const R = 26;
export function createScenery(world) {
  U.skyA.value = paint('sky_a'); U.skyB.value = paint('sky_b');
  const out = {};

  // Sky: one sphere, pastel above the glass and red-black beneath it.
  const sky = new T.Mesh(new T.SphereGeometry(R, 64, 40), new T.ShaderMaterial({
    uniforms: U, side: T.BackSide, depthWrite: false, toneMapped: false,
    vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: ENV + /* glsl */`varying vec3 p;
      void main(){ vec3 d = normalize(p); vec3 c = env(d);
        float e = abs(d.y), m = step(d.y, 0.);
        c = mix(c, mix(vec3(1., .96, .95), vec3(.42, .02, .05), m), exp(-e * 110.) * mix(.55, .6, m));
        gl_FragColor = vec4(c, 1.); }`,
  }));
  sky.renderOrder = -10; world.add(sky);

  // Sea: a still mirror that reflects its own sky, with a hole where the board sits.
  const SEA = /* glsl */`varying vec3 wp, wn; uniform float side;
    void main(){
      vec3 lp = inv * wp, lc = inv * cameraPosition; vec2 q = lp.xz;
      vec2 b = abs(q) - vec2(${(W / 2 + .12).toFixed(2)}, ${(H / 2 + .12).toFixed(2)});
      float sd = length(max(b, 0.)) + min(max(b.x, b.y), 0.);
      if (sd < 0.) discard;
      float dist = length(lp - lc), calm = 1. / (1. + dist * .12);
      vec2 r1 = vec2(sin(q.x * 1.7 + q.y * .6 + time * .5) + sin(q.x * 3.9 - q.y * 1.3 - time * .8) * .5,
                     sin(q.y * 1.9 - q.x * .5 + time * .4) + sin(q.y * 4.3 + q.x * 1.1 + time * .7) * .5);
      float ring = sin(sd * 5. - time * 1.1) * exp(-sd * .55);
      // long swells seen edge-on: they slice a reflection into horizontal bands instead of letting it hang like a curtain
      float far = smoothstep(4., 20., dist);
      float swell = (noise(vec2(q.x * .35 + time * .05, q.y * 2.6 - time * .22)) - .5) + (noise(vec2(q.x * .9 - time * .08, q.y * 7. + time * .3)) - .5) * .5;
      vec3 n = normalize(vec3(r1.x * .012 * calm, 1., r1.y * .012 * calm + ring * (side > 0. ? .02 : .005) + swell * mix(.02, .09, far) * (side > 0. ? 1. : .3)));
      n.y *= side;
      vec3 v = normalize(lp - lc), r = reflect(v, n);
      r.y = side * max(abs(r.y), .004);
      float f = pow(1. - clamp(dot(-v, n), 0., 1.), 3.);
      vec3 sky = envAt(lp, r, 1. + 3. * clamp(abs(r.y) * 2.2, 0., 1.));
      vec3 deep = side > 0. ? mix(vec3(.20, .30, .72), vec3(.42, .47, .86), far) : vec3(.016, .004, .010);
      vec3 col = side > 0. ? mix(deep, sky * vec3(.90, .92, 1.), clamp(.16 + 1.1 * f, 0., 1.)) : mix(deep, sky * .6, .3 + .7 * f);
      // sun glitter: short bright dashes riding the swells, thickest toward the castle
      float gl = noise(vec2(q.x * 1.6 + time * .2, q.y * 16. - time * .9)) * noise(vec2(q.x * 5. - time * .3, q.y * 3.));
      gl = smoothstep(.46, .58, gl) * smoothstep(1.2, 4., sd) * (.25 + .75 * smoothstep(.2, -1., v.x * v.x * 3. + v.z));
      col += vec3(1., .97, .92) * .55 * gl * step(0., side);
      // the board's own shade and a thin lit waterline around the frame
      col *= 1. - exp(-sd * 1.1) * (side > 0. ? .5 : .55);
      col += (side > 0. ? vec3(1., .95, .9) : vec3(1., .12, .16)) * exp(-sd * 9.) * .35;
      // dissolve into the horizon
      vec3 hz = env(normalize(vec3(v.x, side * .012, v.z)));
      col = mix(col, hz, smoothstep(R * .55, R * .985, length(q)));
      // a band of mist where water meets sky
      col = mix(col, side > 0. ? vec3(1., .95, .96) : vec3(.30, .01, .04), smoothstep(R * .7, R, length(q)) * (side > 0. ? .5 : .25));
      gl_FragColor = vec4(col, 1.);
    }`;
  for (const side of [1, -1]) {
    const sea = new T.Mesh(new T.CircleGeometry(R * 1.003, 128), shader(SEA, { side: { value: side } }));
    sea.rotation.x = -side * Math.PI / 2; sea.renderOrder = -9; world.add(sea);
  }

  // Board glass: one sheet per face. You see the other world, and whoever hangs in it, through the tiles.
  const cells = new Uint8Array(W * H * 4), cellTex = new T.DataTexture(cells, W, H, T.RGBAFormat);
  cellTex.magFilter = cellTex.minFilter = T.NearestFilter;
  const GLASS = /* glsl */`varying vec3 wp, wn; varying vec2 vuv; uniform float side; uniform sampler2D cells; uniform vec2 goal;
    float holeAt(vec2 c){ if (c.x < 0. || c.y < 0. || c.x >= ${W}. || c.y >= ${H}.) return 0.; return texture2D(cells, (c + .5) / vec2(${W}., ${H}.)).r; }
    void main(){
      vec3 lp = inv * wp, lc = inv * cameraPosition;
      vec2 g = vec2(lp.x + ${W / 2}., lp.z + ${H / 2}.), c = floor(g), f = fract(g) - .5;
      float chk = mod(c.x + c.y, 2.);
      // jagged holes: distance to the nearest missing tile, roughened
      float hole = -1.;
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 o = vec2(float(i), float(j)); if (holeAt(c + o) < .5) continue;
        vec2 d = abs(f - o) - .5; float sd = length(max(d, 0.)) + min(max(d.x, d.y), 0.);
        hole = max(hole, -sd);
      }
      // the break is cut in straight shards, not eaten away: two crossed sawtooths give it facets
      float zig = abs(fract((g.x + g.y) * 2.5 + .2) - .5) + abs(fract((g.x - g.y) * 1.7 + .6) - .5);
      float inside = hole + (zig - .5) * .11 - .02;
      if (inside > 0.) {
        // a well into the other world: the cut face of the glass, then the far sky pooling below
        float aw = fwidth(inside), face = 1. - smoothstep(.045, .045 + aw, inside), lip = 1. - smoothstep(.0, aw * 1.5, inside - .045);
        float depth = smoothstep(.05, .5, inside), swirl = noise(g * 3. + vec2(time * .12, -time * .07));
        vec3 cutA = mix(vec3(.62, .80, 1.), vec3(.20, .30, .72), smoothstep(0., .045, inside));        // surface: pale blue glass edge
        vec3 cutB = mix(vec3(1., .30, .34), vec3(.30, .02, .07), smoothstep(0., .045, inside));        // mirror: ember edge
        vec3 wellA = mix(vec3(.16, .05, .22), vec3(.05, .0, .04), depth) + vec3(.55, .04, .12) * swirl * depth * .5;   // looking down: dusk, then the red of the mirror
        vec3 wellB = mix(vec3(.50, .56, .92), vec3(.96, .90, .98), depth) * (.75 + .25 * swirl);                        // looking up: daylight
        vec3 well = side > 0. ? wellA : wellB, cutc = side > 0. ? cutA : cutB;
        vec3 colh = mix(well, cutc, face) + (side > 0. ? vec3(.5, .6, 1.) : vec3(1., .25, .3)) * lip * .35;
        gl_FragColor = vec4(colh, 1.); return;
      }
      float rimHole = smoothstep(-.035, 0., inside);

      float edge = max(abs(f.x), abs(f.y)), aa = fwidth(g.x) + fwidth(g.y);
      float line = smoothstep(.5 - .018 - aa, .5 - .018, edge);
      float bevel = smoothstep(.36, .5, edge);
      vec2 k = abs(fract(g + .5) - .5); float stud = 1. - smoothstep(.075, .075 + aa, k.x + k.y);
      float inner = abs(edge - .40); float inlay = (1. - smoothstep(.004, .004 + aa * .7, inner)) * .5;

      vec3 n = normalize(vec3(f.x * bevel * .5, side, f.y * bevel * .5) + vec3(noise(g * 2.3) - .5, 0., noise(g * 2.3 + 7.) - .5) * .03);
      vec3 v = normalize(lp - lc), r = reflect(v, n); r.y = side * max(abs(r.y), .02);
      float fr = pow(1. - clamp(dot(-v, n), 0., 1.), 3.);
      vec3 sky = envAt(lp, r, 2.);
      float vein = smoothstep(.55, .9, noise(g * vec2(3., 5.) + noise(g * 1.7) * 3.));
      vec3 col; float a;
      if (side > 0.) {
        vec3 base = mix(vec3(.985, .955, .965), vec3(.50, .63, .93), chk);
        base = mix(base, base * vec3(.90, .92, 1.02), vein * .5);
        col = mix(base, sky, .16 + .5 * fr); a = mix(.90, .84, chk);
        col = mix(col, vec3(.99, .80, .42), max(max(line, stud), inlay * .7));
        a = mix(a, 1., max(line, stud));
        col = mix(col, vec3(.99, .82, .45), rimHole);   // a gilt lip where the glass broke
      } else {
        vec3 base = mix(vec3(.20, .012, .035), vec3(.028, .014, .03), chk);
        base = mix(base, base * 1.5 + vec3(.05, 0., .01), vein * .5);
        col = mix(base, sky * 1.2, .08 + .5 * fr); a = mix(.95, .90, chk);
        col = mix(col, vec3(.95, .12, .18), max(line, stud) * .9 + inlay * .45);
        a = mix(a, 1., max(line, stud));
        col = mix(col, vec3(1., .22, .24), rimHole);
      }
      col *= 1. - bevel * .10;
      float gl = step(abs(c.x - goal.x) + abs(c.y - goal.y), .1) * (1. - smoothstep(.1, .5, edge) * .6) * (.55 + .45 * sin(time * 3.));
      col += (side > 0. ? vec3(1., .78, .3) : vec3(1., .62, .3)) * gl * .45;
      gl_FragColor = vec4(col, a);
    }`;
  const glass = [1, -1].map((side) => {
    const m = new T.Mesh(new T.PlaneGeometry(W, H), shader(GLASS, { side: { value: side }, cells: { value: cellTex }, goal: { value: new T.Vector2(-9, -9) } }, { transparent: true, depthWrite: false }));
    m.rotation.x = -side * Math.PI / 2; m.position.y = side * .002; m.renderOrder = -3; world.add(m); return m;
  });
  out.setBoard = (st) => {
    for (let s = 0; s < W * H; s++) cells[s * 4] = st.holes.has(s) ? 255 : 0;
    cellTex.needsUpdate = true;
    glass.forEach((m) => m.material.uniforms.goal.value.set(X(st.goal), Y(st.goal)));
  };

  // Whoever stands in the far world, seen through the glass: washed toward that world's colour, dimmed along the
  // tile seams, and clear through a hole.
  const THROUGH = /* glsl */`varying vec3 wp; varying vec2 vuv; uniform sampler2D map, cells; uniform vec3 tint;
    void main(){
      vec3 lp = inv * wp, lc = inv * cameraPosition;
      vec3 hit = lc + (lp - lc) * (lc.y / (lc.y - lp.y));
      vec2 g = hit.xz + vec2(${W / 2}., ${H / 2}.);
      if (g.x < 0. || g.y < 0. || g.x > ${W}. || g.y > ${H}.) discard;
      vec4 c = texture2D(map, vuv + vec2(sin(vuv.y * 26. + time * 1.6) * .005, 0.));
      if (c.a < .35) discard;
      c.rgb *= tint;
      float lum = dot(c.rgb, vec3(.3, .6, .1)), hole = texture2D(cells, (floor(g) + .5) / vec2(${W}., ${H}.)).r;
      vec2 f = abs(fract(g) - .5); float seam = smoothstep(.43, .5, max(f.x, f.y));
      // from the surface the mirror folk are dark shapes under ice; from the mirror the surface folk are pale lights overhead
      vec3 under = mix(c.rgb, vec3(.34, .03, .14) * (.35 + lum), .5), over = mix(c.rgb, vec3(1.05, .93, .98) * (.55 + .6 * lum), .5) * 1.15;
      vec3 col = lc.y > 0. ? under : over; float a = lc.y > 0. ? .78 : .74;
      col = mix(col, c.rgb, hole); a = mix(a * (1. - seam * .55), 1., hole);
      gl_FragColor = vec4(col, a);
    }`;
  out.through = (map) => shader(THROUGH, { map: { value: map }, cells: { value: cellTex }, tint: { value: new T.Color(1, 1, 1) } }, { transparent: true, depthWrite: false, side: T.DoubleSide });

  // Frame: gilt above the glass, thorned iron beneath it. One object, two skins.
  const METAL = /* glsl */`varying vec3 wp, wn; uniform float glow, gilt;
    void main(){
      vec3 lp = inv * wp, n = normalize(inv * wn), v = normalize(lp - inv * cameraPosition);
      float m = smoothstep(.01, -.01, lp.y);
      vec3 r = reflect(v, n); r.y = mix(max(abs(r.y), .05), -max(abs(r.y), .05), m);
      vec3 sky = envAt(lp, r);
      float up = mix(n.y, -n.y, m), fr = pow(1. - clamp(dot(-v, n), 0., 1.), 2.5);
      float key = clamp(dot(n, normalize(vec3(-.35, mix(.8, -.8, m), .5))), 0., 1.);
      // engraving: a running diamond band along each rail
      vec2 q = abs(lp.xz) - vec2(${W / 2}., ${H / 2}.); float along = q.x > q.y ? lp.z : lp.x, across = max(q.x, q.y);
      float band = abs(fract(along * 2.) - .5) + abs((across - .28) * 3.2);
      float cut = (1. - smoothstep(.20, .23, band)) * smoothstep(.10, .13, band) + (1. - smoothstep(.0, .012, abs(across - .13))) + (1. - smoothstep(.0, .012, abs(across - .43)));
      cut *= step(.9, abs(n.y)) * step(.06, across) * (1. - gilt);
      vec3 goldc = vec3(.93, .62, .25) * (.25 + .6 * key + .2 * up) + sky * vec3(1., .8, .5) * (.15 + .6 * fr) + pow(key, 24.) * .8;
      vec3 porc = vec3(.045, .07, .26) * (.55 + .6 * key + .2 * up) + sky * (.02 + .3 * fr) + pow(key, 30.) * .5;   // sapphire enamel
      vec3 gold = mix(mix(porc, goldc, clamp(cut, 0., 1.)), goldc, gilt);
      vec3 emberc = vec3(1., .10, .14) * (.55 + .45 * sin(time * 1.3 + along * 1.7));
      vec3 obs = vec3(.035, .014, .022) * (.6 + key) + sky * vec3(1., .45, .45) * (.08 + .8 * fr) + vec3(1., .1, .14) * pow(key, 16.) * .5;
      vec3 iron = mix(obs + emberc * clamp(cut, 0., 1.) * .9, vec3(.16, .02, .04) * (.5 + key) + sky * vec3(1., .3, .3) * (.2 + fr), gilt);
      gl_FragColor = vec4(mix(gold, iron, m) + glow * mix(vec3(1., .8, .5), vec3(1., .1, .15), m), 1.);
    }`;
  const metal = shader(METAL, { glow: { value: 0 }, gilt: { value: 0 } }), trim = shader(METAL, { glow: { value: 0 }, gilt: { value: 1 } });
  const ring = (ox, oz, ix, iz, depth, bevel, rad) => {
    const s = new T.Shape(), box = (p, x, z, r) => { p.moveTo(-x + r, -z); p.lineTo(x - r, -z); p.quadraticCurveTo(x, -z, x, -z + r); p.lineTo(x, z - r); p.quadraticCurveTo(x, z, x - r, z); p.lineTo(-x + r, z); p.quadraticCurveTo(-x, z, -x, z - r); p.lineTo(-x, -z + r); p.quadraticCurveTo(-x, -z, -x + r, -z); };
    box(s, ox, oz, rad); const h = new T.Path(); box(h, ix, iz, .02); s.holes.push(h);
    const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6 });
    g.translate(0, 0, -depth / 2); g.rotateX(Math.PI / 2); return g;
  };
  // Two frames: the full one, and a slim one for windows where every pixel beside the squares is spoken for.
  const buildFrame = (o, t0, t1, fin, sc) => {
  const frame = new T.Group(); world.add(frame);
  frame.add(new T.Mesh(ring(W / 2 + o, H / 2 + o, W / 2 + .1, H / 2 + .1, .1, .05, .16), metal));
  frame.add(new T.Mesh(ring(W / 2 + t1, H / 2 + t1, W / 2 + t0, H / 2 + t0, .02, .025, .22), trim));
  const prof = [[0, 0], [.17, 0], [.19, .04], [.12, .08], [.08, .13], [.14, .19], [.15, .25], [.09, .31], [.05, .36], [.1, .42], [.1, .47], [0, .54]].map(([x, y]) => new T.Vector2(x, y));
  const finial = new T.LatheGeometry(prof, 20), thorn = new T.ConeGeometry(.13, .9, 5).translate(0, -.45, 0);
  const gemA = new T.MeshBasicMaterial({ color: '#bfe0ff', toneMapped: false }), gemB = new T.MeshBasicMaterial({ color: '#ff2038', toneMapped: false });
  const gem = new T.OctahedronGeometry(.085);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (W / 2 + fin), z = sz * (H / 2 + fin);
    const a = new T.Mesh(finial, trim); a.position.set(x, .09, z); a.scale.setScalar(sc); frame.add(a);
    for (let i = 0; i < 3; i++) { const b = new T.Mesh(thorn, metal); b.position.set(x + sx * i * .05, -.08, z + sz * i * .05); b.rotation.set(sz * i * .5, i * 1.3, -sx * i * .5); b.scale.setScalar(1 - i * .22); frame.add(b); }
    const ga = new T.Mesh(gem, gemA); ga.position.set(x, .09 + .61 * sc, z); const gb = new T.Mesh(gem, gemB); gb.position.set(x, -1.02, z); frame.add(ga, gb);
  }
  for (let i = 0; i < W + H; i++) for (const s of [-1, 1]) {   // a stud beside every tile line
    const along = i < W, k = along ? i - W / 2 + .5 : i - W - H / 2 + .5;
    const m = new T.Mesh(gem, gemA), n = new T.Mesh(gem, gemB);
    const x = along ? k : s * (W / 2 + fin), z = along ? s * (H / 2 + fin) : k;
    m.position.set(x, .105, z); n.position.set(x, -.105, z); m.scale.set(.6, .35, .6); n.scale.set(.6, .35, .6); frame.add(m, n);
  }
  return frame; };
  const frames = [buildFrame(.46, .5, .62, .3, 1), buildFrame(.26, .29, .36, .18, .7)]; frames[1].visible = false;
  out.setSlim = (on) => { frames[0].visible = !on; frames[1].visible = on; };
  out.metal = metal;

  // A clock the size of a moon, half sunk in the horizon: gold dust above the glass, an open wound beneath it.
  const CLOCK = /* glsl */`varying vec3 wp;
    void main(){ vec3 lp = inv * wp; float m = step(lp.y, 0.), h = abs(lp.y);
      vec3 c = mix(vec3(1., .93, .8), vec3(1., .08, .12), m); float a = mix(.34, .8, m) * smoothstep(0., 3., h);
      gl_FragColor = vec4(c * a, a); }`;
  const clockMat = shader(CLOCK, {}, { transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
  const clock = new T.Group(); clock.position.set(0, 0, -(R - .6)); clock.scale.setScalar(R / 84); world.add(clock);
  clock.add(new T.Mesh(new T.RingGeometry(25.6, 26, 128), clockMat), new T.Mesh(new T.RingGeometry(23.2, 23.3, 128), clockMat), new T.Mesh(new T.RingGeometry(27.2, 27.26, 128), clockMat));
  for (let i = 0; i < 60; i++) { const big = i % 5 === 0, m = new T.Mesh(new T.PlaneGeometry(big ? .3 : .08, big ? 2.2 : .9), clockMat), a = i / 60 * Math.PI * 2; m.position.set(Math.sin(a) * 24.5, Math.cos(a) * 24.5, 0); m.rotation.z = -a; clock.add(m); }
  const hands = [[15, .34], [22, .2]].map(([l, w]) => { const m = new T.Mesh(new T.PlaneGeometry(w, l).translate(0, l / 2 - 1.5, 0), clockMat); clock.add(m); return m; });
  clock.traverse((o) => { o.renderOrder = -8; });

  // Drifting things. Cards and petals above; torn cards and embers below. Cards orbit behind the board, never between it and the camera.
  const card = (ink, paper, back) => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 180; const g = c.getContext('2d');
    g.fillStyle = paper; g.beginPath(); g.roundRect(3, 3, 122, 174, 12); g.fill(); g.strokeStyle = ink; g.lineWidth = 2; g.beginPath(); g.roundRect(10, 10, 108, 160, 8); g.stroke();
    const heart = (x, y, r) => { g.save(); g.translate(x, y); g.beginPath(); g.moveTo(0, r * .9); g.bezierCurveTo(-r * 1.5, -r * .2, -r * .6, -r * 1.2, 0, -r * .4); g.bezierCurveTo(r * .6, -r * 1.2, r * 1.5, -r * .2, 0, r * .9); g.fill(); g.restore(); };
    g.fillStyle = ink;
    if (back) { g.globalAlpha = .55; for (let y = 22; y < 165; y += 12) for (let x = 20; x < 112; x += 12) { g.save(); g.translate(x, y); g.rotate(.785); g.fillRect(-3, -3, 6, 6); g.restore(); } g.globalAlpha = 1; }
    else { heart(64, 92, 30); heart(24, 30, 8); g.save(); g.translate(104, 150); g.rotate(Math.PI); heart(0, 0, 8); g.restore(); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  };
  const N = 30, seeds = Array.from({ length: N }, (_, i) => ({ a: i * 2.399, r: 9 + (i * 37 % 19), y: 1.2 + (i * 53 % 17) * .55, s: .55 + (i % 5) * .2, w: .2 + (i % 7) * .06, side: i % 2 ? -1 : 1 }));
  const cardGeo = new T.PlaneGeometry(.7, 1);
  const decks = [[1, card('#c0102c', '#fffaf6'), card('#b5173a', '#fff4f2', true)], [-1, card('#ff2a40', '#16060b'), card('#7a0d1c', '#0c0407', true)]].map(([side, front, back]) => {
    const mine = seeds.filter((s) => s.side === side), mk = (map, s) => { const m = new T.InstancedMesh(cardGeo, new T.MeshBasicMaterial({ map, transparent: true, alphaTest: .5, side: s, toneMapped: false }), mine.length); m.frustumCulled = false; world.add(m); return m; };
    return { side, mine, meshes: [mk(front, T.FrontSide), mk(back, T.BackSide)] };
  });
  const petalTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createLinearGradient(10, 10, 54, 54); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#ffb7cd'); g.fillStyle = gr; g.beginPath(); g.moveTo(8, 32); g.bezierCurveTo(14, 4, 52, 6, 58, 30); g.bezierCurveTo(50, 60, 16, 58, 8, 32); g.fill(); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; })();
  const P = 90, petals = new T.InstancedMesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: petalTex, transparent: true, alphaTest: .3, side: T.DoubleSide, toneMapped: false }), P);
  petals.frustumCulled = false; world.add(petals);
  const pseed = Array.from({ length: P }, (_, i) => ({ x: (hash1(i) - .5) * 26, z: (hash1(i + .3) - .5) * 30 + 2, y: hash1(i + .7) * 11, v: .35 + hash1(i + .9) * .5, s: .07 + hash1(i + .5) * .1, red: i % 9 === 0 }));
  const red = new T.Color('#d3122f'), white = new T.Color('#ffffff'); pseed.forEach((p, i) => petals.setColorAt(i, p.red ? red : white));
  const blob = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, '#fff'); r.addColorStop(.3, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })();
  out.blob = blob;
  const E = 110, epos = new Float32Array(E * 3); for (let i = 0; i < E; i++) { epos[i * 3] = (hash1(i + 11) - .5) * 26; epos[i * 3 + 1] = -hash1(i + 13) * 11; epos[i * 3 + 2] = (hash1(i + 17) - .5) * 30 + 2; }
  const eg = new T.BufferGeometry(); eg.setAttribute('position', new T.BufferAttribute(epos, 3));
  const embers = new T.Points(eg, new T.PointsMaterial({ color: '#ff3a2a', size: .09, map: blob, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false })); embers.frustumCulled = false; world.add(embers);

  // Middle distance: chess pieces the size of towers, standing in the sea between the board and the painted horizon,
  // so the horizon slides behind them when the camera moves. Each is a lathe profile [height, half-width], turned and lit.
  const PROFILES = [
    [[0, .30], [.05, .30], [.08, .22], [.2, .15], [.52, .11], [.56, .19], [.6, .12], [.66, .17], [.78, .19], [.9, .12], [.95, .04], [1, .05]],                      // bishop
    [[0, .34], [.06, .34], [.09, .25], [.18, .2], [.7, .17], [.73, .26], [.78, .26], [.8, .3], [1, .3]],                                                             // rook
    [[0, .30], [.05, .30], [.09, .2], [.24, .14], [.6, .09], [.64, .2], [.68, .11], [.74, .16], [.86, .26], [.9, .12], [.93, .05], [1, .04]],                        // queen
    [[0, .32], [.07, .32], [.11, .2], [.3, .13], [.5, .1], [.54, .2], [.58, .1], [.66, .2], [.8, .22], [.92, .16], [1, 0]],                                          // pawn
  ];
  const TOWER = /* glsl */`varying vec3 wp, wn; uniform vec3 base; uniform float tall, seed, haze;
    void main(){
      vec3 lp = inv * wp, n = normalize(inv * wn), v = normalize(lp - inv * cameraPosition);
      float m = step(lp.y, 0.), hy = abs(lp.y) / tall, ang = atan(lp.x - base.x, lp.z - base.z);
      bool back = dot(n, v) > 0.; if (back) n = -n;
      // the mirror's towers are snapped off, each at its own height, along a slanted splintered line
      float snap = .7 + seed * .24 + sin(ang + seed * 9.) * .07 + abs(fract(ang * 1.6 + seed * 5.) - .5) * .1;
      if (m > .5 && hy > snap) discard;
      vec3 L = normalize(vec3(-.55, mix(.5, -.5, m), .65));
      float d = dot(n, L), key = clamp(d, 0., 1.), wrap = d * .5 + .5, fr = pow(1. - clamp(dot(-v, n), 0., 1.), 2.5);
      float course = smoothstep(.44, .5, abs(fract(hy * 16. + seed) - .5));                                   // courses of stone
      vec2 w = vec2(ang * 1.5915 + floor(hy * 9.) * .37 + seed * 3., hy * 9.), wf = abs(fract(w) - .5);
      float lit = step(wf.x, .11) * step(wf.y, .27) * step(.5, hash(floor(w) + seed * 17.)) * step(.16, hy) * step(hy, .68);
      // surface: sunlit porcelain with lilac shade and gilt courses
      vec3 a = mix(vec3(.40, .38, .78), vec3(1., .96, .94), smoothstep(.15, .8, wrap)) + vec3(1., .9, .8) * pow(key, 12.) * .25;
      a = mix(a, vec3(.95, .72, .36) * (.5 + .7 * key), course * .7) + vec3(.75, .8, 1.) * fr * .35;
      a = mix(a, vec3(1., .78, .4) * 1.15, lit * .9);
      // mirror: charred stone, a hard crimson rim, embers in the joints and the windows
      vec3 b = mix(vec3(.022, .006, .012), vec3(.34, .03, .07), key * key) + vec3(1., .10, .16) * fr * .8;
      float crack = smoothstep(.06, .0, abs(noise(vec2(ang * 3. + seed * 7., hy * 11.)) - .5)) * step(.2, hy);
      b += vec3(1., .16, .1) * (course * .35 + crack * .5 * (.6 + .4 * sin(time * 1.1 + seed * 20. + hy * 9.)));
      b = mix(b, vec3(1., .2, .22) * 1.5, lit);
      b = mix(b, vec3(1., .35, .25) * 1.4, smoothstep(snap - .02, snap, hy));                                 // the break still glows
      if (back) b = vec3(.5, .03, .05) * (1. - hy * .6);                                                      // looking into the hollow
      vec3 col = mix(a, b, m);
      col = mix(col, mix(vec3(.80, .74, .97), vec3(.30, .02, .06), m), haze * .55);                           // far ones sink into their sky
      gl_FragColor = vec4(col, smoothstep(.0, .14, hy));                                                      // the foot is lost in sea mist
    }`;
  const lathes = PROFILES.map((p) => new T.LatheGeometry(p.map(([y, w]) => new T.Vector2(Math.max(w * .66, .001), y)), 20));
  const towers = [1, -1].map((side) => {
    const g = new T.Group();
    for (let i = 0; i < 9; i++) {
      const az = (i - 4) * .25 + (hash1(i + 40) - .5) * .1, r = 13 + hash1(i + 50) * 9, haze = (r - 13) / 9;
      const h = 1.9 + hash1(i + 60) * 1.3 + haze * 1.43, girth = .85 + hash1(i + 70 + side) * .4;   // farther ones are taller, so they read at the same size and differ only in drift
      if (i === 4) continue;   // leave the castle a clear view down the middle
      const m = new T.Mesh(lathes[(i + (side < 0 ? 2 : 0)) % lathes.length], shader(TOWER, { base: { value: new T.Vector3() }, tall: { value: h }, seed: { value: hash1(i * 3 + side + 80) }, haze: { value: haze } }, { transparent: true, side: side < 0 ? T.DoubleSide : T.FrontSide }));
      m.position.set(Math.sin(az) * r, 0, -Math.cos(az) * r); m.material.uniforms.base.value.copy(m.position);
      m.scale.set(h * girth, h * side, h * girth); m.rotation.y = hash1(i + 90) * 6.28; m.renderOrder = -8 - haze; g.add(m);
    }
    world.add(g); return g;
  });

  const m4 = new T.Object3D();
  out.update = (t, dt) => {
    U.time.value = t; world.updateMatrixWorld(); U.inv.value.setFromMatrix4(world.matrixWorld).invert();
    // drifting things belong to their own world: seen through the glass they only litter the board
    const below = Math.cos(world.rotation.z) < 0; decks.forEach((d) => d.meshes.forEach((m) => { m.visible = (d.side < 0) === below; })); petals.visible = !below; embers.visible = below; towers[0].visible = !below; towers[1].visible = below;
    for (const d of decks) { d.mine.forEach((c, i) => { const a = c.a + t * c.w * .05; m4.position.set(Math.cos(a) * c.r, d.side * (c.y + 1.2 + Math.sin(t * c.w + c.a) * .4), -7 - (.5 + .5 * Math.sin(a)) * c.r * .8); m4.rotation.set(t * c.w * .6 + c.a, t * c.w * .8, c.a); m4.scale.setScalar(c.s); m4.updateMatrix(); d.meshes.forEach((m) => m.setMatrixAt(i, m4.matrix)); }); d.meshes.forEach((m) => { m.instanceMatrix.needsUpdate = true; }); }
    pseed.forEach((p, i) => { p.y -= p.v * dt; if (p.y < .02) p.y = 11; m4.position.set(p.x + Math.sin(t * .6 + i) * .7, p.y, p.z + Math.cos(t * .4 + i * 2.) * .5); m4.rotation.set(t * p.v * 2 + i, t * p.v * 1.4, i); m4.scale.setScalar(p.s); m4.updateMatrix(); petals.setMatrixAt(i, m4.matrix); }); petals.instanceMatrix.needsUpdate = true;
    const ep = eg.attributes.position; for (let i = 0; i < E; i++) { let y = ep.getY(i) - dt * (.25 + (i % 5) * .12); if (y < -11) y = -.05; ep.setY(i, y); ep.setX(i, ep.getX(i) + Math.sin(t * .8 + i) * dt * .12); } ep.needsUpdate = true;
    hands[0].rotation.z = -t * .02 + 2.2; hands[1].rotation.z = -Math.floor(t) * (Math.PI / 30);
  };
  return out;
}
function hash1(n) { const s = Math.sin(n * 127.1 + 3.7) * 43758.5453; return s - Math.floor(s); }
