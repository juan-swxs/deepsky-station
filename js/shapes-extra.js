// shapes-extra.js
// Cuatro generadores adicionales de fibras: globo con pin, cadena de recepción,
// carcasa del proyecto y terreno topográfico.
// Firma: (i, N, K, R) -> Array de K puntos [x,y,z], de la raíz a la punta.
// R() es un random determinista en [0,1). Eje Y arriba, cámara en +Z.

const PI = Math.PI, TAU = Math.PI * 2, D = Math.PI / 180;

// ---------------------------------------------------------------------------
// Utilidades internas (no exportadas)
// ---------------------------------------------------------------------------
const fin = (v) => (Number.isFinite(v) ? v : 0);
const lerp = (a, b, t) => a + (b - a) * t;

// Segmento recto a->b muestreado en K puntos
const line = (a, b, K) =>
  Array.from({ length: K }, (_, k) => {
    const t = k / (K - 1);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  });

// Curva paramétrica fn(t) con t en [t0,t1], K puntos
function curve(fn, t0, t1, K) {
  const o = new Array(K);
  for (let k = 0; k < K; k++) o[k] = fn(t0 + (t1 - t0) * (k / (K - 1)));
  return o;
}

// Remuestrea el tramo [t0,t1] (fracción de longitud de arco) de una polilínea 3D a K puntos
function subPoly(pts, t0, t1, K) {
  const n = pts.length;
  const cum = new Array(n);
  cum[0] = 0;
  for (let j = 1; j < n; j++) {
    const a = pts[j - 1], b = pts[j];
    cum[j] = cum[j - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }
  const tot = cum[n - 1];
  const out = new Array(K);
  if (n < 2 || !(tot > 1e-9)) {
    for (let k = 0; k < K; k++) out[k] = [pts[0][0], pts[0][1], pts[0][2]];
    return out;
  }
  let j = 1;
  for (let k = 0; k < K; k++) {
    const u = t0 + (t1 - t0) * (k / (K - 1));
    const s = Math.min(1, Math.max(0, u)) * tot;
    while (j > 1 && cum[j - 1] > s) j--;
    while (j < n - 1 && cum[j] < s) j++;
    const seg = cum[j] - cum[j - 1];
    const w = seg > 1e-12 ? (s - cum[j - 1]) / seg : 0;
    const a = pts[j - 1], b = pts[j];
    out[k] = [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w];
  }
  return out;
}

// Garantiza exactamente K puntos finitos (y aplica escala opcional)
function fix(pts, K, s = 1) {
  let p = pts;
  if (!p || p.length !== K) p = p && p.length ? subPoly(p, 0, 1, K) : line([0, 0, 0], [0, 0, 0], K);
  return p.map((q) => [fin(q[0]) * s, fin(q[1]) * s, fin(q[2]) * s]);
}

// Reparte el índice i entre partes con fracciones fr (suman 1).
// Devuelve [parte, índice local, cantidad de fibras de esa parte]
function split(i, N, fr) {
  let acc = 0;
  for (let p = 0; p < fr.length; p++) {
    const a = Math.round(acc * N);
    acc += fr[p];
    const b = p === fr.length - 1 ? N : Math.round(acc * N);
    if (i < b) return [p, i - a, Math.max(1, b - a)];
  }
  return [fr.length - 1, 0, 1];
}

// Rectángulo redondeado cerrado centrado en origen (z=0), polilínea 3D
function rrPoly(w, h, r, seg) {
  const a = w / 2, b = h / 2;
  r = Math.min(r, a, b);
  const o = [];
  const corner = (cx, cy, a0) => {
    for (let s = 0; s <= seg; s++) {
      const t = a0 + (PI / 2) * (s / seg);
      o.push([cx + r * Math.cos(t), cy + r * Math.sin(t), 0]);
    }
  };
  corner(a - r, -b + r, -PI / 2);
  corner(a - r, b - r, 0);
  corner(-a + r, b - r, PI / 2);
  corner(-a + r, -b + r, PI);
  o.push([o[0][0], o[0][1], 0]);
  return o;
}

const mv = (pts, dx, dy, dz) => pts.map((p) => [p[0] + dx, p[1] + dy, p[2] + dz]);

// Elige el sub-segmento que le toca a la fibra q de n dentro de una lista de segmentos [A,B]
function pickSeg(segs, q, n) {
  const m = segs.length;
  let s, p, pc;
  if (n >= m) { s = q % m; p = Math.floor(q / m); pc = Math.ceil(n / m); }
  else { s = Math.min(m - 1, Math.floor((q * m) / n)); p = 0; pc = 1; }
  const [A, B] = segs[s];
  const t0 = p / pc, t1 = (p + 1) / pc;
  return [
    [lerp(A[0], B[0], t0), lerp(A[1], B[1], t0), lerp(A[2], B[2], t0)],
    [lerp(A[0], B[0], t1), lerp(A[1], B[1], t1), lerp(A[2], B[2], t1)],
  ];
}

// Líneas horizontales discontinuas dentro de un rectángulo (efecto pantalla)
function hatch(cx, cy, w, h, q, n, rows, z, K, R) {
  const row = q % rows, piece = Math.floor(q / rows);
  const M = Math.max(1, Math.ceil(n / rows));
  const y = cy - h / 2 + (h * (row + 0.5)) / rows;
  const x0 = cx - w / 2 + (w * piece) / M;
  const x1 = x0 + (w / M) * (0.6 + 0.4 * R());
  return line([x0, y, z], [x1, y, z], K);
}

// Bézier cúbica 3D
function bez(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [0, 1, 2].map((k) => a * p0[k] + b * p1[k] + c * p2[k] + d * p3[k]);
}

// ---------------------------------------------------------------------------
// 1) GLOBO CON PIN
// ---------------------------------------------------------------------------
const GP_LAT0 = 5.067, GP_LON0 = -73.88, GP_TILT = 0.22; // pin "un poco arriba" del centro
const _gc1 = Math.cos(GP_LON0 * D), _gs1 = Math.sin(GP_LON0 * D);
const _ga = GP_LAT0 * D - GP_TILT;
const _gc2 = Math.cos(_ga), _gs2 = Math.sin(_ga);

// lat/lon en grados -> xyz ya girado (lon0 hacia +Z, luego inclinado en X)
function ll2xyz(lat, lon, r) {
  const la = lat * D, lo = lon * D;
  const x0 = r * Math.cos(la) * Math.sin(lo), y0 = r * Math.sin(la), z0 = r * Math.cos(la) * Math.cos(lo);
  // 1) restar la longitud del pin (giro en Y)
  const x1 = x0 * _gc1 - z0 * _gs1, z1 = x0 * _gs1 + z0 * _gc1;
  // 2) giro en X: baja la latitud del pin al ecuador y lo sube GP_TILT
  return [x1, y0 * _gc2 - z1 * _gs2, y0 * _gs2 + z1 * _gc2];
}

// Marco local en el pin: normal N y tangentes E1, E2
const GP_N = ll2xyz(GP_LAT0, GP_LON0, 1);
const GP_E1 = (() => {
  const v = [GP_N[2], 0, -GP_N[0]], l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
})();
const GP_E2 = [
  GP_N[1] * GP_E1[2] - GP_N[2] * GP_E1[1],
  GP_N[2] * GP_E1[0] - GP_N[0] * GP_E1[2],
  GP_N[0] * GP_E1[1] - GP_N[1] * GP_E1[0],
];
const comb = (n, sn, u, su, v, sv) => [
  n[0] * sn + u[0] * su + v[0] * sv,
  n[1] * sn + u[1] * su + v[1] * sv,
  n[2] * sn + u[2] * su + v[2] * sv,
];
// Punto sobre la esfera a distancia angular rho del pin, azimut phi
const capPt = (rho, phi, r) =>
  comb(GP_N, Math.cos(rho) * r, GP_E1, Math.sin(rho) * Math.cos(phi) * r, GP_E2, Math.sin(rho) * Math.sin(phi) * r);

// Costa esquemática de Sudamérica [lat, lon], sentido horario
const SA_COAST = [
  [12.4, -71.6], [10.6, -66.9], [10.7, -62.0], [7.0, -58.2], [5.9, -55.0], [4.8, -52.0],
  [1.8, -49.9], [-0.2, -48.0], [-2.5, -44.0], [-3.0, -40.0], [-5.2, -35.4], [-8.5, -34.8],
  [-13.0, -38.5], [-18.0, -39.5], [-22.9, -41.9], [-25.5, -48.5], [-29.5, -49.8], [-34.0, -53.5],
  [-35.0, -57.0], [-38.8, -62.2], [-41.0, -63.8], [-46.0, -67.5], [-50.0, -68.8], [-52.5, -69.5],
  [-55.0, -67.5], [-52.5, -74.0], [-46.0, -75.5], [-41.5, -73.8], [-33.0, -71.7], [-23.5, -70.5],
  [-18.3, -70.3], [-14.5, -76.0], [-6.0, -81.0], [-4.5, -81.2], [-2.0, -80.5], [1.0, -79.0],
  [7.0, -77.8], [9.4, -76.3], [11.0, -74.4], [12.4, -71.6],
];
let _coast = null;
function coast3D() {
  if (_coast) return _coast;
  const o = [];
  for (let j = 0; j < SA_COAST.length - 1; j++) {
    const a = SA_COAST[j], b = SA_COAST[j + 1];
    for (let s = 0; s < 4; s++) {
      const t = s / 4;
      o.push(ll2xyz(lerp(a[0], b[0], t), lerp(a[1], b[1], t), 1.006)); // densificado en lat/lon
    }
  }
  const l = SA_COAST[SA_COAST.length - 1];
  o.push(ll2xyz(l[0], l[1], 1.006));
  _coast = o;
  return o;
}

export function shapeGlobePin(i, N, K, R) {
  const [p, q, n] = split(i, N, [0.06, 0.14, 0.08, 0.72]);
  let pts;
  if (p === 0) {
    // Pin: haz radial corto, puntas en abanico
    const a = R() * TAU, rr = 0.03 * Math.sqrt(R());
    const root = comb(GP_N, 1, GP_E1, rr * Math.cos(a), GP_E2, rr * Math.sin(a));
    const len = 0.35 + 0.2 * R();
    const b = R() * TAU, sp = 0.16 * Math.sqrt(R());
    const tip = comb(GP_N, 1 + len, GP_E1, sp * Math.cos(b), GP_E2, sp * Math.sin(b));
    pts = line(root, tip, K);
  } else if (p === 1) {
    // 3 anillos de pulso (4, 8, 13 grados) como arcos solapados
    const c = q % 3;
    const rho = [4, 8, 13][c] * D + (R() - 0.5) * 0.004;
    const ph0 = R() * TAU, span = 0.9 + 0.8 * R();
    pts = curve((t) => capPt(rho, ph0 + span * t, 1.004), 0, 1, K);
  } else if (p === 2) {
    // Contorno de Sudamérica: tramos solapados de la polilínea
    const span = Math.min(1, 4 / n);
    const t0 = (q / n) * (1 - span);
    pts = subPoly(coast3D(), t0, t0 + span, K);
  } else {
    // Retícula: meridianos cada 20 grados y paralelos cada 15 grados (arcos parciales)
    const h = q >> 1;
    const lenRad = 0.6 + 0.5 * R();
    if ((q & 1) === 0) {
      const lon = (h % 18) * 20 - 180;
      const lenDeg = lenRad / D;
      const lat0 = -85 + R() * (170 - lenDeg);
      pts = curve((t) => ll2xyz(lat0 + lenDeg * t, lon, 1), 0, 1, K);
    } else {
      const lat = -75 + 15 * (h % 11);
      const lenDeg = Math.min(340, lenRad / Math.max(0.2, Math.cos(lat * D)) / D);
      const lon0 = R() * 360 - 180;
      pts = curve((t) => ll2xyz(lat, lon0 + lenDeg * t, 1), 0, 1, K);
    }
    if (R() < 0.5) pts.reverse();
  }
  return fix(pts, K);
}

// ---------------------------------------------------------------------------
// 2) CADENA DE RECEPCION (satélite -> ondas -> antena -> cable -> caja)
// ---------------------------------------------------------------------------
// Aristas del cuerpo del mini satélite (caja)
const CH_SAT_E = (() => {
  const v = [];
  for (let a = 0; a < 8; a++) v.push([(a & 1 ? 1 : -1) * 0.15, 1.35 + (a & 2 ? 1 : -1) * 0.12, (a & 4 ? 1 : -1) * 0.1]);
  const e = [];
  for (let a = 0; a < 8; a++) for (const bit of [1, 2, 4]) if (!(a & bit)) e.push([v[a], v[a | bit]]);
  return e;
})();
const CH_BOX = rrPoly(0.7, 0.7, 0.1, 6);
const CH_WIN = rrPoly(0.42, 0.24, 0.02, 3);
const CH_BX = 0.25, CH_BY = -1.25, CH_BZ = 0.1;

export function shapeChain(i, N, K, R) {
  const [p, q, n] = split(i, N, [0.18, 0.25, 0.1, 0.07, 0.3, 0.1]);
  let pts;
  if (p === 0) {
    // Satélite: cuerpo / paneles / antenita
    const [s, q2, n2] = split(q, n, [0.3, 0.55, 0.15]);
    if (s === 0) {
      const [A, B] = pickSeg(CH_SAT_E, q2, n2);
      pts = line(A, B, K);
    } else if (s === 1) {
      const [s2, q3, n3] = split(q2, n2, [0.75, 0.25]);
      const side = q3 & 1 ? 1 : -1, M = Math.max(1, Math.ceil(n3 / 2)), k = q3 >> 1;
      if (s2 === 0) {
        const y = 1.35 - 0.13 + (0.26 * (k + 0.5)) / M; // filas desde el cuerpo hacia el borde
        pts = line([side * 0.16, y, 0], [side * 0.6, y, 0], K);
      } else {
        const x = 0.18 + (0.42 * (k + 0.5)) / M; // columnas del panel
        pts = line([side * x, 1.22, 0], [side * x, 1.48, 0], K);
      }
    } else {
      pts = line([0, 1.23, 0], [(R() - 0.5) * 0.18, 1.1, (R() - 0.5) * 0.1], K);
    }
  } else if (p === 1) {
    // 4 arcos concéntricos que bajan desde el satélite
    const c = q % 4, m = (q - c) / 4, M = Math.max(2, Math.ceil(n / 4));
    const r = 0.35 + 0.28 * c, sp = 0.3, zj = (R() - 0.5) * 0.08;
    const u0 = (m / (M - 1)) * (1 - sp);
    pts = curve((t) => {
      const th = lerp(-40 * D, 40 * D, u0 + sp * t);
      return [r * Math.sin(th), 1.2 - r * Math.cos(th), zj];
    }, 0, 1, K);
  } else if (p === 2) {
    // Antena ground-plane: varilla + 4 radiales a 45 grados
    const [s, q2] = split(q, n, [0.4, 0.6]);
    if (s === 0) {
      const a = R() * TAU, rr = 0.015 * Math.sqrt(R());
      pts = line([rr * Math.cos(a), -0.35, rr * Math.sin(a)], [rr * Math.cos(a), 0.05, rr * Math.sin(a)], K);
    } else {
      const ph = 45 * D + (q2 % 4) * 90 * D, ro = 0.015 * R(), L = 0.3 + 0.03 * R();
      pts = line(
        [ro * Math.cos(ph + 1), -0.35, ro * Math.sin(ph + 1)],
        [L * Math.cos(ph), -0.35 - L, L * Math.sin(ph)],
        K
      );
    }
  } else if (p === 3) {
    // Cable curvo de la antena a la caja
    const ox = (R() - 0.5) * 0.04, oz = (R() - 0.5) * 0.04;
    const P0 = [0, -0.4, 0], P1 = [-0.15, -0.65, 0.12], P2 = [0.4, -0.65, 0.12], P3 = [0.25, -0.9, 0.05];
    pts = curve((t) => { const b = bez(P0, P1, P2, P3, t); return [b[0] + ox, b[1], b[2] + oz]; }, 0, 1, K);
  } else if (p === 4) {
    // Caja 0.7x0.7x0.2: contorno frontal, trasero y aristas
    const [s, q2, n2] = split(q, n, [0.4, 0.4, 0.2]);
    if (s < 2) {
      const sp = Math.min(1, 8 / n2), t0 = (q2 / n2) * (1 - sp);
      pts = mv(subPoly(CH_BOX, t0, t0 + sp, K), CH_BX, CH_BY, s === 0 ? CH_BZ : -CH_BZ);
    } else {
      const t = (q2 + 0.5) / n2;
      const c = subPoly(CH_BOX, t, t, 2)[0];
      pts = line([c[0] + CH_BX, c[1] + CH_BY, CH_BZ], [c[0] + CH_BX, c[1] + CH_BY, -CH_BZ], K);
    }
  } else {
    // Ventana del OLED en la cara frontal
    const [s, q2, n2] = split(q, n, [0.4, 0.6]);
    const cy = CH_BY + 0.03, z = CH_BZ + 0.002;
    if (s === 0) {
      const sp = Math.min(1, 6 / n2), t0 = (q2 / n2) * (1 - sp);
      pts = mv(subPoly(CH_WIN, t0, t0 + sp, K), CH_BX, cy, z);
    } else {
      pts = hatch(CH_BX, cy, 0.38, 0.2, q2, n2, 14, z, K, R);
    }
  }
  return fix(pts, K);
}

// ---------------------------------------------------------------------------
// 3) CARCASA DEL PROYECTO GRANDE
// ---------------------------------------------------------------------------
const CS_HZ = 0.25;
const CS_S = 0.82; // escala final para que la antena alta quepa en radio ~1.7
const CS_RR = rrPoly(1.9, 1.9, 0.2, 8);
const CS_WIN = rrPoly(0.7, 0.38, 0.03, 3);
const CS_BTN = rrPoly(0.16, 0.16, 0.02, 3);
const CS_BOARD = rrPoly(1.3, 0.65, 0.03, 3);
// Logo de satélite (segmentos 3D) arriba a la derecha
const CS_LOGO = (() => {
  const cx = 0.55, cy = 0.58, z = CS_HZ + 0.002, S = [];
  const add = (x0, y0, x1, y1) => S.push([[cx + x0, cy + y0, z], [cx + x1, cy + y1, z]]);
  add(0, -0.08, 0.08, 0); add(0.08, 0, 0, 0.08); add(0, 0.08, -0.08, 0); add(-0.08, 0, 0, -0.08);
  for (const s of [-1, 1]) {
    const xa = s * 0.13, xb = s * 0.33, xm = (xa + xb) / 2;
    add(xa, -0.05, xb, -0.05); add(xa, 0.05, xb, 0.05); add(xa, -0.05, xa, 0.05); add(xb, -0.05, xb, 0.05);
    add(xm, -0.05, xm, 0.05); add(s * 0.08, 0, xa, 0);
  }
  add(0, 0.08, 0, 0.2);
  return S;
})();
// Pines de la placa: dos filas de líneas verticales
const CS_PINS = (() => {
  const S = [];
  for (const row of [-0.24, 0.24]) for (let k = 0; k < 24; k++) {
    const x = -0.55 + (1.1 * k) / 23;
    S.push([[x, row - 0.05, 0], [x, row + 0.05, 0]]);
  }
  return S;
})();

export function shapeCase(i, N, K, R) {
  const [p, q, n] = split(i, N, [0.3, 0.2, 0.1, 0.06, 0.04, 0.18, 0.12]);
  let pts;
  if (p === 0) {
    // Contornos frontal/trasero y aristas redondeadas (líneas en Z)
    const [s, q2, n2] = split(q, n, [0.38, 0.38, 0.24]);
    if (s < 2) {
      const sp = Math.min(1, 10 / n2), t0 = (q2 / n2) * (1 - sp);
      pts = mv(subPoly(CS_RR, t0, t0 + sp, K), 0, 0, s === 0 ? CS_HZ : -CS_HZ);
    } else {
      const c = subPoly(CS_RR, (q2 + 0.5) / n2, (q2 + 0.5) / n2, 2)[0];
      pts = line([c[0], c[1], CS_HZ], [c[0], c[1], -CS_HZ], K);
    }
  } else if (p === 1) {
    // Franjas a 45 grados en el 45% inferior de la cara frontal
    const x0 = -0.8, x1 = 0.8, y0 = -0.82, y1 = -0.1, z = CS_HZ + 0.002;
    const cmin = x0 - y1, cmax = x1 - y0;
    const c = lerp(cmin, cmax, (q + 0.5) / n);
    const a = Math.max(x0, y0 + c), b = Math.min(x1, y1 + c);
    pts = b > a ? line([a, a - c, z], [b, b - c, z], K) : line([a, a - c, z], [a, a - c, z], K);
  } else if (p === 2) {
    // Ventana OLED (0.7x0.38) arriba al centro-izquierda
    const [s, q2, n2] = split(q, n, [0.35, 0.65]);
    const cx = -0.2, cy = 0.5, z = CS_HZ + 0.002;
    if (s === 0) {
      const sp = Math.min(1, 6 / n2), t0 = (q2 / n2) * (1 - sp);
      pts = mv(subPoly(CS_WIN, t0, t0 + sp, K), cx, cy, z);
    } else {
      pts = hatch(cx, cy, 0.64, 0.32, q2, n2, 22, z, K, R);
    }
  } else if (p === 3) {
    // Dos botones cuadrados a la izquierda
    const b = q & 1, qq = q >> 1, nn = Math.max(1, Math.ceil(n / 2));
    const sp = Math.min(1, 4 / nn), t0 = (qq / nn) * (1 - sp);
    pts = mv(subPoly(CS_BTN, t0, t0 + sp, K), -0.78, b ? 0.25 : 0.55, CS_HZ + 0.002);
  } else if (p === 4) {
    const [A, B] = pickSeg(CS_LOGO, q, n);
    pts = line(A, B, K);
  } else if (p === 5) {
    // Antena ground-plane desde la arista superior derecha
    const [s, q2] = split(q, n, [0.12, 0.38, 0.5]);
    const ax = 0.7, a = R() * TAU, rr = 0.015 * Math.sqrt(R());
    const ox = rr * Math.cos(a), oz = rr * Math.sin(a);
    if (s === 0) pts = line([ax + ox, 0.95, oz], [ax + ox, 1.05, oz], K); // conector corto
    else if (s === 1) pts = line([ax + ox, 1.05, oz], [ax + ox, 2.05, oz], K); // varilla ~1.0
    else {
      const ph = 45 * D + (q2 % 4) * 90 * D, L = 0.28 + 0.02 * R();
      pts = line([ax + ox * 0.5, 1.28, oz * 0.5], [ax + L * Math.cos(ph), 1.28 - L, L * Math.sin(ph)], K);
    }
  } else {
    // Placa interior (1.3x0.65 en z=0) y pines
    const [s, q2, n2] = split(q, n, [0.35, 0.65]);
    if (s === 0) {
      const sp = Math.min(1, 6 / n2), t0 = (q2 / n2) * (1 - sp);
      pts = subPoly(CS_BOARD, t0, t0 + sp, K);
    } else {
      const [A, B] = pickSeg(CS_PINS, q2, n2);
      pts = line(A, B, K);
    }
  }
  return fix(pts, K, CS_S);
}

// ---------------------------------------------------------------------------
// 4) TERRENO TOPOGRAFICO CON CURVAS DE NIVEL
// ---------------------------------------------------------------------------
const T_W = 3.2, T_D = 2.4, T_AMP = 0.35, T_ANG = 55 * D, T_S = 0.8;
// Cerros: [cx, cz, amplitud, sigma]
const T_G = [[-0.9, -0.55, 1.0, 0.42], [0.75, -0.6, 0.8, 0.5], [-0.15, 0.65, 0.55, 0.38], [1.15, 0.5, 0.7, 0.33], [-1.25, 0.55, 0.45, 0.35]];
const T_PX = 0.2, T_PZ = 0.1; // posición del pin en el plano

function terrH(x, z) {
  let h = 0;
  for (const g of T_G) {
    const dx = x - g[0], dz = z - g[1];
    h += g[2] * Math.exp(-(dx * dx + dz * dz) / (2 * g[3] * g[3]));
  }
  return h + 0.07 * Math.sin(1.7 * x + 0.6) * Math.cos(1.3 * z - 0.4) + 0.04 * Math.sin(2.9 * x - 2.2 * z);
}
// Giro en X de 55 grados: el borde lejano (z<0) sube, se ve como suelo desde arriba
const _tc = Math.cos(T_ANG), _ts = Math.sin(T_ANG);
const terrTf = (x, y, z) => [x, y * _tc - z * _ts, y * _ts + z * _tc];

const T_NX = 73, T_NZ = 55, T_LEVELS = 9;
let _terr = null, _terrKey = "";

// Marching squares simplificado + encadenado de segmentos -> tramos de K puntos
function buildTerrain(nT, K) {
  const NX = T_NX, NZ = T_NZ;
  const dx = T_W / (NX - 1), dz = T_D / (NZ - 1);
  const H = new Float64Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) H[j * NX + i] = terrH(-T_W / 2 + i * dx, -T_D / 2 + j * dz);

  const polys = [];
  for (let l = 0; l < T_LEVELS; l++) {
    const L = 0.05 + l * 0.115;
    const segs = [];
    for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
      const v00 = H[j * NX + i], v10 = H[j * NX + i + 1], v01 = H[(j + 1) * NX + i], v11 = H[(j + 1) * NX + i + 1];
      // ids de arista: horizontal = 2*(j*NX+i), vertical = 2*(j*NX+i)+1
      const eb = (v00 < L) !== (v10 < L) ? (j * NX + i) * 2 : -1;
      const et = (v01 < L) !== (v11 < L) ? ((j + 1) * NX + i) * 2 : -1;
      const el = (v00 < L) !== (v01 < L) ? (j * NX + i) * 2 + 1 : -1;
      const er = (v10 < L) !== (v11 < L) ? (j * NX + i + 1) * 2 + 1 : -1;
      const e = [];
      if (eb >= 0) e.push(eb);
      if (er >= 0) e.push(er);
      if (et >= 0) e.push(et);
      if (el >= 0) e.push(el);
      if (e.length === 2) segs.push([e[0], e[1]]);
      else if (e.length === 4) {
        const avg = (v00 + v10 + v01 + v11) / 4;
        if ((v00 < L) === (avg < L)) segs.push([eb, er], [et, el]);
        else segs.push([eb, el], [et, er]);
      }
    }
    const adj = new Map();
    segs.forEach((s, k) => {
      for (const e of s) { if (!adj.has(e)) adj.set(e, []); adj.get(e).push(k); }
    });
    const vis = new Uint8Array(segs.length);
    const edgePt = (e) => {
      const horiz = (e & 1) === 0, base = e >> 1;
      const ia = base % NX, ja = (base - ia) / NX;
      const ib = horiz ? ia + 1 : ia, jb = horiz ? ja : ja + 1;
      const va = H[ja * NX + ia], vb = H[jb * NX + ib];
      const t = Math.min(1, Math.max(0, (L - va) / (vb - va)));
      const xa = -T_W / 2 + ia * dx, za = -T_D / 2 + ja * dz, xb = -T_W / 2 + ib * dx, zb = -T_D / 2 + jb * dz;
      return [xa + (xb - xa) * t, T_AMP * L, za + (zb - za) * t];
    };
    const walk = (start, list) => {
      let cur = start;
      for (;;) {
        let nxt = -1;
        for (const t of adj.get(cur)) if (!vis[t]) { nxt = t; break; }
        if (nxt < 0) break;
        vis[nxt] = 1;
        cur = segs[nxt][0] === cur ? segs[nxt][1] : segs[nxt][0];
        list.push(cur);
      }
    };
    for (let s = 0; s < segs.length; s++) {
      if (vis[s]) continue;
      vis[s] = 1;
      const fwd = [segs[s][1]], back = [segs[s][0]];
      walk(segs[s][1], fwd);
      walk(segs[s][0], back);
      const ids = back.reverse().concat(fwd);
      const pts = ids.map(edgePt);
      let len = 0;
      for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][2] - pts[k - 1][2]);
      if (len >= 0.1) polys.push({ pts, len });
    }
  }
  let total = 0;
  for (const pl of polys) total += pl.len;
  const out = [];
  if (total <= 0) return out;
  const tl = total / Math.max(1, nT);
  for (const pl of polys) {
    const nf = Math.max(1, Math.round(pl.len / tl));
    for (let j = 0; j < nf; j++) {
      out.push(subPoly(pl.pts, j / nf, (j + 1) / nf, K).map((a) => terrTf(a[0], a[1], a[2])));
    }
  }
  return out;
}

