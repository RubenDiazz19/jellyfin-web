# TODO — Pendientes del proyecto

Regla cardinal: **desktop no cambia byte a byte** (`desktopIntegrity.test.tsx`
lo vigila), los comentarios van en español y el cierre de cada fase es
`build:check`, `lint` y `test`.

---

## Fase 1 — Detección de foco del backdrop: mejoras al algoritmo

### Completadas (2026-08-31)

- **1.1** Saliencia CIELAB con blur gausiano 5×5 separable (σ≈1.0).
- **1.2** Detección de piel YCbCr (Cb∈[77,127] AND Cr∈[133,173]) como
  proxy de cara, integrada en la señal combinada.
- **1.3** Energía combinada: 35% salencia cromática + 55% bordes (luma
  linealizada) + 10% piel. Las tres señales se fusionan antes del
  suavizado.
- **1.4** Peso de regla de tercios: boost ×1.08 suave en 1/3 y 2/3 del
  ancho, decae linealmente en ±15 columnas.

### Pendiente

#### 1.5 Cache persistente en IndexedDB

**Archivos:** `presentation/theme/dynamicColor.ts`

El cache LRU en memoria se pierde al recargar la página. Las mismas
imágenes se re-analizan en cada sesión. IndexedDB con TTL de 90 días.

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

## Fase 3 — Eliminar código muerto (~635 líneas)

**Riesgo:** ninguno. Código sin importadores en ningún sitio del frontend.

| # | Archivo | Líneas | Problema |
|---|---------|--------|----------|
| **M1** | `data/stores/imageStorage.ts` | 41 | Archivo entero muerto — cero importadores (ni `getImage` ni `setImage`) |
| **M2** | `presentation/components/collection/CollectionCarousel.tsx` | 395 | Componente exportado pero nunca importado — superseded por `CollectionCardCarousel` |
| **M3** | `presentation/components/cards/LandscapeTile.tsx` | 122 | Componente exportado pero nunca importado |
| **M4** | `presentation/components/controls/ImageUploadMenu.tsx` | 42 | Componente exportado pero nunca importado |
| **M5** | `presentation/components/media/RuntimeDisplay.tsx` | ~15 | `EndTime` exportado pero nunca usado como JSX — `RuntimeDisplay` lo maneja internamente |
| **M6** | `domain/viewModels/SearchViewModel.ts` | ~12 | 3 computed signals muertos: `typeFilter` (:160), `stateFilter` (:170), `ratingFilter` (:177) — suplantados por `typeFilters`/`stateFilters`/`ratingFilters` |
| **M7** | `domain/viewModels/CastViewModel.ts` | ~3 | `deviceName` signal (:28) escrito pero nunca leído por ningún componente |
| **M8** | `data/stores/librarySortStore.ts:7` | 1 | `SORT_KEYS` exportado pero solo usado internamente — quitar `export` |
| **M9** | `data/stores/themeStore.ts:25,31` | 2 | `THEME_DEFAULTS` e `isSeedSource` exportados pero solo usados internamente — quitar `export` |
| **M10** | `data/stores/persistentStore.ts:79` | 1 | `flushPersistentStores` exportado "solo para tests" pero nunca importado en ningún test |

---

## Fase 4 — ViewModel: extraer `loadingError()` + `guardedLoad()`

**Problema:** 5 ViewModels repiten el mismo scaffolding try/catch/isLatest/finally
con `LoadGuard`. El patrón es idéntico salvo el cuerpo async.

**Archivos afectados:**

| Duplicación | Ubicaciones |
|-------------|-------------|
| `loading = signal(false); error = signal<string \| null>(null)` | `CatalogViewModel.ts:24-25`, `DetailViewModel.ts:13-14`, `SearchViewModel.ts:195`, `VideoPlayerViewModel.ts:95-96`, `AvatarPickerViewModel.ts:39`, `CastViewModel.ts:29`, `HomeViewModel.ts:17,19` |
| Bloque `isLatest = loads.begin(); try/catch/finally` | `CatalogViewModel.ts:51-65`, `DetailViewModel.ts:53-81`, `SearchViewModel.ts:575-591,613-631`, `AvatarPickerViewModel.ts:173-190`, `HomeViewModel.ts:33-77` |

**Propuesta:**

1. **Crear `domain/viewModels/loadingState.ts`** (~15 líneas):
   `loadingError()` devuelve `{ loading: Signal<boolean>, error: Signal<string | null> }`.

2. **Crear `domain/viewModels/guardedLoad.ts`** (~35 líneas):
   `guardedLoad(loading, error)` devuelve `{ guarded, loads }` con el
   patrón begin/try/catch/isLatest/finally encapsulado.

