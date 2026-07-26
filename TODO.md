# TODO: Refactorización, modernización y mejoras

> **Estado (2026-07-26).** Un commit por tarea. Verificación tras cada uno:
> `tsc` limpio, `bun run lint` en **0 errores**, stylelint limpio, **396 tests**
> en verde (eran 334) y build de producción OK.
>
> **Parciales, con el bloqueo anotado dentro:** D1 (primera fase), F1, F2, G3, G5.
> **Sin empezar:** D2, E1, E2, E3, F3, F4, F5, G1, G2, H1, H3.
>
> D1 va en la rama `d1-playbackmanager`, aparte de master.

---

## 🔴 Crítico — Deuda técnica urgente

### D1. Descomponer `playbackmanager.js` (4.350 → 3.596 líneas) 🟡
> `src/components/playback/playbackmanager.js` — el archivo más grande y problemático.
> En la rama `d1-playbackmanager`. **10 módulos TypeScript nuevos y 158 tests**
> (de 0). Quedan ~3.400 líneas en un constructor con closures.

- [x] **D1.8 — Tests de caracterización en `play()` y la máquina de eventos** ✅
      31 tests sobre un banco de pruebas (`__tests__/playbackHarness.ts`) que
      sustituye la app legacy por dobles y corta solo en dos fronteras: el
      servidor y el player. La cadena de reproducción corre de verdad.
    - [x] Secuencia completa `getPlaybackInfo → elección de fuente → player.play
          → onPlaybackStarted`, con el orden fijado por aserto
    - [x] Estados intermedios: sin fuentes, error del servidor, sin player
          capaz, item marcador de posición, fallo del player, URL suelta y
          delegación a una sesión remota
    - [x] Máquina de eventos: parada, informes al servidor, pausa/reanudación,
          volumen y modos de cola, errores con y sin reintento por
          transcodificación, y el estado que expone el manager

    > **El primer test ya encontró una regresión de D1.5**: `getUrlParameter`
    > reventaba con una URL `undefined`, cosa que el `getParam` original
    > toleraba. Afectaba a toda reproducción cuya fuente no genera URL de
    > medios. Corregido y con test propio.
    >
    > De paso, dos `catch` mudos (`playInternal` y `onPlaybackRejection`) que
    > se tragaban el error original ahora lo registran: sin eso, un fallo en la
    > cadena dejaba la reproducción muerta y la consola vacía.
- [x] **D1.9 — Extraer `PlayerStateManager`** ✅
    - [x] Crear clase `PlayerStateManager` con su propio test unitario (10 tests)
    - [x] Reemplazar `playerStates` local por `this._playerStateManager`
    - [x] Mover `getPlayerData` y el estado asociado al nuevo módulo

    > **`getPlayerData()` estaba roto y nadie lo había visto.** Buscaba el
    > estado en `playerStates[player.name]`, lo creaba si no existía… y
    > devolvía **`player`**, no el estado. Consecuencia: el mapa se llenaba de
    > objetos vacíos que no leía nadie y las seis propiedades de estado
    > (`streamInfo`, `isChangingStream`, los tres índices de pista y
    > `maxStreamingBitrate`) acababan pegadas al objeto del player.
    >
    > Funcionaba de casualidad —lecturas y escrituras iban al mismo sitio— pero
    > el manager ensuciaba objetos que no son suyos. Había hasta un
    > `eslint-disable sonarjs/no-dead-store` tapando el síntoma.
    >
    > Verificado antes de tocar: ningún módulo fuera del manager lee esas
    > propiedades del player, y los 31 tests de D1.8 siguen en verde tras el
    > cambio — que es exactamente para lo que se escribieron.
