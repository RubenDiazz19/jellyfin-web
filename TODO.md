# TODO — Pendientes del proyecto

Regla cardinal: **desktop no cambia byte a byte** (`desktopIntegrity.test.tsx`
lo vigila), los comentarios van en español y el cierre de cada fase es
`build:check`, `lint` y `test`.

---

## Home con filas curadas (Opción A) — [COMPLETADO]

Las filas anteriores del Home ("Series" y "Películas") mostraban TODOS los ítems
de la biblioteca — los mismos datos que las páginas dedicadas `/series` y
`/movies`, solo que en layout horizontal. Esto era redundante.

**Implementación final (Opción A)**:
1. **Hero**: 100% Novedades/Destacados (series y películas recientes intercaladas). No muestra items de continuar viendo para eliminar la redundancia.
2. **Fila 1 — Continuar viendo**: `CwCard` apaisadas.
3. **Fila 2 — Añadidos recientemente**: `CatalogCard` verticales.
4. **Fila 3 — Colecciones**: `CollectionCard` 16:9 que navega a la vista de colección.
5. **Fila 4 — Más vistos**: `CatalogCard` verticales.

### Fase 1 — API layer: nuevas funciones de datos

| # | Archivo | Cambio |
|---|---------|--------|
| **1a** | `data/api/home.ts` | Extraer `getResume(limit)` como función pública con su propia cache (`cachedList`). Reutiliza la lógica de mapeo de `fetchHomeCarousel` (líneas 62-114). |
| **1b** | `data/api/home.ts` | Extraer `getLatest(kind, limit)` como función pública con su propia cache. Reutiliza la lógica de las líneas 52-57 de `fetchHomeCarousel`. |
| **1c** | `data/api/played.ts` | **Nuevo archivo**. `getMostPlayed(limit)` llama a `GET /Users/{uid}/Items/Played?IncludeItemTypes=Movie,Series&Limit=N`. Devuelve `CatalogItem[]`. Cache con `cachedList('played', ...)`. |
| **1d** | `data/api/favorites.ts` | Añadir `getFavoriteItems(limit)`. Usa `fetchUserItems` con `Filters=IsFavorite&IncludeItemTypes=Movie,Series`. Devuelve `CatalogItem[]`. Más ligero que `getFavoriteKeys()` actual (no trae Season/Episode). |
| **1e** | `data/api/ApiService.ts` | Registrar `getResume`, `getLatest`, `getMostPlayed`, `getFavoriteItems` en el grupo `catalog` (líneas 118-120). |

### Fase 2 — ViewModel: nuevas señales y carga

| # | Archivo | Cambio |
|---|---------|--------|
| **2a** | `domain/viewModels/HomeViewModel.ts` | Nuevos signals: `continueWatching` (CarouselSlide[]), `recentlyAdded` (CatalogItem[]), `favorites` (CatalogItem[]), `mostPlayed` (CatalogItem[]). Señales de loading: `rowsLoading`, `rowsReady`. |
| **2b** | `domain/viewModels/HomeViewModel.ts` | Nuevo método `loadRows()`: carga las 4 fuentes en paralelo con `Promise.all`. Cada fuente tiene `.catch(() => [])` independiente para que la fallo de una no bloquee las demás. |
| **2c** | `domain/viewModels/HomeViewModel.ts` | Modificar `load()`: sustituir el pipeline 2 (líneas 56-74, `getShows()`+`getMovies()`) por `loadRows()`. El pipeline 1 (hero) se mantiene intacto. |
| **2d** | `domain/viewModels/HomeViewModel.ts` | Eliminar signals obsoletos: `shows`, `movies`, `showsLoading`, `showsReady`, `showsError`. |

### Fase 3 — Presentación: nuevas filas en el Home

| # | Archivo | Cambio |
|---|---------|--------|
| **3a** | `presentation/pages/HomePage.tsx` | Reescribir `HomeLibraryJellyfin`: 4 filas condicionales (solo se renderizan si la fila tiene datos). Orden: Continue Watching → Recently Added → Favorites → Most Played. Cada fila usa `RowScroller` con la card apropiada. |
| **3b** | `presentation/components/cards/CatalogCard.tsx` | **Nuevo archivo**. Wrapper ligero que acepta `CatalogItem` y despacha `PosterCard` (shows) o `MovieCard` (movies) según `item.kind`. |
| **3c** | `presentation/pages/HomePage.tsx` | Adaptar `HomeLibraryProto`: mantener estructura similar pero usando las mismas fuentes curadas. No es crítico (prototipo sin backend). |
| **3d** | `strings/en-us.json`, `strings/es.json` | Añadir `"MostPlayed"`: "Most Played" / "Más vistos". Las demás claves ya existen (`ContinueWatching`, `TabLatest`, `Favorites`). |

### Fase 4 — Tests

| # | Archivo | Cambio |
|---|---------|--------|
| **4a** | `domain/viewModels/__tests__/HomeViewModel.test.ts` | Mockear nuevas funciones (`getResume`, `getLatest`, `getMostPlayed`, `getFavoriteItems`). Testear que `loadRows()` rellena los 4 signals. Testear que la fallo de una fila no bloquea las demás. Testear que `load()` ya no llama a `getShows()`/`getMovies()`. |
| **4b** | Verificar `desktopIntegrity.test.tsx` | Las nuevas filas no filtran tokens mobile a desktop. |

### Fase 5 — Limpieza

| # | Archivo | Cambio |
|---|---------|--------|
| **5a** | `data/api/shows.ts`, `data/api/movies.ts` | Verificar si `getShows()`/`getMovies()` se siguen usando en `LibraryViewModel`. Si es así, **no borrar** — solo eliminar la dependencia desde `HomeViewModel`. |
| **5b** | `data/api/home.ts` | Simplificar `fetchHomeCarousel()` usando `getResume()` y `getLatest()` internamente para evitar duplicación de lógica. |

### Archivos afectados (resumen)

| Archivo | Acción |
|---|---------|
| `data/api/home.ts` | Extraer `getResume()`, `getLatest()` |
| `data/api/played.ts` | **Nuevo** — `getMostPlayed()` |
| `data/api/favorites.ts` | Añadir `getFavoriteItems()` |
| `data/api/ApiService.ts` | Registrar nuevos métodos |
| `domain/viewModels/HomeViewModel.ts` | Nuevos signals, reemplazar carga |
| `presentation/pages/HomePage.tsx` | Reescribir `HomeLibraryJellyfin` |
| `presentation/components/cards/CatalogCard.tsx` | **Nuevo** — dispatch PosterCard/MovieCard |
| `strings/en-us.json` | Añadir `"MostPlayed"` |
| `strings/es.json` | Añadir `"MostPlayed"` |
| `domain/viewModels/__tests__/HomeViewModel.test.ts` | Actualizar mocks y assertions |

### Orden de ejecución

```
Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5
 API      VM       View     Tests    Limpieza
```

Cada fase es mergeable por separado (no rompe nada hasta que se conectan
VM → View en Fase 3).
