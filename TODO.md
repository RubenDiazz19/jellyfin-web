# TODO: MVVM, limpieza y optimización de jellyfin-web

## Estrategia general (ya implementada)

MVVM clásico con Signals:

```
data/    → Model  (API, sesión, stores, caché en memoria)
domain/viewModels/ → ViewModel (clase @observable, comandos, 0 imports de React)
presentation/ → View (componentes React, solo render + binding)
domain/bridge/  → Hooks puente (único lugar con React hooks)
```

Reglas:
- **ViewModel es una clase**, nunca un hook.
- **ViewModel no importa nada de React ni de presentation/**.
- **View no importa nada de data/** — solo ve ViewModels a través del bridge.
- **Bridge** es el único sitio con hooks (`useViewModel()` suscribe signals → React).
- **Signals** (`@preact/signals-core`) para reactividad: propiedades observables sin decoradores.

---

## ✅ Fases completadas

- **Fase 0** — Signals + estructura MVVM + ApiService + ViewModels (Home, Show, Movie, Search, Library, Login, Session, VideoPlayer) + ESLint MVVM rules + tests
- **Fase 1** — Dependencias compartidas movidas (DrawerHeaderLink, playback constants)
- **Fase 2** — Eliminados `apps/legacy`, `apps/modern`, `apps/wizard`, `src/plugins`, `elements/`, scripts legacy, estilos huérfanos
- **Fase 3** — Eliminados ~40 componentes legacy no usados; conservados los que necesita dashboard
- **Fase 4** — Reproductor de vídeo propio (VideoPlayerViewModel + VideoPlayer.tsx + OSD completo con seek, volumen, subs, audio, fullscreen, auto-ocultar, atajos de teclado)
- **Fase 5** — Entry point limpio (sin polyfills, sin auto-imports legacy, sin plugins)
- **Fase 6** — RootAppRouter simplificado (solo dashboard + frontend)
- **Fase 7** — package.json limpio (sin webpack/babel/polyfills, build con Vite)
- **Fase 8.1–8.4** — TypeScript, lint, tests y build de producción verificados
- **Fase 9.1–9.7** — Mejoras post-revisión: releasePointerCapture en el carrusel, ShowViewModel con refresco optimista + fix del caché (`clearShowCache()` en toda mutación), MoviePage con loading/error, MovieViewModel con API real + tests, `useSignalValue` en VideoControls, reset de wheelAccum

---

## Fase 8.5 — Verificación manual (pendiente)

- [ ] Navegación completa: home → serie → temporada → episodio
- [ ] Búsqueda
- [ ] Reproducción: play, pausa, seek, volumen, fullscreen, audio/subs
- [ ] Dashboard: usuarios, plugins, librerías, tareas
- [ ] Login / logout / cambio de usuario
- [ ] Tema oscuro
- [ ] Responsive / móvil / TV

---

## Fase 9 — Pendientes menores

### 9.8 CSS specificity (pendiente)

Los selectores de actionSheet (`html body.jf-frontend-active .dialog.actionSheet` = 0,4,2) funcionan pero son frágiles.
- [ ] Evaluar migrar a `@layer` para evitar dependencia del orden de carga

### 9.9 Fullscreen API en Safari (pendiente)

Safari requiere `webkitEnterFullscreen` en `<video>` para ciertos casos. El `VideoPlayerViewModel` solo usa `element.requestFullscreen()`.
- [ ] Verificar comportamiento en Safari y añadir fallback si es necesario

---

## Fase 10 — Reproductor: nuevas funcionalidades

### 10.1 Velocidad de reproducción y menú de pistas siempre accesible ✓

- [x] Signal `playbackRate` + comando `setPlaybackRate` en VideoPlayerViewModel (persiste al recargar la fuente por cambio de pista vía `defaultPlaybackRate`)
- [x] Sección «Velocidad» (0.5×–2×) en VideoSettingsMenu
- [x] El menú de ajustes se muestra siempre (antes solo con >1 audio o subtítulos); la pista de audio se lista aunque solo haya una
- [x] Tests del comando en VideoPlayerViewModel.test

### 10.2 Picture-in-Picture ✓

- [x] Signals `pipAvailable`/`pipActive` + comando `togglePip` (con feature-detect: oculto en navegadores sin API)
- [x] Botón PiP en el OSD + salida limpia en `close()`
- [x] Atajo de teclado `p`
- [x] Tests

### 10.3 Enviar a TV (Chromecast / AirPlay) ✓

- [x] Remote Playback API (`video.remote`): signals `castAvailable`/`castState` + comando `promptCast` (sin SDK externo; Chrome → Cast, Safari → AirPlay)
- [x] Botón en el OSD, visible solo cuando hay receptores en la red; estado activo mientras se emite
- [x] Nota: con transcode HLS (MSE) Chrome no permite remoting — el botón solo aparece en DirectPlay
- [x] Tests

### 10.4 Saltos de ±10 s en el OSD ✓

- [x] Botones retroceder/avanzar 10 s junto al play (los atajos ← → ya existían)

---

## Fase 11 — Hero: tiempo restante al hacer hover en play ✓

- [x] `formatRemainingCompact()`: `<60 min` → «42 min»; `≥60` → «1 h 12 min» (60 exacto → «1 h»)
- [x] El PlayBtn del hero usa el formato compacto en el hoverText (slides «continuar viendo»)
- [x] Tests del formateador

---

## Fase 12 — Progreso actualizado al instante al salir del reproductor ✓

Bug: al salir de un episodio/película, la página de destino (home/serie) hacía fetch en paralelo con el `reportPlaybackStop` aún en vuelo → el servidor respondía con la posición vieja y el progreso no se veía hasta recargar.

- [x] Barrera `settlePlaybackReports()` en data/api/playback.ts: los fetch de catálogo (home carousel, shows, movie) esperan al último stop en vuelo (con timeout de seguridad de 2 s)
- [x] `clearShowCache()` dentro de la barrera; el DELETE de ActiveEncodings sale del camino crítico
- [x] Tests de la barrera (orden stop → fetch, timeout)

---

## Fase 13 — Reproductor: fix de cambio de audio y menús divididos

### 13.1 Fix: el cambio de pista de audio no surtía efecto ✓

Causa raíz (verificada contra el servidor con curl): Jellyfin ignora `audioStreamIndex` en PlaybackInfo **si no va acompañado de `mediaSourceId`** — la TranscodingUrl volvía siempre con `AudioStreamIndex=1` (el default).

- [x] `getPlaybackDecision` acepta `mediaSourceId` y lo envía como query param
- [x] `reload()` (cambio de audio / subtítulo quemado) pasa el `mediaSourceId` de la decisión vigente
- [x] Test: setAudioTrack repide PlaybackInfo con `audioStreamIndex` + `mediaSourceId`
- [x] Verificación E2E: la TranscodingUrl trae el AudioStreamIndex elegido y el `<video>` cambia de sesión conservando la posición

### 13.2 Menús divididos: subtítulos, audio y velocidad ✓

El menú único de ajustes era demasiado grande.

- [x] Tres botones independientes en el OSD, cada uno con su icono y su panel: Subtítulos (visible si hay pistas), Audio (visible si hay pistas), Velocidad (siempre)
- [x] Solo un panel abierto a la vez; click fuera cierra
- [x] Iconos nuevos: subtítulos (CC), audio (ecualizador), velocidad (velocímetro)

---

## Fase 14 — ShowPage: tiempo restante expandible en el play del hero ✓

El botón píldora del hero sustituía el texto al hacer hover (`T1 E05` → restante), y en modo Jellyfin `cont.remaining` venía vacío (hover mostraba una cadena vacía).

- [x] `getShow()` rellena `cont.remaining` desde el runtime × progreso del episodio en curso
- [x] Hover: el botón se expande solo en horizontal con «· 12 min» (formato compacto), misma altura, animado; al quitar el ratón vuelve a su estado (verificado E2E: 129→187 px de ancho, altura constante 44 px)
- [x] La barra de progreso interna del botón se mantiene

---

## Fase 15 — Fixes: subtítulos, marcar como visto y layout del menú

### 15.1 Fix: el cambio de subtítulos no surtía efecto ✓

El `<track>` VTT solo cambiaba de `src`; el navegador no recarga un track ya
montado al mutar su atributo, así que seguían viéndose los subtítulos viejos.

- [x] `key={subtitleUrl}` en el `<track>` fuerza el remount → el navegador
      carga el nuevo VTT
- [x] Verificación E2E: al cambiar de pista el `<track>.src` pasa de
      `Subtitles/17` a `Subtitles/16` y el modo sigue en `showing`

### 15.2 Marcar como visto contra Jellyfin ✓

Los botones agregados solo tocaban el store local; no se propagaban al server.

- [x] `WATCHED.sync(scope, watched)` sincroniza el subconjunto de una serie/
      película con la verdad del server (un único evento)
- [x] `getShow()` / `getMovie()` hidratan el store desde `UserData.Played`
- [x] `ShowNavWatchedButton` → `markPlayed(showId)` (el server propaga a todos
      los episodios/temporadas); `SeasonWatchedButton` → `markPlayed(seasonId)`;
      `MovieWatchedButton` → `markPlayed(movieId)`; `WatchedButton` acepta
      `serverId` (jfId del episodio) y marca en el server si hay sesión
- [x] Estado agregado (serie/temporada completas) se deriva de los episodios:
      marcar todos ⇒ marcado; desmarcar uno ⇒ desmarcado. Revert local si el
      server falla
- [x] Verificación E2E contra el server real: 7 no vistos → 0 → 7

### 15.3 Fix: columna negra a la derecha al abrir el menú «más opciones» ✓

Grid blowout: las rejillas de dos columnas de las páginas de detalle
(`1.5fr 1fr` / `1.6fr 1fr`) usaban tracks `1fr` = `minmax(auto, 1fr)`, cuyo
mínimo es el min-content del hijo (la fila de reparto, muy ancha) → la rejilla
desbordaba el viewport (`scrollWidth` 2263 > 1920). En pantalla completa del
navegador ese sobrante se veía como una franja negra a la derecha al abrir
cualquier menú.

- [x] `minmax(0, Nfr)` en ShowDetail / EpisodeDetail / MoviePage → los tracks
      pueden encogerse y la `CastList` scrollea dentro de su `overflow-x: auto`
- [x] Red de seguridad: `overflow-x: clip` en `html:has(body.jf-frontend-active)`
      (clip, no hidden: no crea contenedor de scroll ni rompe los `position:
      fixed` de los menús flotantes)
- [x] Verificación E2E: `scrollWidth == clientWidth` en show/episode antes y
      después de abrir el menú, y en pantalla completa (1999px) sin franja negra

---

---

## Fase 16 — Optimizaciones de rendimiento y mejora del código ✓

### 🟥 Alto impacto

#### 16.1 N+1 queries al cargar serie
**Archivo:** `data/api/shows.ts:getSeasonsWithEpisodes()`

Por cada temporada hace 1 request → para 10 temporadas son 11 requests secuenciales. Jellyfin permite obtener todos los episodios de golpe.

- [x] Una sola llamada a `/Shows/{id}/Episodes` + Seasons en paralelo; episodios agrupados por `ParentIndexNumber` (E2E: 1 request donde antes había N+1)

#### 16.2 Hero image de episodios usa `Primary` en vez de `Thumb`
**Archivo:** `data/api/shows.ts:140-141`, usado en `EpisodePage.tsx:94`

```ts
thumbHD: imageUrl(item.Id, 'Primary', { maxWidth: 1920 })
```

Jellyfin tiene tipo `Thumb` específico para thumbnails de episodio, normalmente 16:9 y con mejor encuadre. También se puede caer a `ParentBackdropImageTags` (backdrop de la serie) cuando no hay thumbnail.

- [x] Cadena `Thumb` (si hay tag) → `Primary` → backdrop de la serie, con el tag correcto en la URL

#### 16.3 Sin negociación de formato de imagen
**Archivo:** `data/api/images.ts:imageUrl()`

Todas las imágenes se piden sin `format`. Jellyfin soporta `format=webp` y `format=avif` — reducirían el peso de imágenes 50-70%. Crítico para hero images de 1920px que son LCP.

- [x] `format=webp` en `imageUrl()` y `getItemBackdrops()` (sin feature-detect: todo navegador que soporta el resto del frontend decodifica webp; verificado E2E: todas las respuestas llegan `image/webp`)

### 🟧 Medio impacto

#### 16.4 `useViewModel` re-renderiza todo el componente por cualquier cambio
**Archivo:** `domain/bridge/useViewModel.ts`

Suscribe a todos los signals del ViewModel. En ShowPage, cambiar `loading` o `error` re-renderiza la página completa aunque solo haya cambiado el estado de carga.

- [x] Nuevo `useVmSignals(vm, pick)` de suscripción selectiva; aplicado en Home (hero ya no re-renderiza al cargar la biblioteca), Show/Season/Episode (sin suscripción a `loading`) y Movie

#### 16.5 Backdrop renderiza TODAS las imágenes del crossfade en el DOM
**Archivo:** `presentation/components/layout/Backdrop.tsx:29-39`

```tsx
pool.map((url, i) => (
    <div style={{ opacity: i === idx ? 1 : 0 }} />
))
```

Si una serie tiene 5 backdrops, hay 5 divs con `background-image` en el DOM. Las imágenes ocultas (opacity 0) igual se descargan.

- [x] Doble búfer (activa + saliente durante el fade) y precarga de la siguiente con `new Image()` (E2E: 1 capa en DOM donde antes había N)

#### 16.6 Sin preload para hero images (LCP)
La hero image se carga via CSS `background-image` → prioridad baja. Debería tener `<link rel="preload">` o un `<img fetchpriority="high">` oculto.

- [x] `<link rel="preload" as="image" fetchpriority="high">` del backdrop activo, gestionado por el propio Backdrop

#### 16.7 Sin error boundaries
Cualquier error en render de una página crashea toda la app.

- [x] `ErrorBoundary` con fallback (recargar / volver al inicio) montado con key por ruta en App.tsx

#### 16.8 `as any` en props de alineación
**Archivo:** `ShowPage.tsx`, `MoviePage.tsx`

```tsx
alignItems: pos.align as any,
```

Hero position tokens tienen tipos literales que no casan con `CSSProperties`.

- [x] `HERO_POS` tipado con `CSSProperties[...]`; eliminados los `as any` de ShowPage/MoviePage

#### 16.9 Cache de shows sin invalidación por tiempo
**Archivo:** `data/api/cache.ts`

`showCache` solo se limpia en mutaciones (watched, playback stop). Los datos pueden estar stale indefinidamente.

- [x] TTL de 5 min en showCache (API compatible con Map; tests con fake timers)

### 🟩 Bajo impacto

#### 16.10 Date formatting sin memo
```tsx
new Date(ep.date).toLocaleDateString('es-ES', { ... })
```
Se ejecuta en cada render, a veces 2-3 veces por página.

- [x] `formatDateLong()` con caché por fecha en theme/format.ts; EpisodePage lo usa en sus 3 sitios

#### 16.11 Muchos divs con onClick en vez de `<button>`
Géneros, breadcrumbs, etc. usan `<span onClick>` → no funcionan con teclado.

- [x] Nav (logo, tabs, breadcrumbs, lupa) y géneros de Show/Movie (hero y detalle) son `<button>` con reset heredado

#### 16.12 Sin manejo de foco en navegación
Al cambiar de página, el foco no se gestiona. Usuarios de teclado pierden la posición.

- [x] Al cambiar de ruta el foco se mueve al contenedor de la página (`tabIndex=-1`, sin outline; preventScroll vía focusPatch)

#### 16.13 `target: ES5` en tsconfig
Vite transpila igual, pero es confuso. Podría ser `ES2017+` para bundles más pequeños.

- [x] `target: ES2020` + `lib ES2020` (typecheck y build de producción verificados)

#### 16.14 Baja cobertura de tests
6 tests para 92 archivos. Sin tests de componentes ni integración.

- [x] +17 tests: watchedStore (toggle/setMany/sync y eventos), showCache TTL, formatDateLong, LibraryViewModel (películas, proto, error, carreras) — 223 en total

---

## Fase 17 — Películas con API real ✓

Antes las películas solo existían en el catálogo proto; con sesión Jellyfin la
biblioteca `/movies` salía vacía y ni la home ni el hero ni la búsqueda las
mostraban.

- [x] `getMovies()` en data/api/movies.ts (listado con `IncludeItemTypes=Movie`
      + hidratación del store «visto» desde `UserData.Played`)
- [x] `LibraryViewModel.load('movies')` usa la API real con sesión
- [x] `HomeViewModel` carga series y películas en paralelo (películas opcionales:
      si fallan, las series siguen); fila «Películas» en la home Jellyfin
- [x] Hero: películas a medias desde `/Items/Resume` (etiqueta «Continuar
      viendo» sin T·E, reanuda directo en el reproductor) + últimas películas
      intercaladas con las series en los slides «nuevo»
- [x] `SearchViewModel` busca también sobre las películas del server
- [x] Tests del HomeViewModel actualizados (getMovies en mocks + caso de fallo
      parcial); E2E: biblioteca con contador, ficha con logo/play, hero con 2 slides

---

## Fase 18 — Panel de ajustes completo contra Jellyfin ✓

El placeholder de Ajustes solo mostraba la sesión; el resto de opciones eran
toasts «pendiente de conectar». Ahora todo va contra la API real (idea: no
tener que abrir el web nativo para el día a día).

- [x] `data/api/users.ts`: getCurrentUser (`/Users/Me`), updateUserConfig
      (merge + POST Configuration), changePassword, avatar (subir/borrar/URL),
      getUserViews, getUsers (admin)
- [x] **Perfil** (`/profile` abre aquí): avatar con subida/borrado, datos de la
      sesión, cambio de contraseña, cerrar sesión
- [x] **Reproducción** (`/settings` abre aquí): idioma de audio preferido,
      pista por defecto, recordar audio/subtítulos, autoplay del siguiente
      episodio (todo persiste en el server con parche optimista + revert), y
      calidad máxima de streaming (localStorage `jfp-max-bitrate`, la lee el
      device profile del reproductor)
- [x] **Subtítulos**: modo (Por defecto/Inteligente/Solo forzados/Siempre/Nunca)
      e idioma preferido
- [x] **Bibliotecas**: vistas del usuario con carátula y tipo; escaneo global y
      acceso al panel de administración (admin)
- [x] **Servidor**: nombre/versión/SO/id + abrir panel de administración
- [x] **Usuarios** (solo admin): listado con rol y última actividad
- [x] E2E contra el server: el toggle cambia `RememberSubtitleSelections` en el
      server y revierte; el idioma de subtítulos llega como `spa`; secciones de
      bibliotecas/servidor/usuarios cargan datos reales

---

## Fase 19 — Menú «más opciones» de películas arreglado ✓

Causa raíz: MoviePage pasaba al MoreButton el id con prefijo `movie-` (clave
de los stores locales) — todas las llamadas al server iban con un id inválido:
la descarga no arrancaba, el editor de imágenes no encontraba las aplicadas,
marcar visto/borrar/metadata fallaban.

- [x] MoreButton recibe SIEMPRE el id real; el prefijo `movie-` de los stores
      locales (visto/favorito) lo aplica internamente según `type`
- [x] Descargar funciona (E2E: evento download con «Obsession.mp4»)
- [x] «Editar imágenes» muestra póster/fondos/logo actuales (E2E: Primary
      visible y «Fondos (1)»)
- [x] «Añadir a lista de reproducción» y «Añadir a colección» nativos:
      data/api/lists.ts (getPlaylists/getCollections, add, create) + diálogo
      AddToDialog con listado, carátulas y creación — sin saltar al web nativo
      (también en series y episodios)
- [x] E2E contra el server: crear playlist desde el diálogo aparece en
      /Items?IncludeItemTypes=Playlist; marcar reproducido cambia
      UserData.Played

---

## Resumen de impacto

| Métrica | Antes | Después |
|---------|-------|---------|
| Directorios `apps/` | 5 (legacy, modern, dashboard, wizard, frontend) | 2 (dashboard, frontend) |
| Componentes en `components/` | ~107 | ~40-50 |
| Líneas de JS/TS eliminadas | — | ~58.000 |
| Dependencias npm | ~75 | ~53-58 |
| ViewModels testeables sin React | 0 | 8 |
| Errores ESLint | ~500 | 0 |
| Warnings ESLint | ~200 | 71 (sonar + exhaustive-deps) |
