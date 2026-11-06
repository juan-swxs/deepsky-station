// DeepSky_Station — navegación por capas del mundo de fibras.
// ======================= DATOS EDITABLES =======================
const CONFIG = {
  stationUrl: "https://app.tinygs.com/station/DeepSky_Station@YE6YyEiGKQeLknUc",
  lat: 5.067, lon: -73.88,
  recordKm: 3238.9,
  alturaAntenaM: null,               // altura de la antena sobre el suelo (m). null = "Por medir"
  alturaDetalle: "",                 // p. ej. "en el techo de una casa de 2 pisos"
  montaje: "La antena ground-plane se instaló al aire libre, en lo alto y con el cielo despejado, sujeta a un poste de madera. " +
           "Su cable RG58 de 3 m baja hasta la placa, que queda bajo techo dentro de la carcasa, conectada por el pigtail u.FL → SMA. " +
           "Los cuatro radiales a 45° forman el plano de tierra que hace que la antena reciba igual en todas las direcciones.",
};
// ===============================================================

import { initWorld, shapeBurst, shapeSatellite, shapeAntenna, shapeEarth, shapeMap } from "./world.js?v=8";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const capture = params.has("captura");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
if (capture) document.documentElement.classList.add("captura");

// ---------- Figuras: 0 señal · 1 satélite · 2 antena · 3 Tierra · 4 globo+pin · 5 cadena · 6 carcasa · 7 terreno ----------
let extra = {};
try { extra = await import("./shapes-extra.js?v=8"); } catch (e) { console.warn("shapes-extra.js no disponible, uso figuras base", e); }
const SH = [shapeBurst, shapeSatellite, shapeAntenna, shapeEarth,
  extra.shapeGlobePin || shapeEarth, extra.shapeChain || shapeSatellite, extra.shapeCase || shapeAntenna, shapeMap];

// Encuadre: x/y desplazan la figura para dejar espacio al panel; spin 0 = la figura se queda de frente
const F = {
  inicio: { x: 0.5, y: 0.0, s: 1.05, free: 0.56, tilt: 0.18, spin: 0.12 },
  globo: { x: -0.4, y: 0.04, s: 1.18, free: 0.6, tilt: 0.05, spin: 0, yaw: 0 },
  cadena: { x: -0.4, y: 0.03, s: 0.92, free: 0.6, tilt: 0.06, spin: 0, yaw: 0.35 },
  izq: { x: 0.4, y: 0, s: 1.15, free: 0.6, tilt: 0.16, spin: 0.12 },
  carcasa: { x: 0.4, y: 0, s: 1.12, free: 0.6, tilt: 0.22, spin: 0, yaw: -0.55 },
  mapa: { x: -0.62, y: 0.04, s: 0.72, free: 0.48, tilt: 0.0, spin: 0, yaw: 0 },
};
const LAYERS = [
  { id: "inicio", name: "Señal", shape: 0, frame: F.inicio },
  { id: "coordenadas", name: "Coordenadas", shape: 4, frame: F.globo },
  { id: "arquitectura", name: "Arquitectura", shape: 5, frame: F.cadena },
  { id: "montaje", name: "Montaje", steps: [
      { shape: 5, frame: { ...F.cadena, x: 0.4, yaw: -0.35 } },   // componentes
      { shape: 1, frame: F.izq },                                    // firmware: escuchando un satélite
      { shape: 6, frame: F.carcasa },                                // diseño de la carcasa
      { shape: 2, frame: F.izq },                                    // antena
      { shape: 3, frame: F.izq },                                    // resultados: la Tierra y su órbita
  ] },
  { id: "mapa", name: "Mapa", shape: 7, frame: F.mapa },
  { id: "link", name: "Link", shape: 3, frame: F.izq },
];
const MONTAJE = 3;

