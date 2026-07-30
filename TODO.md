# TODO

Cualquier cosa de esta lista se da por terminada cuando pasan las tres:

```bash
bun run build:check   # tsc --noEmit — el build NO typechequea
bun run lint
bun run test
```

Dos reglas que se han pagado con tiempo y conviene no volver a aprender:

- **Para decidir sobre el peso de una dependencia, `bun run build:analyze`, nunca `du`.** Los
  tamaños que había anotados en §2 eran el `du` de `node_modules`, que cuenta documentación y
  demos. Al medir el código publicado: **dos items se cerraron sin tocar código** (`react-blurhash`
  y `react-query-devtools`) y otros **dos cambiaron de motivo**, porque su peso real era 30× y 8×
  menor que lo anotado (los iconos, 3,6 MB → 124 KB; `react-lazy-load-image-component`,
  216 → 27 KB). De `date-fns` sigue sin medirse lo único que importa —cuánto aporta al bundle—,
  y por eso continúa como «evaluar».
- **Este repo se commitea con `jj`, y `jj` no ejecuta los hooks de git.** Comprobado: un
  `pre-commit` en `.git/hooks` no salta con `jj commit` y sí con `git commit`. Cualquier
  automatismo que dependa de un hook de git aquí es un no-op.

---

# D3 — Nuevas características de reproducción ✅

- [x] **Chromecast** — Sender SDK de Google + receptor de Jellyfin (`CastReceiverId` del usuario,
  canal `urn:x-cast:com.connectsdk`). Sin receptores Cast cae a la Remote Playback API del
  navegador, que es lo que había antes.
  ⚠️ **Sin verificar contra hardware real**: la lógica está cubierta con el SDK mockeado, pero
  nadie lo ha probado contra un Chromecast físico.
- [x] **Skip Intro / Skip Credits** — Lee `/MediaSegments/{itemId}`. Requiere un proveedor de
  segmentos en el servidor (p. ej. Intro Skipper); sin segmentos el botón no aparece.
- [x] **Reproducir después** — Cola persistida en localStorage. Se encola desde el menú «···» de
  cualquier item, se ve y reordena en `/queue` y en el panel del reproductor, y al terminar un
  item encadena con la cola.

---

# Optimizaciones y mejora continua

## 1. Migración de código legacy (90 ficheros `.js`)

> **Estos cuatro puntos no son tarea de una sesión, y empezarlos a medias deja el repo peor que
> ahora**: un paradigma de renderizado a medio migrar es más difícil de entender que el legacy
> entero. Cada uno lleva abajo su alcance medido y el siguiente paso concreto, para que se puedan
> atacar de uno en uno y con un final visible.
>
> El precedente de cómo hacerlo está en el historial: **D1** (descomponer `playbackmanager.js`) y
> **D2** (migrar al SDK) se hicieron en fases numeradas, cada una con su commit y la suite en
> verde. Misma receta aquí.

