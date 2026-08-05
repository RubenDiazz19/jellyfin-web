# TODO — Optimizaciones y mejoras del frontend propio

Trabajo sobre el frontend propio (`src/apps/frontend/`). Regla cardinal que se
respeta: **desktop no cambia byte a byte** (`desktopIntegrity.test.tsx` lo
vigila), los comentarios van en español y el cierre de cada fase es
`build:check`, `lint` y `test`.

---

# Pendiente

Nada abierto de la ronda de optimización. Lo que quedó decidido a propósito, y
por qué, está anotado abajo.

---

# Completado (histórico, ir a git log)

El trabajo anterior (spec 2025, paleta única, hero completo, navegación
píldora, selección de seed manual, caché LRU) quedó registrado en el historial.

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
