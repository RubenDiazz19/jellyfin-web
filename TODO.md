# TODO — Mejoras del Frontend Propio

Generado automáticamente a partir de un análisis profundo del código.

---

## 🔴 Bugs

### B1 — Race condition en VideoPlayerViewModel (MEDIA)
- **Archivo:** `src/apps/frontend/domain/viewModels/VideoPlayerViewModel.ts`
- **Líneas:** 370–397, 865
- **Descripción:** `open()`/`loadSource()` no valida `this.itemId` después del `await`. Un cambio rápido de item puede aplicar subtitle/audio al item equivocado.
- **Fix:** Añadir guard `this.itemId !== itemId` tras el await en `loadSource()`, o implementar un generación counter que invalide operaciones obsoletas.

### B2 — Memory leak en VideoPlayer (BAJA)
- **Archivo:** `src/apps/frontend/presentation/components/player/VideoPlayer.tsx`
- **Líneas:** 330–334
- **Descripción:** `skipHideTimer` no se limpia en el cleanup del `useEffect` de unmount.
- **Fix:** Añadir `if (skipHideTimer.current) clearTimeout(skipHideTimer.current)` al cleanup.

### B3 — Memory leak en TasksViewModel (BAJA-MEDIA)
- **Archivo:** `src/apps/frontend/domain/viewModels/TasksViewModel.ts`
- **Líneas:** 56–70
- **Descripción:** Los cleanup functions de `watchScheduledTasks`, `watchItemRefresh`, `watchLibraryChanged` se descartan. En re-login sin reload se duplican listeners.
- **Fix:** Guardar y llamar los cleanup functions al destruir el ViewModel o al cerrar sesión.

### B4 — Race condition en castBinding (BAJA)
- **Archivo:** `src/apps/frontend/domain/player/castBinding.ts`
- **Líneas:** 26–36
- **Descripción:** `watchAvailability` promise puede resolver después del cleanup, filtrando el watcher de Chromecast.
- **Fix:** Usar AbortController o flag `cleaned` para evitar que el `.then()` active el watcher después del cleanup.

### B5 — Keyframe global en CollectionCardCarousel (BAJA-MEDIA)
- **Archivo:** `src/apps/frontend/presentation/components/collection/CollectionCardCarousel.tsx`
- **Líneas:** 173–201
- **Descripción:** `@keyframes collectionLoopMarquee` es global. Múltiples instancias con distintos `durationSec` comparten la misma animación.
- **Fix:** Generar nombre de keyframe único por instancia, o extraer la animación a un CSS module.

---

## 🟠 Optimizaciones de Rendimiento

### O1 — SearchOverlay siempre en bundle inicial (ALTA)
- **Archivo:** `src/apps/frontend/app/App.tsx`
- **Líneas:** 15–17
- **Descripción:** `SearchOverlay` y toda su árbol de dependencias (SearchFilters 497 líneas, SearchResults, RatingFilterBar, etc.) siempre están en el bundle inicial, aunque solo se montan cuando el overlay está abierto.
- **Fix:** Lazy-mount detrás de `searchVM.overlayOpen`, o usar `React.lazy` para el contenido del overlay.

### O2 — Nav re-renderiza en cada scroll frame (ALTA)
- **Archivo:** `src/apps/frontend/presentation/components/layout/Nav.tsx`
- **Línea:** 65
- **Descripción:** `useScrollY()` re-renderiza `Nav` ~60 veces por segundo durante scroll. Solo usa `y` para togglear la clase `scrolled` (y > 80).
- **Fix:** Usar ref + toggle de clase CSS en vez de React state, o debuncar el listener de scroll.

### O3 — SearchViewModel re-fetchea en cada apertura (MEDIA)
- **Archivo:** `src/apps/frontend/domain/viewModels/SearchViewModel.ts`
- **Líneas:** 553, 605–621
- **Descripción:** `load()` re-fetch del catálogo completo cada vez que se abre el overlay, sin verificar frescura.
- **Fix:** Añadir freshness check: si `shows.value.length > 0` y la última carga fue hace < N segundos, saltar el fetch.

### O4 — PosterCard calcula progress per-render (MEDIA)
- **Archivo:** `src/apps/frontend/presentation/components/cards/PosterCard.tsx`
- **Líneas:** 38–46
- **Descripción:** El cálculo de progreso de episodes itera seasons, mapea episodes y consulta WATCHED store en cada render.
- **Fix:** Memoizar con `useMemo`.

### O5 — CwCard mide DOM por cada card en mount (MEDIA)
- **Archivo:** `src/apps/frontend/presentation/components/cards/CwCard.tsx`
- **Líneas:** 121–149
- **Descripción:** Cada card configura un ResizeObserver implícito midiendo scrollWidth vs clientWidth. Con 15–20 cards, son 30–40 mediciones en mount.
- **Fix:** Considerar medición diferida, batch de mediciones, o virtualizar la fila.

