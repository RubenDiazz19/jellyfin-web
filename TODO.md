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

# Completado (histórico, ir a git log)

El trabajo anterior (spec 2025, paleta única, hero completo, navegación
píldora, selección de seed manual, caché LRU) quedó registrado en el historial.

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
