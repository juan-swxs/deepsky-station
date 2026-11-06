// Página DeepSky_Station — lógica general.
// ======================= DATOS EDITABLES =======================
const CONFIG = {
  stationUrl: "https://app.tinygs.com/station/DeepSky_Station@YE6YyEiGKQeLknUc",
  lat: 5.067, lon: -73.88,                 // 3 decimales, como los publica TinyGS
  recordKm: 3238.9,
  // Altura de la antena sobre el suelo en metros. null = "Por medir".
  alturaAntenaM: null,
  alturaDetalle: "",                       // p. ej. "en el techo de una casa de 2 pisos"
  // Texto del paso "La antena, al aire libre". Edítalo con los detalles reales del montaje.
  montaje: "La antena ground-plane se instaló al aire libre, en lo alto y con el cielo despejado, sujeta a un poste de madera. " +
           "Su cable RG58 de 3 m baja hasta la placa, que queda bajo techo dentro de la carcasa, conectada por el pigtail u.FL → SMA. " +
           "Los cuatro radiales a 45° forman el plano de tierra que hace que la antena reciba igual en todas las direcciones.",
};
// ===============================================================

document.documentElement.classList.add("js");
// ?captura: modo para generar capturas de toda la página (sin animaciones de entrada)
if (new URLSearchParams(location.search).has("captura")) document.documentElement.classList.add("captura");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---------- Links ----------
for (const a of [$("#cta-top"), $("#station-link")]) a.href = CONFIG.stationUrl;
$("#station-link-text").textContent = CONFIG.stationUrl.replace("https://", "");
$("#copy-link").addEventListener("click", async (e) => {
  try { await navigator.clipboard.writeText(CONFIG.stationUrl); e.target.textContent = "Link copiado"; }
  catch { e.target.textContent = "Copia: " + CONFIG.stationUrl; }
  setTimeout(() => (e.target.textContent = "Copiar link"), 2200);
});
if (window.qrcode) {
  const qr = window.qrcode(0, "M");
  qr.addData(CONFIG.stationUrl); qr.make();
  $("#qr").innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
}

// ---------- Altura y montaje ----------
const altVal = $("#altura-val"), altNota = $("#altura-nota"), card = $("#altura-card");
if (CONFIG.alturaAntenaM == null) {
  card.classList.add("pending");
  altVal.textContent = "Por medir";
  altNota.textContent = "Distancia desde el suelo hasta la base de la antena.";
  $("#altura-montaje").textContent = "Altura de la antena al suelo: pendiente de medir.";
} else {
  altVal.innerHTML = `${CONFIG.alturaAntenaM.toLocaleString("es-CO")} <span>m</span>`;
  altNota.textContent = CONFIG.alturaDetalle || "Desde el suelo hasta la base de la antena.";
  $("#altura-montaje").textContent = `La base de la antena quedó a ${CONFIG.alturaAntenaM.toLocaleString("es-CO")} m del suelo${CONFIG.alturaDetalle ? ", " + CONFIG.alturaDetalle : ""}.`;
}
$("#montaje-texto").textContent = CONFIG.montaje;

// ---------- Héroe (animación de fibras, js/hero.js) ----------
const phaseBtns = $$(".phases button");
let hero = null;
function markPhase(i) { phaseBtns.forEach((b) => b.setAttribute("aria-selected", String(+b.dataset.phase === i))); }
import("./hero.js").then(({ initHero }) => {
  const fase = new URLSearchParams(location.search).get("fase");   // ?fase=0..3 arranca en esa figura
  hero = initHero($("#hero-canvas"), { reducedMotion: reduced, onPhase: markPhase, initialPhase: fase !== null ? +fase : undefined });
  if (fase !== null) markPhase(+fase); else hero.setPhase?.(1);
}).catch((err) => console.warn("Animación del héroe no disponible:", err));
phaseBtns.forEach((b) => b.addEventListener("click", () => { const i = +b.dataset.phase; markPhase(i); hero?.setPhase(i); }));

// ---------- Navegación activa ----------
const navLinks = $$(".pill a");
const secIO = new IntersectionObserver((entries) => {
  for (const en of entries) if (en.isIntersecting) {
    navLinks.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + en.target.id));
  }
}, { rootMargin: "-45% 0px -50% 0px" });
$$("section[id]").forEach((s) => secIO.observe(s));

