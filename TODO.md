# Plan de Optimización, Limpieza, Modularización y Reutilización de Código

> Generado a partir del análisis con 4 agentes de exploración (27 sep 2026)

---

## 📋 Resumen Ejecutivo

| Categoría | Archivos Afectados | Líneas ~ | Prioridad |
|-----------|-------------------|----------|-----------|
| **Refactor crítico (god ViewModels)** | 3 | 2,600+ | 🔴 Crítica |
| **Deduplicación de lógica** | 6 | ~400 | 🟡 Alta |
| **Eliminación código muerto** | 7 | ~50 | 🟢 Baja (quick win) |
| **Consistencia y arquitectura** | 25+ | - | 🟡 Media |

---

## 🔴 PRIORIDAD CRÍTICA — Refactor de God ViewModels

### 1. `VideoPlayerViewModel.ts` (958 líneas → 8-10 servicios)

**Ubicación:** `src/apps/frontend/domain/viewModels/VideoPlayerViewModel.ts`

**Responsabilidades a extraer:**

| Servicio Nuevo | Responsabilidad | Líneas aprox |
|----------------|-----------------|--------------|
| `SubtitleManager` | Tracks VTT, burned subs, offset, text vs image | ~120 |
| `AudioTrackManager` | Selección, preferencia de idioma persistente | ~60 |
| `CastBinding` | Chromecast/AirPlay, pauseForCast, promptCast | ~100 |
| `MediaSessionBinding` | Lock screen, notificación, PiP controls | ~80 |
| `AutoNextTracker` | Next episode, progreso durante créditos | ~100 |
| `SleepTimer` | Modos, expiración | ~60 |
| `ProgressReporter` | Intervalo 10s, stop reporting | ~40 |
| `SegmentTracker` | Intro/credits skip, segmento activo | ~80 |
| `TrickplayManager` | Thumbnails preview en seek bar | ~60 |
| `VideoFilters` | Brightness, aspect ratio, playback rate | ~50 |

**Facade final:** `VideoPlayerViewModel` (~150 líneas) que compone los servicios vía constructor.

**Tests afectados:** 8 archivos de test en `domain/viewModels/__tests__/VideoPlayerViewModel.*.test.ts`

---

### 2. `SearchViewModel.ts` (798 líneas → 6 clases)

**Ubicación:** `src/apps/frontend/domain/viewModels/SearchViewModel.ts`

**Extracción propuesta:**

| Clase | Responsabilidad |
|-------|-----------------|
| `SearchQueryParser` | `parseQuery`, `normalizeSearchText` |
| `SearchFilters` | Estado filtros (type, state, rating, tags, category mode) |
| `LocalSearchEngine` | Índice catálogo local, filtrado, `catalog` computed |
| `RemoteSearchManager` | Búsqueda remota debounced, `MIN_REMOTE_QUERY=2` |
| `SearchViewManager` | Saved views (serializar/aplicar), overlay open/close |
| `TagManager` | `allTags`, `availableTags`, mutaciones de tags |

**Facade:** `SearchViewModel` coordinando los anteriores.

**Tests afectados:** `SearchViewModel.test.ts`

---

### 3. `HomePage.tsx` (860 líneas → 4 componentes + hooks)

**Ubicación:** `src/apps/frontend/presentation/pages/HomePage.tsx`

**Extracción:**

| Componente/Hook | Responsabilidad |
|-----------------|-----------------|
| `HeroCarousel` | Carrusel hero, drag/wheel, scroll snap |
| `HeroSlide` | Slide individual: context menu, trailer video, play button |
| `HomeLibrary` | Renderizado secciones biblioteca (modo Jellyfin + prototipo) |
| `TrailerController` | Autoplay trailer, interacción, coordinación con VM |
| `useHomeScrollTransition` | (Ya existe) Coordenadas hero ↔ spacer |

**Tests afectados:** `HomePage.test.tsx` (si existe), `desktopIntegrity.test.tsx`

---

## 🟡 PRIORIDAD ALTA — Deduplicación de Lógica

### 4. Lógica de Carrusel Compartida (~300 líneas duplicadas)

**Archivos:**
- `src/apps/frontend/presentation/components/collection/CollectionCardCarousel.tsx`
- `src/apps/frontend/presentation/components/collection/SubCollectionsCarousel.tsx`

**Código duplicado idéntico:**
- `checkScrollButtons()` — detección scroll left/right
- `scrollByAmount()` — navegación programática
- `useEffect` listeners scroll + cleanup
- Estilos inline botones navegación (izq/der) ~90 líneas c/u
- SVGs flechas idénticos
- `onMouseEnter/Leave` hover state

