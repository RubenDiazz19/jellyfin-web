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

### B6 — SearchViewModel.start() filtra listeners si se llama múltiples veces (MEDIA)
- **Archivo:** `src/apps/frontend/domain/viewModels/SearchViewModel.ts`
- **Líneas:** 696–729
- **Descripción:** `start()` registra event listeners en `window` y crea un `effect`, pero no limpia los de llamadas anteriores. Si se llama repetidamente sin invocar la función de cleanup, se acumulan listeners y suscripciones.
- **Fix:** Guard contra doble-start: rastrear si ya está iniciado y saltar/advertir, o limpiar suscripciones anteriores antes de re-suscribir.

### B7 — Device ID vacío si nunca se generó (MEDIA)
- **Archivo:** `src/apps/frontend/data/api/playback.ts`
- **Líneas:** 337–340
- **Descripción:** `getDeviceId()` devuelve `localStorage.getItem(KEY) ?? ''`. Si nunca se generó un device ID (primera visita, storage limpiado), devuelve cadena vacía. Este ID se envía al servidor en el header `Authorization` y en `deleteActiveEncodings`. Un device ID vacío puede impedir que el servidor asocie correctamente el encoding con este cliente, impidiendo la limpieza de procesos transcode obsoletos.
- **Fix:** Generar device ID al primer uso con `crypto.randomUUID()` y persistirlo.

### B8 — ToastProvider crea contexto nuevo en cada render (MEDIA)
- **Archivo:** `src/apps/frontend/presentation/components/toast/ToastProvider.tsx`
- **Línea:** 54
- **Descripción:** `value={{ toast }}` crea un nuevo objeto en cada render de `ToastProvider`. Aunque `toast` es estable por `useCallback`, el objeto de valor del contexto es nuevo cada vez. Cualquier consumidor con `useContext(ToastContext)` se re-renderiza en cada render de `ToastProvider`, aunque la función toast no haya cambiado.
- **Fix:** Memoizar el valor del contexto: `const ctxValue = useMemo(() => ({ toast }), [toast]);`.

### B9 — Race conditions en useEffect con async sin guard de cancelación (MEDIA)
- **Archivos:**
  - `presentation/pages/ListPage.tsx` (líneas 51–66)
  - `presentation/pages/SettingsPage.tsx` (líneas 54–59)
  - `presentation/components/controls/AddToDialog.tsx` (líneas 61–71)
  - `presentation/components/admin/editor/IdentifyTab.tsx` (líneas 83–106)
- **Descripción:** Varios `useEffect` lanzan fetches asíncronos sin flag `alive`/`cancelled`. Si las dependencias cambian rápido o el componente se desmonta antes de que la promise resuelva, los `set*` callbacks actualizan estado de componentes desmontados o con datos obsoletos.
- **Fix:** Añadir patrón `let alive = true; ... return () => { alive = false; };` y guardar cada `set*` con `if (alive)`.

### B10 — `as any` doble en SearchResults (BAJA-MEDIA)
- **Archivo:** `src/apps/frontend/presentation/components/search/SearchResults.tsx`
- **Línea:** 128
- **Descripción:** `item={{ ...item, title: 'name' in item ? item.name : (item as any).title, year: 0 } as any}` — doble cast `as any`. Los items de colección tienen `name` pero no `title`, y la card espera `title`. Si la forma de los datos cambia, esto pasa `undefined` silenciosamente.
- **Fix:** Crear función mapper `toCardItem(item): CardItem` que transforme los tipos de forma segura, o usar un type guard con fallback: `('title' in item ? item.title : undefined) ?? ''`.

### B11 — VideoPlayer lee signals `.value` fuera del mecanismo de suscripción (MEDIA)
- **Archivo:** `src/apps/frontend/presentation/components/player/VideoPlayer.tsx`
- **Líneas:** 95–96, 112–114, 165, 283–286, 317–319
- **Descripción:** Varias signals se leen via `.value` directamente en el body del componente (ej. `videoPlayerVM.subtitleUrl.value`, `videoPlayerVM.fullscreen.value`). `useVmSignals` suscribe a algunas, pero estas lecturas directas están fuera del hook. Si alguna signal cambia pero no está en la lista de pick de `useVmSignals`, el componente NO se re-renderiza y el JSX muestra valores obsoletos.
- **Fix:** Auditar todas las lecturas `.value` en el render y asegurar que estén cubiertas por el mecanismo de suscripción, o usar `useSignalValue` para cada una que el pick list omita.