// ---------- Datos en la página ----------
for (const a of [$("#cta-top"), $("#station-link")]) a.href = CONFIG.stationUrl;
$("#station-link-text").textContent = CONFIG.stationUrl.replace("https://", "");
$("#copy-link").addEventListener("click", async (e) => {
  try { await navigator.clipboard.writeText(CONFIG.stationUrl); e.target.textContent = "Link copiado"; }
  catch { e.target.textContent = CONFIG.stationUrl; }
  setTimeout(() => (e.target.textContent = "Copiar link"), 2200);
});
if (window.qrcode) { const q = window.qrcode(0, "M"); q.addData(CONFIG.stationUrl); q.make(); $("#qr").innerHTML = q.createSvgTag({ cellSize: 6, margin: 0, scalable: true }); }
if (CONFIG.alturaAntenaM == null) {
  $("#altura-card").classList.add("pending");
  $("#altura-val").textContent = "Por medir";
  $("#altura-nota").textContent = "Del suelo a la base de la antena.";
  $("#altura-montaje").textContent = "Altura de la antena al suelo: pendiente de medir.";
} else {
  const m = CONFIG.alturaAntenaM.toLocaleString("es-CO");
  $("#altura-val").innerHTML = `${m} <span>m</span>`;
  $("#altura-nota").textContent = CONFIG.alturaDetalle || "Del suelo a la base de la antena.";
  $("#altura-montaje").textContent = `La base de la antena quedó a ${m} m del suelo${CONFIG.alturaDetalle ? ", " + CONFIG.alturaDetalle : ""}.`;
}
$("#montaje-texto").textContent = CONFIG.montaje;

// ---------- Mundo ----------
const fromHash = () => Math.max(0, LAYERS.findIndex((l) => "#" + l.id === location.hash));
let layer = params.has("capa") ? Math.min(LAYERS.length - 1, +params.get("capa")) : fromHash();
let step = params.has("paso") ? Math.min(4, +params.get("paso")) : 0;
const target = (l = layer, s = step) => (LAYERS[l].steps ? LAYERS[l].steps[s] : LAYERS[l]);

const world = initWorld($("#world"), SH, { reducedMotion: reduced || capture, initial: target().shape });
world.setFrame(target().frame);

// ---------- Paneles ----------
const sections = LAYERS.map((l) => document.getElementById(l.id));
let busyUntil = 0;
function showLayer(i, instant) {
  sections.forEach((s, k) => {
    if (k === i) return;
    if (s.classList.contains("active")) {
      s.classList.add("leaving"); s.classList.remove("shown");
      setTimeout(() => s.classList.remove("active", "leaving"), instant ? 0 : 450);
    }
  });
  const s = sections[i];
  s.classList.remove("leaving");
  s.classList.add("active");
  const delay = instant ? 0 : 950;               // el panel aparece cuando la figura se está armando
  setTimeout(() => { if (layer === i) { s.classList.add("shown"); onShown(i); } }, delay);
}
function onShown(i) {
  if (LAYERS[i].id === "mapa") initMap();
  if (LAYERS[i].id === "inicio") $$("[data-count]", sections[i]).forEach(countUp);
}
function renderStep() {
  $$("#montaje .step").forEach((a) => a.classList.toggle("on", +a.dataset.step === step));
  $$("#montaje .steps-nav button").forEach((b) => b.setAttribute("aria-selected", String(+b.dataset.step === step)));
  $("#step-count").textContent = `${step + 1} / 5`;
}
function updateChrome() {
  const L = LAYERS[layer];
  $$(".pill a").forEach((a) => a.classList.toggle("on", +a.dataset.go === layer));
  $$(".rail button").forEach((b) => { const g = +b.dataset.go; b.classList.toggle("on", g === layer); b.classList.toggle("done", g < layer); });
  $("#hud-depth").textContent = `Capa ${String(layer + 1).padStart(2, "0")} / ${String(LAYERS.length).padStart(2, "0")}`;
  $("#hud-name").textContent = L.steps ? `${L.name} · paso ${step + 1}` : L.name;
  history.replaceState(null, "", "#" + L.id + (capture ? "" : ""));
}

