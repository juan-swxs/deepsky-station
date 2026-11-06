// Héroe: miles de fibras tipo fibra óptica que se transforman entre 4 figuras
// (señal → satélite CubeSat → antena ground-plane → Tierra con órbita).
// Todo el morph ocurre en la GPU: cada vértice guarda su posición en las 4 figuras
// y el shader interpola con retraso por fibra, ruido suave y repulsión del puntero.
import * as THREE from "three";

const N = 1700;            // fibras
const K = 20;              // puntos por fibra
const HOLD = 5.0, MORPH = 2.2;
const BODY = new THREE.Color("#7d818d"), TIP = new THREE.Color("#ff8a2a");

// ---------- generadores de figuras: devuelven K puntos [x,y,z] de la raíz a la punta ----------
const rnd = mulberry32(20261106);
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = (a, b) => a + (b - a) * rnd();
const line = (a, b, jit = 0) => Array.from({ length: K }, (_, k) => {
  const t = k / (K - 1);
  return [a[0] + (b[0] - a[0]) * t + R(-jit, jit) * t, a[1] + (b[1] - a[1]) * t + R(-jit, jit) * t, a[2] + (b[2] - a[2]) * t + R(-jit, jit) * t];
});

// 0 · Señal: diente de león de fibras con remolino
function shapeBurst() {
  const u = R(-1, 1), ph = R(0, Math.PI * 2), s = Math.sqrt(1 - u * u);
  const d = [s * Math.cos(ph), u, s * Math.sin(ph)];
  const r0 = 0.12, r1 = R(1.15, 1.6), sw = R(0.9, 1.5);
  return Array.from({ length: K }, (_, k) => {
    const t = k / (K - 1), r = r0 + (r1 - r0) * Math.pow(t, 0.85), a = sw * t * t;
    const x = d[0] * r, y = d[1] * r, z = d[2] * r;
    return [x * Math.cos(a) - z * Math.sin(a), y + 0.08 * Math.sin(t * 3 + ph), x * Math.sin(a) + z * Math.cos(a)];
  });
}

// 1 · Satélite CubeSat 3U con dos paneles solares y antena
function shapeSatellite(i) {
  const f = i / N;
  if (f < 0.24) {                                     // cuerpo: fibras verticales sobre las caras
    const side = Math.floor(rnd() * 4), w = 0.26, v = R(-w, w);
    const [x, z] = [[v, w], [v, -w], [w, v], [-w, v]][side];
    return line([x, -0.5, z], [x, 0.5, z], 0.004);
  }
  if (f < 0.84) {                                     // paneles: rejilla de celdas
    const sgn = rnd() < 0.5 ? -1 : 1, x0 = 0.34 * sgn, x1 = 1.65 * sgn;
    if (rnd() < 0.72) {                               // filas a lo largo del panel
      const y = Math.round(R(-0.42, 0.42) / 0.07) * 0.07 + R(-0.006, 0.006);
      return line([x0, y, 0], [x1, y, 0]);
    }
    const x = x0 + (x1 - x0) * Math.round(rnd() * 8) / 8;   // columnas de celdas
    return line([x, -0.42, 0], [x, 0.42, 0]);
  }
  if (f < 0.93) {                                     // antena tipo varilla
    const a = R(0, Math.PI * 2), r = R(0, 0.018);
    return line([r * Math.cos(a), 0.5, r * Math.sin(a)], [r * Math.cos(a) * 0.4, 1.35, r * Math.sin(a) * 0.4]);
  }
  const sgn = rnd() < 0.5 ? -1 : 1, y = R(-0.06, 0.06);        // bisagras cuerpo-panel
  return line([0.26 * sgn, y, R(-0.05, 0.05)], [0.36 * sgn, y, 0]);
}

