# D4 — Organización personal: tags, orden, selección y vistas

Cuatro características que hacen la biblioteca navegable a mano, reutilizando
los patrones existentes (stores de localStorage, `updateItemMetadata`, eventos
`ITEM_MUTATED_EVENT`). Orden de ejecución: A → D (D depende de A); B y C son
independientes y encajan entre medias.

## Fase A — Tags ocultos en Search, sincronizados con el servidor

Los tags viven en el servidor (metadata del item), así que son visibles desde
cualquier cliente. «Ocultos» = no pintan nada en las tarjetas (a diferencia de
los favoritos); solo sirven para filtrar y ordenar.

- [x] **Llevar `Tags` al modelo** — `JFItem`, `Movie` y `Show` ganan `tags?: string[]`,
  mapeados en `mapMovie`/`mapShow`. El server ya devuelve `Tags` en el DTO; el tipo
  solo no lo declaraba.
- [x] **Escritura** — `ItemMetadataPatch` y `JFRawItem` ganan `Tags`. Nuevo
  `setItemTags(itemId, tags)` que reutiliza `updateItemMetadata` (GET full → merge →
  `POST /Items/{id}`, ya en `metadata.ts:56`), y lote `setItemsTags(ids, tags)` con un
  solo `emitItemMutated()`.
  ⚠️ **Permiso**: `POST /Items/{id}` es la misma puerta que el editor de metadatos
  admin. Sin permiso de edición → 403: la escritura falla con toast; la lectura
  (filtrar) funciona para cualquiera.
- [x] **Filtrado** — `SearchViewModel` gana `tagFilter` + `allTags` (unión de tags de la
  biblioteca cargada, para la fila de chips) y sintaxis `#etiqueta` en la caja de
  búsqueda. Re-filtra por `ITEM_MUTATED_EVENT`, como favs/vistos.
- [x] **UI** — tercera fila de chips «Etiquetas» en `SearchPage` (se oculta sin tags);
  entrada «Etiquetas…» en el menú «···» con un diálogo estilo `AddToDialog` (campo con
  autosugerencia de tags existentes + chips asignados).

## Fase B — Orden en la biblioteca

- [x] `LibraryViewModel` gana `sortKey` (`title | year | rating | runtime | random`)
  persistido en localStorage (`jfp-library-sort`) y computeds ordenados con
  `Intl.Collator`. Control de orden junto al título en `LibraryPage`. Sin tocar data:
  el server ya llega con `SortBy=SortName`.

## Fase C — Multiselección en lote

- [x] Nuevo `SelectionViewModel`: `selecting`/`selected`, toggle por tarjeta y acciones
  en lote: visto (`markPlayed` por item + `WATCHED.setMany`), cola (`QUEUE.enqueue`),
  tags (`setItemsTags`, que **suman** a los existentes).
- [x] UI en `LibraryPage`/`SearchPage`: botón «Seleccionar», tarjetas en modo toggle y
  barra flotante de acciones (reutilizando `BottomSheet`/FAB).

## Fase D — Vistas guardadas

- [x] `viewsStore.ts` (localStorage `jfp-views`): `{ id, name, typeFilter, stateFilter,
  tag?, query? }`. Las vistas son locales (config de filtro); los tags a los que
  apuntan viven en el servidor.
- [x] Fila de chips «Mis vistas» en `SearchPage` con botón «guardar actual»; al pulsar
  una vista navega a `/search` y aplica los filtros.

---

Transversal: claves en `en-us.json`/`es.json`, comentarios en español y tests de
data/VM en `__tests__` junto a cada pieza. Cierre de cada fase con `build:check`,
`lint` y `test`.

## Estado: D4 completada

Las cuatro fases están implementadas y verificadas (`build:check` limpio,
`lint` con 0 errores, 904 tests en verde — 53 nuevos).

Dos correcciones sobre lo que asumía el plan:

- **`Tags` no venía en el DTO.** Es un `ItemFields` que hay que pedir
  explícitamente: se añadió a `FIELDS_LIST` y también a los `Fields` de
  `getItemRaw`, porque el guardado reenvía el item entero y sin pedirlo cada
  edición de metadatos habría borrado las etiquetas.
- **`emitItemMutated()` sin id ya existía** como «alcance desconocido», así que
  el lote lo reutiliza en vez de inventar nada.

