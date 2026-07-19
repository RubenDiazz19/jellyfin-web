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

## Fase 14 — ShowPage: tiempo restante expandible en el play del hero

El botón píldora del hero sustituía el texto al hacer hover (`T1 E05` → restante), y en modo Jellyfin `cont.remaining` venía vacío (hover mostraba una cadena vacía).

- [ ] `getShow()` rellena `cont.remaining` desde el runtime × progreso del episodio en curso
- [ ] Hover: el botón se expande solo en horizontal con «· 12 min» (formato compacto), misma altura, animado; al quitar el ratón vuelve a su estado
- [ ] La barra de progreso interna del botón se mantiene

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
