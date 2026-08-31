# TODO — Auditoría del proyecto

Hallazgos de la auditoría profunda del código. Regla cardinal: **desktop no
cambia byte a byte** (`desktopIntegrity.test.tsx` lo vigila), los comentarios
van en español y el cierre de cada fase es `build:check`, `lint` y `test`.

---

## Fase 1 — Bugs críticos

| # | Archivo | Línea(s) | Problema |
|---|---------|-----------|----------|
| **C1** | `presentation/components/player/VideoPlayer.tsx` | 62 | `observeLayoutMode()` no retorna cleanup al useEffect — el observer nunca se desconecta al desmontar |
| **C2** | `presentation/theme/MobileThemeProvider.tsx` | 122 | Mismo problema: `observeLayoutMode()` return descartado |
| **C3** | `data/api/playback.ts` | 252, 268 | `PlayMethod` hardcoded como `'Transcode'` siempre — incluso para DirectPlay. El servidor malinterpreta el estado de codificación |

---

## Fase 2 — Memory leaks y correctitud

| # | Archivo | Línea(s) | Problema |
|---|---------|-----------|----------|
| **H1** | `presentation/components/player/VideoPlayer.tsx` | 109, 327-329 | `osdNoticeTimer` no se limpia al desmontar — `setTimeout` dispara sobre componente desmontado |
| **H2** | `presentation/components/player/VideoGestures.tsx` | 88-89 | `feedbackTimer` y `singleTapTimer` no se limpian al desmontar |
| **H3** | `domain/bridge/useScrollY.ts` | 6-14 | Cleanup no cancela `requestAnimationFrame` pendiente al desmontar |
| **H4** | `presentation/components/admin/editor/useSubtitleSearch.ts` | 72-76 | `isPerfectMatch` no está en deps del useEffect — usa valor obsoleto del mount |
| **H5** | `domain/player/hlsSource.ts` | 92 | `recoverMediaError()` no va seguido de `startLoad()` — la reproducción puede bloquearse |
| **H6** | `domain/viewModels/VideoPlayerViewModel.ts` | 486 | `togglePlay` traga rechazo de `play()` sin actualizar UI — botón dice "pausa" pero el vídeo está pausado |
| **H7** | `presentation/pages/HomePage.tsx` | 127 | Wheel lock timer de 900ms no se limpia al desmontar — almacenar en ref y limpiar en cleanup |

---

## Fase 3 — Duplicación en SearchViewModel

| # | Archivo | Línea(s) | Problema |
|---|---------|-----------|----------|
| **M1** | `domain/viewModels/SearchViewModel.ts` | 318-394 | Lógica de filtrado por rating duplicada idéntica para items locales vs remotos |
| **M2** | `domain/viewModels/SearchViewModel.ts` | 300-377 | Lógica de filtrado por estado (vistos/favs) duplicada idéntica |
| **M5** | `domain/viewModels/SearchViewModel.ts` | 532-538 | `clearRatingFilter` y `clearRatingFilters` son idénticos — eliminar uno |
| **M7** | `domain/viewModels/SearchViewModel.ts` | 135-136 | `typeFilters` / `stateFilters` usan `string[]` en vez de los tipos unión `TypeFilter[]` / `StateFilter[]` |

---

## Fase 4 — Duplicación en el reproductor

| # | Archivo | Línea(s) | Problema |
|---|---------|-----------|----------|
| **M3** | `presentation/components/player/VideoControls.tsx` / `VideoSettingsMenu.tsx` / `VideoGestures.tsx` | 18 / 24 / 47 | `formatTime` / `markTime` / `fmt` son funciones idénticas — extraer a `domain/player/format.ts` |
| **M8** | `domain/player/subtitleStyle.ts` | 131-140 | Elemento `<style>` de apariencia de subtítulos nunca se elimina al cerrar el reproductor |

---

## Fase 5 — Duplicación en HomePage y tipos débiles

| # | Archivo | Línea(s) | Problema |
|---|---------|-----------|----------|
| **M4** | `presentation/pages/HomePage.tsx` | 550-562 / 629-641 | `sectionStyle` / `headingStyle` duplicados entre `HomeLibraryJellyfin` y `HomeLibraryProto` |
| **M6** | `data/stores/viewsStore.ts` | 27 | `ratingFilter.operator` es `string` en vez de `RatingOperator` union type |

