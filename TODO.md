# TODO — Pendientes del proyecto

Regla cardinal: **desktop no cambia byte a byte** (`desktopIntegrity.test.tsx`
lo vigila), los comentarios van en español y el cierre de cada fase es
`build:check`, `lint` y `test`.

---

## Fase 1 — Detección de foco del backdrop: mejoras al algoritmo

### Completadas (2026-08-31 / 2026-09-03)

- **1.1** Saliencia CIELAB con blur gausiano 5×5 separable (σ≈1.0). ✅
- **1.2** Detección de piel YCbCr (Cb∈[77,127] AND Cr∈[133,173]) como
  proxy de cara, integrada en la señal combinada. ✅
- **1.3** Energía combinada: 35% salencia cromática + 55% bordes (luma
  linealizada) + 10% piel. Las tres señales se fusionan antes del
  suavizado. ✅
- **1.4** Peso de regla de tercios: boost ×1.08 suave en 1/3 y 2/3 del
  ancho, decae linealmente en ±15 columnas. ✅
- **1.5** Cache persistente en IndexedDB (`presentation/theme/dynamicColor.ts`):
  L2 async con TTL de 90 días usando IndexedDB nativa sin dependencias externas.
  El cache LRU en memoria se mantiene como L1 rápido. ✅

---

## Fase 2 — Pendientes de la auditoría

### Completadas (2026-08-31)

| # | Archivo | Problema | Estado |
|---|---------|----------|--------|
| **D1** | `data/session/session.ts` | `createdAt: 0` hardcodeado — campo vestigial | ✅ eliminado |
| **D2** | `data/api/http.ts` | `res.json()` sin validar content-type | ✅ validación añadida |
| **D3** | `data/api/playback.ts` | Reporting functions tragan errores silenciosamente | ✅ `console.warn` añadido |

### Pendientes

| # | Archivo | Línea | Problema |
|---|---------|-------|----------|
| **A1** | `presentation/components/search/SearchPills.tsx` | 165 | `aria-label` hardcodeado en español — debería usar `globalize.translate()` |
| **A2** | `legacy/components/imageUploader/imageUploader.js` | 69 | `<img>` sin atributo `alt` |
| **C1** | `config/eslint/app.mjs` | 154 | TODO pendiente — añadir `tseslint.configs.recommendedTypeChecked` |

### Dependencias obsoletas

| Paquete | Versión actual | Problema |
|---------|---------------|----------|
| `date-fns` | 2.30.0 | v4 ya existe — v2 sin mejoras ni fixes activos |
| `webcomponents.js` | 0.7.24 | Polyfill innecesario — todos los targets soportan Custom Elements v1 |
| `screenfull` | 6.0.2 | La API Fullscreen es nativa en todos los targets |
| `headroom.js` | 0.12.0 | Solo usado en `libraryMenu.js` — reemplazable con `position: sticky` + `IntersectionObserver` |
| `react-lazy-load-image-component` | 1.6.3 | Nativo `loading="lazy"` soportado en todos los targets |

---

# Pendiente (features)

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

## Auditoría de código (2026-08-31)

Se realizó una auditoría profunda del proyecto que identificó ~45 items en
18 fases. Se verificó que **~40 de ~45 items ya habían sido corregidos**
en el código. Los items pendientes quedan en la Fase 2 de este archivo.

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
  porque casi todo MUI vive hoy en los chunks diferidos del dashboard.
- `optimizeDeps` ya no pre-empaqueta los ~10 600 módulos de
  `@mui/icons-material`: se escanean las fuentes y salen los ~140 que se usan
  de verdad.
- `@material/material-color-utilities` (~100 KB) salió del arranque: la
  derivación de paleta vive en `theme/colorScheme.ts` y se carga con
  `import()`; `dynamicColor` hace lo propio.
- `LibraryPage` y `SearchPage` son `React.lazy`, pero se **precargan** en
  cuanto el hilo queda libre (`prefetchTabs`).

**Persistencia / estado**

- Las escrituras a `localStorage` de los stores van por lotes (200 ms) con
  volcado al ocultar la página; la caché en memoria y el evento siguen siendo
  síncronos. `setMany` además solo notifica si algo cambia de verdad.
- React Query: `maxAge` y `dehydrateOptions.shouldDehydrateQuery` explícitos —
  no se persisten consultas fallidas, pendientes ni ya caducadas.

**Deuda / duplicación**

- `VideoPlayerViewModel` bajó de 1 022 a ~905 líneas repartiendo estado en tres
  colaboradores de `domain/player/`: `SegmentTracker`, `TitlePreferences` y
  `AutoNextTracker`.
- `createTtlCache` (`data/api/ttlCache.ts`) unifica el `Map` + clave por
  usuario + TTL + comprobación de identidad de los tres cachés.
- `CatalogViewModel` es la base de Library / Discover / Favorites.
- `TICKS_PER_SECOND` tiene una única definición (`data/api/types.ts`), con
  `domain/player/format.ts` de puerta para la vista.
- Componentes compartidos: `controls/SelectToggle`, `layout/PageSection` (cinco
  páginas) y `layout/CardGrid` (cuatro).

**Corregido de paso**

- **«Visto» de serie incoherente entre pantallas.** Tenía DOS representaciones
  locales que nadie reconciliaba. Ahora `mapShow` lee el agregado del servidor,
  `fetchShows` hidrata la clave de serie, `hydrateWatched` la deriva de los
  episodios en la ficha, y el botón escribe las dos caras a la vez.
- `SelectionViewModel.markWatched` revertía poniendo TODO a `!watched`.
- El provider del tema emitía `--md-sys-color-scheme: light` sobre una paleta
  oscura durante el frame en que el scheme ya había cambiado y la paleta no.

## Decisiones tomadas (no son deuda pendiente)

- **`imageStorage` NO se migró a IndexedDB.** `setImage` no tiene ni un
  llamador: los fondos que sube el usuario van al servidor
  (`listsStore.setCover`).
- **`HomeViewModel`, `ShowViewModel` y `MovieViewModel` se quedan fuera de
  `CatalogViewModel`.** El primero tiene dos cargas independientes con su
  propio par `loading`/`ready`; los otros dos no son catálogos sino una entidad
  suelta con su propio ciclo (`gone`, atajos por caché).