// 2 · Antena ground-plane de ¼ de onda con ondas que suben
function shapeAntenna(i) {
  const f = i / N, hub = [0, -0.1, 0];
  if (f < 0.16) { const a = R(0, Math.PI * 2), r = 0.07; return line([r * Math.cos(a), -0.95, r * Math.sin(a)], [r * Math.cos(a), hub[1], r * Math.sin(a)]); }
  if (f < 0.24) { const a = R(0, Math.PI * 2), r = R(0, 0.02); return line([r * Math.cos(a), hub[1], r * Math.sin(a)], [0, 0.8, 0]); }
  if (f < 0.52) {                                     // 4 radiales a 45° hacia abajo
    const q = Math.floor(rnd() * 4), a = Math.PI / 4 + q * Math.PI / 2, L = 1.05, j = 0.02;
    return line([R(-j, j), hub[1], R(-j, j)], [Math.cos(a) * L * 0.707, hub[1] - L * 0.707, Math.sin(a) * L * 0.707], 0.01);
  }
  const ring = Math.floor(rnd() * 4), rad = 0.35 + ring * 0.24, phi = R(0, Math.PI * 2);
  const th0 = R(0.35, 2.3), span = R(0.35, 0.6);                 // arcos de las ondas
  return Array.from({ length: K }, (_, k) => {
    const th = th0 + span * (k / (K - 1));
    return [rad * Math.cos(th) * Math.cos(phi), 0.75 + rad * Math.sin(th) * 0.75, rad * Math.cos(th) * Math.sin(phi)];
  });
}

// 3 · Tierra con meridianos, paralelos, órbita inclinada y un satélite
function shapeEarth(i) {
  const f = i / N, Re = 0.95;
  if (f < 0.66) {
    const span = R(0.7, 1.2);
    if (rnd() < 0.55) {                               // paralelos
      const lat = Math.round(R(-75, 75) / 15) * 15 * Math.PI / 180, lon0 = R(0, Math.PI * 2);
      return Array.from({ length: K }, (_, k) => { const lo = lon0 + span * k / (K - 1); return [Re * Math.cos(lat) * Math.cos(lo), Re * Math.sin(lat), Re * Math.cos(lat) * Math.sin(lo)]; });
    }
    const lon = Math.round(R(0, 360) / 20) * 20 * Math.PI / 180, la0 = R(-1.4, 1.4 - span);   // meridianos
    return Array.from({ length: K }, (_, k) => { const la = la0 + span * k / (K - 1); return [Re * Math.cos(la) * Math.cos(lon), Re * Math.sin(la), Re * Math.cos(la) * Math.sin(lon)]; });
  }
  const tilt = 0.5, Ro = 1.55;
  const orbit = (a) => { const x = Ro * Math.cos(a), z = Ro * Math.sin(a); return [x, -z * Math.sin(tilt), z * Math.cos(tilt)]; };
  if (f < 0.9) { const a0 = R(0, Math.PI * 2), sp = R(0.25, 0.45); return Array.from({ length: K }, (_, k) => orbit(a0 + sp * k / (K - 1))); }
  const c = orbit(0.6), s = 0.09;                    // pequeño satélite sobre la órbita
  const sgn = rnd() < 0.5 ? -1 : 1, y = R(-0.035, 0.035);
  return rnd() < 0.6 ? line([c[0] + 0.05 * sgn, c[1] + y, c[2]], [c[0] + 0.24 * sgn, c[1] + y, c[2]])
                     : line([c[0] + R(-s, s) * 0.4, c[1] - 0.06, c[2] + R(-s, s) * 0.4], [c[0] + R(-s, s) * 0.4, c[1] + 0.06, c[2] + R(-s, s) * 0.4]);
}

// ---------- shaders ----------
const common = /* glsl */`
  uniform float uTime, uMix, uPx;
  uniform int uFrom, uTo;
  uniform vec2 uMouse; uniform float uMouseOn;
  attribute vec3 aS0, aS1, aS2, aS3;
  attribute float aT, aSeed;
  vec3 pick(int i){ return i==0?aS0:(i==1?aS1:(i==2?aS2:aS3)); }
  vec3 fibre(out float vT){
    vT = aT;
    float m = clamp((uMix * 1.45) - aSeed * 0.45, 0.0, 1.0);
    m = m * m * (3.0 - 2.0 * m);
    vec3 a = pick(uFrom), b = pick(uTo);
    vec3 p = mix(a, b, m);
    // remolino durante la transición: las fibras se sueltan y fluyen
    float swirl = sin(3.14159 * m) * (0.35 + 0.65 * aT);
    p += swirl * vec3(sin(aSeed * 31.0 + aT * 4.0), cos(aSeed * 17.0 + aT * 3.0) * 0.6, sin(aSeed * 23.0 - aT * 5.0)) * 0.45;
    // ruido suave permanente (más en la punta)
    float w = 0.018 + 0.05 * aT * aT;
    p += w * vec3(sin(uTime * 0.9 + aSeed * 40.0 + aT * 3.0), cos(uTime * 0.7 + aSeed * 29.0 + aT * 2.0), sin(uTime * 0.8 + aSeed * 13.0 + aT * 4.0));
    return p;
  }
  vec4 project(vec3 p){
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec4 cp = projectionMatrix * mv;
    vec2 ndc = cp.xy / cp.w;
    vec2 d = ndc - uMouse;
    float dist = length(d * vec2(1.6, 1.0));
    float push = uMouseOn * smoothstep(0.38, 0.0, dist) * (0.15 + 0.85 * aT) * 0.32;
    mv.xy += normalize(d + 1e-5) * push;
    return projectionMatrix * mv;
  }`;