- [x] **D1.10 — Extraer event handlers a módulo** 🟡 (los sencillos fuera; los
      cuatro grandes esperan a D1.11/D1.12)
    - [x] `utils/playerProgressEvents.ts`: los nueve handlers que solo
          trasladan el evento al servidor (`pause`, `unpause`, `volumechange`,
          `timeupdate`, los dos modos de cola y los tres cambios de lista) eran
          nueve funciones idénticas enganchadas **dos veces**, una por cada
          rama de `initMediaPlayer`. Ahora son una tabla y un bucle.
    - [x] `utils/PlaybackProgressTimer.ts`: el latido de 10 s. El id del
          intervalo se guardaba como `player._progressInterval` — el mismo
          vicio que el estado antes de D1.9. Y el 10000 suelto pasa a
          `PROGRESS_REPORT_INTERVAL_MS`, con el porqué del valor escrito.
    - [x] Testear cada handler por separado — 15 tests unitarios nuevos, más 3
          de caracterización que atan el latido al manager real.
    - [ ] **Los cuatro grandes NO se mueven todavía**: `onPlaybackStarted`,
          `onPlaybackStopped`, `onPlaybackError` y `onPlaybackChanging` llaman
          entre las cuatro a ~15 closures del constructor (`getPlayer`,
          `changeStream`, `playInternal`, `getCurrentTicks`,
          `setCurrentPlayerInternal`, `cancelPlayback`…). Sacarlas hoy
          significa pasarles una bolsa de quince dependencias: eso no es
          desacoplar, es mudar el enredo y añadir una indirección.
          **Se hacen después de D1.11 y D1.12**, cuando esas closures sean
          métodos y baste con `this`.
- [x] **D1.11 — Mover estado del constructor a propiedades de clase** ✅
    - [x] `players` → `this._players`
    - [x] `currentTargetInfo` → `this._currentTargetInfo`
    - [x] `currentPairingId` → `this._currentPairingId`

    > 15 puntos de acceso en total, todos dentro del constructor y todos con
    > `self` a mano, así que la sustitución es mecánica y sin cambio de
    > semántica. Ya no queda **ninguna** variable de estado suelta en el
    > constructor: lo demás son funciones.
    >
    > Con esto, cada closure que solo tocaba estas tres variables ya puede ser
    > un método — es lo que desbloquea D1.12 y, tras él, los cuatro handlers
    > grandes que quedaron fuera de D1.10.
- [x] **D1.12 — Convertir `self.xxx = function()` a métodos de clase** ✅
    - [x] Migrar getters/setters simples — 48 de golpe, los que no tocaban
          ninguna closure: transformación demostrablemente mecánica
    - [x] Migrar métodos de control — tras promover `getPlayerData` y las 49
          closures internas a métodos privados `_x()`
    - [x] Migrar `play`, `queue` y el resto del núcleo
    - [x] Eliminar `const self = this` — **0 apariciones de `self` en el fichero**

    > **El constructor pasa de ~2.400 líneas a 54**: ya solo inicializa estado y
    > engancha plugins. Las 78 funciones públicas son métodos de clase y las 49
    > closures internas, métodos privados.
    >
    > Los 4 handlers de eventos (`onPlaybackError`, `onPlaybackStopped` y los
    > dos de player autogestionado) reciben ahora el player **por parámetro**:
    > antes llegaba como `this`, porque `Events` invoca al handler con el objeto
    > que emite. Como `Events.off` compara por identidad de función,
    > `_stoppedHandlers` guarda el handler concreto de cada player para poder
    > desengancharlo.
    >
    > **API pública intacta, comprobado**: 128 métodos antes y 128 después,
    > ninguno añadido ni perdido.
    >
    > La trampa del refactor fueron los callbacks `function () {…}` anidados:
    > al pasar de `self` a `this` dejan de funcionar, porque dentro de una
    > `function` normal `this` no es la instancia. Se convirtieron a arrow los
    > 20 que usaban `this`; el resto se quedó como estaba.

> **Defecto encontrado de paso, no corregido aquí**: `bindMediaSegmentManager`
> se llama dos veces sobre el singleton — una al final del constructor y otra a
> nivel de módulo—, así que el gestor de segmentos se suscribe por duplicado.
> Viene del backport `0065f165cb`, es anterior a todo este trabajo, y quitarlo
> cambia comportamiento: merece su propio commit con su prueba.