Pendiente de probar a mano contra el servidor real: el 403 al etiquetar sin
permiso de edición (la ruta de error está escrita pero no ejercitada).

---

# D5 — Etiquetado automático en castellano

Los chips de la fase A enseñaban los keywords crudos de TMDB: cientos, en
inglés y de cola larga (`aftercreditsstinger`, `blind girl`), inservibles como
filtro. Se sustituyen por un vocabulario cerrado de ~48 etiquetas en castellano
que rellena un LLM en una pasada única.

- [x] `data/autotag/vocabulary.ts`: lista cerrada con pista por etiqueta.
  Deliberadamente **no** repite los géneros de Jellyfin — cubre tono, tema,
  subgénero y ambientación, que es lo que el género no dice.
- [x] `data/autotag/parseResponse.ts`: valida lo que contesta el modelo
  (vallas ```json, etiquetas inventadas, ids colados, tipos raros).
- [x] `data/autotag/index.ts`: lee `autoTags.json` **validando contra el
  vocabulario**, así editar la lista no obliga a regenerar.
- [x] `scripts/autotag/`: CLI (`bun run autotag`) con Groq / Google AI Studio /
  Ollama / cualquier API compatible con OpenAI. Reanudable, con `--dry-run`,
  `--limit`, `--force`.
- [x] `stores/manualTagsStore.ts`: registra lo que el usuario teclea, para
  distinguirlo de los keywords de TMDB en la fila de chips.
- [x] `SearchViewModel`: `allTags` (los chips) enseña solo automáticas +
  manuales; el filtrado y `#` siguen mirando **todo**, incluidos los keywords.

Decisiones que conviene recordar:

- **Las etiquetas automáticas viven en un JSON local, no en las `Tags` del
  servidor.** Un refresco de metadatos de Jellyfin reescribe el item y se las
  llevaría por delante. Como efecto secundario, van en `autoTags` y no en
  `tags`, así que el diálogo de etiquetas no puede subirlas sin querer.
- **`setItemTags` diferencia lo nuevo de lo que ya tenía el item.** El diálogo
  manda la lista entera, con los keywords de TMDB mezclados; solo lo que no
  estuviera antes se registra como manual.
- **Un título sin etiquetas es una respuesta válida**, y se guarda como `[]`
  para no volver a preguntar por él en la siguiente pasada.

Ejecutado contra la biblioteca real (7 títulos, gemini-2.5-flash, capa
gratuita). Tres fallos que solo aparecieron al pasarlo de verdad:

- **El modelo copiaba MAL el id.** Se le mandaba el id de Jellyfin —hex de 32
  caracteres— para que lo devolviera, y cambiaba un dígito
  (`…be859cafe2db` → `…be854cafe2db`). La validación lo rechazaba por id
  desconocido y ese título perdía todas sus etiquetas **en silencio**, uno
  distinto en cada pasada. Ahora los títulos se numeran 1..N dentro del lote:
  un número de dos cifras no se transcribe mal, y si pasara se ve por rango.
- **Sobreabstención.** «Ante la duda, lista vacía» era tan fuerte que el modelo
  no ponía ni `Anime` con el keyword `anime` delante. Se separó: género y
  origen son objetivos y van siempre; la reserva queda para tono/tema.
- **`Anime` + `Animación` siempre juntas**, gastando una plaza para no decir
  nada. Se resuelve en código (`dropRedundant`), no pidiéndoselo al modelo,
  que lo ignoraba aun con la pista puesta.

---

# D6 — Búsqueda como capa, filtros de varias etiquetas

- [x] `SearchOverlay`: la lupa de la barra abre la búsqueda **encima** de la
  página actual en vez de navegar a `/search`. Montada en `App.tsx` fuera del
  wrapper de ruta, para quedar por encima de los heroes a pantalla completa.
  Cierra con Escape o con la ✕, y al cerrar limpia los filtros: se abre sobre
  otra página y volver a ella con una búsqueda vieja puesta desorienta.
- [x] Extraídos `SearchInput`, `SearchFilters` y `SearchResults` a
  `components/search/`: la página `/search` y la capa son la misma UI sobre el
  mismo VM, y duplicarla era garantizar que se separasen a la primera
  corrección. `/search` se conserva para enlaces directos y para la navegación
  inferior de móvil, donde una página entera funciona mejor que una capa.
- [x] `tagFilter: string` → `tagFilters: string[]`, cruzándose en Y. Es lo que
  hace útil tener géneros y matices en el mismo vocabulario: el género acota y
  el matiz afina («Anime» + «Instituto»).
- [x] `SavedView.tags?: string[]`; se sigue leyendo el `tag` singular del
  formato viejo para no invalidar las vistas ya guardadas en localStorage.
- [x] `--prune` en el script: borra del JSON los títulos que ya no están en la
  biblioteca. Cero llamadas a la API — es comparar listas de ids.

El envío incremental **ya funcionaba** (`pendingItems` filtra por
`!(item.id in out.items)`); lo que faltaba era hacerlo visible. Ahora se dice
«Ya etiquetados: N» y «→ N llamadas a la API» antes de empezar. Verificado con
un servidor de prueba cuya biblioteca crece de 3 a 5: en la segunda pasada solo
viajan las 2 nuevas.

Decisión posterior a petición: el vocabulario incluye ahora los géneros
generales (Comedia, Terror, Ciencia ficción…) y se quitaron los `Basado en …`.
Los géneros de Jellyfin no se reutilizan tal cual porque vienen con los idiomas
mezclados —en esta biblioteca conviven «Animación» y «Sci-Fi & Fantasy»—, así
que pasarlos por el vocabulario es también lo que los deja en castellano.
Tope por item subido a 5: hay dos capas que cubrir y con cuatro la segunda se
quedaba fuera.

---

# D7 — Reproductor: el seek hacia delante no debe «tardar en cargar»

Avanzar (barra, flechas, doble toque, mandos del sistema) hace un seek local
(`video.currentTime`, correcto: el DynamicHLS de Jellyfin reinicia ffmpeg en la
posición pedida vía el segmento que se solicita), pero hls.js se crea con su
config **por defecto** (`new Hls()` sin opciones en `hlsSource.ts`), y esos
valores por defecto son justo los que penalizan el seek hacia delante.

- [ ] **Config de hls.js afinada** — `domain/player/hlsSource.ts` gana una
  fábrica `hlsConfig()` (pura y testeable) que se pasa a `new HlsMod(config)`:
  - `maxBufferLength: 30` y `maxMaxBufferLength: 30` — capar el buffer hacia
    delante. Con los valores por defecto (600 s / 60 MB) hls.js rellena un
    buffer enorme y, al avanzar, lo desecha entero y lo reconstruye en ráfaga;
    esas descargas compiten con el segmento objetivo cuando el transcode va
    cargado (el «a veces tarda»).
  - `lowLatencyMode: false` — heurísticas LL-HLS que con Jellyfin no aportan
    nada (mismo criterio que el cliente oficial).
  - `startFragPrefetch: true` — tras el seek, precarga el fragmento siguiente:
    sin él hay un micro-corte al reanudar.
  - `fragLoadingRetryDelay: 250` — cuando el segmento objetivo aún no está
    transcodificado, hls.js reintenta cada 1 s por defecto; bajar el retardo
    acorta la recuperación.
  - `manifestLoadingTimeOut: 20000`.
- [ ] **Test de `hlsConfig()`** — `__tests__/hlsSource.test.ts`: buffer capeado
  (`maxMaxBufferLength === maxBufferLength`), low-latency off, prefetch on,
  retry < 1000 ms.
- [ ] Cierre con `build:check`, `lint` y `test`.

Decisiones que conviene recordar:

- **Capar a 30 s** (preguntado y confirmado): igual que el cliente oficial de
  Jellyfin. Reduce memoria y carga y acelera el seek; el margen en redes muy
  lentas baja, pero el oficial usa el mismo valor (6 s solo para bitrates muy
  altos con HWA).
- **Descartado: reiniciar el transcode con `startTimeTicks` en seeks lejanos.**
  El seek local ya provoca el reinicio del lado servidor (ffmpeg arranca con
  `-ss` en la posición pedida); recargar la fuente entera sería más caro, no
  más rápido.
- **Descartado: tocar el device profile.** `BreakOnNonKeyFrames: true` ya hace
  que cada segmento arranque en keyframe, que es lo que hace rápido el seek.