**Solución:**
```
src/apps/frontend/presentation/components/collection/
├── useCarouselScroll.ts          # Hook: canScrollL/R, scrollBy, ref
├── CarouselNavButtons.tsx        # Componente botones + SVGs
├── CollectionCardCarousel.tsx    # Usa hook + botones
└── SubCollectionsCarousel.tsx    # Usa hook + botones
```

---

### 5. Helpers Compartidos → `domain/utils/`

| Helper | Usado en | Nuevo archivo |
|--------|----------|---------------|
| `runtimeMinutes()` | `LibraryViewModel.ts:26`, `SearchViewModel.ts:87` | `domain/utils/runtime.ts` |
| `compareBy()` (sort) | `LibraryViewModel.ts:30-45`, `SearchViewModel.ts:94-106` | `domain/utils/sorting.ts` |
| `formatEpisodeCode()` | `HomeViewModel.ts:13` (duplicado de `format.ts`) | **Eliminar** dominio, usar `presentation/utils/format.ts` |

---

### 6. IntersectionObserver Compartido

**Archivos:**
- `src/apps/frontend/presentation/components/layout/LazyCard.tsx` (líneas 36-47)
- `src/apps/frontend/presentation/components/layout/LazySection.tsx` (líneas 8-23)

**Solución:** `src/apps/frontend/shared/useIntersectionObserver.ts`
```typescript
export function createIntersectionObserver(rootMargin: string)
export function useIntersectionObserver(ref, rootMargin)
```

---

### 7. Gradientes Centralizados (5+ variantes)

**Archivos con gradientes inline/constantes locales:**
- `PosterShell.tsx:50` — `DEFAULT_GRADIENT`
- `CollectionCardCarousel.tsx:303` — inline idéntico a PosterShell
- `MovieCard.tsx:33` — `GRID_GRADIENT` (variante)
- `SeasonCard.tsx:59` — variante landscape
- `LandscapeCardShell.tsx:45` — default landscape

**Solución:** `src/apps/frontend/presentation/theme/gradients.ts`
```typescript
export const gradients = {
  posterDefault: 'linear-gradient(180deg, transparent 25%, rgba(0,0,0,0.92))',
  gridPoster: 'linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.9))',
  seasonCard: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 30%, transparent 55%, rgba(0,0,0,0.94) 100%)',
  landscapeDefault: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent 55%)',
}
```

---

### 8. Hook `useScrollY` Compartido

**Usos directos de `window.scrollY`:**
- `ScrollTopFab.tsx:32`
- `useHomeScrollTransition.ts:42` (rAF)
- `DetailHero.tsx` (vía hook)

**Solución:** `src/apps/frontend/presentation/hooks/useScrollY.ts` con rAF optimizado.

---

## 🟢 PRIORIDAD BAJA — Eliminación Código Muerto (Quick Wins)

### 9. Exports No Utilizados (hacer `private` o eliminar)

| Archivo | Export | Acción |
|---------|--------|--------|
| `domain/viewModels/utils/knownTags.ts` | `knownTags()` | **Eliminar** (solo test) |
| `domain/viewModels/utils/searchViews.ts` | `TYPE_FILTERS`, `STATE_FILTERS` | Quitar `export` |
| `presentation/components/nav/MobileNav.tsx` | `NAV_CLASS` | Quitar `export` |
| `presentation/components/controls/menus/MenuEntry.tsx` | `entryColor()` | Quitar `export` |
| `data/api/fanart.ts` | `FANART_API_KEY` | Quitar `export` (barrel lo exporta) |
| `presentation/components/controls/fields.tsx` | `ERROR_FG` | Quitar `export` |
| `domain/viewModels/HomeViewModel.ts` | `formatEpisodeCode()` | **Eliminar** (duplicado) |

---

## 🟡 PRIORIDAD MEDIA — Consistencia y Arquitectura

### 10. Barrel Exports Faltantes (18 directorios)

**Directorios SIN `index.ts`:**
```
components/admin/
components/cards/           (solo cards/search/ tiene)
components/cast/
components/collection/
components/controls/
components/home/
components/layout/
components/m3/
components/media/
components/nav/
components/person/
components/player/
components/pwa/
components/queue/
components/search/
components/similar/
components/skeleton/
components/tasks/
components/toast/
components/tweaks/
domain/viewModels/
domain/viewModels/utils/
domain/player/
domain/bridge/
presentation/hooks/
```

**Acción:** Crear `index.ts` en cada uno re-exportando componentes públicos.

---

### 11. Migrar a `useAsyncToast` (26 archivos)

**Patrón actual (inconsistente):**
```typescript
// 26 archivos usan try/catch + toast directo
try {
  await action()
  toast('OK', 'success')
} catch (e) {
  toast(e.message, 'warn')
}
```

**Patrón objetivo (ya existe en 4 archivos):**
```typescript
const { run } = useAsyncToast()
await run(async () => { await action() }, {
  successMessage: 'OK',
  errorMessage: (e) => e.message
})
```

