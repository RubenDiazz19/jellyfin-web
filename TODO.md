# TODO — Optimizaciones y mejoras del frontend propio

Trabajo sobre el frontend propio (`src/apps/frontend/`). Regla cardinal que se
respeta: **desktop no cambia byte a byte** (`desktopIntegrity.test.tsx` lo
vigila), los comentarios van en español y el cierre de cada fase es
`build:check`, `lint` y `test`.

---

# Pendiente

## Selector de avatar a pantalla completa estilo Crunchyroll

El Plan A ya resuelve el arte del personaje desde AniList y la rejilla lo
pinta. Lo que falta es cambiar el formato del diálogo, de modal de 560px a
pantalla completa con todas las opciones a la vista:

- **Primitiva fullscreen en `Dialog`**: `variant?: 'modal' | 'fullscreen'`
  (por defecto `'modal'`, nada de lo existente cambia). El fullscreen ocupa
  `inset: 0`, panel al 100%, `borderRadius: 0`, fondo negro; portal, Escape y
  `stopPropagation` compartidos con el modal.
- **Catálogo completo de la biblioteca** en `avatars.ts`:
  `browseLibraryCharacters({ startIndex })` pagina todos los items
  `Movie,Series` con `Fields=People` (chunks con `StartIndex`), dedupe por
  `Id:Role` y **agrupado por serie**. Requiere refactor de
  `charactersFromItems` para compartir el `seen` entre páginas.
- **Fuentes**: la búsqueda pasa a ser SOLO de la biblioteca local
  (`searchLibraryCharacters`); se quitan AniList y TMDB como fuentes de
  candidatos. AniList queda únicamente como proveedor de arte (ya integrado en
  el Plan A).
- **ViewModel**: `groups` (serie → candidatos), `seriesFilter`, `hasMore` /
  `loadMore`; filtrar selecciona el grupo cargado; el arte se resuelve por
  serie cuando el grupo está a la vista.
- **Vista**: cabecera + búsqueda ancha + chips de serie (scroll horizontal) +
  rejilla grande `repeat(auto-fill, minmax(140px, 1fr))` + «Cargar más» +
  barra inferior con la composición actual (vista previa + Guardar).
- **Strings**: `AvatarPickerAllSeries` («Todas») y `AvatarPickerLoadMore`
  («Cargar más») en `en-us.json` / `es.json`.
- **Tests**: paginación/agrupación/dedupe de `browseLibraryCharacters`; chips
  y filtro en `AvatarPickerDialog.test.tsx`; VM con catálogo agrupado.

---

## Fase 1 — Componentes duplicados en `presentation/` (COMPLETADA)


### 1.1 Unificar los 4 WatchedButton en un componente genérico

**Archivos afectados:**
`WatchedButton.tsx`, `MovieWatchedButton.tsx`, `ShowNavWatchedButton.tsx`,
`SeasonWatchedButton.tsx` (todos en `controls/`).

Los 4 siguen el mismo patrón: computar `active` → `useWatchedToggle` →
`WatchedToggleIcon`. La única diferencia es la fuente del estado (showVM,
movieVM o un id directo).

**Plan:** Crear `WatchedToggle` genérico que acepte
`{ active, applyLocal, serverId, message }` directamente (los mismos args
de `useWatchedToggle`). Los 4 actuales se vuelven wrappers de 3-5 líneas
o se eliminan si el caller puede computar los args.

### 1.2 Extraer `<NavActions>` del Nav duplicado

**Archivo:** `layout/Nav.tsx` (líneas 112-126 y 211-226).

El bloque FavButton + WatchedButton está copiado idénticamente para mobile
y desktop.

**Plan:** Extraer `<NavActions actionId actionData />` y usarlo en ambos
branches.

### 1.3 Unificar estilos de esquina de tarjetas (fav + watched)

**Archivos:** `PosterShell.tsx`, `CwCard.tsx`, `SeasonCard.tsx`, `EpCard.tsx`.

Los 4 implementan independientemente posicionamiento absolute para botones
de esquina (top-left watched, top-right fav).

**Plan:** Crear `<CardOverlay>` con slots `topLeft` y `topRight`.

### 1.4 Extraer `<CardProgress>` para la barra de progreso

**Archivos:** `PosterShell.tsx`, `CwCard.tsx`, `SeasonCard.tsx`, `EpCard.tsx`.