- [ ] **Unificar API client** — terminar **D2**, cuya fase 4 quedó parcial. **En marcha.**
  **Medido, y sale mejor de lo que decía la nota vieja**: no son 88 imports repartidos. De los 78
  ficheros que tocan el cliente legacy, **67 solo usan la fachada `ServerConnections`** y no se
  enteran de lo que haya detrás. De los 173 usos de `ServerConnections`, **112 son `getApi()`**,
  que ya devuelve SDK. Y de los 74 usos del `ApiClient` legacy, **60 están dentro de la propia
  capa de conexión**: las fases anteriores ya limpiaron los consumidores.
  - [x] **`Credentials` deja de venir del paquete** — reimplementada en `credentials.ts`,
    conservando la clave de almacenamiento y la forma del objeto (si cambian, todo el mundo se
    queda desconectado al desplegar). 15 tests.
  - [x] **`getCurrentApiClientAsync` borrado** — su último consumidor (`ParentalControl`) pasa a
    `getUserApi(api).updateUserPolicy()`. La fachada ya no reparte clientes legacy bajo demanda.
  - [ ] **Quedan 4 ficheros con llamadas de negocio al `ApiClient` legacy**, todas con equivalente
    directo en el SDK. Son independientes entre sí, así que van de una en una:
    - `components/mediaLibraryEditor/mediaLibraryEditor.js` (5) → `getLibraryStructureApi`
    - `components/libraryoptionseditor/libraryoptionseditor.js` (4) → `getLocalizationApi` (cultures,
      countries) y `api.getUri` para el `getJSON`
    - `components/viewContainer.js` (1) → `getUrl` es solo construir una URL: `api.getUri`
    - `hooks/useApi.tsx` y `components/ConnectionRequired.tsx` → solo importan **tipos**
      (`Event`, `ConnectResponse`), que además salen de nuestro propio `src/apiclient.d.ts`, no del
      paquete. Mover esos tipos a un módulo propio.
  - [ ] **Y entonces sí, el núcleo**: con los consumidores fuera, el `ApiClient` legacy queda solo
    como contenedor de datos dentro de `connectionManager.js` (877 líneas). Sustituirlo por un
    registro propio (info del servidor + `Api` del SDK) y borrar `utils/jellyfin-apiclient/`
    (`compat.ts`, `createApiClient.ts`), que es lo único que instancia la clase del paquete.
    Red de seguridad: los **24 tests** de `__tests__/connectionManager.test.ts` fijan la
    orquestación (sondeo de direcciones, versión mínima, validación de token, logout). ⚠️ Usan un
    proveedor de credenciales **falso**, así que no cubren `credentials.ts`; eso lo cubren sus 15.
- [ ] **Migrar web components `emby-*` a React TSX** — quedan **16** (eran 18), **2575 líneas** en
  `src/elements/`. Usan `innerHTML` y DOM imperativo: es un segundo motor de renderizado en
  paralelo a React.
  ⚠️ **Los 16 se registran con `document.registerElement`, la API v0 de custom elements, que los
  navegadores eliminaron**. Ninguno usa `customElements.define`. O sea: hoy solo funcionan porque
  el polyfill `webcomponents.js` resucita una API muerta. Ese es el argumento de peso para migrar,
  más que el `innerHTML`.
  - [x] **Paso 0 — borrar los muertos**: `emby-programcell` y `emby-radio` no tenían ni una
    referencia en el repo. Fuera, 212 líneas.
  - [ ] **Paso 1 — por número de usos, de menos a más** (que es también de menos a más riesgo):
    `emby-progressring` (solo lo usa `emby-itemrefreshindicator`) y `emby-scrollbuttons` (solo
    `emby-scroller` y un `.scss` del tema) → los de 1-2 usos → `emby-checkbox` (7),
    `emby-select` (8), `emby-input` (12) → **`emby-button` el último, con 29**.
- [ ] **Reemplazar 13 `.template.html`** — **889 líneas** de HTML que se cargan aparte de su JS
  (dialog, filterdialog, imageeditor…).
  **Siguiente paso**: van atados a los `emby-*`, así que después del punto anterior. Cada plantilla
  con su JS es un componente React de una pieza.
- [ ] **Migrar iconos a un solo sistema** — quitar `material-design-icons-iconfont` y unificar en
  `@mui/icons-material` (SVG). **38 ficheros** usan la fuente.
  **El motivo bueno no es el peso**: se envían **124 KB** (el `woff2`), no los 3,6 MB del disco —
  2,0 MB de ese paquete son `docs/`. El motivo es que su `@font-face` trae **`font-display: block`**,
  así que hasta que la fuente baja los iconos se quedan **invisibles**. Un SVG no tiene ese
  problema, y de paso muere el `@font-face` del CSS de entrada.

## 2. Bundle y dependencias

Punto de partida medido: **15 MB de JS**; chunks mayores `index` (1016 KB → 280 KB gz),
`hls` (516 → 158) y `AppLayout` (280 → 65).

- [x] **Auditar bundles grandes** — `bun run build:analyze` escribe `bundle-stats.html` (treemap
  con gzip y brotli) en la raíz del repo, fuera de `dist/`, que es lo que se despliega. Es opt-in:
  el build normal no paga los ~14 s extra.
- [x] **`react-blurhash`** — **no se toca**: el peso no era real. De sus 920 KB, **828 son
  `docs/`**; lo que entra al bundle es `dist/index.js` = **2612 bytes**. Escribir el hook a mano
  ahorraría 2,6 KB en crudo a cambio de mantener código propio de canvas y decodificación.