const lineVS = common + /* glsl */`
  varying float vT;
  void main(){ float t; vec3 p = fibre(t); vT = t; gl_Position = project(p); }`;
const lineFS = /* glsl */`
  uniform vec3 uBody, uTip; varying float vT;
  void main(){
    vec3 c = mix(uBody, uTip, smoothstep(0.82, 1.0, vT) * 0.85);
    float a = mix(0.04, 0.27, smoothstep(0.0, 0.9, vT));
    gl_FragColor = vec4(c, a);
  }`;
const tipVS = common + /* glsl */`
  varying float vSeed;
  void main(){ float t; vec3 p = fibre(t); vSeed = aSeed; vec4 c = project(p); gl_Position = c;
    gl_PointSize = uPx * (4.5 + 4.0 * fract(aSeed * 7.13)) * (3.2 / c.w); }`;
const tipFS = /* glsl */`
  uniform vec3 uTip; uniform float uTime; varying float vSeed;
  void main(){
    vec2 q = gl_PointCoord - 0.5; float r = length(q);
    if (r > 0.5) discard;
    float core = smoothstep(0.16, 0.0, r), halo = smoothstep(0.5, 0.0, r);
    float flick = 0.75 + 0.25 * sin(uTime * 3.0 + vSeed * 50.0);
    vec3 c = mix(uTip, vec3(1.0, 0.95, 0.82), core * 0.85);
    gl_FragColor = vec4(c, (halo * 0.22 + core * 0.9) * flick);
  }`;