Los 4 usan exactamente:
```tsx
<div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
    <Progress value={...} height={3} />
</div>
```

**Plan:** Un componente `<CardProgress>` o agregar modo
`position: 'absolute'` a `Progress`.

### 1.5 Unificar el frame de poster

**Archivos:** `PosterShell.tsx`, `PosterTile.tsx`, `SeasonCard.tsx`.

Los 3 repiten `aspectRatio: '2/3', borderRadius: 4, overflow: 'hidden',
position: 'relative'` + `containerType: 'inline-size'` + `background` +
`contentVisibility`.

**Plan:** Un componente `<PosterFrame>` o una clase CSS `.jfp-poster-frame`.

### 1.6 Unificar el overlay de logo/título

**Archivos:** `PosterShell.tsx` (128-180), `PosterTile.tsx` (88-146).

Ambos implementan la misma lógica: logo → img con objectPosition left
bottom, sin logo → título con line-clamp. Diferencias menores en font-size.

**Plan:** `<PosterOverlay logo title progress />` compartido.

### 1.7 PosterShell debe usar `<SelectionMark>` en vez de reimplementarlo

**Archivo:** `PosterShell.tsx` (105-114) vs `SelectionMark.tsx` (8-16).

PosterShell reimplementa inline el mismo markup que `SelectionMark`.

**Plan:** Reemplazar el inline por `<SelectionMark selected={selected} />`.

### 1.8 Extraer `<LoadState>` para diálogos y páginas

**Archivos:** `AddToDialog.tsx`, `TagsDialog.tsx`, `MyListButton.tsx`,
`LibraryPage.tsx`, `FavoritesPage.tsx`, `CatalogPage.tsx`, `ListsPage.tsx`,
`ListPage.tsx`.

8+ archivos repiten
`{error ? <ErrText/> : !data ? <Loading/> : data.length===0 ? <Empty/> : <Content/>}`.

**Plan:** `<LoadState loading error count emptyTitle emptyText>` que maneje
los 3 estados.

### 1.9 Extraer `<PopupPanel>` para menús flotantes

**Archivos:** `MoreButton.tsx`, `ListCardMenu.tsx`, `UserAvatar.tsx`.

Los 3 repiten los mismos estilos de popup (blur, borderRadius, boxShadow,
position fixed).

**Plan:** `<PopupPanel>` con estilos unificados + portal + click-outside.

### 1.10 Unificar estilos de fila de menú

**Archivos:** `ItemMenuList.tsx`, `ListCardMenu.tsx`, `ImageUploadMenu.tsx`,
`UserAvatar.tsx`.

Los 4 reimplementan el mismo patrón de botón de menú (display block,
width 100%, hover con rgba).

**Plan:** `ItemMenuList` es la versión canónica. Los otros 3 deben usarlo
o un `<MenuEntry>` extraído.

### 1.11 Extraer `useListsSync()` para el patrón de evento LISTS

**Archivos:** `ListsPage.tsx` (33-39), `ListPage.tsx` (52-57),
`MyListButton.tsx` (91-98).

Los 3 implementan el mismo listener de `LISTS.event` + `refresh()`.

**Plan:** Hook `useListsSync()` que retorne las listas actuales y maneje
la suscripción.

### 1.12 Extraer `useViewModelLoad()` para el patrón de carga

**Archivos:** 7 páginas (Library, Favorites, Genre, Person, Search,
Login, HomePage).

Todas hacen `useViewModel(vm)` +
`useEffect(() => void vm.load(...), [deps])`.

**Plan:** Hook combinado `useViewModelLoad(vm, loadFn, deps)`.

---

## Fase 2 — ViewModels y domain layer (COMPLETADA)

### 2.1 Crear `DetailViewModel` base para Show/Movie

**Archivos:** `ShowViewModel.ts` (93 líneas), `MovieViewModel.ts` (88 líneas).

Ambos tienen la misma estructura: `item` signal, `loading`, `error`, `gone`,
`LoadGuard`, `ItemMutationSubscription`, `load(id)`, `showFor(id)` /
`movieFor(id)`, `subscribeToMutations()`.

**Plan:** Un `DetailViewModel<T>` base con la lógica compartida. Los dos
se vuelven subclases de ~20 líneas cada una.

### 2.2 Unificar la suscripción a mutaciones

**Archivos:** `HomeViewModel.ts`, `LibraryViewModel.ts`, `ShowViewModel.ts`,
`MovieViewModel.ts`.