> **Fallos reales que ha destapado el tipado**, todos corregidos:
> - `supportsDirectPlay` leía `.length` de `RequiredHttpHeaders`, que es un
>   **diccionario**: la condición se cumplía siempre, así que las fuentes con
>   cabeceras obligatorias se daban por reproducibles en directo y luego
>   fallaban al cargarlas.
> - `getPlayerTargets` llamaba a `createTarget(player)` con un argumento donde
>   la firma pide dos: la rama de respaldo reventaba.
> - `normalizeName` usaba `replace(' ', '')`, que solo quita el primer
>   espacio: ningún dispositivo con nombre de dos palabras casaba nunca.
> - `playableMediaTypes` se llenaba con booleanos en un campo `MediaType[]`.
> - `getTextTracks` se llamaba dos veces por reproducción.

### D2. Unificar API clients (`jellyfin-apiclient` → `@jellyfin/sdk`)
> `jellyfin-apiclient` (legacy) coexiste con `@jellyfin/sdk` (moderno). ~15+ archivos usan el legacy.

- [ ] Inventariar todos los imports de `jellyfin-apiclient`
- [ ] Migrar `src/lib/jellyfin-apiclient/` a uso de SDK
- [ ] Migrar `src/utils/jellyfin-apiclient/` a uso de SDK
- [ ] Migrar legacy en `src/scripts/` y `src/components/`
- [ ] Eliminar dependencia `jellyfin-apiclient` de package.json
- [ ] Eliminar `src/lib/jellyfin-apiclient/` y `src/utils/jellyfin-apiclient/`

---

## 🟡 Prioridad Alta — Migración y deuda técnica

### E1. Migrar 110 archivos JS → TypeScript
> 15.5% del código sigue en JS sin tipos. Priorizar por impacto.

- [ ] Migrar `src/scripts/` (24 archivos JS)
- [ ] Migrar `src/components/` legacy (cardBuilder, guide, mediainfo, etc.)
- [ ] Migrar `src/elements/emby-*/` (18 web components)
- [ ] Migrar `src/lib/` (scroller, navdrawer, etc.)
- [ ] Activar `checkJs: true` o eliminar `allowJs` al finalizar

### E2. Refactorizar archivos >500 líneas
> 26 archivos exceden 500 líneas; 4 superan 1.000.

- [ ] `src/scripts/browserDeviceProfile.js` (1.631 líneas)
- [ ] `src/components/cardbuilder/cardBuilder.js` (1.269 líneas)
- [ ] `src/components/guide/guide.js` (1.203 líneas)
- [ ] `src/hooks/useFetchItems.ts` (929 líneas)
- [ ] `src/apps/frontend/presentation/pages/SettingsPage.tsx` (918 líneas)
- [ ] `src/apps/dashboard/routes/playback/transcoding.tsx` (898 líneas)
- [ ] Resto de archivos >500 líneas (20 archivos)

### E3. Resolver 64 TODOs/FIXMEs/HACKs
- [ ] Auditar y clasificar cada uno (resolver, convertir a issue, o eliminar)
- [ ] Resolver los de `playbackmanager.js` (13)
- [ ] Resolver los de `browserDeviceProfile.js` (5)
- [ ] Resolver los de `scrollManager.js` (5)
- [ ] Resolver los de `appRouter.js` (4)
- [ ] Eliminar comentarios obsoletos

---

## 🟠 Prioridad Media — Unificación de sistemas

### F1. Armonizar 3 sistemas de breakpoints 🟡
> Frontend: 600/1024 | MUI: 600/900/1200/1536 | SCSS legacy: 800/1000/1280
> Escala canónica: MUI (600/900/1200/1536), escritorio propio en 1024.
> Documentado en `utils/breakpoints.ts` y `styles/_breakpoints.scss`, con test
> de sincronización. El tema MUI declara la escala explícitamente.

- [ ] Migrar SCSS legacy a variables MUI — **parcial (4 queries renombradas).
      El resto no se toca todavía**: los cortes legacy (50em, 48.125em, 43.75em,
      62.5em…) no equivalen a ningún corte canónico; migrarlos movería el layout
      de las vistas legacy. Además están en `em`, que escala con la fuente del
      sistema, así que la escala SCSS se mantiene en `em`.
