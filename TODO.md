# D3 — Nuevas características de reproducción

- [x] **Chromecast** — Botón "Cast" en el reproductor para enviar reproducción a dispositivos Chromecast.
  Sender SDK de Google + receptor propio de Jellyfin (`CastReceiverId` del usuario, canal
  `urn:x-cast:com.connectsdk`). Si no hay receptores Cast, el botón cae a la Remote Playback
  API del navegador, que es lo que había antes (AirPlay y cast nativo de un `<video>` directo).
  **Sin verificar contra hardware real**: la lógica está cubierta por tests con el SDK mockeado,
  pero nadie lo ha probado contra un Chromecast físico.
- [x] **Skip Intro / Skip Credits** — Botón en el OSD del reproductor para saltar intros y créditos detectados por Jellyfin.
  Lee `/MediaSegments/{itemId}`; requiere que el servidor tenga un proveedor de segmentos
  instalado (p. ej. Intro Skipper). Sin segmentos el botón no aparece.
- [x] **Reproducir después** — Cola de reproducción (play queue) para encolar películas/episodios "para después", con UI para ver y reordenar la cola.
  Persistida en localStorage. Se encola desde el menú "···" de cualquier item; se ve y reordena
  en `/queue` y en el panel del reproductor. Al terminar un item, encadena con la cola.

---

# Optimizaciones y mejora continua

## 1. Migración de código legacy (~98 archivos JS)

- [ ] **Unificar API client** — Migrar completamente de `jellyfin-apiclient` (88 imports activos) a `@jellyfin/sdk`. Actualmente conviven ambos; eliminar el cliente antiguo.
- [ ] **Migrar web components "emby-\*" a React TSX** — 15 componentes (`emby-button`, `emby-checkbox`, `emby-select`, `emby-tabs`, `emby-toggle`, etc.) que usan `innerHTML` y manipulación DOM imperativa. Migrar a React elimina un paradigma paralelo de renderizado.
- [ ] **Reemplazar 13 archivos `.template.html`** — Componentes legacy (dialog, filterdialog, imageeditor, etc.) que cargan HTML + JS aparte. Convertir a componentes React.
- [ ] **Migrar iconos a un solo sistema** — Eliminar `material-design-icons-iconfont` (~3.6MB) y unificar todos los iconos en `@mui/icons-material` (SVG React components).

## 2. Bundle y dependencias

- [x] **Auditar bundles grandes** — Agregar `vite-plugin-visualizer` o `rollup-plugin-visualizer` para inspeccionar composición de chunks en producción.
  `bun run build:analyze` escribe `bundle-stats.html` (treemap con tamaños gzip y brotli) en la
  raíz del repo — fuera de `dist/`, que es lo que se despliega. Es opt-in: el build normal no
  paga el coste. Punto de partida medido: 15 MB de JS en total, y los chunks mayores son
  `index` (1016 KB → 280 KB gz), `hls` (516 → 158) y `AppLayout` (280 → 65).
- [ ] **`webcomponents.js` (896KB)** — Polyfill obsoleto; los navegadores modernos soportan web components nativamente. Cargarlo condicionalmente solo para browsers que lo necesiten o eliminarlo.
- [ ] **`react-blurhash` (920KB)** — Reemplazar por un hook simple sobre `blurhash` (88KB). Es un wrapper fino que no justifica su peso.
- [ ] **`react-lazy-load-image-component` (216KB)** — Solo se usa en `Image.tsx`. Reemplazar con `loading="lazy"` nativo + blurhas.
- [x] **`@tanstack/react-query-devtools`** — ~~Se bundlea siempre~~ **ya no**: nada que hacer, medido.
  Desde la v5 el paquete se resuelve a `() => null` salvo con `NODE_ENV=development`, y como
  declara `sideEffects: false`, Rollup dobla la constante y lo elimina entero. En `dist/assets/*.js`
  hay **0** coincidencias de `TanStack`, `ReactQueryDevtools`, `query-devtools` y `@tanstack`.
  Pasarlo a `lazy()` solo añadiría un `Suspense` y un chunk async a cambio de nada.
- [ ] **Evaluar date-fns v3** — v2 pesa ~25MB en disco. v3 es más pequeña y tree-shakeable mejor, pero requiere migración de imports y es breaking.
- [ ] **Evaluar remplazo de lodash-es** — Solo se usan 7 funciones (`isEmpty`, `debounce`, `isEqual`, etc.). Con tree-shaking está bien, pero valorar utilidades inline para eliminar la dependencia.

## 3. Calidad de código

