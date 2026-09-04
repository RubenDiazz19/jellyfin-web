# TODO — Pendientes del proyecto

Regla cardinal: **desktop no cambia byte a byte** (`desktopIntegrity.test.tsx`
lo vigila), los comentarios van en español y el cierre de cada fase es
`build:check`, `lint` y `test`.

---

## Unificación total del sistema de tags

El sistema actual tiene 3 fuentes de etiquetas que la UI consume por separado:
genres (del servidor, en inglés), server tags (mezcla de keywords de TMDB en
inglés + lo que escribe el usuario) y autoTags (vocabulario cerrado en
español). La consecuencia es una lógica fragmentada, chips con keywords basura
y traducciones duplicadas.

**Objetivo**: un solo tipo de tag, todo en español, vocabulario cerrado,
misma lógica en toda la app.

### Fase A — Consolidar la fuente de tags

| # | Archivo | Cambio |
|---|---------|--------|
| **A1** | `domain/tags.ts` | Reescribir `getItemTags()` para que devuelva SOLO tags del vocabulario cerrado: autoTags + server tags que pasen por `canonicalTag()`. Eliminar genres del resultado. La función es la única puerta de entrada a etiquetas para toda la app. |
| **A2** | `domain/tags.ts` | Importar `VOCABULARY_TAGS` y `canonicalTag` desde `data/autotag/vocabulary.ts`. Server tags que no estén en el vocabulario se descartan (son keywords de TMDB). |
| **A3** | `domain/tags.ts` | Eliminar el tipo `source` del `Tag` — ya no hace falta distinguir la fuente porque todo pasa por el mismo filtro. Queda `{ label: string }`. |
| **A4** | `domain/tags.ts` | Eliminar `CategorizableItem`, `getItemCategories`, `getHeroCategories` de este módulo. Los genres se gestionan por separado (son otro concepto). |

### Fase B — Separar genres de tags

| # | Archivo | Cambio |
|---|---------|--------|
| **B1** | `domain/genres.ts` | Restaurar `getItemCategories` y `getHeroCategories` aquí (gestionan genres, no tags). Usan `translateGenre` para traducir los genres del servidor. |
| **B2** | `domain/genres.ts` | Eliminar re-exportaciones de `tags.ts`. Los dos conceptos (genres y tags) son independientes. |
| **B3** | `domain/tags.ts` | Eliminar `getItemCategories` / `getHeroCategories` / `CategorizableItem` — se mudan a `genres.ts`. |

### Fase C — Descontaminar server tags

| # | Archivo | Cambio |
|---|---------|--------|
| **C1** | `domain/tags.ts` | En `getItemTags()`, server tags se filtran con `canonicalTag()`: lo que no esté en el vocabulario se descarta. Esto elimina `aftercreditsstinger`, `blind girl`, etc. |
| **C2** | `data/api/metadata.ts` | `setItemTags` y `setItemsTags` siguen guardando lo que el usuario escriba en el servidor — el vocabulario cerrado se aplica al LEER, no al escribir. No tocar. |

### Fase D — Actualizar consumidores

| # | Archivo | Cambio |
|---|---------|--------|
| **D1** | `SearchViewModel.ts` | `allTags`: usar `getItemTags()` directamente (ya no filtra por `source`). Los chips muestran solo tags del vocabulario. |
| **D2** | `SearchViewModel.ts` | `catalog` computed: los tags indexados salen de `getItemTags()` (sin genres). |
| **D3** | `SearchViewModel.ts` | `tagsOf()`: eliminar — reemplazar por `getItemTags()` + `.map(t => t.label)`. |
| **D4** | `knownTags.ts` | Usar `getItemTags()` en vez de iterar genres+tags+autoTags por separado. |
| **D5** | `ShowPage.tsx` |Breadcrumb usa `getItemTags(show)[0]?.label`. HeroGenres sigue usando genres (`getHeroTags` → ahora es `getHeroCategories`). Sección de detalle: GenreLinks para genres, chips de tags para etiquetas del vocabulario. |
| **D6** | `MoviePage.tsx` | Mismo tratamiento que ShowPage. |
| **D7** | `DetailSections.tsx` | `GenreLinks`: acepta `string[]` (genres). Nuevo componente `TagLinks` o similar para tags del vocabulario. |
| **D8** | `DetailHero.tsx` | `HeroGenres`: recibe genres (string[]), no tags. |

### Fase E — Limpiar traducciones

| # | Archivo | Cambio |
|---|---------|--------|
| **E1** | `data/autotag/genreTranslations.ts` | **Eliminar**. La traducción de genres se queda en `genres.ts` con `GENRE_TRANSLATIONS` (ya lo es). |
| **E2** | `data/autotag/vocabulary.ts` | Eliminar `ENGLISH_TO_SPANISH` y `translateEnglishTag` — no se necesitan porque el vocabulario ya está en español. |
| **E3** | `domain/genres.ts` | Restaurar `GENRE_TRANSLATIONS` inline (como estaba antes). Solo se usa para traducir genres del servidor, no tags. |

