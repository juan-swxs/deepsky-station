// Mundo de fibras: motor WebGL que dibuja miles de fibras ópticas y las transforma
// entre figuras. Cada cambio de capa es una "zambullida": las fibras se abren, la cámara
// entra entre ellas y la nueva figura se arma. Todo el morph ocurre en la GPU.
import * as THREE from "three";

const N = 1700, K = 20;
const MORPH = 2.0;
const BODY = new THREE.Color("#7d818d"), TIP = new THREE.Color("#ff8a2a");

// ---------- utilidades deterministas ----------
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const line = (a, b, rnd, jit = 0) => Array.from({ length: K }, (_, k) => {
  const t = k / (K - 1);
  return [a[0] + (b[0] - a[0]) * t + (rnd() - 0.5) * 2 * jit * t, a[1] + (b[1] - a[1]) * t + (rnd() - 0.5) * 2 * jit * t, a[2] + (b[2] - a[2]) * t + (rnd() - 0.5) * 2 * jit * t];
});

// ---------- figuras base (las 4 originales) ----------
export function shapeBurst(i, n, k, rnd) {
  const R = (a, b) => a + (b - a) * rnd();
  const u = R(-1, 1), ph = R(0, Math.PI * 2), s = Math.sqrt(1 - u * u);
  const d = [s * Math.cos(ph), u, s * Math.sin(ph)];
  const r0 = 0.12, r1 = R(1.15, 1.6), sw = R(0.9, 1.5);
  return Array.from({ length: K }, (_, q) => {
    const t = q / (K - 1), r = r0 + (r1 - r0) * Math.pow(t, 0.85), a = sw * t * t;
    const x = d[0] * r, y = d[1] * r, z = d[2] * r;
    return [x * Math.cos(a) - z * Math.sin(a), y + 0.08 * Math.sin(t * 3 + ph), x * Math.sin(a) + z * Math.cos(a)];
  });
}
export function shapeSatellite(i, n, k, rnd) {
  const R = (a, b) => a + (b - a) * rnd(), f = i / n;
  if (f < 0.24) { const side = Math.floor(rnd() * 4), w = 0.26, v = R(-w, w); const [x, z] = [[v, w], [v, -w], [w, v], [-w, v]][side]; return line([x, -0.5, z], [x, 0.5, z], rnd, 0.004); }
  if (f < 0.84) {
    const sgn = rnd() < 0.5 ? -1 : 1, x0 = 0.34 * sgn, x1 = 1.65 * sgn;
    if (rnd() < 0.72) { const y = Math.round(R(-0.42, 0.42) / 0.07) * 0.07 + R(-0.006, 0.006); return line([x0, y, 0], [x1, y, 0], rnd); }
    const x = x0 + (x1 - x0) * Math.round(rnd() * 8) / 8; return line([x, -0.42, 0], [x, 0.42, 0], rnd);
  }
  if (f < 0.93) { const a = R(0, Math.PI * 2), r = R(0, 0.018); return line([r * Math.cos(a), 0.5, r * Math.sin(a)], [r * Math.cos(a) * 0.4, 1.35, r * Math.sin(a) * 0.4], rnd); }
  const sgn = rnd() < 0.5 ? -1 : 1, y = R(-0.06, 0.06); return line([0.26 * sgn, y, R(-0.05, 0.05)], [0.36 * sgn, y, 0], rnd);
}
export function shapeAntenna(i, n, k, rnd) {
  const R = (a, b) => a + (b - a) * rnd(), f = i / n, hub = [0, -0.1, 0];
  if (f < 0.16) { const a = R(0, Math.PI * 2), r = 0.07; return line([r * Math.cos(a), -0.95, r * Math.sin(a)], [r * Math.cos(a), hub[1], r * Math.sin(a)], rnd); }
  if (f < 0.24) { const a = R(0, Math.PI * 2), r = R(0, 0.02); return line([r * Math.cos(a), hub[1], r * Math.sin(a)], [0, 0.8, 0], rnd); }
  if (f < 0.52) { const q = Math.floor(rnd() * 4), a = Math.PI / 4 + q * Math.PI / 2, L = 1.05, j = 0.02; return line([R(-j, j), hub[1], R(-j, j)], [Math.cos(a) * L * 0.707, hub[1] - L * 0.707, Math.sin(a) * L * 0.707], rnd, 0.01); }
  const ring = Math.floor(rnd() * 4), rad = 0.35 + ring * 0.24, phi = R(0, Math.PI * 2), th0 = R(0.35, 2.3), span = R(0.35, 0.6);
  return Array.from({ length: K }, (_, q) => { const th = th0 + span * (q / (K - 1)); return [rad * Math.cos(th) * Math.cos(phi), 0.75 + rad * Math.sin(th) * 0.75, rad * Math.cos(th) * Math.sin(phi)]; });
}
export function shapeEarth(i, n, k, rnd) {
  const R = (a, b) => a + (b - a) * rnd(), f = i / n, Re = 0.95;
  if (f < 0.66) {
    const span = R(0.7, 1.2);
    if (rnd() < 0.55) { const lat = Math.round(R(-75, 75) / 15) * 15 * Math.PI / 180, lon0 = R(0, Math.PI * 2); return Array.from({ length: K }, (_, q) => { const lo = lon0 + span * q / (K - 1); return [Re * Math.cos(lat) * Math.cos(lo), Re * Math.sin(lat), Re * Math.cos(lat) * Math.sin(lo)]; }); }
    const lon = Math.round(R(0, 360) / 20) * 20 * Math.PI / 180, la0 = R(-1.4, 1.4 - span);
    return Array.from({ length: K }, (_, q) => { const la = la0 + span * q / (K - 1); return [Re * Math.cos(la) * Math.cos(lon), Re * Math.sin(la), Re * Math.cos(la) * Math.sin(lon)]; });
  }
  const tilt = 0.5, Ro = 1.55, orbit = (a) => { const x = Ro * Math.cos(a), z = Ro * Math.sin(a); return [x, -z * Math.sin(tilt), z * Math.cos(tilt)]; };
  if (f < 0.9) { const a0 = R(0, Math.PI * 2), sp = R(0.25, 0.45); return Array.from({ length: K }, (_, q) => orbit(a0 + sp * q / (K - 1))); }
  const c = orbit(0.6), s = 0.09, sgn = rnd() < 0.5 ? -1 : 1, y = R(-0.035, 0.035);
  return rnd() < 0.6 ? line([c[0] + 0.05 * sgn, c[1] + y, c[2]], [c[0] + 0.24 * sgn, c[1] + y, c[2]], rnd)
                     : line([c[0] + R(-s, s) * 0.4, c[1] - 0.06, c[2] + R(-s, s) * 0.4], [c[0] + R(-s, s) * 0.4, c[1] + 0.06, c[2] + R(-s, s) * 0.4], rnd);
}