- [x] **Eliminar `console.log` en producción** — 18 ocurrencias (principalmente `connectionManager.js` y `webSettings.js`). Reemplazar con logger configurable o eliminarlos.
  No hacía falta un logger nuevo: el repo ya usaba niveles (60 `debug`, 34 `warn`, 144 `error`) y
  `console.log` era el único outlier. Cada una pasa al nivel que le toca — trazas de ciclo de vida
  y de sondeo de direcciones a `debug` (el navegador las oculta por defecto, y ahí fallar es lo
  normal: prueba varias URLs), fallo inesperado con fallback silencioso a `warn`. La regla
  `no-console` de ESLint impide que vuelvan a colarse, permitiendo los cuatro niveles útiles.
- [ ] **Resolver 30 TODO + 8 FIXME** — Distribuidos por toda la codebase. Priorizar los FIXME (scrollManager, browserDeviceProfile, authentication-api, etc.).
- [ ] **Reducir tipos `any`** — Persistentes en `apiclient.d.ts`, `global.d.ts` (`NativeShell: any`), y algunas utilidades. Tiparlos correctamente.
- [ ] **Subir cobertura de tests** — Threshold global de líneas al 5% es extremadamente bajo. El dashboard (admin) tiene solo 1 test. Establecer metas progresivas (30% → 50% → 70%).
- [ ] **Extender separación por capas** — La arquitectura MVVM con linting estricto solo existe en `apps/frontend/`. Aplicar reglas similares al dashboard y componentes compartidos.

## 4. Rendimiento

- [x] **Agregar pistas de precarga en HTML** — hecho el `preconnect`; los `preload` se descartan, medidos uno a uno.
  El `preconnect` al servidor **no puede ir en el HTML**: el servidor lo elige el usuario al
  iniciar sesión y puede ser cualquier host. Se hace en runtime (`utils/preconnect.ts`) en cuanto
  el arranque resuelve la URL, antes de `initApiClient`. Van dos al mismo host a propósito: el
  navegador tiene pools separados para conexiones anónimas y con credenciales, y la app usa las
  dos (la API por `fetch` CORS anónimo, las imágenes por `<img src>` sin `crossorigin`).
  Los tres `preload` que pedía este punto harían daño, no bien:
  - **service worker**: lo pide `register()` fuera de la ruta crítica; precargarlo solo competiría
    con lo que sí bloquea el primer pintado.
  - **manifest.json**: ya está su `<link rel="manifest">`, que el navegador baja a baja prioridad
    porque no hace falta para pintar. Precargarlo no adelanta nada.
  - **fonts**: la única fuente del build es `MaterialIcons-Regular.woff2` (124 KB). Su URL va
    hasheada (un `<link>` estático no puede nombrarla), solo la usa el dashboard, y ahí vive bajo
    `display: none`, que no dispara la descarga. Precargarla serían 124 KB tirados en cada carga
    del frontend. Si se toca, lo que arregla de verdad su `font-display: block` es el punto de
    migrar los iconos a SVG.
- [x] **Hacer `theme-color` dinámico** — Actualmente hardcodeado a `#202020` en `index.html`. Leer del tema activo.
  En mobile/tablet ya lo movía `MobileThemeProvider` (al surface de M3); faltaba desktop y el
  dashboard, que ahora lo leen del tema activo en `themes/themeColor.ts`. El valor del HTML se
  queda (es el color del primer pintado, antes de que haya JS) pero pasa a `#101010`, el fondo
  real del tema oscuro y el que ya declaraba `manifest.json`.
- [ ] **Evaluar registro de Service Worker en desktop** — Actualmente solo se registra en mobile/tablet. Desktop se queda sin offline support.
- [ ] **Auditar renderizado** — Verificar que no haya re-renders innecesarios con React DevTools Profiler, especialmente en listas grandes (bibliotecas, grids).

## 5. Developer Experience

- [ ] **Crear `AGENTS.md`** — Configuración para opencode/herramientas AI que describa el proyecto, convenciones, y comandos frecuentes.
- [x] **Agregar `.env.example`** — Documentar variables de entorno necesarias para desarrollo.
  Solo hay una variable propia (`JELLYFIN_SERVER`, el backend al que apunta el proxy del dev
  server) y la lee `vite.config.ts` en Node, así que no llega al bundle ni necesita prefijo
  `VITE_`. `loadEnv` la busca en el `.env` de la raíz del repo; el entorno real tiene prioridad.
- [ ] **Modularizar ESLint config** — `eslint.config.mjs` tiene 563 líneas. Separar reglas por dominio (react, typescript, imports, stylistic).
- [ ] **Configurar pre-commit hooks** — Husky + lint-staged para lint y typecheck automáticos antes de commits.
- [ ] **Configurar commitlint** — Para estandarizar formato de mensajes de commit.
