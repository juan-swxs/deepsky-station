// Visor 3D de la carcasa TinyGS: STL exportados de SolidWorks (mm, coordenadas del ensamble),
// materiales PBR, sombras suaves, despiece y antena ground-plane conectada al SMA.
import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const MODELS = "assets/models/";
const SMA = new THREE.Vector3(22, 37.5, 10.5);      // centro del agujero SMA en la pared superior (mm)

export function initCaseViewer(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!opts.capture });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.pixelRatio || 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 120;
  controls.maxDistance = 600;
  controls.minPolarAngle = Math.PI * 0.18;
  controls.maxPolarAngle = Math.PI * 0.62;
  controls.autoRotate = !opts.capture && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  controls.autoRotateSpeed = 0.6;
  controls.target.set(42, 56, 10);

  // ---- Luces ----
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-160, 260, 220);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 6;
  key.shadow.bias = -0.0004;
  Object.assign(key.shadow.camera, { left: -220, right: 220, top: 220, bottom: -220, near: 10, far: 900 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffb27a, 1.1);       // contraluz cálido (puntas de las fibras)
  rim.position.set(220, 60, -180);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xe8e6f2, 0x6d6a78, 0.35));

  // Suelo que solo recibe sombra
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.ShadowMaterial({ opacity: 0.22 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -40;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---- Materiales ----
  const shellMat = new THREE.MeshPhysicalMaterial({ color: 0x1a1a1e, roughness: 0.58, metalness: 0.0, clearcoat: 0.18, clearcoatRoughness: 0.6, sheen: 0.4, sheenRoughness: 0.8, sheenColor: 0x3a3a44 });
  const boardMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.15 });
  const hdrMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.5 });
  const alu = new THREE.MeshStandardMaterial({ color: 0xd9dbe0, metalness: 1, roughness: 0.22 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8b25a, metalness: 1, roughness: 0.25 });
  const blackRub = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.7 });
  const tipMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.5, emissive: 0xff8a2a, emissiveIntensity: 0.0 });

  const model = new THREE.Group();          // todo en mm, coordenadas del ensamble
  scene.add(model);
  const parts = {};

  // Colores por vértice para la placa (PCB, OLED, USB) y las regletas (plástico, pines dorados)
  function paintBoard(geo) {
    const p = geo.attributes.position, c = new Float32Array(p.count * 3), col = new THREE.Color();
    for (let i = 0; i < p.count; i += 3) {
      const zc = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
      const xc = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
      if (zc > 17.7) col.set(0x0b0d14);                       // vidrio del OLED
      else if (zc > 13.6 && xc > -21 && xc < 13.5) col.set(0x1b1d26);   // marco del OLED
      else if (xc < -29.2 && zc > 12.8) col.set(0xbfc3c9);     // USB-C metálico
      else col.set(0xeeece6);                                  // PCB blanca
      for (let k = 0; k < 3; k++) col.toArray(c, (i + k) * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(c, 3));
  }
  function paintHeaders(geo) {
    const p = geo.attributes.position, c = new Float32Array(p.count * 3), col = new THREE.Color();
    for (let i = 0; i < p.count; i += 3) {
      const zc = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
      col.set(zc > 9.0 && zc < 11.5 ? 0x121214 : 0xd8b25a);
      for (let k = 0; k < 3; k++) col.toArray(c, (i + k) * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(c, 3));
  }

  const loader = new STLLoader();
  const load = (f) => new Promise((res, rej) => loader.load(MODELS + f, res, undefined, rej));

  const ready = Promise.all([
    load("estuche_v2_trasera.stl"), load("estuche_v2_frontal.stl"), load("heltec_v3.stl"), load("regletas_2x18.stl"),
  ]).then(([back, front, board, hdr]) => {
    paintBoard(board); paintHeaders(hdr);
    const mk = (g, m) => { g.computeVertexNormals(); const o = new THREE.Mesh(g, m); o.castShadow = o.receiveShadow = true; return o; };
    parts.back = mk(back, shellMat);
    parts.front = mk(front, shellMat);
    parts.board = mk(board, boardMat);
    parts.hdr = mk(hdr, hdrMat);
    for (const k of ["back", "front", "board", "hdr"]) model.add(parts[k]);
    buildAntenna();
    applyExplode(0);
    setView(opts.view || "iso", true);
    opts.onReady && opts.onReady();
  });

  // ---- SMA, cable RG58 y antena ground-plane (no a escala) ----
  function buildAntenna() {
    const g = new THREE.Group();
    // Conector SMA saliendo de la pared superior
    const sma = new THREE.Mesh(new THREE.CylinderGeometry(3.15, 3.15, 9, 32), gold);
    sma.position.copy(SMA).add(new THREE.Vector3(0, 4.2, 0));
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 2.6, 6), gold);
    nut.position.copy(SMA).add(new THREE.Vector3(0, 1.4, 0));
    const plug = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 9, 6), gold);
    plug.position.copy(SMA).add(new THREE.Vector3(0, 12, 0));
    g.add(sma, nut, plug);
    // Antena: base a la derecha y arriba del estuche
    const base = new THREE.Vector3(104, 40, 4);
    const curve = new THREE.CatmullRomCurve3([
      SMA.clone().add(new THREE.Vector3(0, 16, 0)),
      SMA.clone().add(new THREE.Vector3(4, 34, 2)),
      new THREE.Vector3(50, 62, 16),
      new THREE.Vector3(88, 22, 8),
      base.clone().add(new THREE.Vector3(0, -12, 0)),
      base.clone().add(new THREE.Vector3(0, -2, 0)),
    ]);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 2.4, 14), blackRub);
    g.add(cable);
    const H = 62;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, H, 32), alu);
    tube.position.copy(base).add(new THREE.Vector3(0, H / 2, 0));
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 4, 32), alu);
    collar.position.copy(base).add(new THREE.Vector3(0, H - 2, 0));
    const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 58, 12), alu);
    whip.position.copy(base).add(new THREE.Vector3(0, H + 29, 0));
    const wtip = new THREE.Mesh(new THREE.SphereGeometry(1.7, 16, 12), tipMat);
    wtip.position.copy(base).add(new THREE.Vector3(0, H + 58, 0));
    g.add(tube, collar, whip, wtip);
    const hub = base.clone().add(new THREE.Vector3(0, H - 2, 0));
    for (let i = 0; i < 4; i++) {                  // 4 radiales a 45° hacia abajo
      const a = Math.PI / 4 + i * Math.PI / 2, L = 50;
      const dir = new THREE.Vector3(Math.cos(a) * Math.SQRT1_2, -Math.SQRT1_2, Math.sin(a) * Math.SQRT1_2);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, L, 10), alu);
      rod.position.copy(hub).addScaledVector(dir, L / 2);
      rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(1.8, 14, 10), tipMat);
      tip.position.copy(hub).addScaledVector(dir, L);
      g.add(rod, tip);
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    parts.antenna = g;
    model.add(g);
  }

  // ---- Despiece ----
  let explode = 0;
  function applyExplode(e) {
    explode = e;
    if (!parts.front) return;
    const s = THREE.MathUtils.smootherstep(e, 0, 1);
    parts.front.position.z = s * 34;
    parts.board.position.z = parts.hdr.position.z = s * 12;
    parts.back.position.z = -s * 10;
    parts.antenna.visible = e < 0.98;
    parts.antenna.traverse((o) => { if (o.material) { o.material.transparent = s > 0.01; o.material.opacity = 1 - s * 0.85; } });
  }

  // ---- Vistas ----
  const views = {
    front: [new THREE.Vector3(36, 42, 380), new THREE.Vector3(36, 40, 10)],
    back: [new THREE.Vector3(30, 50, -360), new THREE.Vector3(36, 40, 10)],
    iso: [new THREE.Vector3(-205, 175, 345), new THREE.Vector3(42, 56, 10)],
    despiece: [new THREE.Vector3(-150, 95, 230), new THREE.Vector3(0, 6, 14)],
  };
  let tween = null;
  function setView(name, instant) {
    const [p, t] = views[name] || views.iso;
    if (instant) { camera.position.copy(p); controls.target.copy(t); controls.update(); return; }
    tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: p, t1: t, k: 0 };
  }

  // ---- Bucle ----
  let running = true, raf = 0, last = performance.now();
  function resize() {
    const w = canvas.clientWidth || 800, h = canvas.clientHeight || 600;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  const io = new IntersectionObserver(([en]) => { running = en.isIntersecting; if (running) loop(); });
  io.observe(canvas);
  controls.addEventListener("start", () => { controls.autoRotate = false; tween = null; });

  function loop() {
    cancelAnimationFrame(raf);
    if (!running) return;
    raf = requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (tween) {
      tween.k = Math.min(1, tween.k + dt * 1.4);
      const s = THREE.MathUtils.smootherstep(tween.k, 0, 1);
      camera.position.lerpVectors(tween.p0, tween.p1, s);
      controls.target.lerpVectors(tween.t0, tween.t1, s);
      if (tween.k >= 1) tween = null;
    }
    // Las puntas de la antena "laten" en naranja, como las fibras del héroe
    tipMat.emissiveIntensity = 0.6 + 0.4 * Math.sin(now / 420);
    controls.update();
    renderer.render(scene, camera);
  }
  loop();

  return {
    ready,
    setExplode: applyExplode,
    setView,
    renderOnce() { controls.update(); renderer.render(scene, camera); },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); renderer.dispose(); pmrem.dispose(); },
  };
}