- [x] **`@tanstack/react-query-devtools`** — **ya no entra en producción**. Desde la v5 se resuelve
  a `() => null` fuera de `NODE_ENV=development` y declara `sideEffects: false`, así que Rollup lo
  elimina entero: **0 coincidencias** de `TanStack`, `ReactQueryDevtools`, `query-devtools` ni
  `@tanstack` en `dist/assets/*.js`. Pasarlo a `lazy()` solo añadiría un `Suspense` para nada.
- [ ] **`webcomponents.js` (896 KB)** — polyfill obsoleto; los navegadores actuales soportan web
  components de forma nativa. Lo importan **15 de los 18 `emby-*`**, cada uno por su cuenta.
  Se puede cargar condicionalmente, pero **muere solo** con el punto de migrar los `emby-*` (§1):
  ese es el orden barato, y explica por qué no compensa tocarlo antes.
- [ ] **`react-lazy-load-image-component`** — solo se usa en `Image.tsx`. Sustituible por
  `loading="lazy"` nativo + blurhash, pero **por quitar una dependencia, no por peso**: son
  **27 KB publicados**, no 216.
  ⚠️ No es gratis: el paquete hace lazy loading con IntersectionObserver y efectos de entrada, y el
  `loading="lazy"` nativo usa otros umbrales — cambia **cuándo** entra cada imagen.
- [ ] **Evaluar date-fns v3** — el único de esta sección donde de verdad hay algo que medir: los
  34 MB del disco son irrelevantes, pero aparece en **57 chunks** del build. El tree-shaking ya va
  por función, solo que muy repartido. Mide su aportación real con `build:analyze` antes de
  decidir; la migración es breaking.
- [ ] **Evaluar reemplazo de `lodash-es`** — 7 funciones en uso (`isEmpty`, `debounce`,
  `isEqual`…). Con tree-shaking no molesta; valorar utilidades inline solo para bajar el número de
  dependencias.

## 3. Calidad de código

- [x] **Eliminar `console.log` en producción** — los 18 pasan al nivel que les toca. No hacía falta
  un logger nuevo: el repo ya usaba niveles (60 `debug`, 34 `warn`, 144 `error`) y `console.log`
  era el único outlier. Trazas de ciclo de vida y de sondeo de direcciones a `debug` (ahí fallar es
  lo normal: prueba varias URLs hasta que una responde, así que un `warn` por intento sería ruido);
  fallo inesperado con fallback silencioso a `warn`. La regla **`no-console`** impide que vuelvan.
- [ ] **Resolver 28 TODO + 11 FIXME** — repartidos por la codebase. Prioridad a los FIXME
  (`scrollManager`, `browserDeviceProfile`, `authentication-api`…).
- [ ] **Reducir tipos `any`** — `apiclient.d.ts`, `global.d.ts` (`NativeShell: any`) y algunas
  utilidades. Buena parte de `apiclient.d.ts` desaparece al terminar D2 (§1), así que va después.
- [ ] **Subir cobertura de tests** — el umbral global de líneas está al **5 %**, y el dashboard
  tiene 1 test. `src/apps/frontend/**` ya tiene el suyo propio al **22 %**.
  Como los cuatro puntos de §1, esto **no se hace de una tacada**: subir el umbral global sin
  escribir los tests solo rompe el build. Metas progresivas (30 % → 50 % → 70 %), y subir el número
  del umbral **en el mismo commit** que los tests que lo sostienen, para que nunca esté en rojo.
- [ ] **Extender separación por capas** — el MVVM con linting estricto solo cubre `apps/frontend/`.
  Aplicar reglas equivalentes al dashboard y a los componentes compartidos.

## 4. Rendimiento

- [x] **Hacer `theme-color` dinámico** — en mobile/tablet ya lo movía `MobileThemeProvider` (al
  surface de M3); faltaban desktop y el dashboard, que ahora lo leen del tema activo en
  `themes/themeColor.ts`, de la **definición** del tema y no del CSS calculado (el `<link>` del
  tema puede llegar después del render, y un objeto plano se puede probar). El valor del HTML se
  queda —es el color del primer pintado, cuando no hay JS— pero pasa de `#202020` a **`#101010`**,
  el fondo real del tema oscuro y el que ya declaraba `manifest.json`: estaban desalineados.