### Fase F — Tests

| # | Archivo | Cambio |
|---|---------|--------|
| **F1** | `domain/__tests__/tags.test.ts` | Reescribir: probar que `getItemTags` solo devuelve tags del vocabulario, que server tags basura se descartan, que no hay genres en el resultado. |
| **F2** | `domain/__tests__/genres.test.ts` | Verificar que `getItemCategories` sigue funcionando con genres. |
| **F3** | `domain/viewModels/__tests__/knownTags.test.ts` | Verificar que `knownTags` devuelve tags unificados sin genres. |
| **F4** | `domain/viewModels/__tests__/SearchViewModel.test.ts` | Verificar que chips y filtrado usan tags del vocabulario. |

### Archivos afectados (resumen)

| Archivo | Acción |
|---|---|
| `domain/tags.ts` | Reescribir: solo vocabulario cerrado |
| `domain/genres.ts` | Restaurar `getItemCategories`/`getHeroCategories` inline |
| `domain/viewModels/knownTags.ts` | Simplificar con `getItemTags` |
| `domain/viewModels/SearchViewModel.ts` | Simplificar `allTags`, `tagsOf`, `catalog` |
| `data/autotag/genreTranslations.ts` | Eliminar |
| `data/autotag/vocabulary.ts` | Limpiar `ENGLISH_TO_SPANISH` |
| `data/api/metadata.ts` | Sin cambios (guardado sigue igual) |
| `presentation/pages/ShowPage.tsx` | Separar genres y tags en la vista |
| `presentation/pages/MoviePage.tsx` | Separar genres y tags en la vista |
| `presentation/components/layout/DetailSections.tsx` | Adaptar GenreLinks a genres |
| `presentation/components/layout/DetailHero.tsx` | HeroGenres usa genres |
| Tests (4 archivos) | Actualizar |

---

## Pendientes de la auditoría

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

# Completado (histórico, ir a git log)

## Fase 1 — Detección de foco del backdrop (2026-08-31 / 2026-09-03)

- **1.1** Saliencia CIELAB con blur gausiano 5×5 separable (σ≈1.0). ✅
- **1.2** Detección de piel YCbCr (Cb∈[77,127] AND Cr∈[133,173]) como proxy de cara. ✅
- **1.3** Energía combinada: 35% salencia cromática + 55% bordes + 10% piel. ✅
- **1.4** Peso de regla de tercios: boost ×1.08 suave en 1/3 y 2/3. ✅
- **1.5** Cache persistente en IndexedDB (`presentation/theme/dynamicColor.ts`). ✅

## Fase 2 — Pendientes de la auditoría (2026-08-31)

| # | Archivo | Problema | Estado |
|---|---------|----------|--------|
| **D1** | `data/session/session.ts` | `createdAt: 0` hardcodeado | ✅ eliminado |
| **D2** | `data/api/http.ts` | `res.json()` sin validar content-type | ✅ validación añadida |
| **D3** | `data/api/playback.ts` | Reporting functions tragan errores silenciosamente | ✅ `console.warn` añadido |

## Selector de avatar a pantalla completa estilo Crunchyroll

- **Primitiva fullscreen en `Dialog`**: `variant?: 'modal' | 'fullscreen'`. ✅
- **Catálogo completo de la biblioteca** en `avatars.ts`. ✅
- **Fuentes**: búsqueda SOLO de la biblioteca local. ✅
- **ViewModel**: `groups`, `seriesFilter`, `hasMore`/`loadMore`. ✅
- **Vista**: cabecera + búsqueda + chips + rejilla + barra inferior. ✅
- **Strings**: `AvatarPickerAllSeries` y `AvatarPickerLoadMore`. ✅
- **Tests**: paginación/agrupación/dedupe. ✅

## Auditoría de código (2026-08-31)

Se realizó una auditoría profunda del proyecto que identificó ~45 items en
18 fases. Se verificó que **~40 de ~45 items ya habían sido corregidos**.

## Ronda de optimización (2026-08-06)

**Rendimiento interactivo**: `SelectionViewModel.selectedIds` con `computed`+`Set`,
eventos `CustomEvent` con `StoreChange`, reproductor con `setPositionState` a ~1 Hz.

**Bundle / build**: `manualChunks` para `vendor-react` y `vendor-color`,
`optimizeDeps` para `@mui/icons-material`, lazy loading con `prefetchTabs`.

**Persistencia / estado**: Escrituras a `localStorage` por lotes, React Query
con `maxAge` explícito.

**Deuda / duplicación**: `VideoPlayerViewModel` repartido en 3 colaboradores,
`createTtlCache` unificado, `CatalogViewModel` como base, `TICKS_PER_SECOND`
con única definición, componentes compartidos (`SelectToggle`, `PageSection`,
`CardGrid`).

## Decisiones tomadas

- **`imageStorage` NO se migró a IndexedDB** — los fondos van al servidor.
- **`HomeViewModel`, `ShowViewModel` y `MovieViewModel` se quedan fuera de
  `CatalogViewModel`** — tienen ciclos propios.
