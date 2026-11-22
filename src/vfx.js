// Short-lived effects: sparks, shards and shock rings. Everything is pooled; nothing allocates while playing.
import * as T from 'three';

const N = 420, RINGS = 8;
export function createVfx(world, blob) {
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 4), size = new Float32Array(N);
  const P = Array.from({ length: N }, () => ({ life: 0, max: 1, v: new T.Vector3(), g: 0, drag: 1, s: 1, c: [1, 1, 1], add: 1 }));
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('tint', new T.BufferAttribute(col, 4)); geo.setAttribute('size', new T.BufferAttribute(size, 1));
  // premultiplied output: tint.a near 1 glows additively, near 0 sits on top like paint
  const mat = new T.ShaderMaterial({
    uniforms: { map: { value: blob }, scale: { value: 600 } }, transparent: true, depthWrite: false, toneMapped: false,
    blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor,
    vertexShader: `attribute vec4 tint; attribute float size; varying vec4 c; uniform float scale;
      void main(){ c = tint; vec4 m = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * m; gl_PointSize = size * scale / -m.z; }`,
    fragmentShader: `varying vec4 c; uniform sampler2D map;
      void main(){ float a = texture2D(map, gl_PointCoord).a; a *= a; gl_FragColor = vec4(c.rgb * a, a * (1. - c.a)); }`,
  });
  const points = new T.Points(geo, mat); points.frustumCulled = false; points.renderOrder = 6; world.add(points);
  let next = 0;
  function spark(p, v, o) {
    const q = P[next]; pos[next * 3] = p.x; pos[next * 3 + 1] = p.y; pos[next * 3 + 2] = p.z;
    q.life = q.max = o.life * (.6 + Math.random() * .8); q.v.copy(v); q.g = o.g || 0; q.drag = o.drag ?? 2; q.s = o.size * (.5 + Math.random()); q.c = o.color; q.add = o.add ?? 1;
    next = (next + 1) % N;
  }
  const v = new T.Vector3(), p = new T.Vector3();
  // A burst of count sparks at local point `at`. side: +1 above the glass, -1 beneath it.
  function burst(at, side, o) {
    for (let i = 0; i < o.count; i++) {
      const a = Math.random() * 6.283, up = (o.up ?? .6) + Math.random() * (o.spread ?? 1), sp = o.speed * (.3 + Math.random());
      v.set(Math.cos(a) * sp, side * up * o.speed, Math.sin(a) * sp);
      p.set(at.x + (Math.random() - .5) * (o.r || .3), side * ((o.y ?? .5) + (Math.random() - .5) * (o.h || .6)), at.z + (Math.random() - .5) * (o.r || .3));
      spark(p, v, { ...o, g: -side * (o.g ?? 3), color: o.colors[i % o.colors.length] });
    }
  }
  // Sparks strung along a path from a to b.
  function streak(a, b, side, o) {
    for (let i = 0; i < o.count; i++) {
      const k = Math.random(); p.lerpVectors(a, b, k); p.y = side * (.15 + Math.random() * (o.h || 1));
      v.set((Math.random() - .5) * .5, side * Math.random() * (o.rise ?? .8), (Math.random() - .5) * .5);
      spark(p, v, { ...o, g: 0, color: o.colors[i % o.colors.length] });
    }
  }
  const ringMat = () => new T.ShaderMaterial({
    uniforms: { k: { value: 0 }, color: { value: new T.Color() }, add: { value: 1 }, thick: { value: .1 } }, transparent: true, depthWrite: false, toneMapped: false, side: T.DoubleSide,
    blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor,
    vertexShader: 'varying vec2 u; void main(){ u = uv * 2. - 1.; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `varying vec2 u; uniform float k, add, thick; uniform vec3 color;
      void main(){ float r = length(u), e = 1. - pow(1. - k, 3.); float a = (1. - smoothstep(0., thick, abs(r - e * .92))) * (1. - k) + (1. - smoothstep(0., e * .9, r)) * .18 * (1. - k) * (1. - k);
        gl_FragColor = vec4(color * a, a * (1. - add)); }`,
  });
  const rings = Array.from({ length: RINGS }, () => { const m = new T.Mesh(new T.PlaneGeometry(1, 1), ringMat()); m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = -1; m.userData = { t: 0, ms: 1 }; world.add(m); return m; });
  let rn = 0;
  function ring(at, side, color, radius = 1.4, ms = 520, add = side < 0 ? 1 : .35, thick = .1) {
    const m = rings[rn]; rn = (rn + 1) % RINGS; m.position.set(at.x, side * .03, at.z); m.scale.setScalar(radius * 2); m.material.uniforms.color.value.set(color); m.material.uniforms.add.value = add; m.material.uniforms.thick.value = thick; m.userData.t = 0; m.userData.ms = ms; m.visible = true;
  }
  function update(dt, height) {
    mat.uniforms.scale.value = height * .9;
    for (let i = 0; i < N; i++) {
      const q = P[i]; if (q.life <= 0) { if (size[i]) size[i] = 0; continue; }
      q.life -= dt; const k = Math.max(0, q.life / q.max), d = Math.exp(-q.drag * dt);
      q.v.multiplyScalar(d); q.v.y += q.g * dt; pos[i * 3] += q.v.x * dt; pos[i * 3 + 1] += q.v.y * dt; pos[i * 3 + 2] += q.v.z * dt;
      const f = Math.min(1, k * 3) * Math.min(1, (1 - k) * 12); size[i] = q.s * (.4 + .6 * k);
      col[i * 4] = q.c[0] * f; col[i * 4 + 1] = q.c[1] * f; col[i * 4 + 2] = q.c[2] * f; col[i * 4 + 3] = q.add;
    }
    geo.attributes.position.needsUpdate = geo.attributes.tint.needsUpdate = geo.attributes.size.needsUpdate = true;
    for (const m of rings) if (m.visible) { m.userData.t += dt * 1000; const k = m.userData.t / m.userData.ms; if (k >= 1) m.visible = false; else m.material.uniforms.k.value = k; }
  }
  return { burst, streak, ring, update };
}

// Palettes, as linear-ish rgb triples. Bright ones bloom.
export const HUE = {
  gold: [[1.6, 1.2, .5], [1.4, 1.3, 1.1], [1.5, .9, .3]],
  snow: [[1, 1, 1], [1, .8, .86], [.75, .85, 1]],
  blood: [[.8, .02, .08], [1, .1, .15], [.45, 0, .05]],
  ember: [[2.2, .25, .2], [2, .7, .3], [1.6, .05, .1]],
  ink: [[.02, .01, .03], [.2, .0, .04], [.05, .02, .08]],
  ghost: [[1.8, 1.7, 1.9], [1.5, .5, .6], [1, 1, 1.4]],
};