// ---------- shaders ----------
function shaders(nShapes) {
  const attrs = Array.from({ length: nShapes }, (_, s) => `attribute vec3 aS${s};`).join("\n");
  let pick = `vec3 pick(int i){ `;
  for (let s = 0; s < nShapes - 1; s++) pick += `if(i==${s}) return aS${s}; `;
  pick += `return aS${nShapes - 1}; }`;
  const common = /* glsl */`
    uniform float uTime, uMix, uWarp, uPx;
    uniform int uFrom, uTo;
    uniform vec2 uMouse; uniform float uMouseOn;
    ${attrs}
    attribute float aT, aSeed;
    ${pick}
    vec3 fibre(){
      float m = clamp((uMix * 1.45) - aSeed * 0.45, 0.0, 1.0);
      m = m * m * (3.0 - 2.0 * m);
      vec3 p = mix(pick(uFrom), pick(uTo), m);
      float swirl = sin(3.14159 * m) * (0.35 + 0.65 * aT);
      p += swirl * vec3(sin(aSeed * 31.0 + aT * 4.0), cos(aSeed * 17.0 + aT * 3.0) * 0.6, sin(aSeed * 23.0 - aT * 5.0)) * 0.45;
      // zambullida: las fibras se abren radialmente y vienen hacia la cámara
      p *= 1.0 + uWarp * (0.6 + 1.6 * aSeed) * (0.4 + aT);
      p.z += uWarp * (1.2 + 2.5 * aSeed);
      float w = 0.018 + 0.05 * aT * aT;
      p += w * vec3(sin(uTime * 0.9 + aSeed * 40.0 + aT * 3.0), cos(uTime * 0.7 + aSeed * 29.0 + aT * 2.0), sin(uTime * 0.8 + aSeed * 13.0 + aT * 4.0));
      return p;
    }
    vec4 project(vec3 p){
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vec4 cp = projectionMatrix * mv;
      vec2 d = cp.xy / cp.w - uMouse;
      float push = uMouseOn * smoothstep(0.38, 0.0, length(d * vec2(1.6, 1.0))) * (0.15 + 0.85 * aT) * 0.32;
      mv.xy += normalize(d + 1e-5) * push;
      return projectionMatrix * mv;
    }`;
  return {
    lineVS: common + `varying float vT; void main(){ vT = aT; gl_Position = project(fibre()); }`,
    lineFS: `uniform vec3 uBody, uTip; uniform float uWarp; varying float vT;
      void main(){ vec3 c = mix(uBody, uTip, smoothstep(0.82, 1.0, vT) * 0.85);
        float a = mix(0.04, 0.27, smoothstep(0.0, 0.9, vT)) * (1.0 - uWarp * 0.35); gl_FragColor = vec4(c, a); }`,
    tipVS: common + `varying float vSeed; void main(){ vSeed = aSeed; vec4 c = project(fibre()); gl_Position = c;
      gl_PointSize = uPx * (4.5 + 4.0 * fract(aSeed * 7.13)) * (3.2 / c.w); }`,
    tipFS: `uniform vec3 uTip; uniform float uTime; varying float vSeed;
      void main(){ vec2 q = gl_PointCoord - 0.5; float r = length(q); if (r > 0.5) discard;
        float core = smoothstep(0.16, 0.0, r), halo = smoothstep(0.5, 0.0, r);
        float flick = 0.75 + 0.25 * sin(uTime * 3.0 + vSeed * 50.0);
        gl_FragColor = vec4(mix(uTip, vec3(1.0, 0.95, 0.82), core * 0.85), (halo * 0.22 + core * 0.9) * flick); }`,
  };
}