3. **Refactorizar** `CatalogViewModel`, `DetailViewModel`, `SearchViewModel`,
   `AvatarPickerViewModel` y `HomeViewModel` para usar estas utilidades.
   Las subclases (`MovieViewModel`, `ShowViewModel`, `PersonViewModel`, etc.)
   no se tocan — la API pública no cambia.

**Ahorro:** ~75 líneas, 1 point of change para loading/error.

---

## Fase 5 — ViewModel: extraer `mutationOnLoad()`

**Problema:** 3 ViewModels repiten el patrón `new ItemMutationSubscription()` +
`subscribeToMutations()` con ligeras variantes en el callback.

| ViewModel | Líneas | Variante |
|-----------|--------|----------|
| `DetailViewModel.ts:84-97` | Recarga el item actual en mutación, sin debounce |
| `HomeViewModel.ts:85-90` | Recarga todo en mutación, con debounce |
| `LibraryViewModel.ts:139-147` | Recarga la biblioteca en mutación, con debounce |

**Propuesta:** Crear `domain/viewModels/mutationSubscription.ts` (~25 líneas) con
`mutationOnLoad(onMutated, opts?)` que devuelve una función `ensureSubscribed()`.
Configurable con `debounce: boolean`.

**Ahorro:** ~30 líneas, patrón centralizado.

---

## Fase 6 — Cards: unificar familia de cards (~200 líneas)

**Problema:** 3 familias de cards reimplementan frame + imagen + gradiente +
overlay + selección + menú contextual.

### 6a. Extender `useCardInteractions` para season/episode

`useCardInteractions.tsx:17-56` solo soporta `kind: 'show' | 'movie'`.
Pero `SeasonCard.tsx:35-47`, `EpCard.tsx:34-45` y `CwCard.tsx:37-52`
duplican manualmente `useSelectionMode` + `useItemContextMenu` (40+ líneas).

**Propuesta:** Añadir `season` y `episode` al tipo `CardKind`, refactorizar
las 3 cards para usar el hook unificado.

### 6b. Crear `LandscapeCardShell`

`CwCard.tsx` (120), `EpCard.tsx` (106) comparten: frame 16:9 + imagen +
gradiente + overlay + `CardProgress` + selección + context menu.
**Propuesta:** Shell unificado con props `progress`, `captionLines`,
`hoverScale`, etc. para diferenciar variantes.

### 6c. Generalizar `PosterShell` absorbiento `PosterTile`

`PosterShell.tsx` y `PosterTile.tsx` comparten imagen, gradiente, overlay,
selección. `PosterTile` es la versión ligera (sin progress bar, con label).
**Propuesta:** Unificar con un prop `compact` o `variant: 'full' | 'tile'`.

**Ahorro:** ~200 líneas (350 → ~150 con shell unificado).

---

## Fase 7 — Stores: crear `createKVStore()` (~100 líneas)

**Problema:** 3 stores replican manualmente la persistencia a localStorage
que `persistentStore.ts` ya resuelve (read/parse, write/stringify, cache,
batched writes, event dispatch).

| Store | Líneas | Patrón duplicado |
|-------|--------|-----------------|
| `themeStore.ts:41-53` | `try { JSON.parse(localStorage.getItem) } catch` |
| `librarySortStore.ts:18-31` | Idéntico |
| `collectionStylesStore.ts:24-43` | `read()` + `write()` + event dispatch, sin cache — cada getter re-parsea el JSON |

**Propuesta:** Añadir `createKVStore<T>()` en `persistentStore.ts` (~25 líneas)
que reutilice `read()`, `scheduleWrite()` y cache. Cada store pasa a ser un
wrapper de 1 línea:

| Store | Antes | Después |
|-------|-------|---------|
| `themeStore.ts` | 55 líneas | ~20 |
| `librarySortStore.ts` | 34 líneas | ~15 |
| `collectionStylesStore.ts` | 142 líneas | ~90 |

**Ahorro:** ~100 líneas, persistencia centralizada con batched writes y cache.

---

## Fase 8 — Theme: unificar vocabulario de colores (~55 líneas)

**Problema:** Doble vocabulario de colores — `T.bg/fg/dim/hairline`
(hardcoded) y `MC.bg/fg` (CSS vars con fallback idéntico a `T`).
Los fallbacks de `MC` en `responsive.ts:107-118` son caracter por caracter
iguales a los valores de `T` en `tokens.ts`. Los componentes usan uno u otro
con patrón condicional `r.touch ? MC.bg : T.bg`.

**Adicional:** `T.display` y `T.ui` son idénticos (mismo string Inter).