function go(l, s = 0, instant = false) {
  l = Math.max(0, Math.min(LAYERS.length - 1, l));
  const layerChanged = l !== layer;
  layer = l; step = LAYERS[l].steps ? Math.max(0, Math.min(LAYERS[l].steps.length - 1, s)) : 0;
  const t = target();
  world.goTo(t.shape, t.frame);
  if (layerChanged || instant) showLayer(layer, instant);
  renderStep(); updateChrome();
  busyUntil = performance.now() + (reduced ? 250 : 1150);
  $("#hint").classList.add("gone");
}
function next() {
  if (LAYERS[layer].steps && step < LAYERS[layer].steps.length - 1) return go(layer, step + 1);
  if (layer < LAYERS.length - 1) go(layer + 1, 0);
}
function prev() {
  if (LAYERS[layer].steps && step > 0) return go(layer, step - 1);
  if (layer > 0) { const p = layer - 1; go(p, LAYERS[p].steps ? LAYERS[p].steps.length - 1 : 0); }
}

// ---------- Entrada ----------
const modal = $("#viewer-modal");
const canScroll = (el, dy) => {
  const p = el.closest(".panel");
  if (!p || p.scrollHeight <= p.clientHeight + 2) return false;
  return dy > 0 ? p.scrollTop + p.clientHeight < p.scrollHeight - 2 : p.scrollTop > 2;
};
let acc = 0;
window.addEventListener("wheel", (e) => {
  if (modal.open || e.target.closest("#map")) return;
  if (canScroll(e.target, e.deltaY)) return;
  e.preventDefault();
  if (performance.now() < busyUntil) { acc = 0; return; }
  acc += e.deltaY;
  if (Math.abs(acc) > 40) { acc > 0 ? next() : prev(); acc = 0; }
}, { passive: false });

let t0 = null;
window.addEventListener("touchstart", (e) => { t0 = e.target.closest("#map") ? null : { y: e.touches[0].clientY, x: e.touches[0].clientX, el: e.target }; }, { passive: true });
window.addEventListener("touchend", (e) => {
  if (!t0 || modal.open) return;
  const dy = t0.y - e.changedTouches[0].clientY, dx = t0.x - e.changedTouches[0].clientX;
  if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx) && !canScroll(t0.el, dy) && performance.now() > busyUntil) dy > 0 ? next() : prev();
  t0 = null;
}, { passive: true });

window.addEventListener("keydown", (e) => {
  if (modal.open || e.target.matches("input, textarea")) return;
  if (["ArrowDown", "PageDown", "ArrowRight"].includes(e.key) || (e.key === " " && !e.target.closest("button, a"))) { e.preventDefault(); next(); }
  else if (["ArrowUp", "PageUp", "ArrowLeft"].includes(e.key)) { e.preventDefault(); prev(); }
  else if (e.key === "Home") go(0); else if (e.key === "End") go(LAYERS.length - 1);
});
document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-go]");
  if (g) { e.preventDefault(); go(+g.dataset.go, 0); return; }
  const st = e.target.closest("[data-step]");
  if (st && st.closest(".steps-nav")) { go(MONTAJE, +st.dataset.step); return; }
  if (e.target.closest("[data-step-next]")) { step < 4 ? go(MONTAJE, step + 1) : go(MONTAJE + 1); return; }
  if (e.target.closest("[data-step-prev]")) { step > 0 ? go(MONTAJE, step - 1) : go(MONTAJE - 1); }
});
window.addEventListener("hashchange", () => { const i = fromHash(); if (i !== layer) go(i); });

// ---------- Contadores ----------
const fmt = (v, d) => v.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });
function countUp(el) {
  const to = parseFloat(el.dataset.count), d = +(el.dataset.dec || 0);
  if (reduced || capture || el.dataset.done) { el.textContent = fmt(to, d); return; }
  el.dataset.done = 1;
  const t = performance.now();
  const stepF = (now) => { const k = Math.min(1, (now - t) / 1400); el.textContent = fmt(to * (1 - Math.pow(1 - k, 3)), d); if (k < 1) requestAnimationFrame(stepF); };
  requestAnimationFrame(stepF);
}