**Archivos a migrar (ejemplos):**
- `presentation/pages/auth/LoginPage.tsx`
- `presentation/pages/SettingsPage.tsx`
- `presentation/components/admin/editor/MetadataEditor.tsx`
- `presentation/components/lists/ListPage.tsx`
- `presentation/components/queue/QueuePanel.tsx`
- ... y 20 más

---

### 12. Documentar Guías de Gestión de Estado

**Archivo:** `docs/state-management.md` (nuevo) o `AGENTS.md` (ampliación)

**Contenido:**
| Caso | Qué Usar | Ejemplo |
|------|----------|---------|
| Estado del ViewModel (señales) | `useVmSignals(vm)` | `const { items, loading } = useVmSignals(libraryVM)` |
| Estado UI efímero local | `useState` | `const [hovered, setHovered] = useState(false)` |
| Selección fina de señal | `useSignalSelector` | `const title = useSignalSelector(vm.title)` |
| Estado derivado computado | `computed(() => ...)` en VM | `vm.filteredItems = computed(() => ...)` |

---

### 13. Props de Cards Inconsistentes

**Problema:** Cada card espera shape distinta:

| Componente | Prop | Tipo |
|------------|------|------|
| `PosterCard` | `slide` | `Slide` (custom) |
| `MovieCard` | `movie` | `MovieLike` |
| `SearchMovieCard` | `item` | `CatalogItem` |
| `SeasonCard` | `show`, `season` | `Show`, `Season` (2 props) |
| `EpCard` | `show`, `season`, `ep` | 3 props |
| `CwCard` | `slide` | `CarouselSlide` |
| `CatalogCard` | `item` | `CatalogItem` |

**Solución:** Definir `CardItem` unificado en `domain/models.ts` o `presentation/components/cards/types.ts` y crear adaptadores.

---

## 📦 Orden de Ejecución Sugerido

### Fase 1: Quick Wins (1-2 días)
1. ✅ Eliminar exports muertos (Item 9)
2. ✅ Crear barrel exports faltantes (Item 10)
3. ✅ Centralizar gradientes (Item 7)

### Fase 2: Deduplicación (3-5 días)
4. ✅ Extraer `useCarouselScroll` + `CarouselNavButtons` (Item 4)
5. ✅ Mover helpers a `domain/utils/` (Item 5)
6. ✅ Extraer `useIntersectionObserver` (Item 6)
7. ✅ Crear `useScrollY` (Item 8)

### Fase 3: Consistencia (3-4 días)
8. ✅ Migrar a `useAsyncToast` (Item 11)
9. ✅ Documentar state management (Item 12)
10. ✅ Unificar props de cards (Item 13)

### Fase 4: Refactors Mayores (2-3 semanas c/u)
11. ✅ `VideoPlayerViewModel` split (Item 1)
12. ✅ `SearchViewModel` split (Item 2)
13. ✅ `HomePage` split (Item 3)

---

## ✅ Criterios de Aceptación por Fase

### Fase 1-2 (Quick wins + Deduplicación)
- [ ] `bun run lint` pasa sin warnings nuevos
- [ ] `bun run build:check` pasa (tsc --noEmit limpio)
- [ ] `bun run test` pasa (coverage no baja)
- [ ] Bundle size no aumenta (verificar con `bun run build:analyze`)

### Fase 3 (Consistencia)
- [ ] 0 archivos usando try/catch + toast directo para async actions
- [ ] Documentación de state management en `AGENTS.md` o `docs/`
- [ ] Cards usan tipo unificado o adaptadores documentados

### Fase 4 (Refactors Mayores)
- [ ] Cada servicio extraído tiene tests propios
- [ ] Facade ViewModel mantiene API pública compatible
- [ ] No regresiones en `playbackFlow.test.tsx`
- [ ] No regresiones en `desktopIntegrity.test.tsx`

---

## 🛠️ Comandos de Verificación

```bash
# Antes de cada PR
bun run build:check   # Typecheck
bun run lint          # ESLint
bun run test          # Vitest (una pasada)

# Análisis bundle
bun run build:analyze # Abre bundle-stats.html

# Buscar código muerto periódicamente
# (ESLint no tiene unused-imports rule, revisar manualmente)
```

---

## 📝 Notas Adicionales

- **Legacy:** No tocar `src/legacy/` salvo necesidad estricta (regla `import/no-restricted-paths`)
- **Idioma:** Comentarios en español (frontend propio), inglés (legacy heredado)
- **Commits:** Mensajes en español, convencional commits
- **Tests:** Añadir tests al tocar frontend propio; umbral global 5%, frontend propio más alto
- **Dev server:** `bun start` (HMR :8080), backend Docker `:8096`

---

*Plan generado automáticamente. Revisar y ajustar según prioridades del equipo.*