---

## Fase 6 — Dependencias innecesarias

| # | Archivo | Problema |
|---|---------|----------|
| **M10** | `package.json` | `@preact/signals-react` no se importa en ningún archivo — ~180KB innecesarios |
| **L8** | `package.json` | `history` es solo tipo (type-only import) — mover a devDependencies |

---

## Fase 7 — Archivos muertos

| # | Archivo | Evidencia |
|---|---------|-----------|
| **F1** | `utils/date.ts` | Exporta `toIsoDateOnlyString` pero nunca se importa |
| **F2** | `utils/mediaSource.ts` | Exporta `isHls()` pero nunca se importa |
| **F3** | `constants/homeSectionType.ts` | Exporta `HomeSectionType` y `DEFAULT_SECTIONS` — nadie los importa |
| **F4** | `legacy/components/groupedcards.js` | Nunca se importa — archivo muerto |
| **F5** | `legacy/scripts/screensavermanager.scss` | Nunca se importa — archivo muerto |
| **F6** | `legacy/components/appFooter/appFooter.js` | Solo se importa a sí mismo — nadie lo usa |
| **F7** | `apps/frontend/domain/bridge/useImageStorage.ts` | Exporta `useImageStorage` pero nunca se importa |
| **F8** | `types/base/models/item-dto-query-result.ts` | Exporta `ItemDtoQueryResult` pero nunca se importa — se usa `BaseItemDtoQueryResult` del SDK |
| **F9** | `utils/reactUtils.tsx` | Exporta `renderComponent` pero nunca se importa |
| **F10** | `legacy/components/shortcuts.js` | Líneas 362-366: `editItem()` siempre rechaza — la ruta `ItemAction.Edit` es muerta |
| **F11** | `legacy/scripts/libraryMenu.js` | Línea 622-623: `Promise.resolve(user)` descartado — noop |

---

## Fase 8 — Exports sin usar

| # | Archivo | Línea | Export |
|---|---------|-------|--------|
| **E1** | `utils/dom.js` | 242 | `whichAnimationCancelEvent` — nunca se llama como `dom.whichAnimationCancelEvent()` |
| **E2** | `utils/dom.js` | 255 | `whichTransitionEvent` — nunca se llama |
| **E3** | `utils/dom.js` | 284 | `setElementTitle` — nunca se llama |
| **E4** | `utils/number.ts` | 56 | `decimalCount` — exportado pero nunca importado |
| **E5** | `utils/string.ts` | 38 | `toFloat` — solo se importa en `string.test.ts`, nunca en producción |
| **E6** | `apps/frontend/shared/fullscreen.ts` | 20 | `isFullscreen` — solo se usa internamente, el export es innecesario |
| **E7** | `apps/frontend/shared/pwa.ts` | 13 | `STANDALONE_CLASS` — solo se usa internamente |

---

## Fase 9 — Imports innecesarios

| # | Archivo | Problema |
|---|---------|----------|
| **L6** | Cards (`EpCard`, `SeasonCard`, `CwCard`, `PosterCard`, `MovieCard`, `SearchResultCard`) | `import React from 'react'` solo para `React.memo` — cambiar a `import { memo }` |
| **L7** | `presentation/components/admin/editor/useSubtitleSearch.ts` | Importa `React` completo solo para `React.DragEvent` — usar `import type { DragEvent }` |
| **L11** | `legacy/components/viewContainer.js` | Líneas 141-163: `hasjQuery`/`hasScript`/etc. calculados pero nunca consumidos |

---

## Fase 10 — Performance

| # | Archivo | Línea(s) | Problema |
|---|---------|-----------|----------|
| **P1** | `presentation/components/player/VideoPlayer.tsx` | 360-489 | Keyboard handler se recrea en cada cambio de `queueItems` — usar ref para estabilizar deps |
| **P2** | `presentation/components/player/VideoPlayer.tsx` | 47-51 | `pointerIsOverBars` ejecuta `querySelectorAll` en cada mouse move — cachear refs de los elementos |
| **P3** | `domain/viewModels/SearchViewModel.ts` | 257-401 | `results` computed: O(n*m) en cada keystroke. El `known` Set se reconstruye entero en cada cambio — cachearlo como computed separado |
| **P4** | `presentation/components/layout/Backdrop.tsx` | 52-61 | Preload `<link>` se crea/destruye en cada cambio de imagen — reusar un solo elemento y actualizar `href` |
| **P5** | `presentation/components/player/VideoControls.tsx` | 45-50 | `setInterval(new Date())` corre cada segundo aunque el player esté activo — solo activar cuando `endTimeText` sea visible |
| **P6** | `presentation/components/player/VideoPlayer.tsx` | 93-98 | `buffering` en pick list causa re-render completo del árbol en cada toggle — mover a VideoControls |