// ---------- Visor 3D ----------
let viewer = null;
$$("[data-open3d]").forEach((b) => b.addEventListener("click", async () => {
  modal.showModal();
  if (viewer) return;
  try {
    const { initCaseViewer } = await import("./case-viewer.js?v=8");
    viewer = initCaseViewer($("#case-canvas"), { onReady: () => $("#viewer-loading")?.remove() });
    $("#explode").addEventListener("input", (e) => viewer.setExplode(+e.target.value));
    $$(".viewer-btns button").forEach((x) => x.addEventListener("click", () => {
      if (x.dataset.view === "despiece") { $("#explode").value = 1; viewer.setExplode(1); }
      viewer.setView(x.dataset.view);
    }));
  } catch (err) { console.error(err); $("#viewer-loading").textContent = "No se pudo cargar el modelo 3D."; }
}));
$("#close3d").addEventListener("click", () => modal.close());
modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });

// ---------- Mapa ----------
let mapReady = null;
function initMap() {
  if (mapReady) { mapReady.invalidateSize(); return; }
  if (!window.L) return;
  const home = [CONFIG.lat, CONFIG.lon];
  const map = L.map("map", { scrollWheelZoom: true }).setView(home, 15);
  const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Imágenes © Esri, Maxar, Earthstar Geographics" }).addTo(map);
  const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© colaboradores de OpenStreetMap" });
  const pin = L.divIcon({ className: "", html: '<div class="pin"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
  const photo = (img) => L.divIcon({ className: "", html: `<div class="pin-photo" style="background-image:url('${img}')"></div>`, iconSize: [46, 46], iconAnchor: [23, 52] });
  L.marker(home, { icon: pin, title: "DeepSky_Station" }).addTo(map).bindPopup(`<div class="popup"><img src="assets/img/antena_estacion.jpg" alt="Antena de la estación"><b>DeepSky_Station</b>Nemocón · ${CONFIG.lat.toFixed(3)}, ${CONFIG.lon.toFixed(3)}<br>2579 m s. n. m. · QTH FJ35bb</div>`);
  L.marker([CONFIG.lat + 0.0012, CONFIG.lon - 0.0016], { icon: photo("assets/img/antena_estacion.jpg") }).addTo(map).bindPopup(`<div class="popup"><img src="assets/img/antena_estacion.jpg" alt="Antena ground-plane"><b>La antena</b>Ground-plane HYS 433 MHz, 3 dBi, 4 radiales a 45°.</div>`);
  L.marker([CONFIG.lat - 0.0012, CONFIG.lon + 0.0017], { icon: photo("assets/img/render_estuche.png") }).addTo(map).bindPopup(`<div class="popup"><img src="assets/img/render_estuche.png" alt="Render de la carcasa"><b>La carcasa</b>Heltec LoRa32 V3 en la carcasa de 75 × 75 mm.</div>`);
  const record = L.circle(home, { radius: CONFIG.recordKm * 1000, color: "#ff8a2a", weight: 2, fillColor: "#ff8a2a", fillOpacity: 0.06, dashArray: "6 8" }).addTo(map).bindTooltip(`Récord: ${fmt(CONFIG.recordKm, 1)} km`, { sticky: true });
  const toggle = (which) => {
    $$(".map-tools [data-layer]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.layer === which)));
    if (which === "sat") { map.removeLayer(osm); sat.addTo(map); } else { map.removeLayer(sat); osm.addTo(map); }
  };
  $$(".map-tools [data-layer]").forEach((b) => b.addEventListener("click", () => toggle(b.dataset.layer)));
  $("#map-record").addEventListener("click", () => map.flyToBounds(record.getBounds(), { duration: reduced ? 0 : 1.6 }));
  $("#map-home").addEventListener("click", () => map.flyTo(home, 15, { duration: reduced ? 0 : 1.4 }));
  mapReady = map;
  setTimeout(() => map.invalidateSize(), 300);
}

// ---------- Arranque ----------
go(layer, step, true);
