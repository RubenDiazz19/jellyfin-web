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

- [ ] **Auditar bundles grandes** — Agregar `vite-plugin-visualizer` o `rollup-plugin-visualizer` para inspeccionar composición de chunks en producción.
- [ ] **`webcomponents.js` (896KB)** — Polyfill obsoleto; los navegadores modernos soportan web components nativamente. Cargarlo condicionalmente solo para browsers que lo necesiten o eliminarlo.
- [ ] **`react-blurhash` (920KB)** — Reemplazar por un hook simple sobre `blurhash` (88KB). Es un wrapper fino que no justifica su peso.
- [ ] **`react-lazy-load-image-component` (216KB)** — Solo se usa en `Image.tsx`. Reemplazar con `loading="lazy"` nativo + blurhas.
- [ ] **`@tanstack/react-query-devtools`** — Se bundlea siempre pero solo se renderiza condicionalmente. Convertir a `lazy()` para que sea un chunk separado.
- [ ] **Evaluar date-fns v3** — v2 pesa ~25MB en disco. v3 es más pequeña y tree-shakeable mejor, pero requiere migración de imports y es breaking.
- [ ] **Evaluar remplazo de lodash-es** — Solo se usan 7 funciones (`isEmpty`, `debounce`, `isEqual`, etc.). Con tree-shaking está bien, pero valorar utilidades inline para eliminar la dependencia.

## 3. Calidad de código

- [ ] **Eliminar `console.log` en producción** — 18 ocurrencias (principalmente `connectionManager.js` y `webSettings.js`). Reemplazar con logger configurable o eliminarlos.
- [ ] **Resolver 30 TODO + 8 FIXME** — Distribuidos por toda la codebase. Priorizar los FIXME (scrollManager, browserDeviceProfile, authentication-api, etc.).
- [ ] **Reducir tipos `any`** — Persistentes en `apiclient.d.ts`, `global.d.ts` (`NativeShell: any`), y algunas utilidades. Tiparlos correctamente.
- [ ] **Subir cobertura de tests** — Threshold global de líneas al 5% es extremadamente bajo. El dashboard (admin) tiene solo 1 test. Establecer metas progresivas (30% → 50% → 70%).
- [ ] **Extender separación por capas** — La arquitectura MVVM con linting estricto solo existe en `apps/frontend/`. Aplicar reglas similares al dashboard y componentes compartidos.

## 4. Rendimiento

- [ ] **Agregar pistas de precarga en HTML** — `<link rel="preload">` para recursos críticos (service worker, manifest.json, fonts). `<link rel="preconnect">` para el servidor Jellyfin.
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