### O6 — pointerIsOverBars usa querySelectorAll en cada pointer move (BAJA)
- **Archivo:** `src/apps/frontend/presentation/components/player/VideoPlayer.tsx`
- **Líneas:** 50–53
- **Descripción:** `pointerIsOverBars` llama `root.querySelectorAll(OSD_BARS)` en cada movimiento del ratón.
- **Fix:** Cacheear los elementos referenciados al montar.

### O7 — GC pressure por objetos style inline (MEDIA)
- **Archivo:** `src/apps/frontend/presentation/components/collection/CollectionCardCarousel.tsx`
- **Líneas:** 87, 325–335
- **Descripción:** `displayItems` se duplica y los objetos `style` se recrean en cada render.
- **Fix:** Memoizar `displayItems` y objetos de estilo con `useMemo`/`useCallback`.

### O8 — Objetos style inline estáticos recreados (BAJA)
- **Archivo:** `src/apps/frontend/presentation/pages/HomePage.tsx`
- **Líneas:** 171–329
- **Descripción:** Muchos objetos style estáticos se recrean en cada render del hero.
- **Fix:** Extraer constantes de estilo fuera del componente.

---

## 🟡 Refactorización

### R1 — Logger centralizado (ALTA)
- **Archivos afectados:** 5 archivos con `console.*`
  - `domain/viewModels/VideoPlayerViewModel.ts` (líneas 351, 418, 428, 459, 981)
  - `domain/viewModels/CastViewModel.ts` (líneas 51, 69, 86, 175)
  - `presentation/components/layout/ErrorBoundary.tsx` (línea 20)
  - `data/autotag/parseResponse.ts` (línea 91)
  - `data/api/playbackPrewarm.ts` (línea 57)
- **Descripción:** No hay logger centralizado. Se usa `console.*` directamente, violando la convención de AGENTS.md.
- **Fix:** Crear `domain/logger.ts` con niveles `debug`/`warn`/`error` y reemplazar todos los `console.*`.

### R2 — VideoPlayerViewModel demasiado grande (MEDIA)
- **Archivo:** `src/apps/frontend/domain/viewModels/VideoPlayerViewModel.ts` (1034 líneas)
- **Descripción:** Gestiona 30+ signals, `attach()` con 15+ bindings, source loading, retry, progress, y todos los comandos.
- **Fix:** Extraer `attach()` (~260 líneas) en clase `PlayerEventBinding`. Extraer comandos (play/pause/seek/skip) en módulo separado.

### R3 — VideoPlayer.tsx demasiado grande (MEDIA)
- **Archivo:** `src/apps/frontend/presentation/components/player/VideoPlayer.tsx` (897 líneas)
- **Descripción:** Maneja 8 concerns distintos: OSD, skip, subtítulos, teclado, sleep, prefs, gestos, JSX.
- **Fix:** Extraer `useKeyboardShortcuts`, `useSubtitleManager`, `useOsdVisibility` como hooks personalizados.

### R4 — Catálogo/Detail base duplicado (MEDIA)
- **Archivos:**
  - `domain/viewModels/CatalogViewModel.ts` (47 líneas)
  - `domain/viewModels/DetailViewModel.ts` (103 líneas)
- **Descripción:** Ambos duplican el patrón loading/error/guarded/loads.
- **Fix:** Unificar en clase base `LoadableViewModel`.

### R5 — Triple indirection en mutation subscription (BAJA)
- **Archivos:**
  - `domain/viewModels/mutationSubscription.ts` (26 líneas)
  - `domain/viewModels/itemMutations.ts` (63 líneas)
- **Descripción:** Tres capas: `ItemMutationSubscription` + `subscribeToMutations()` wrapper + `mutationOnLoad()` factory.
- **Fix:** Simplificar a un solo helper.

### R6 — SearchFilters repetitivo (MEDIA)
- **Archivo:** `src/apps/frontend/presentation/components/search/SearchFilters.tsx`
- **Líneas:** 153–196, 216–287, 315–358
- **Descripción:** 4 bloques casi idénticos de categorías (~100 líneas) que solo difieren en label y count.
- **Fix:** Data-driven con `.map()` sobre array de configuración de categorías.

### R7 — Filtros de search duplicados (MEDIA)
- **Archivo:** `src/apps/frontend/domain/viewModels/SearchViewModel.ts`
- **Líneas:** 314–413
- **Descripción:** `results` computed tiene 2 loops de filtrado casi idénticos (local y remote).
- **Fix:** Extraer función compartida `matchesFilters(entry, types, states, tags, ratings)`.

### R8 — Toggle filters repetitivos (BAJA)
- **Archivo:** `src/apps/frontend/domain/viewModels/SearchViewModel.ts`
- **Líneas:** 207–225, 462–524
- **Descripción:** `toggleTypeFilter`, `toggleStateFilter`, `toggleTagFilter` son casi idénticos.
- **Fix:** Helper genérico `toggleArrayItem<T>(signal, item, equals?)`.

