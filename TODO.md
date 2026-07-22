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

### A1. Permitir zoom en viewport
> `src/index.html` — Reemplazar `user-scalable=no, maximum-scale=1` por `maximum-scale=5`.

- [ ] Editar viewport meta tag
- [ ] Verificar que no hay regresiones de layout
- [ ] Probar en dispositivo real

### A2. Soporte `prefers-reduced-motion`
- [ ] Añadir regla CSS global para `@media (prefers-reduced-motion: reduce)`
- [ ] Verificar que keyframes existentes se respetan

### A3. Soporte `prefers-contrast`
- [ ] Leer `prefers-contrast: more` en el theme provider
- [ ] Ajustar `contrastLevel` en `SchemeTonalSpot` en `m3.ts`
- [ ] Probar cambio entre modos

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

### E4. Unificar lockfiles (bun vs npm)
> Conviven `bun.lock` y `package-lock.json`.

- [ ] Decidir gestor definitivo (bun recomendado por ser más rápido)
- [ ] Eliminar lockfile redundante
- [ ] Actualizar CI/CD y docs si es necesario

---

## 🟠 Prioridad Media — UX e Interacción

### B1. Swipe-down para cerrar BottomSheet
- [ ] Añadir event listeners táctiles en BottomSheet
- [ ] Animar seguimiento del arrastre
- [ ] Dismiss al superar threshold vertical
- [ ] Compatibilidad con scroll interior

### B2. Swipe-to-dismiss en toasts mobile
- [ ] Añadir swipe gesture horizontal al toast
- [ ] Animar salida y dismiss

### B3. Extender `touch-action: manipulation`
> Actualmente solo en botones.

- [ ] Revisar sliders, listas, tarjetas clickeables
- [ ] Añadir bajo `html.layout-mobile` / `html.layout-tablet`

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

### G3. Estandarizar uso de `React.FC`
> ~13 archivos lo usan, otros no. Decidir convención.

- [ ] Decidir si se usa o no `React.FC`
- [ ] Configurar regla de ESLint para enforcing

### G4. Reducir uso de `any` (165+ apariciones)
- [ ] Auditar usos de `any` (priorizar código moderno)
- [ ] Reemplazar con tipos concretos o genéricos
- [ ] Configurar regla `no-explicit-any` como warning

### G5. Eliminar dependencias legacy innecesarias
- [ ] `webcomponents.js` v0.7.24 (prehistorico, v1 salió en 2016)
- [ ] `@uupaa/dynamic-import-polyfill`
- [ ] `lodash-es` si no se usa extensivamente

### G6. Configurar Prettier
> El formateo se delega a ESLint stylistic, sin Prettier.

- [ ] Decidir si añadir Prettier o mantener ESLint stylistic
- [ ] En cualquier caso, documentar la decisión

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
