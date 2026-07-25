# TODO: Refactorización, modernización y mejoras

> **Estado (2026-07-25):** Auditoría completa del código. Pendiente:
> descomposición de módulos legacy, migración JS→TS, unificación de
> sistemas duplicados, y mejoras de accesibilidad/UX.

---

## 🔴 Crítico — Deuda técnica urgente

### D1. Descomponer `playbackmanager.js` (4.350 líneas)
> `src/components/playback/playbackmanager.js` — el archivo más grande y problemático. Monolítico, sin tipos, 13+ TODOs internos.

- [ ] Extraer lógica de gestión de players a módulo separado
- [ ] Extraer lógica de cola/reproducción a use case
- [ ] Extraer lógica de eventos/reportes a servicio
- [ ] Tipar con TypeScript los módulos resultantes
- [ ] Resolver TODOs internos durante la refactorización

### D2. Unificar API clients (`jellyfin-apiclient` → `@jellyfin/sdk`)
> `jellyfin-apiclient` (legacy) coexiste con `@jellyfin/sdk` (moderno). ~15+ archivos usan el legacy.

- [ ] Inventariar todos los imports de `jellyfin-apiclient`
- [ ] Migrar `src/lib/jellyfin-apiclient/` a uso de SDK
- [ ] Migrar `src/utils/jellyfin-apiclient/` a uso de SDK
- [ ] Migrar legacy en `src/scripts/` y `src/components/`
- [ ] Eliminar dependencia `jellyfin-apiclient` de package.json
- [ ] Eliminar `src/lib/jellyfin-apiclient/` y `src/utils/jellyfin-apiclient/`

---

## 🎯 Prioridad Alta — Accesibilidad

### A1. Permitir zoom en viewport ✅
> `src/index.html` — Reemplazar `user-scalable=no, maximum-scale=1` por `maximum-scale=5`.

- [x] Editar viewport meta tag
- [x] Verificar que no hay regresiones de layout — el retardo de 300 ms lo
      cubre `touch-action: manipulation`; la capa de gestos del reproductor
      mantiene `touch-action: none` (el doble-tap no se lo lleva el zoom).
      Fijado con tests en `a11yViewport.test.ts`.
- [x] `appHost.setUserScalable()` ya no puede volver a bloquear el zoom
      (reescribía el meta con `user-scalable=no` y perdía `viewport-fit=cover`)
- [ ] Probar en dispositivo real — **requiere verificación humana**

### A2. Soporte `prefers-reduced-motion` ✅
- [x] Añadir regla CSS global para `@media (prefers-reduced-motion: reduce)` —
      `styles/site.scss` (toda la app: dashboard + legacy) y el `global.css`
      del frontend (incluye la ruta `/video`, que se monta sin AppLayout)
- [x] Verificar que keyframes existentes se respetan — se acorta la duración a
      0.01ms en vez de usar `animation: none`, que dejaría invisibles los
      keyframes con fill-mode `both`; `animation-iteration-count: 1` corta los
      bucles infinitos. Fijado en `a11yMotion.test.ts`.
- [x] Cubrir el movimiento que el CSS no alcanza: `utils/motion.ts`
      (`prefersReducedMotion` / `scrollBehavior`), usado por `scrollManager.js`,
      el ripple M3 y `ScrollTopFab`

### A3. Soporte `prefers-contrast` ✅
- [x] Leer `prefers-contrast: more` en el theme provider — y también `less`;
      `custom` / `no-preference` caen en el estándar
- [x] Ajustar `contrastLevel` en `SchemeTonalSpot` en `m3.ts` — constantes en
      `M3_CONTRAST`, recortadas a −1…1 para no degenerar la paleta, y el nivel
      activo se emite como `--md-sys-contrast`
- [x] Probar cambio entre modos — tests del provider: estándar, `more`, `less`,
      cambio en caliente y ausencia de rastro en desktop

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