---

## Fase 11 — Code smells

### Números mágicos sin nombre

| Archivo | Línea | Valor | Significado |
|---------|-------|-------|-------------|
| `VideoPlayer.tsx` | 118 | `2200` | Duración del aviso OSD |
| `VideoPlayer.tsx` | 339 | `4200` | Duración de hints de gestos |
| `VideoPlayer.tsx` | 355 | `3800` | Duración de sugerencia landscape |
| `VideoGestures.tsx` | 94 | `650` | Duración default de feedback |
| `HomePage.tsx` | 61 | `8000` | Intervalo de autoplay del hero |
| `HomePage.tsx` | 121 | `100` | Umbral de wheel |
| `HomePage.tsx` | 127 | `900` | Duración del lock de wheel |
| `MobileHero.tsx` | 66 | `48`, `60` | Umbrales de swipe |

**Plan:** Extraer como constantes nombradas al inicio de cada archivo.

### `Array.prototype.map.call` anti-pattern (30+ ocurrencias)

- `legacy/components/libraryoptionseditor/libraryoptionseditor.js` — 20+ instancias
- `apps/dashboard/features/users/components/ParentalControl.tsx` — 4 ocurrencias
- `apps/dashboard/features/users/components/Access.tsx` — 3 ocurrencias
- `apps/dashboard/routes/users/add.tsx` — 2 ocurrencias

**Plan:** Reemplazar con `[...nodeList]` o `Array.from(nodeList)`.

---

## Fase 12 — TypeScript

### Uso de `any`

| Archivo | Línea | Problema |
|---------|-------|----------|
| `utils/events.ts` | 6-51 | Archivo entero usa `any` — el event bus custom debería usar generics |
| `utils/query/queryClient.ts` | 26, 53 | `as any` para acceder a campos del error |
| `legacy/components/router/routerHistory.ts` | 11, 44, 48 | `any` en implementación de History |
| `global.d.ts` | 11 | `NativeShell: any` |
| `types/cardOptions.ts` | 78 | `widths?: any` |

### Non-null assertions (`!.`)

24 ocurrencias. En producción (no tests):
- `presentation/components/tweaks/TweaksPanel.tsx:243` — `trackRef.current!.getBoundingClientRect()` → usar optional chaining
- `utils/container.ts:36` — `list!.includes(s)` → usar null guard

### `@ts-expect-error`

3 ocurrencias:
- `legacy/elements/emby-scrollbuttons/utils.ts:100`
- `themes/utils.ts:8`
- `utils/motion.test.ts:33` (test, aceptable)

---

## Fase 13 — Configuración

| # | Archivo | Problema |
|---|---------|----------|
| **L11** | `config/tsconfig.json` | Falta `forceConsistentCasingInImports` |
| **L12** | `config/eslint/app.mjs` | Línea 154: TODO pendiente — añadir `tseslint.configs.recommendedTypeChecked` |

---

## Fase 14 — Legacy: deuda técnica acumulada

### `innerHTML` (78 ocurrencias en legacy)

El frontend propio usa 0 `innerHTML`. Legacy tiene 78 — principal superficie
de XSS. Principales ofensores:
- `libraryoptionseditor.js` — 17 asignaciones
- `libraryMenu.js` — 7 asignaciones
- `multiSelect.js` — 3 asignaciones

### `.then()` chains (225 ocurrencias en legacy)

El frontend propio usa `async/await` consistentemente. Legacy tiene 225
cadenas `.then()`, muchas sin `.catch()`. Casos críticos:
- `playbackmanager.js:1125` — `stopActiveEncodings().then()` sin `.catch()`

### `dangerouslySetInnerHTML` (6 ocurrencias en legacy)