- [x] **Pistas de precarga** — hecho el `preconnect`; los tres `preload` **se descartan, medidos
  uno a uno**.
  El `preconnect` **no puede ir en el HTML**: el servidor lo elige el usuario al iniciar sesión y
  puede ser cualquier host, así que se hace en runtime (`utils/preconnect.ts`) en cuanto el
  arranque resuelve la URL, antes de `initApiClient`. Van **dos al mismo host** a propósito: el
  navegador tiene pools separados para conexiones anónimas y con credenciales, y la app usa las dos
  (API por `fetch` CORS anónimo, imágenes por `<img src>` sin `crossorigin`).
  Por qué los `preload` harían daño: el **service worker** lo pide `register()` fuera de la ruta
  crítica; **manifest.json** ya tiene su `<link rel="manifest">`, que el navegador baja a baja
  prioridad porque no hace falta para pintar; y la única **fuente** del build va con URL hasheada
  (un `<link>` estático no puede nombrarla), solo la usa el dashboard y allí vive bajo
  `display: none`, que no dispara la descarga — serían 124 KB tirados en cada carga.
- [ ] **Evaluar registro de Service Worker en desktop** — hoy solo se registra en mobile/tablet, así
  que desktop se queda sin offline.
- [ ] **Auditar renderizado** — buscar re-renders innecesarios con el Profiler de React DevTools,
  sobre todo en listas grandes (bibliotecas, grids).

## 5. Developer Experience

- [x] **Crear `AGENTS.md`** — qué es cada zona del repo, comandos, las tres capas del MVVM con la
  severidad real de cada regla, y las trampas que cuestan una tarde. Cada afirmación comprobada
  contra el código: iba a documentar «comentarios en inglés» y resultó que **153 de los 197**
  ficheros del frontend propio los tienen en español, mientras el legacy los conserva en inglés
  (8 de 133) — la convención real es seguir el idioma del fichero que se toca.
- [x] **Agregar `.env.example`** — solo hay una variable propia, `JELLYFIN_SERVER` (el backend al
  que apunta el proxy del dev server), y la lee `vite.config.ts` en Node, así que no llega al
  bundle ni necesita prefijo `VITE_`. Para que el fichero no fuese decorativo se cableó con
  `loadEnv`, que lo busca en la raíz del repo (el `root` de Vite es `src/`, donde nadie lo
  pondría); el entorno real tiene prioridad sobre el fichero.
- [x] **Modularizar ESLint config** — de 568 líneas en un fichero a **57** que solo deciden el
  orden, más 8 módulos en `eslint/` (`base`, `ignores`, `style`, `node`, `app`, `react`,
  `frontend`, `legacy`) y un `messages.mjs` para el texto que comparten dos de ellos.
  Los bloques se movieron **literalmente**, sin reescribir ninguna regla. Verificado como toca en
  un refactor que no debe cambiar nada: salida completa del lint en JSON antes y después,
  comparada mensaje a mensaje (fichero, regla, línea, columna, severidad) sobre los 749 ficheros
  del repo → **186 mensajes idénticos, 0 regresiones, 0 pérdidas**.
  ⚠️ Al tocar esto, lo que importa es **el orden**: en flat config gana lo último, y `legacy` va
  el último a propósito porque apaga reglas para el JS heredado.
- [ ] **Pre-commit hooks y commitlint** — ⚠️ **tal como están planteados, no funcionarían**: husky
  se engancha por `pre-commit` y commitlint por `commit-msg`, y **`jj` no ejecuta los hooks de git**
  (ver la nota del principio). Instalarlos dejaría una red de seguridad que nunca salta, que es
  peor que no tenerla porque se confía en ella.
  Alternativas reales: `jj fix` configurado en la config del repo, o dejar lint y typecheck en CI.
  Y sobre el formato de los mensajes: los de este repo son **prosa en español explicando el por
  qué**, no Conventional Commits — imponer `feat:`/`fix:` sería cambiar la convención, no
  estandarizarla.