### E4. Unificar lockfiles (bun vs npm) ✅
> Conviven `bun.lock` y `package-lock.json`.

- [x] Decidir gestor definitivo: **bun**. `package-lock.json` estaba congelado
      desde antes de quitar webpack (14/07) mientras `bun.lock` sigue vivo, y
      el Dockerfile ya instalaba con bun. `engines` bloquea npm y yarn con el
      mismo truco que ya había para yarn.
- [x] Eliminar lockfile redundante — fuera `package-lock.json`
- [x] Actualizar CI/CD y docs — los tres workflows pasan a `setup-bun` +
      `bun install --frozen-lockfile`; se corrigen dos scripts que ya no
      existían (`build:production` → `build`, y fuera `build:es-check`, que se
      cayó con webpack). README documenta la decisión y los comandos reales.

---

## 🟠 Prioridad Media — UX e Interacción

### B1. Swipe-down para cerrar BottomSheet ✅
- [x] Añadir event listeners táctiles en BottomSheet — nativos, porque
      `touchmove` tiene que ser no pasivo para frenar el scroll del documento
- [x] Animar seguimiento del arrastre — el sheet sigue al dedo y el scrim se
      atenúa con el recorrido; al soltar, transición de vuelta o de salida
- [x] Dismiss al superar threshold vertical — por recorrido (96px) o por
      velocidad (flick), medida entre las dos últimas muestras
- [x] Compatibilidad con scroll interior — el gesto solo se apropia si el
      contenido está arriba del todo; si no, el dedo mueve la lista

### B2. Swipe-to-dismiss en toasts mobile ✅
- [x] Añadir swipe gesture horizontal al toast — solo en el snackbar táctil;
      `touch-action: pan-y` deja el scroll vertical al navegador
- [x] Animar salida y dismiss — sigue al dedo, la opacidad cae con el
      recorrido y sale por el lado del gesto; el descarte manual cancela el
      timer de auto-cierre

### B3. Extender `touch-action: manipulation` ✅
> Actualmente solo en botones.

- [x] Revisar sliders, listas, tarjetas clickeables — las tarjetas
      (`.jfp-card-m3`, `.jfp-hoverlift`) entran; los deslizantes se excluyen
      a propósito (`input[type=range]`, `[role=slider]`, la capa de gestos y
      la barra de seek, que declaran `touch-action: none`). Las listas no
      necesitan nada: `manipulation` sigue permitiendo pan y pinch.
- [x] Añadir bajo `html.layout-mobile` / `html.layout-tablet` — y también bajo
      `body.jf-video-active`, la ruta `/video`, que se monta sin AppLayout y
      se quedaba fuera

---

## 🟠 Prioridad Media — Unificación de sistemas

### F1. Armonizar 3 sistemas de breakpoints
> Frontend: 600/1024 | MUI: 600/900/1200/1536 | SCSS legacy: 800/1000/1280

- [ ] Evaluar alinear frontend con MUI (sm=600, md=900, lg=1200)
- [ ] Migrar SCSS legacy a variables MUI
- [ ] Documentar decisión en el código
- [ ] Consolidar breakpoints de `card.scss` (25+ → menos pasos)

### F2. Unificar 3 sistemas de imágenes
> `Image.tsx`, `common/Image.tsx`, `images/imageLoader.js`

- [ ] Analizar diferencias y funcionalidad de cada uno
- [ ] Elegir implementación canónica
- [ ] Migrar consumidores y eliminar los otros dos

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

### G3. Estandarizar uso de `React.FC` ✅
> ~13 archivos lo usan, otros no. Decidir convención.
> **Corrección del inventario:** no son ~13 sino **114 archivos** (125 usos),
> todos en `src/components`, `src/elements` y `src/apps/dashboard`.
> `src/apps/frontend` no lo usa ni una vez.

