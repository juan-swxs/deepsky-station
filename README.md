# DeepSky_Station · TinyGS

Sitio de la estación terrena **DeepSky_Station** (red TinyGS) en Nemocón, Cundinamarca, construido como un
**mundo de fibras** que se explora por capas: Señal → Coordenadas → Arquitectura → Montaje (5 pasos) → Mapa → Link.

- `index.html` — capas (paneles) sobre el lienzo WebGL a pantalla completa
- `js/world.js` — motor de fibras: morph en GPU entre figuras, "zambullida" entre capas, polvo de fondo
- `js/shapes-extra.js` — figuras del globo con pin, cadena de recepción, carcasa y terreno (escritas con Codex)
- `js/app.js` — navegación (rueda, teclado, gestos, riel), **datos editables en `CONFIG`**, mapa, QR, visor 3D
- `js/case-viewer.js` — visor 3D de la carcasa (STL de SolidWorks)
- `assets/models/*.stl`, `assets/img/*` — modelos, renders y foto de la antena

Atajos: `#coordenadas`, `#montaje`… abren una capa; `?captura&capa=N&paso=M` deja una capa fija para capturas.
Probar en local: `py -m http.server 8765` → http://127.0.0.1:8765