// ---------- Aparición y contadores ----------
$$(".section-head, .coord, .chain li, .viewer-wrap, .step, .map-wrap, .linkcard > *").forEach((el) => el.classList.add("reveal"));
const fmt = (v, d) => v.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });
function countUp(el) {
  const to = parseFloat(el.dataset.count), d = +(el.dataset.dec || 0);
  if (reduced) { el.textContent = fmt(to, d); return; }
  const t0 = performance.now(), dur = 1400;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(to * e, d);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const revIO = new IntersectionObserver((entries) => {
  for (const en of entries) if (en.isIntersecting) {
    en.target.classList.add("in");
    $$("[data-count]", en.target).forEach(countUp);
    if (en.target.matches("[data-count]")) countUp(en.target);
    revIO.unobserve(en.target);
  }
}, { threshold: 0.15 });
$$(".reveal, .ticker").forEach((el) => revIO.observe(el));

// ---------- Visor 3D (carga diferida) ----------
const caseCanvas = $("#case-canvas");
const viewerIO = new IntersectionObserver(async ([en]) => {
  if (!en.isIntersecting) return;
  viewerIO.disconnect();
  try {
    const { initCaseViewer } = await import("./case-viewer.js");
    const v = initCaseViewer(caseCanvas, { onReady: () => $("#viewer-loading").remove() });
    $("#explode").addEventListener("input", (e) => v.setExplode(+e.target.value));
    $$(".viewer-btns button").forEach((b) => b.addEventListener("click", () => v.setView(b.dataset.view)));
  } catch (err) {
    console.error(err);
    $("#viewer-loading").textContent = "No se pudo cargar el modelo 3D.";
  }
}, { rootMargin: "300px" });
viewerIO.observe(caseCanvas);

// ---------- Mapa ----------
function initMap() {
  if (!window.L) return;
  const home = [CONFIG.lat, CONFIG.lon];
  const map = L.map("map", { zoomControl: true, scrollWheelZoom: false, attributionControl: true }).setView(home, 15);
  const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19, attribution: "Imágenes © Esri, Maxar, Earthstar Geographics",
  }).addTo(map);
  const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "© colaboradores de OpenStreetMap",
  });
  const pin = L.divIcon({ className: "", html: '<div class="pin"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
  const photo = (img) => L.divIcon({ className: "", html: `<div class="pin-photo" style="background-image:url('${img}')"></div>`, iconSize: [46, 46], iconAnchor: [23, 52] });

  L.marker(home, { icon: pin, title: "DeepSky_Station" }).addTo(map).bindPopup(
    `<div class="popup"><img src="assets/img/antena_estacion.jpg" alt="Antena de la estación"><b>DeepSky_Station</b>Nemocón, Cundinamarca · ${CONFIG.lat.toFixed(3)}, ${CONFIG.lon.toFixed(3)}<br>2579 m s. n. m. · QTH FJ35bb</div>`);
  // Marcadores de fotos alrededor de la estación (desplazados unos metros para que no se tapen)
  L.marker([CONFIG.lat + 0.0012, CONFIG.lon - 0.0016], { icon: photo("assets/img/antena_estacion.jpg") }).addTo(map).bindPopup(
    `<div class="popup"><img src="assets/img/antena_estacion.jpg" alt="Antena ground-plane"><b>La antena</b>Ground-plane HYS 433 MHz, 3 dBi, con 4 radiales a 45°.</div>`);
  L.marker([CONFIG.lat - 0.0012, CONFIG.lon + 0.0017], { icon: photo("assets/img/render_estuche.png") }).addTo(map).bindPopup(
    `<div class="popup"><img src="assets/img/render_estuche.png" alt="Render de la carcasa"><b>La carcasa</b>Heltec LoRa32 V3 dentro de la carcasa de 75 × 75 mm diseñada en SolidWorks.</div>`);

  const record = L.circle(home, { radius: CONFIG.recordKm * 1000, color: "#ff8a2a", weight: 2, fillColor: "#ff8a2a", fillOpacity: 0.06, dashArray: "6 8" })
    .addTo(map).bindTooltip(`Récord: ${CONFIG.recordKm.toLocaleString("es-CO")} km`, { sticky: true });

  const toggle = (which) => {
    $$(".map-tools [data-layer]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.layer === which)));
    if (which === "sat") { map.removeLayer(osm); sat.addTo(map); } else { map.removeLayer(sat); osm.addTo(map); }
  };
  $$(".map-tools [data-layer]").forEach((b) => b.addEventListener("click", () => toggle(b.dataset.layer)));
  $("#map-record").addEventListener("click", () => map.flyToBounds(record.getBounds(), { duration: reduced ? 0 : 1.6 }));
  $("#map-home").addEventListener("click", () => map.flyTo(home, 15, { duration: reduced ? 0 : 1.4 }));
  map.on("click", () => map.scrollWheelZoom.enable());
}
const mapIO = new IntersectionObserver(([en]) => { if (en.isIntersecting) { mapIO.disconnect(); initMap(); } }, { rootMargin: "400px" });
mapIO.observe($("#map"));