- [ ] Consolidar breakpoints de `card.scss` (25+ → menos pasos) — 27 media
      queries con 14 cortes distintos que deciden cuántas tarjetas caben por
      fila. Consolidarlos cambia la rejilla a muchos anchos y es justo el
      renderer que E2/G1 van a reescribir; hacerlo ahora sería trabajo tirado.

### F2. Unificar 3 sistemas de imágenes 🟡
> `Image.tsx`, `common/Image.tsx`, `images/imageLoader.js`. React unificado
> (`common/Image.tsx` como canónico con `alt` y `layout: 'fill' | 'flow'`);
> el legacy lo bloquea G1/F4.

- [ ] Eliminar `images/imageLoader.js` — **bloqueado por G1/F4**: sus 10
      consumidores generan HTML como texto; no se puede sustituir por un
      componente React hasta que esos renderers sean React.

### F3. Unificar routers (`appRouter.js` → `react-router-dom`)
> `appRouter.js` (553 líneas) corre en paralelo con react-router v6.

- [ ] Inventariar rutas legacy que aún pasan por `appRouter.js`
- [ ] Migrar a `react-router-dom`
- [ ] Eliminar `appRouter.js` y dependencias asociadas

### F4. Eliminar manipulación directa del DOM
> 48 archivos usan `getElementById`, `querySelector`, `createElement`, etc.

- [ ] Reemplazar con refs de React y estado declarativo
- [ ] Priorizar archivos en rutas críticas del dashboard

### F5. Layout tablet en Dashboard
> Trata <900px como "mobile". Considerar rail colapsable.

- [ ] Evaluar viabilidad técnica
- [ ] Implementar drawer angosto para tablet (600-900px)

---

## 🔵 Prioridad Baja — Consistencia y mantenibilidad

### G1. Reemplazar 18 web components `emby-*` por React
> Legacy de la era pre-React. Usados principalmente en dashboard.

- [ ] Inventariar dependencias de cada `emby-*`
- [ ] Reemplazar por componentes React uno a uno

### G2. Migrar 18 templates HTML a React
> Archivos `.html` usados para renderizado legacy.

- [ ] Convertir a componentes React con JSX
- [ ] Eliminar archivos `.html` originales

### G3. Estandarizar uso de `React.FC` 🟡
> Decisión: **no se usa `React.FC`**. Regla de ESLint configurada
> (`@typescript-eslint/no-restricted-types`): `error` en frontend, `warn` en
> el resto. Quedan 125 usos legacy.

- [ ] Migrar los 125 usos legacy — pendiente, es una pasada mecánica aparte
      (encaja con E1/E2); la regla ya impide que crezca

> De paso: `eslint` intentaba parsear `docker-config/` (datos del servidor que
> escribe el docker-compose) y `bun run lint` fallaba entero con 14 errores de
> parseo. Añadido a los ignores; ahora la suite queda en **0 errores**.

### G5. Eliminar dependencias legacy innecesarias 🟡
- [ ] `webcomponents.js` v0.7.24 — **no se puede quitar todavía: lo bloquea G1.**
      No es un polyfill "de más": los 18 `emby-*` están escritos contra Custom
      Elements **v0** (`document.registerElement`, `createdCallback`,
      `attachedCallback`), API que ningún navegador moderno implementa —
      Chrome la retiró en la v80. Quien la aporta es justamente
      `webcomponents-lite`. Quitarla hoy rompe el dashboard entero.
      **Orden correcto: G1 (reescribir los `emby-*`) → luego esta dependencia
      se cae sola.** Está importada en 16 archivos.

---

## 🧪 Tests y cobertura

### H1. Aumentar cobertura en Dashboard
> Dashboard apenas tiene tests (solo utilidades).

- [ ] Añadir tests para rutas principales
- [ ] Añadir tests para features/users, features/playback, etc.

### H3. Tests de integración para frontend
- [ ] Tests de navegación entre páginas
- [ ] Tests de flujo de reproducción