Los 4 tienen el mismo `subscribeToMutations()` con
`this.mutations.ensure(callback, MUTATION_DEBOUNCE_MS)`.

**Plan:** Helper `subscribeToMutations(vm, debounce, callback)` en
`itemMutations.ts`.

### 2.3 Decomponer `VideoPlayerViewModel` (964 líneas)

**Archivo:** `domain/viewModels/VideoPlayerViewModel.ts`.

Ya tiene `SegmentTracker`, `TitlePreferences`, `AutoNextTracker`. El VM
principal sigue siendo grande.

**Plan:** Extraer `SubtitlesBinding` y `CastBinding` como colaboradores
adicionales si el VM crece.

---

## Fase 3 — Reorganización de código compartido

### 3.1 Mover `globalize` de `src/legacy/lib/` a `src/lib/`

`globalize` es el sistema i18n del proyecto (219 importadores) pero vive
en `legacy/`, lo que implica que es legacy cuando no lo es.

**Plan:** Mover a `src/lib/globalize/`, actualizar path aliases en
`tsconfig.json` y `vite.config.ts`.

### 3.2 Mover `queryClient` a `src/lib/query/`

El propio archivo tiene un `TODO: Move this file to lib/query`. Es
infraestructura compartida, no una utilidad.

**Plan:** Mover a `src/lib/query/`, actualizar imports.

### 3.3 Consolidar generación de URLs de imagen (3 sistemas paralelos)

Tres implementaciones:
- `utils/sdk/imageUrls.ts` (SDK-based, usado por legacy)
- `apps/frontend/data/api/images.ts` (fetch-based, usado por frontend)
- `legacy/components/playback/utils/image.ts` (wrapper con lógica de episode)

**Plan:** Unificar en `utils/sdk/imageUrls.ts` con opción de
episode-awareness.

### 3.4 Deprecar `utils/dashboard.js` (módulo Dios)

256 líneas, 15+ funciones, mezcla navegación, auth, UI helpers, y plugin
config. Se adjunta a `window.Dashboard`.

**Plan:** Extraer funciones de navegación a un módulo compartido, mantener
UI helpers, deprecar `window.Dashboard` incrementalmente.

### 3.5 Sincronizar breakpoints TS ↔ SCSS

`utils/breakpoints.ts` y `styles/_breakpoints.scss` definen la misma escala
en dos lugares.

**Plan:** Documentar la relación en un comentario o generar ambos desde un
único JSON.

---

## Fase 4 — Limpieza de legacy

### 4.1 Eliminar código muerto confirmado

| Módulo | Evidencia |
|---|---|
| `legacy/scripts/touchHelper.js` | 0 imports |
| `legacy/scripts/screensavermanager.scss` | Solo SCSS, nadie lo importa |
| `legacy/components/playmenu.js` | 0 imports |
| `legacy/components/maintabsmanager.js` | 0 imports |

### 4.2 Eliminar código probablemente muerto

| Módulo | Evidencia |
|---|---|
| `legacy/components/alphaPicker/` | Solo importado internamente |
| `legacy/components/notifications/` | No importado por frontend ni dashboard |
| `legacy/components/groupedcards.js` | Solo importado por legacy cardbuilder |
| `legacy/elements/emby-collapse/` | Verificar uso externo |
| `legacy/elements/emby-scrollbuttons/` | Verificar uso externo |
| `legacy/elements/emby-ratingbutton/` | Verificar uso externo |

### 4.3 Eliminar React wrappers con `dangerouslySetInnerHTML`

**Archivos:** `CheckBoxElement.tsx`, `IconButtonElement.tsx`,
`SelectElement.tsx`.

Usan `dangerouslySetInnerHTML` para renderizar web components legacy. Ya
existen equivalentes React puros (`Button.tsx`, `Input.tsx`).

**Plan:** Verificar que el dashboard puede usar los equivalentes React y
eliminar los wrappers.

---

## Fase 5 — Estilos y tokens

### 5.1 Centralizar constantes de color de error

`fields.tsx` define `DANGER` y `ERROR_FG`, pero `ErrorBoundary.tsx` y
otros usan `'#ff6b6b'` directamente.

**Plan:** Importar siempre desde `fields.tsx` o un módulo `tokens.ts`.

### 5.2 Unificar padding responsive

`PageSection.tsx`, `DetailSections.tsx`, `Row.tsx`, `SearchPage.tsx`
computan el mismo ternario `r.touch ? ... : ...` para padding.