### B12 — ripple.ts: setTimeout de seguridad nunca se limpia (BAJA)
- **Archivo:** `src/apps/frontend/shared/ripple.ts`
- **Línea:** 25
- **Descripción:** `setTimeout(() => ink.remove(), 700)` es un fallback por si `animationend` nunca se dispara. El timeout nunca se cancela incluso si `animationend` sí se ejecuta primero (el handler intenta remover un elemento ya removido, que es no-op). Deja timers innecesarios en la cola.
- **Fix:** Almacenar el ID del timeout y cancelarlo en el handler de `animationend`.

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

### O9 — VideoControls crea setInterval cada segundo para calcular endTime (BAJA)
- **Archivo:** `src/apps/frontend/presentation/components/player/VideoControls.tsx`
- **Líneas:** 54–60
- **Descripción:** Cuando `hasDuration` es true, un `setInterval` dispara cada segundo para actualizar `now` con el fin de mostrar la hora de fin. Esto provoca un re-render de `VideoControls` cada segundo durante toda la reproducción. Dado que `currentTime` ya se actualiza cada segundo, el endTime puede calcularse directamente de `current` y `duration` sin un timer separado.
- **Fix:** Calcular `endTimeText` directamente de `current` y `duration` sin usar estado `now` ni intervalo.

### O10 — getMaxStreamingBitrate() se llama dos veces (BAJA)
- **Archivo:** `src/apps/frontend/data/api/playback.ts`
- **Líneas:** 58–61
- **Descripción:** `MaxStreamingBitrate` y `MaxStaticBitrate` ambos llaman a `getMaxStreamingBitrate()`. Aunque la función lee de `localStorage` y es barata, el resultado podría cachearse en una variable local por claridad.
- **Fix:** `const maxBitrate = getMaxStreamingBitrate();` y usar `maxBitrate` para ambos campos.

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

### R9 — Patrón setBusy/try/catch/toast duplicado en 20+ ubicaciones (ALTA)
- **Archivos afectados:** 20+ archivos incluyendo:
  - `presentation/components/controls/AddToDialog.tsx` (líneas 75–85, 88–101)
  - `presentation/components/controls/MyListButton.tsx` (líneas 92–108, 110–123)
  - `presentation/components/controls/TagsDialog.tsx` (líneas 57–71)
  - `presentation/components/controls/BulkTagsDialog.tsx` (líneas 32–40)
  - `presentation/components/controls/CreateCollectionDialog.tsx` (líneas 36–49)
  - `presentation/components/controls/SelectionBar.tsx` (líneas 52–85, 178–183)
  - `presentation/components/admin/editor/MetadataEditor.tsx`, `MetadataTab.tsx`, `TagsTab.tsx`, `IdentifyTab.tsx`, `SubtitlesTab.tsx`
  - `domain/hooks/useItemActions.ts` (líneas 97–109, 114–122)
  - `presentation/components/admin/AvatarPickerDialog.tsx`
  - `presentation/pages/settings/ProfileSection.tsx`, `LibrariesSection.tsx`, `DisplaySection.tsx`, `SettingsPage.tsx`
- **Descripción:** El patrón `setBusy(true); try { await action(); toast(success); onClose(); } catch(e) { toast(e.message, 'warn'); setBusy(false); }` se repite en prácticamente cada diálogo y manejador de acción. ~120 líneas de boilerplate idéntico.
- **Fix:** Crear hook `useAsyncAction()`:
  ```ts
  function useAsyncAction<T>(
      action: () => Promise<T>,
      opts?: { success?: string; onClose?: () => void }
  ): { execute: () => Promise<void>; busy: boolean }
  ```
  O una función de orden superior `withBusyToast(toast, fn, opts?)`.