// Polvo de fondo: puntos lejanos que dan profundidad y se estiran en la zambullida
const dustVS = /* glsl */`
  uniform float uTime, uWarp, uPx; attribute float aSeed; varying float vA;
  void main(){
    vec3 p = position;
    p.z = mod(p.z + uTime * (0.08 + aSeed * 0.1) + uWarp * 6.0 * (0.5 + aSeed), 14.0) - 10.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vA = smoothstep(-10.0, -6.0, p.z) * (1.0 - smoothstep(2.0, 3.6, p.z));
    gl_PointSize = uPx * (1.2 + 2.2 * aSeed + uWarp * 5.0) * (4.0 / max(0.5, -mv.z));
  }`;
const dustFS = /* glsl */`
  uniform vec3 uCol; varying float vA;
  void main(){ float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard; gl_FragColor = vec4(uCol, vA * 0.5 * smoothstep(0.5, 0.1, r)); }`;

/**
 * @param canvas
 * @param shapeFns  arreglo de generadores (i, N, K, rnd) => K puntos
 * @param opts { reducedMotion, initial, onArrive(i) }
 */
export function initWorld(canvas, shapeFns, opts = {}) {
  const S = shapeFns.length;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
  camera.position.set(0, 0.15, 5.4);
  const group = new THREE.Group();
  scene.add(group);

  // ---------- geometría de fibras (una por figura en atributos) ----------
  const rndSeeds = mulberry32(20261106);
  const seeds = Float32Array.from({ length: N }, () => rndSeeds());
  const shapes = shapeFns.map((fn, s) => {
    const rnd = mulberry32(1000 + s * 7919);
    return Array.from({ length: N }, (_, i) => {
      let pts = null;
      try { pts = fn(i, N, K, rnd); } catch { pts = null; }
      if (!Array.isArray(pts) || pts.length !== K || pts.some((p) => !p || p.some((v) => !Number.isFinite(v)))) pts = Array.from({ length: K }, () => [0, 0, 0]);
      return pts;
    });
  });
  const segV = N * (K - 1) * 2;
  const lineGeo = new THREE.BufferGeometry(), tipGeo = new THREE.BufferGeometry();
  const SA = shapes.map(() => new Float32Array(segV * 3)), T = new Float32Array(segV), SD = new Float32Array(segV);
  const tSA = shapes.map(() => new Float32Array(N * 3));
  let v = 0;
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < K - 1; k++) for (const kk of [k, k + 1]) {
      for (let s = 0; s < S; s++) SA[s].set(shapes[s][i][kk], v * 3);
      T[v] = kk / (K - 1); SD[v] = seeds[i]; v++;
    }
    for (let s = 0; s < S; s++) tSA[s].set(shapes[s][i][K - 1], i * 3);
  }
  lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segV * 3), 3));
  tipGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  for (let s = 0; s < S; s++) {
    lineGeo.setAttribute("aS" + s, new THREE.BufferAttribute(SA[s], 3));
    tipGeo.setAttribute("aS" + s, new THREE.BufferAttribute(tSA[s], 3));
  }
  lineGeo.setAttribute("aT", new THREE.BufferAttribute(T, 1));
  lineGeo.setAttribute("aSeed", new THREE.BufferAttribute(SD, 1));
  tipGeo.setAttribute("aT", new THREE.BufferAttribute(new Float32Array(N).fill(1), 1));
  tipGeo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  const big = new THREE.Sphere(new THREE.Vector3(), 8);
  lineGeo.boundingSphere = big; tipGeo.boundingSphere = big;

  const uniforms = {
    uTime: { value: 0 }, uMix: { value: 1 }, uWarp: { value: 0 }, uFrom: { value: 0 }, uTo: { value: 0 },
    uMouse: { value: new THREE.Vector2(9, 9) }, uMouseOn: { value: 0 }, uPx: { value: 1 },
    uBody: { value: BODY }, uTip: { value: TIP },
  };
  const sh = shaders(S);
  const mat = (vs, fs) => new THREE.ShaderMaterial({ uniforms, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false });
  const lines = new THREE.LineSegments(lineGeo, mat(sh.lineVS, sh.lineFS));
  const tips = new THREE.Points(tipGeo, mat(sh.tipVS, sh.tipFS));
  group.add(lines, tips);

  // Polvo de fondo
  const D = 900, dp = new Float32Array(D * 3), ds = new Float32Array(D);
  for (let i = 0; i < D; i++) { dp[i * 3] = (rndSeeds() - 0.5) * 16; dp[i * 3 + 1] = (rndSeeds() - 0.5) * 10; dp[i * 3 + 2] = rndSeeds() * 14 - 10; ds[i] = rndSeeds(); }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dp, 3));
  dustGeo.setAttribute("aSeed", new THREE.BufferAttribute(ds, 1));
  dustGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30);
  const dust = new THREE.Points(dustGeo, new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, uWarp: uniforms.uWarp, uPx: uniforms.uPx, uCol: { value: new THREE.Color("#5d6070") } },
    vertexShader: dustVS, fragmentShader: dustFS, transparent: true, depthWrite: false,
  }));
  scene.add(dust);

  // ---------- estado ----------
  let cur = opts.initial ?? 0, next = cur, morphT = 1;
  uniforms.uFrom.value = uniforms.uTo.value = cur;
  // Encuadre por figura: desplazamiento (para dejar espacio al panel), escala y rotación base
  let frame = { x: 0, y: 0, s: 1, tilt: 0.18, spin: 0.12, yaw: 0 };
  const frameTarget = { ...frame };
  function setFrame(f) { Object.assign(frameTarget, f); if (opts.reducedMotion) Object.assign(frame, frameTarget); }

  function goTo(i, f) {
    i = Math.max(0, Math.min(S - 1, i));
    if (f) setFrame(f);
    if (i === next && morphT < 1) return;
    cur = morphT < 0.5 ? cur : next;
    next = i;
    morphT = i === cur ? 1 : 0;
    uniforms.uFrom.value = cur; uniforms.uTo.value = next; uniforms.uMix.value = morphT;
    if (opts.reducedMotion) { cur = next; uniforms.uFrom.value = next; uniforms.uMix.value = 1; render(); opts.onArrive?.(next); }
    else start();
  }

  // ---------- puntero ----------
  const mouse = new THREE.Vector2(9, 9), look = new THREE.Vector2(), ZERO = new THREE.Vector2();
  let mouseOn = 0;
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect(), p = e.touches ? e.touches[0] : e;
    mouse.set(((p.clientX - r.left) / r.width) * 2 - 1, -((p.clientY - r.top) / r.height) * 2 + 1); mouseOn = 1;
  };
  const onLeave = () => (mouseOn = 0);
  window.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerleave", onLeave);

  // ---------- tamaño ----------
  let aspect = 1;
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight, dpr = Math.min(devicePixelRatio, 2);
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    aspect = camera.aspect = w / h; camera.updateProjectionMatrix();
    uniforms.uPx.value = dpr;
    if (opts.reducedMotion) render();
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

  // ---------- bucle ----------
  let raf = 0, last = performance.now(), time = 0;
  function render() {
    const narrow = aspect < 0.9;
    group.position.set(narrow ? 0 : frame.x, narrow ? frame.y + 0.75 : frame.y, 0);
    group.scale.setScalar(frame.s * (narrow ? 0.66 : 1));
    renderer.render(scene, camera);
  }
  function tick(now) {
    if (document.hidden) { raf = 0; return; }
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    uniforms.uTime.value = time;
    if (morphT < 1) {
      morphT = Math.min(1, morphT + dt / MORPH);
      uniforms.uMix.value = morphT;
      if (morphT >= 1) { cur = next; uniforms.uFrom.value = cur; opts.onArrive?.(cur); }
    }
    // zambullida: pico a mitad de la transición
    const wTarget = morphT < 1 ? Math.sin(Math.PI * Math.min(1, morphT * 1.15)) : 0;
    uniforms.uWarp.value += (wTarget - uniforms.uWarp.value) * 0.12;
    const k = 1 - Math.pow(0.04, dt);                     // suavizado del encuadre
    for (const key of ["x", "y", "s", "tilt", "spin", "yaw"]) frame[key] += ((frameTarget[key] ?? 0) - frame[key]) * k;
    if ((frameTarget.spin ?? 0.12) > 0.001) group.rotation.y += dt * frame.spin;
    else {                                              // figura de frente con un leve vaivén
      const TAU = Math.PI * 2, base = Math.round((group.rotation.y - frame.yaw) / TAU) * TAU;
      const goal = base + frame.yaw + Math.sin(time * 0.35) * 0.18;
      group.rotation.y += (goal - group.rotation.y) * (1 - Math.pow(0.08, dt));
    }
    group.rotation.x = frame.tilt + Math.sin(time * 0.25) * 0.05;
    look.lerp(mouseOn ? mouse : ZERO, 0.04);
    camera.position.set(look.x * 0.35, 0.15 + look.y * 0.22, 5.4 - uniforms.uWarp.value * 2.0);
    camera.lookAt(group.position.x * 0.3, group.position.y * 0.3, 0);
    uniforms.uMouse.value.lerp(mouse, 0.25);
    uniforms.uMouseOn.value += ((mouseOn ? 1 : 0) - uniforms.uMouseOn.value) * 0.08;
    render();
  }
  function start() {
    if (opts.reducedMotion) { render(); return; }
    if (!raf && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }
  const onVis = () => { if (!document.hidden) start(); };
  document.addEventListener("visibilitychange", onVis);
  start();

  return {
    goTo, setFrame,
    get current() { return next; },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect();
      window.removeEventListener("pointermove", onMove); document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis); renderer.dispose();
    },
  };
}