**Plan:** Definir `pagePad`, `sectionPad`, `rowPad` como valores
responsive en `responsive.ts`.

### 5.3 Centralizar el fix de Chrome scroll

8+ componentes con
`onMouseDown={(e) => e.preventDefault()}` y el mismo comentario.

**Plan:** Documentar una vez en un comentario compartido o crear una
directiva.

---

# Completado (histórico, ir a git log)

## Selector de avatar a pantalla completa — Pendiente

## Ronda de avatares — Plan A (2026-08-14)

El avatar ya es el PERSONAJE, no el intérprete: la biblioteca local etiqueta
con el rol, pero su imagen es la del actor de doblaje, y Jellyfin no guarda
arte de personajes. El arte se resuelve desde AniList.

- `data/api/characterArt.ts` (nuevo): `resolveSeriesArt(serie)` busca la serie
  en AniList (`Media` search, `type: ANIME`) y devuelve `rol → arte oficial` de
  sus personajes. Un único paso por serie (una petición, no una por personaje),
  caché en memoria por serie, fusión de peticiones en vuelo y pool de
  concurrencia (3) para no tocar el rate-limit público. Falla tolerante: sin
  match se devuelve vacío y el candidato conserva la foto del intérprete.
- `avatars.ts`: `AvatarCandidate.series` (la serie de la que sale), que usa el
  cruce con AniList. Se expone en `ApiService` (`avatarService`).
- `AvatarPickerViewModel`: signal `artById` (id de candidato → arte). Al cargar
  candidatos se pinta al instante con la foto del intérprete y, cuando llega el
  arte de AniList, la tile lo muestra. `apply()` compone con la URL resuelta,
  así el avatar subido es el dibujo del personaje.
- Vista: la tile y la vista previa usan `artById.get(id) ?? imageUrl`.
- Emparejamiento por nombre de rol normalizado (minúsculas + sin acentos):
  «Naruto Uzumaki» = «naruto uzumaki».
- Tests: `characterArt.test.ts` (nuevo) y ampliados `avatars`,
  `AvatarPickerViewModel` y `AvatarPickerDialog`.

## Correcciones de avatares (2026-08-17)

- **«Failed to fetch · al cargar la imagen» al guardar personajes de anime.**
  La rejilla ya ha enseñado esa misma URL como tile (CSS, sin CORS) y el CDN
  de AniList la cachea un mes; al guardar, el `fetch` con CORS podía reutilizar
  esa entrada de caché —que llegó sin cabeceras CORS porque la petición de la
  tile no lleva Origin— y la comprobación CORS reventaba sin red de por medio.
  Por eso solo fallaban los personajes ya pintados en la rejilla (anime: las
  URLs del propio Jellyfin no se cachean tanto y pasaban). `buildAvatarFile`
  pide ahora con `cache: 'reload'`; hay test de regresión del argumento.
- **Fuera los colores de fondo.** La composición lleva un fondo fijo
  (`AVATAR_BACKGROUND`), que solo asoma en los PNG transparentes del arte de
  AniList; el selector de colores y `AvatarPickerBackground` se eliminaron.

## Ronda de optimización (2026-08-06)

**Rendimiento interactivo**

- `SelectionViewModel` publica `selectedIds` (un `computed` con un `Set`) y las
  tarjetas se suscriben con `useSignalSelector`: marcar una ya no repinta la
  rejilla entera, y `has()` pasó de `.some()` a O(1).
- Los eventos de store viajan como `CustomEvent` con los ids que han cambiado
  (`StoreChange`), y `useStoreValue`/`useStoreVersion` filtran por ámbito
  (prefijo de clave, ver `itemKeys`). Marcar un episodio ya no repinta las
  decenas de tarjetas de la Home. Cubierto en `bridge/__tests__/useStore`.
- Reproductor: `setPositionState` limitado a ~1 Hz (el spec lo pide y los
  navegadores descartaban el resto), `currentTime` publicado cuantizado al
  segundo, el timer de progreso arranca en `play` y para en `pause`/`ended`, y
  el `loadedmetadata` de cada carga sustituye al anterior en vez de apilarse.

**Bundle / build**

