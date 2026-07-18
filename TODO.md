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

## Fase 9 — Mejoras post-revisión

### 9.1 releasePointerCapture en el carrusel ✓

El hero de HomePage capturaba el puntero en `onPointerDown` sin soltarlo explícitamente.
- [x] En `onPointerUp`/`onPointerCancel`, añadido `e.currentTarget.releasePointerCapture?.(e.pointerId)`

### 9.2 loading.hide() duplicado ✓

`loading.hide()` se llama tanto en `VideoRoute.tsx` como en `AppLayout.tsx`.
- [x] Verificado: `loading.hide()` ya es idempotente. No requiere cambios.

### 9.3 ShowViewModel con refresco optimista ✓

`ShowViewModel.load()` retornaba temprano si la serie ya estaba cargada, dejando stale el "continuar viendo".
- [x] Ahora siempre re-fetch pero sin mostrar loading si ya hay datos (optimistic update). El error no sobreescribe datos previos.
- [x] Fix del caché que lo hacía inútil: `invalidateShow(itemId)` se llamaba con ids de episodio pero `showCache` se indexa por id de serie (el delete nunca casaba). Ahora toda mutación (fin de reproducción, marcar visto, editar metadatos/imágenes/subtítulos) hace `clearShowCache()` — siempre correcto; cada serie re-fetchea una vez en la siguiente visita.

### 9.4 MoviePage con loading/error ✓

- [x] Añadidos estados loading/error en `MoviePage` (como ShowPage)

### 9.5 MovieViewModel con API real ✓

`MovieViewModel.load()` solo resolvía de `PROTO_DATA`.
- [x] Añadido `data/api/movies.ts` con `getMovie(id)` y `mapMovie()` (mismo patrón que shows.ts)
- [x] Registrado en ApiService como `catalog.getMovie` y exportado en el barrel
- [x] `MovieViewModel.load()` llama a la API con fallback a PROTO_DATA, seq anti-race y sin pisar proto con errores
- [x] Tests de MovieViewModel (`__tests__/MovieViewModel.test.ts`, 6 casos)

### 9.6 useSignalValue en VideoControls ✓

`useViewModel(videoPlayerVM)` suscribía **todos** los signals del VM.
- [x] Sustituido por `useSignalValue` individual para `currentTime`, `duration`, `playing`, `fullscreen` (el componente ya no re-renderiza por audioTracks/subtitleUrl/buffering…)

### 9.7 wheelAccum residual en carrusel ✓

- [x] Resetear `wheelAccum.current = 0` al inicio del nuevo efecto

### 9.8 CSS specificity (pendiente)

Los selectores de actionSheet (`html body.jf-frontend-active .dialog.actionSheet` = 0,4,2) funcionan pero son frágiles.
- [ ] Evaluar migrar a `@layer` para evitar dependencia del orden de carga

### 9.9 Fullscreen API en Safari (pendiente)

Safari requiere `webkitEnterFullscreen` en `<video>` para ciertos casos. El `VideoPlayerViewModel` solo usa `element.requestFullscreen()`.
- [ ] Verificar comportamiento en Safari y añadir fallback si es necesario

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
