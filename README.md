# DeepSky_Station · TinyGS

Página de la estación terrena **DeepSky_Station** (red TinyGS) en Nemocón, Cundinamarca.

- `index.html` — estructura (Presentación, Coordenadas, Arquitectura, Montaje, Mapa, Link)
- `css/style.css` — estilos
- `js/hero.js` — animación de fibras (señal → satélite → antena → Tierra) en WebGL
- `js/case-viewer.js` — visor 3D de la carcasa (STL de SolidWorks) con despiece
- `js/main.js` — **datos editables al inicio** (`CONFIG`: altura de la antena, texto del montaje, link)
- `assets/models/*.stl` — carcasa, placa Heltec V3 y regletas (mm)
- `render.html?view=iso|front|back|despiece&explode=0..1` — página auxiliar para generar renders

Probar en local: `py -m http.server 8765` y abrir http://127.0.0.1:8765