---

## 🟢 Simplificación

### S1 — Clamp repetido (12 ocurrencias)
- **Archivos:**
  - `domain/viewModels/VideoPlayerViewModel.ts` (líneas 232, 258, 586, 617, 630, 644)
  - `domain/player/subtitlesBinding.ts` (línea 51)
  - `domain/player/autoNext.ts` (línea 58)
  - `data/api/playbackContext.ts` (línea 174)
  - `presentation/components/player/VideoControls.tsx` (líneas 21, 95)
- **Descripción:** `Math.min(Math.max(val, min), max)` repetido 12 veces.
- **Fix:** Función `clamp(val, min, max)` en un módulo compartido.

### S2 — isSeriesWatched wrapper trivial
- **Archivo:** `src/apps/frontend/domain/viewModels/SearchViewModel.ts`
- **Líneas:** 79–81
- **Descripción:** `isSeriesWatched(show)` solo llama a `isShowFullyWatched(show)`.
- **Fix:** Inline — reemplazar llamadas directamente por `isShowFullyWatched`.

### S3 — Métodos de delegación de una línea (6)
- **Archivo:** `src/apps/frontend/domain/viewModels/VideoPlayerViewModel.ts`
- **Líneas:** 511–525
- **Descripción:** `setSleepTimer`, `setSubtitleOffset`, `adjustSubtitleOffset`, `resetSubtitleOffset`, `publishSubtitle`, `flushPendingSubtitle` son wrappers triviales.
- **Fix:** Evaluar si la vista puede acceder al sub-binding directamente o simplificar.

### S4 — formatRuntime duplicado
- **Archivo:** `src/apps/frontend/presentation/utils/format.ts`
- **Líneas:** 34–51
- **Descripción:** Lógica horas/minutos duplicada para paths numérico y string.
- **Fix:** Extraer helper `formatHM(minutes)`.

### S5 — Formato T{n} E{nn} duplicado (3 veces)
- **Archivo:** `src/apps/frontend/domain/viewModels/HomeViewModel.ts`
- **Líneas:** 112–114, 136–137, 148–149
- **Descripción:** El template `T{season} E{episode}` repetido 3 veces.
- **Fix:** Helper `formatEpisodeCode(season, episode)`.

### S6 — Array.from(new Set(...)) verbose (3 veces)
- **Archivos:**
  - `data/api/shows.ts` (líneas 41, 43–50)
  - `data/api/movies.ts` (líneas 22–29)
- **Descripción:** `Array.from(new Set(array.filter(...).map(...).filter(Boolean)))` verbose.
- **Fix:** `[...new Set(...)]` más corto.

### S7 — Cadena if/else de codecs de audio
- **Archivo:** `src/apps/frontend/data/api/itemMapping.ts`
- **Líneas:** 194–217
- **Descripción:** Larga cadena if/else para detectar badges de audio.
- **Fix:** Tabla de lookup: `const AUDIO_BADGES: [RegExp, string][] = [...]` con loop `for...of`.

---

## 🔵 Internacionalización (i18n)

### I1 — WatchedToggle.tsx
- **Línea:** 40
- **Strings:** `'Marcar como no visto'` / `'Marcar como visto'`

### I2 — WatchedButton.tsx
- **Línea:** 26
- **Strings:** `'Marcar como no visto'` / `'Marcar como visto'`

### I3 — MovieWatchedButton.tsx
- **Línea:** 29
- **Strings:** `'Marcar como no vista'` / `'Marcar como vista'`

### I4 — MoviePage.tsx
- **Línea:** 95
- **String:** `'Película'` (fallback en breadcrumb)

### I5 — http.ts
- **Línea:** 142
- **String:** `'La imagen supera 30 MB'`

### I6 — playback.ts
- **Líneas:** 171, 237
- **Strings:** `'Sin fuentes reproducibles'`, `'El servidor no puede reproducir este item'`

### I7 — itemMapping.ts
- **Líneas:** 286, 294, 304
- **Strings:** `'canales'`, `'idiomas'`, `'pistas'`

---

## Orden de Ejecución Sugerido

1. **B1** — Race condition en VideoPlayerViewModel (bug más peligroso)
2. **R1** — Logger centralizado (limpieza rápida, mejora toda la base)
3. **O1 + O2** — SearchOverlay lazy + Nav scroll (ganancia visible de rendimiento)
4. **I1–I7** — i18n (corrección mecánica de bajo riesgo)
5. **B2–B5** — Resto de bugs (memory leaks y race conditions menores)
6. **O3–O8** — Resto de optimizaciones de rendimiento
7. **R2–R8** — Refactorizaciones estructurales
8. **S1–S7** — Simplificaciones de código