### R10 — expandGenre + dedup duplicado en 2 componentes (BAJA)
- **Archivos:**
  - `presentation/components/layout/DetailHero.tsx` (líneas 196–223) — `HeroGenres`
  - `presentation/components/layout/DetailSections.tsx` (líneas 169–195) — `GenreLinks`
- **Descripción:** Ambos componentes hacen `Array.from(new Set(genres.flatMap((g) => expandGenre(g))))` — la misma lógica de expansión y deduplicación.
- **Fix:** Extraer utilidad `expandAndDedupeGenres(genres: string[]): string[]` en `domain/genres.ts` junto a `expandGenre`.

### R11 — Menú de UserAvatar duplicado (touch/desktop) (BAJA)
- **Archivo:** `src/apps/frontend/presentation/components/layout/UserAvatar.tsx`
- **Líneas:** 48–73 (touch/BottomSheet), 146–169 (desktop/PopupPanel)
- **Descripción:** Los mismos 5 items de menú se renderizan dos veces — una para touch y otra para desktop. Ambos branch tienen la misma estructura de click handler (`setOpen(false); toast(...); logout()`). El branch desktop añade URL del servidor y divisores.
- **Fix:** Extraer los items del menú a una variable JSX compartida que ambos branches rendericen. El prop `sheet` en `MenuEntry` ya maneja las diferencias de estilo.

### R12 — Sin regla ESLint para bloquear imports de legacy/components en frontend (MEDIA)
- **Archivo:** `config/eslint/frontend.mjs`
- **Descripción:** Las reglas MVVM bloquean `presentation/` → `data/` y `domain/` → `presentation/`, pero NO hay regla que impida `src/apps/frontend/**` importar de `src/legacy/components/*` o `src/legacy/scripts/*`. El caso actual es `ListCardMenu.tsx` importando `playbackManager` directamente. Sin esta regla, nuevos imports legacy pueden colarse sin detección.
- **Fix:** Añadir regla `import/no-restricted-paths` para `src/apps/frontend/**` que bloquee `src/legacy/components/*` y `src/legacy/scripts/*`, con whitelist para módulos aceptados (`lib/globalize`, `lib/jellyfin-apiclient`).

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

### I8 — SeasonCard.tsx
- **Líneas:** 74, 105
- **Strings:** `'Temporada'`, `'episodios'`

### I9 — SeasonPage.tsx
- **Líneas:** 140, 191–194, 227
- **Strings:** `'episodios'`, `'vistos'`, `'Reanudar E...'`, `'Volver a ver desde E01'`, `'Continuar con E...'`, `'Temporada {s.n}'`

### I10 — PersonStats.tsx
- **Línea:** 66
- **Strings:** `'Genero'`, `'Anos'`

### I11 — EpCard.tsx
- **Línea:** 75
- **String:** `'Temporada'`

### I12 — DetailSections.tsx
- **Línea:** 37
- **String:** `'Cargando...'` (debería usar `globalize.translate('Loading')`)

### I13 — SearchResultCard.tsx
- **Línea:** 26
- **String:** `'Coleccion'`

---

## 🧪 Tests Faltantes

### T1 — Cobertura de páginas (MEDIA)
- **Páginas sin tests:**
  - `presentation/pages/HomePage.tsx` — la página principal no tiene test dedicado
  - `presentation/pages/LoginPage.tsx`
  - `presentation/pages/ShowPage.tsx`
  - `presentation/pages/MoviePage.tsx`
  - `presentation/pages/SeasonPage.tsx`
  - `presentation/pages/EpisodePage.tsx`
  - `presentation/pages/SearchPage.tsx`
  - `presentation/pages/GenrePage.tsx`
  - `presentation/pages/FavoritesPage.tsx`
  - `presentation/pages/PersonPage.tsx`
  - `presentation/pages/ListsPage.tsx`
  - `presentation/pages/ListPage.tsx`
  - `presentation/pages/QueuePage.tsx`