- `SelectElement.tsx:28`
- `IconButtonElement.tsx:48, 56`
- `CheckBoxElement.tsx:71`
- `MarkdownBox.tsx:17`
- `ConnectionErrorPage.tsx:73` (sanitizado con DOMPurify)

### `React.FC` en legacy (141 archivos)

141 archivos en `src/legacy/` usan `FC` o `React.FC`. El frontend propio no
usa ninguno (correcto). Los 3 con la forma explícita `React.FC`:
- `legacy/elements/emby-button/IconButton.tsx:13`
- `legacy/elements/emby-button/LinkButton.tsx:21`
- `legacy/elements/emby-button/Button.tsx:19`

### `webcomponents.js` polyfill innecesario

El proyecto depende de `webcomponents.js: 0.7.24` pero el browserslist apunta
a `last 2 versions` de navegadores modernos que soportan Custom Elements v1
nativamente. Los 9 archivos legacy que lo importan:
- `emby-textarea.js`, `emby-select.js`, `emby-checkbox.js`, `emby-tabs.js`,
  `emby-toggle.js`, `emby-input.js`, `emby-button.js`,
  `paper-icon-button-light.js`, `emby-collapse.js`

### Archivos legacy más endeudados

| Archivo | Líneas | Problemas |
|---------|--------|-----------|
| `playback/playbackmanager.js` | 3627 | God object, `.then()`, innerHTML, sin tipos |
| `scripts/browserDeviceProfile.js` | 1631 | HACKs, FIXMEs, compat checks |
| `scripts/libraryMenu.js` | 847 | innerHTML, headroom.js, TODOs |
| `libraryoptionseditor/libraryoptionseditor.js` | 835 | 17 innerHTML, 20+ `Array.prototype.map.call` |

---

## Fase 15 — i18n y accesibilidad

| # | Archivo | Línea | Problema |
|---|---------|-------|----------|
| **A1** | `presentation/components/search/SearchPills.tsx` | 165 | `aria-label` hardcodeado en español (`'Cerrar selector'` / `'Añadir filtro'`) — debería usar `globalize.translate()` |
| **A2** | `legacy/components/imageUploader/imageUploader.js` | 69 | `<img>` sin atributo `alt` |

---

## Fase 16 — Dependencias obsoletas

| Paquete | Versión actual | Problema |
|---------|---------------|----------|
| `date-fns` | 2.30.0 | v4 ya existe — v2 sin mejoras ni fixes activos |
| `webcomponents.js` | 0.7.24 | Polyfill innecesario — todos los targets soportan Custom Elements v1 |
| `screenfull` | 6.0.2 | La API Fullscreen es nativa en todos los targets |
| `headroom.js` | 0.12.0 | Solo usado en `libraryMenu.js` — reemplazable con `position: sticky` + `IntersectionObserver` |
| `react-lazy-load-image-component` | 1.6.3 | Nativo `loading="lazy"` soportado en todos los targets |

---

## Fase 17 — Archivos grandes: división

| Líneas | Archivo | Recomendación |
|--------|---------|---------------|
| 1024 | `domain/viewModels/VideoPlayerViewModel.ts` | Extraer event wiring y source loading a colaboradores |
| 878 | `presentation/components/player/VideoPlayer.tsx` | Extraer keyboard shortcuts, OSD auto-hide, subtitle offset a hooks custom |
| 706 | `domain/viewModels/SearchViewModel.ts` | Extraer helpers de filtrado — reducir duplicación en `results` computed |
| 691 | `presentation/pages/HomePage.tsx` | Extraer estilos compartidos; fusionar `HomeLibraryJellyfin` + `HomeLibraryProto` |
| 3627 | `legacy/components/playback/playbackmanager.js` | God object — descomponer en módulos de responsabilidad única |

---

## Fase 18 — Session y datos

| # | Archivo | Línea(s) | Problema |
|---|---------|-----------|----------|
| **D1** | `data/session/session.ts` | 58 | `createdAt: 0` hardcodeado — campo vestigial |
| **D2** | `data/api/http.ts` | 68 | `res.json()` sin validar content-type — el proxy devuelve HTML en 404 |
| **D3** | `data/api/playback.ts` | 248-271 | Reporting functions tragan errores silenciosamente — añadir `console.debug` |

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