export function shapeTerrain(i, N, K, R) {
  const [p, q, n] = split(i, N, [0.05, 0.08, 0.04, 0.83]);
  let pts;
  if (p === 0) {
    // Pin vertical (perpendicular al terreno) subiendo ~0.6
    const y0 = T_AMP * terrH(T_PX, T_PZ);
    const a = R() * TAU, rr = 0.02 * Math.sqrt(R()), len = 0.45 + 0.15 * R();
    const b = R() * TAU, sp = 0.05 * Math.sqrt(R());
    const A = terrTf(T_PX + rr * Math.cos(a), y0, T_PZ + rr * Math.sin(a));
    const B = terrTf(T_PX + sp * Math.cos(b), y0 + len, T_PZ + sp * Math.sin(b));
    pts = line(A, B, K);
  } else if (p === 1) {
    // Anillo de alcance (radio ~1.1), dos círculos concéntricos segmentados
    const c = q & 1, M = Math.max(1, Math.ceil(n / 2)), m = q >> 1;
    const a0 = (m / M) * TAU + c * 0.5 * (TAU / M), span = (TAU / M) * 0.7, rad = 1.1 - 0.03 * c;
    pts = curve((t) => {
      const a = a0 + span * t, x = T_PX + rad * Math.cos(a), z = T_PZ + rad * Math.sin(a);
      return terrTf(x, T_AMP * terrH(x, z) + 0.012, z);
    }, 0, 1, K);
  } else if (p === 2) {
    // Marco del plano, siguiendo el relieve
    const P = 2 * (T_W + T_D), sp = Math.min(1, 6 / n), s0 = (q / n) * (1 - sp);
    pts = curve((t) => {
      let d = (((s0 + sp * t) % 1) + 1) % 1 * P, x, z;
      if (d < T_W) { x = -T_W / 2 + d; z = -T_D / 2; }
      else if ((d -= T_W) < T_D) { x = T_W / 2; z = -T_D / 2 + d; }
      else if ((d -= T_D) < T_W) { x = T_W / 2 - d; z = T_D / 2; }
      else { d -= T_W; x = -T_W / 2; z = T_D / 2 - d; }
      return terrTf(x, T_AMP * terrH(x, z), z);
    }, 0, 1, K);
  } else {
    // Curvas de nivel: cada fibra es un tramo de isolínea
    const key = n + "|" + K;
    if (_terrKey !== key) { _terr = buildTerrain(n, K); _terrKey = key; }
    const T = _terr.length;
    pts = T ? _terr[Math.min(T - 1, Math.floor((q * T) / n))] : line([0, 0, 0], [0, 0, 0], K);
  }
  return fix(pts, K, T_S);
}