- **Fix:** Añadir al menos smoke tests para las páginas más visitadas (HomePage, LoginPage, ShowPage, MoviePage).

### T2 — Módulos data/api sin tests (MEDIA)
- **Archivos sin tests:**
  - `data/api/http.ts` — `apiFetch`, `apiSend`, `uploadImage`, `authHeader`
  - `data/api/auth.ts` — `connectTo`, `authenticate`, `getSavedServers`, `saveServer`
  - `data/api/quickConnect.ts`
  - `data/api/tasks.ts` — `watchScheduledTasks`, `watchItemRefresh`
  - `data/session/session.ts` — restore, clear, event wiring (solo testeado indirectamente via SessionViewModel)
- **Fix:** Tests unitarios para los flujos de autenticación y HTTP helpers.

### T3 — Componentes UI sin tests (BAJA)
- **Componentes críticos sin tests:**
  - `presentation/components/player/VideoControls.tsx`
  - `presentation/components/player/VideoSettingsMenu.tsx`
  - `presentation/components/search/SearchFilters.tsx`
  - `presentation/components/search/SearchResults.tsx`
  - `presentation/components/controls/AddToDialog.tsx`
  - `presentation/components/controls/ConfirmDialog.tsx`
  - `presentation/components/controls/WatchedToggle.tsx`
- **Fix:** Tests de integración para los componentes de mayor uso.

---

## 🧹 Limpieza de Configuración

### C1 — Polyfills obsoletos en ESLint (BAJA)
- **Archivo:** `config/eslint/app.mjs`
- **Líneas:** ~73
- **Descripción:** La lista de polyfills incluye ES2015 (`Object.assign`, `Array.from`, `String.trim`, `Number`, `RegExp`, `Symbol`, `Map`, `Set`, etc.) que son nativos desde ES2015/2017. Con `browserslist` apuntando a `chrome107`, `firefox104`, `safari16`, ninguno necesita polyfill. También incluye `document.registerElement` (API v0 de Web Components no utilizada).
- **Fix:** Limpiar la lista para reflejar solo polyfills reales necesarios.

### C2 — `history` en devDependencies posiblemente sin uso (BAJA)
- **Archivo:** `package.json`
- **Descripción:** `history` (5.3.0) está en `devDependencies`. Era la librería de routing del setup legacy de React Router. El frontend nuevo usa `react-router-dom` 6.x. Verificar si se usa en tests del dashboard o legacy, y eliminar si no es así.

### C3 — `loading.ts` legacy podría reemplazarse (BAJA)
- **Archivos:**
  - `src/apps/frontend/app/VideoRoute.tsx` (línea 4)
  - `src/apps/frontend/app/AppLayout.tsx` (línea 2)
- **Descripción:** El módulo legacy `loading` es imperativo (crea `<div class="docspinner">`, lo añade a `document.body`, alterna clases). Solo se usa `loading.hide()` para dismiss del splash screen. Es el último acoplamiento a DOM imperativo en `app/`.
- **Fix:** Reemplazar con una variable de estado React o una línea CSS inline que oculte el splash.

---

## Orden de Ejecución Sugerido

1. **B1** — Race condition en VideoPlayerViewModel (bug más peligroso)
2. **B9** — Race conditions en useEffect con async (4 archivos, impacto visible)
3. **B8** — ToastProvider context memo (re-renders innecesarios en toda la app)
4. **R1** — Logger centralizado (limpieza rápida, mejora toda la base)
5. **R9** — useAsyncAction hook (elimina ~120 líneas de boilerplate en 20+ archivos)
6. **O1 + O2** — SearchOverlay lazy + Nav scroll (ganancia visible de rendimiento)
7. **I1–I13** — i18n (corrección mecánica de bajo riesgo)
8. **B6–B7, B10–B12** — Resto de bugs (memory leaks, device ID, type safety)
9. **O3–O10** — Resto de optimizaciones de rendimiento
10. **R2–R8, R10–R12** — Refactorizaciones estructurales
11. **S1–S7** — Simplificaciones de código
12. **T1–T3** — Tests faltantes
13. **C1–C3** — Limpieza de configuración