- [x] Decidir: **no se usa `React.FC`**. Se declara función normal y se tipan
      las props en el parámetro. No aporta nada (el retorno se infiere), fuerza
      un genérico, estorba en componentes genéricos y arrastra el `children`
      implícito que React 18 quitó.
- [x] Configurar regla de ESLint para enforcing —
      `@typescript-eslint/no-restricted-types` con mensaje propio: `error` en
      `src/apps/frontend` (ya limpio, así se blinda) y `warn` en el resto,
      donde quedan los 125 usos legacy. Documentado en `CONTRIBUTING.md`.
- [ ] Migrar los 125 usos legacy — pendiente, es una pasada mecánica aparte
      (encaja con E1/E2); la regla ya impide que crezca

> De paso: `eslint` intentaba parsear `docker-config/` (datos del servidor que
> escribe el docker-compose) y `bun run lint` fallaba entero con 14 errores de
> parseo. Añadido a los ignores; ahora la suite queda en **0 errores**.

### G4. Reducir uso de `any` (165+ apariciones)
- [ ] Auditar usos de `any` (priorizar código moderno)
- [ ] Reemplazar con tipos concretos o genéricos
- [ ] Configurar regla `no-explicit-any` como warning

### G5. Eliminar dependencias legacy innecesarias 🟡 (2 de 3 resueltas)
- [ ] `webcomponents.js` v0.7.24 — **no se puede quitar todavía: lo bloquea G1.**
      No es un polyfill "de más": los 18 `emby-*` están escritos contra Custom
      Elements **v0** (`document.registerElement`, `createdCallback`,
      `attachedCallback`), API que ningún navegador moderno implementa —
      Chrome la retiró en la v80. Quien la aporta es justamente
      `webcomponents-lite`. Quitarla hoy rompe el dashboard entero.
      **Orden correcto: G1 (reescribir los `emby-*`) → luego esta dependencia
      se cae sola.** Está importada en 16 archivos.
- [x] `@uupaa/dynamic-import-polyfill` — eliminada. Tenía un único uso
      (`viewContainer.js`, carga de controladores de plugin desde el servidor);
      se sustituye por `import()` nativo con `/* @vite-ignore */`, que resuelve
      al mismo namespace del módulo. Build de producción verificado.
- [x] `lodash-es` — **se queda.** Sí se usa: 10 importaciones en rutas
      importantes (`playbackmanager`, `globalize`, los tres temas, `backdrop`,
      `filterdialog`, `AppTabs`, `Lists`) de `merge`, `isEqual`, `isEmpty`,
      `debounce`, `union` y `groupBy`. Se importa hoja a hoja
      (`lodash-es/merge`), así que entra en el bundle solo lo usado.

### G6. Configurar Prettier ✅ (decisión: no)
> El formateo se delega a ESLint stylistic, sin Prettier.

- [x] Decidir: **se mantiene ESLint stylistic, no se añade Prettier**. Prettier
      reformatearía por encima de `@stylistic` y obligaría a desactivar media
      configuración (`eslint-config-prettier`) para que no se peleen, perdiendo
      el control fino ya afinado (ternarios multilínea, espaciado de genéricos).
      Un solo formateador = una sola fuente de verdad y un solo comando en CI.
- [x] Documentar la decisión — en la cabecera de `eslint.config.mjs` (con la
      receta por si se cambia de idea) y en `CONTRIBUTING.md`

---

## 🧪 Tests y cobertura

### H1. Aumentar cobertura en Dashboard
> Dashboard apenas tiene tests (solo utilidades).

- [ ] Añadir tests para rutas principales
- [ ] Añadir tests para features/users, features/playback, etc.

### H2. Tests para legacy code migrado
> Cada migración JS→TS debe incluir tests.

- [ ] Definir política: todo archivo migrado debe tener test
- [ ] Añadir umbral de cobertura en vitest config

### H3. Tests de integración para frontend
- [ ] Tests de navegación entre páginas
- [ ] Tests de flujo de reproducción