- `vite.config.ts`: `manualChunks`, `build.target` explícito y
  `chunkSizeWarningLimit` como trinquete. **Solo se agrupan `vendor-react` y
  `vendor-color`**: agrupar `@mui` subía la carga inicial de 937 KB a 1 157 KB
  porque casi todo MUI vive hoy en los chunks diferidos del dashboard. Las
  cifras medidas están en el propio config — medid antes de añadir un grupo.
- `optimizeDeps` ya no pre-empaqueta los ~10 600 módulos de
  `@mui/icons-material`: se escanean las fuentes y salen los ~140 que se usan
  de verdad (descartando los que solo existen como `.d.ts`).
- `@material/material-color-utilities` (~100 KB) salió del arranque: la
  derivación de paleta vive en `theme/colorScheme.ts` y se carga con
  `import()`; `dynamicColor` hace lo propio. Desktop no lo descarga.
- `LibraryPage` y `SearchPage` son `React.lazy`, pero se **precargan** en
  cuanto el hilo queda libre (`prefetchTabs`): son destinos de la barra de
  navegación y no pueden enseñar un «Cargando» a pantalla completa.

**Persistencia / estado**

- Las escrituras a `localStorage` de los stores van por lotes (200 ms) con
  volcado al ocultar la página; la caché en memoria y el evento siguen siendo
  síncronos. `setMany` además solo notifica si algo cambia de verdad. Esto
  cubre `WATCHED.sync` y la reescritura de la cola en cada auto-avance.
- React Query: `maxAge` y `dehydrateOptions.shouldDehydrateQuery` explícitos —
  no se persisten consultas fallidas, pendientes ni ya caducadas.

**Deuda / duplicación**

- `VideoPlayerViewModel` bajó de 1 022 a ~905 líneas repartiendo estado en tres
  colaboradores de `domain/player/`: `SegmentTracker`, `TitlePreferences` y
  `AutoNextTracker`. Los signals públicos siguen colgando del VM.
- `createTtlCache` (`data/api/ttlCache.ts`) unifica el `Map` + clave por
  usuario + TTL + comprobación de identidad de los tres cachés. Las políticas
  propias (revalidación en segundo plano, bypass `fresh`, desalojo del error)
  se quedan en cada uno a propósito.
- `CatalogViewModel` es la base de Library / Discover / Favorites: `shows`,
  `movies`, `loading`, `error` y el `guarded()` que envuelve cada carga.
- `TICKS_PER_SECOND` tiene una única definición (`data/api/types.ts`), con
  `domain/player/format.ts` de puerta para la vista.
- Componentes compartidos: `controls/SelectToggle`, `layout/PageSection` (cinco
  páginas) y `layout/CardGrid` (cuatro).

**Corregido de paso**

- **«Visto» de serie incoherente entre pantallas.** Tenía DOS representaciones
  locales que nadie reconciliaba —la clave suelta `showId` y el conjunto de las
  claves de sus episodios— y cada sitio leía la que tuviera a mano: la ficha
  agrega episodios, y la tarjeta de la Home no puede porque no los tiene
  cargados. El resultado era que la misma serie salía vista en una pantalla y
  no vista en otra según qué se hubiera visitado antes. Ahora `mapShow` lee el
  agregado del servidor, `fetchShows` hidrata la clave de serie (igual que
  `fetchMovies` con la suya), `hydrateWatched` la deriva de los episodios en la
  ficha, y el botón escribe las dos caras a la vez.
- `SelectionViewModel.markWatched` revertía poniendo TODO a `!watched`, así que
  un fallo del servidor desmarcaba lo que ya estaba visto antes del lote.
- El provider del tema emitía `--md-sys-color-scheme: light` sobre una paleta
  oscura durante el frame en que el scheme ya había cambiado y la paleta no.

## Decisiones tomadas (no son deuda pendiente)

- **`imageStorage` NO se migró a IndexedDB.** `setImage` no tiene ni un
  llamador: los fondos que sube el usuario van al servidor
  (`listsStore.setCover`), y aquí solo puede quedar lo que dejara una versión
  anterior. Migrar una ruta de escritura muerta sería ceremonia; lo que sí
  costaba —`Backdrop` leyendo una data URL de cientos de KB en cada render— se
  arregló memoizando la lectura.
- **`HomeViewModel`, `ShowViewModel` y `MovieViewModel` se quedan fuera de
  `CatalogViewModel`.** El primero tiene dos cargas independientes con su
  propio par `loading`/`ready`; los otros dos no son catálogos sino una entidad
  suelta con su propio ciclo (`gone`, atajos por caché).