export function initHero(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.set(0, 0.15, 5.4);
  const group = new THREE.Group();
  scene.add(group);

  // ---------- geometría ----------
  const makers = [shapeBurst, shapeSatellite, shapeAntenna, shapeEarth];
  const shapes = makers.map((mk) => Array.from({ length: N }, (_, i) => mk(i)));
  const seeds = Float32Array.from({ length: N }, () => rnd());

  const segV = N * (K - 1) * 2;
  const lineGeo = new THREE.BufferGeometry(), tipGeo = new THREE.BufferGeometry();
  const S = shapes.map(() => new Float32Array(segV * 3)), T = new Float32Array(segV), SD = new Float32Array(segV);
  const tS = shapes.map(() => new Float32Array(N * 3)), tT = new Float32Array(N).fill(1), tSD = new Float32Array(N);
  let v = 0;
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < K - 1; k++) for (const kk of [k, k + 1]) {
      for (let s = 0; s < 4; s++) S[s].set(shapes[s][i][kk], v * 3);
      T[v] = kk / (K - 1); SD[v] = seeds[i]; v++;
    }
    for (let s = 0; s < 4; s++) tS[s].set(shapes[s][i][K - 1], i * 3);
    tSD[i] = seeds[i];
  }
  const dummy = new THREE.BufferAttribute(new Float32Array(segV * 3), 3);
  lineGeo.setAttribute("position", dummy);
  tipGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  for (let s = 0; s < 4; s++) {
    lineGeo.setAttribute("aS" + s, new THREE.BufferAttribute(S[s], 3));
    tipGeo.setAttribute("aS" + s, new THREE.BufferAttribute(tS[s], 3));
  }
  lineGeo.setAttribute("aT", new THREE.BufferAttribute(T, 1));
  lineGeo.setAttribute("aSeed", new THREE.BufferAttribute(SD, 1));
  tipGeo.setAttribute("aT", new THREE.BufferAttribute(tT, 1));
  tipGeo.setAttribute("aSeed", new THREE.BufferAttribute(tSD, 1));
  const big = new THREE.Sphere(new THREE.Vector3(), 4);
  lineGeo.boundingSphere = big; tipGeo.boundingSphere = big;

  const uniforms = {
    uTime: { value: 0 }, uMix: { value: 1 }, uFrom: { value: 1 }, uTo: { value: 1 },
    uMouse: { value: new THREE.Vector2(9, 9) }, uMouseOn: { value: 0 }, uPx: { value: 1 },
    uBody: { value: BODY }, uTip: { value: TIP },
  };
  const lines = new THREE.LineSegments(lineGeo, new THREE.ShaderMaterial({
    uniforms, vertexShader: lineVS, fragmentShader: lineFS, transparent: true, depthWrite: false, blending: THREE.NormalBlending,
  }));
  const tips = new THREE.Points(tipGeo, new THREE.ShaderMaterial({
    uniforms, vertexShader: tipVS, fragmentShader: tipFS, transparent: true, depthWrite: false, blending: THREE.NormalBlending,
  }));
  group.add(lines, tips);

  // ---------- estado del ciclo ----------
  let phase = opts.initialPhase ?? (opts.reducedMotion ? 1 : 0), next = phase, morphT = 1, holdT = 0, onPhase = opts.onPhase;
  uniforms.uFrom.value = uniforms.uTo.value = phase;
  function setPhase(i) {
    i = ((i % 4) + 4) % 4;
    if (i === next && morphT < 1) return;
    // si está en transición, parte desde la figura de destino actual
    phase = morphT < 0.5 ? phase : next;
    next = i; morphT = i === phase ? 1 : 0; holdT = 0;
    uniforms.uFrom.value = phase; uniforms.uTo.value = next; uniforms.uMix.value = morphT;
    onPhase && onPhase(next);
    if (opts.reducedMotion) { phase = next; uniforms.uFrom.value = next; uniforms.uMix.value = 1; draw(); }
  }

  // ---------- puntero ----------
  const mouse = new THREE.Vector2(9, 9), look = new THREE.Vector2(), ZERO = new THREE.Vector2();
  let mouseOn = 0;
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect(), p = e.touches ? e.touches[0] : e;
    mouse.set(((p.clientX - r.left) / r.width) * 2 - 1, -((p.clientY - r.top) / r.height) * 2 + 1);
    mouseOn = 1;
  };
  const onLeave = () => (mouseOn = 0);
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("touchmove", onMove, { passive: true });
  document.addEventListener("pointerleave", onLeave);

  // ---------- tamaño ----------
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight, dpr = Math.min(devicePixelRatio, 2);
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    uniforms.uPx.value = dpr;
    const wide = camera.aspect > 1.05;                  // figura a la derecha en pantallas anchas
    group.position.set(wide ? 1.95 : 0, wide ? 0.0 : 0.7, 0);
    group.scale.setScalar(wide ? 0.88 : 0.72);
    if (opts.reducedMotion) draw();
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

  // ---------- bucle ----------
  let visible = true, raf = 0, last = performance.now(), time = 0;
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) start(); });
  io.observe(canvas);
  const onVis = () => { if (!document.hidden) start(); };
  document.addEventListener("visibilitychange", onVis);

  function draw() { renderer.render(scene, camera); }
  function frame(now) {
    if (!visible || document.hidden) { raf = 0; return; }
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    uniforms.uTime.value = time;
    if (morphT < 1) {
      morphT = Math.min(1, morphT + dt / MORPH);
      uniforms.uMix.value = morphT;
      if (morphT >= 1) { phase = next; uniforms.uFrom.value = phase; holdT = 0; }
    } else if ((holdT += dt) > HOLD) setPhase(phase + 1);
    group.rotation.y += dt * 0.12;
    group.rotation.x = 0.18 + Math.sin(time * 0.25) * 0.06;
    look.lerp(mouseOn ? mouse : ZERO, 0.04);
    camera.position.x = look.x * 0.35; camera.position.y = 0.15 + look.y * 0.22; camera.lookAt(group.position.x * 0.35, group.position.y * 0.35, 0);
    uniforms.uMouse.value.lerp(mouse, 0.25);
    uniforms.uMouseOn.value += ((mouseOn ? 1 : 0) - uniforms.uMouseOn.value) * 0.08;
    draw();
  }
  function start() {
    if (opts.reducedMotion) { draw(); return; }
    if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  start();

  return {
    setPhase,
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      window.removeEventListener("pointermove", onMove); window.removeEventListener("touchmove", onMove);
      document.removeEventListener("pointerleave", onLeave); document.removeEventListener("visibilitychange", onVis);
      lineGeo.dispose(); tipGeo.dispose(); lines.material.dispose(); tips.material.dispose(); renderer.dispose();
    },
  };
}