### Propuesta

1. **Unificar colores** — Crear `C` en `tokens.ts` con CSS vars + fallbacks:
   ```ts
   export const C = {
       bg: 'var(--md-sys-color-background, #000)',
       fg: 'var(--md-sys-color-on-background, #fff)',
       dim: 'var(--md-sys-color-on-surface-variant, rgba(255,255,255,0.55))',
       hairline: 'var(--md-sys-color-outline-variant, rgba(255,255,255,0.12))',
   } as const;
   ```
   Eliminar `MC` de `responsive.ts` y el patrón `r.touch ? MC.x : T.x` en 8
   ubicaciones. Las CSS vars resuelven M3 en mobile/tablet y caen al fallback
   oscuro en desktop — sin branching.

2. **Eliminar `T.display`** — fusionar con `T.ui` (~40 referencias a actualizar).

3. **Mover `format.ts`** fuera de `theme/` a `presentation/utils/format.ts` —
   no tiene relación con theming (7 importadores).

4. **Romper dependencia circular** en `responsive.ts:10` — leer layout via
   `layoutMode.ts` directamente en vez de ir por `MobileThemeProvider`.

**Ahorro:** ~55 líneas, un solo vocabulario de colores, sin dependencias circulares.

---

## Fase 9 — Pages: extraer componentes compartidos (~130 líneas)

**Problema:** 4 pages de detalle copian el mismo shell, synopsis y patrón
de overview. PersonPage duplica internamente su carrusel de filmografía.

| Duplicación | Pages afectadas |
|-------------|-----------------|
| Shell `if (!item) return <DetailStatus>` + div negro (`position: relative; min-height: 100vh; bg: #000`) | MoviePage:36, ShowPage:37, SeasonPage:33, EpisodePage:38 |
| Párrafo synopsis con `style` idéntico (`fontFamily: T.ui, fontSize: 17, lineHeight: 1.55, color: rgba(255,255,255,0.82), maxWidth: 640, textWrap: pretty`) | MoviePage:192, ShowPage:227, SeasonPage:277, EpisodePage:224 |
| CastList con `marginTop: 48` | MoviePage:199, ShowPage:234, EpisodePage:231 |
| Filmography carousel duplicado internamente (movies block = shows block) | PersonPage:239-259 vs PersonPage:262-283 |

### Propuesta

1. **`DetailPageShell`** — wrapper que maneja loading check + div negro.
   Reutiliza MoviePage, ShowPage, SeasonPage, EpisodePage.

2. **`SynopsisText`** — párrafo con estilo estandarizado y props opcionales
   `maxWidth`, `fontSize`. Reutiliza las 4 detail pages.

3. **`DetailOverviewSection`** — synopsis + cast en un componente.
   Reutiliza MoviePage:191-201, ShowPage:226-236, EpisodePage:222-233.

4. **`FilmographyRow`** — carrusel horizontal de filmografía con título +
   contador. Reutiliza PersonPage internamente (movies + shows).

**Ahorro:** ~130 líneas, consistencia visual garantizada.

---

## Fase 10 — Shared: tests faltantes y limpieza menor

| # | Acción | Archivo |
|---|--------|---------|
| **S1** | Añadir tests para `focusPatch.ts` — mockear `HTMLElement.prototype.focus` y verificar supresión en hover | `shared/focusPatch.ts` (42 líneas, 0 tests) |
| **S2** | Añadir tests para `fullscreen.ts` — mockear API Fullscreen nativa | `shared/fullscreen.ts` (36 líneas, 0 tests) |
| **S3** | Mover `clamp01` a `utils/math.ts` si aparece un segundo consumidor | `shared/videoGestures.ts:78` (1 consumidor actual) |
| **S4** | Centralizar constantes de umbral de gesture en `shared/gestures/thresholds.ts` — `MOVE_THRESHOLD=12`, `DRAG_THRESHOLD=8`, `SWIPE_DRAG_THRESHOLD=48` están en 3 archivos distintos | `videoGestures.ts:8`, `dragDismiss.ts:6`, `MobileHero.tsx:32` |

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

- **`imageStorage` se elimina en la Fase 3 (M1).** `setImage` no tiene ni un
  llamador: los fondos que sube el usuario van al servidor
  (`listsStore.setCover`). El archivo entero es dead code.
- **`HomeViewModel`, `ShowViewModel` y `MovieViewModel` se quedan fuera de
  `CatalogViewModel`.** El primero tiene dos cargas independientes con su
  propio par `loading`/`ready`; los otros dos no son catálogos sino una entidad
  suelta con su propio ciclo (`gone`, atajos por caché).
