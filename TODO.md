# TODO — Frontend móvil/tablet (PWA)

Trabajo sobre el frontend propio (`src/apps/frontend/`), scopeado a
mobile/tablet salvo que se diga lo contrario. Regla cardinal que se respeta en
cada fase: **desktop no cambia byte a byte** (`desktopIntegrity.test.tsx` lo
vigila), los comentarios van en español y el cierre de cada fase es
`build:check`, `lint` y `test`.

---

# Pendiente — una decisión, no código

## El spec 2025 no se puede activar con la variante que usamos

`makeColorTokens` ya pide `specVersion: '2025'` (`M3_SPEC` en `m3.ts`), pero
**material-color-utilities lo ignora**: `DynamicScheme.maybeFallbackSpecVersion`
solo respeta el spec nuevo en `EXPRESSIVE`, `VIBRANT`, `TONAL_SPOT` y
`NEUTRAL`; `CONTENT` —la nuestra, la que hace que el color salga del póster—
cae en el `default` y vuelve a `'2021'`. Está fijado en `m3.test.ts` («el spec
2025 que se pide lo degrada la librería a 2021 en CONTENT»): el día que la
librería lo soporte, ese test falla y avisa.

Opciones, si se quiere el spec 2025 de verdad:

- **Dejarlo como está** (recomendado por ahora): la paleta sigue siendo la del
  contenido y el spec se activará solo cuando upstream valide CONTENT. Coste: 0.
- **Cambiar a `SchemeVibrant`** — una línea en `m3.ts`. Conserva el tono del
  póster (Batman sigue saliendo rojo) y sube el croma, así que el spec 2025 sí
  se aplica; a cambio el `primary-container` deja de ser exactamente el color
  extraído (`#93000b` en vez de `#b31217`).
- **`SchemeExpressive`**: descartado. Rota el tono del seed —un póster rojo da
  una interfaz azul— y rompe la premisa de «el color es el del contenido».

---

# Completado (verificado en el working tree)

## Fase 1 — M3 Expressive: spec 2025 ✅ (salvo la activación de arriba)

- **Spec version explícita**: `M3_SPEC = '2025'` se le pasa a `SchemeContent`
  en `makeColorTokens`, documentado y con test que fija el degradado a 2021.
- **Roles de color nuevos**: `COLOR_TOKENS` pasa de 37 a **53** con los 16 del
  update de 2025 — `primary/secondary/tertiary/error-dim` y la familia
  `*-fixed` (`fixed`, `fixed-dim`, `on-fixed`, `on-fixed-variant`). El conteo
  del test ya no es un literal: sale de `M3_COLOR_ROLE_COUNT`.
- **Typescale Expressive**: los 15 estilos *emphasized* se derivan de los
  baseline (mismo tamaño e interlineado, un escalón más de peso) y se emiten
  como `--md-sys-typescale-<rol>-emphasized-*`. Los baseline quedan intactos.
  Primer consumidor: el destino activo de la navegación.
- **Shape**: añadido `--md-sys-shape-corner-extra-large-top` (`28px 28px 0 0`)
  y usado en `BottomSheet.tsx`, que antes componía el shorthand a mano.
- **Tests**: `m3.test.ts` cubre roles dim/fixed (incluido que los `fixed` valen
  lo mismo en claro y oscuro), los 15 emphasized, el corner nuevo y la
  equivalencia `buildM3Css` ↔ `buildM3CssFromTokens`.

## Fase 2 — Optimización y limpieza ✅

- **Un solo cálculo de paleta**: nuevo `buildM3CssFromTokens(tokens, scheme,
  contrast)`; `buildM3Css` se queda como fachada. `MobileThemeProvider` deriva
  los 53 roles una vez con `useMemo` y los reparte entre el `<style>` de tokens
  y el `theme-color`. Antes eran dos derivaciones completas por cada rotación
  del carrusel.
- **Selector de seed manual en Ajustes**: fila de 8 muestras (una por zona del
  círculo de color) + «Automático» en `AppearanceSection`, con roles ARIA de
  radiogroup. Elegir una fija el color (`seedSource: 'manual'`) y **el dynamic
  color deja de pisarla**; «Automático» (`setSeed(null)`) devuelve el mando al
  póster. `seedSource` se persiste en `themeStore` y se infiere del server
  (una seed remota solo puede venir de una elección manual, porque las
  dinámicas nunca se suben). Claves nuevas en `en-us.json`/`es.json`.
- **Caché LRU en `dynamicColor`**: tope de 50 entradas aprovechando el orden de
  inserción del `Map` (un acierto reinserta la clave al final; se desaloja la
  primera). Test nuevo `dynamicColor.test.ts`.

## Fase 3 — Hero a pantalla completa en móvil/tablet ✅

`MobileHero.tsx` reescrito:

- El hero es la primera pantalla y ocupa todo el viewport
  (`--jfp-viewport-h`, `100svh`), como el carrusel de escritorio.
- Imagen sin recortes: **póster en móvil** (2:3, llena el alto) y **backdrop en
  tablet** (16:9); nunca un 16:9 estirado a cover en pantalla vertical.
- Orden respetado y sin superposiciones: logo/título → dato (T·E, año,
  restante) → play → puntos del carrusel, todo en columna con gap (los puntos
  ya no van en absoluto).
- Adaptativo: paddings que descuentan barra superior, píldora de navegación,
  rail y safe-areas; `min()`/`clamp()`; modo compacto bajo `max-height: 520px`
  para móvil tumbado.
- Test nuevo: `presentation/components/home/__tests__/MobileHero.test.tsx`.

## Fase 4 — Menús tipo píldora flotante con color del contenido ✅

- **`MobileNav.tsx`**: la nav deja el modo antiguo y es una píldora flotante
  (móvil: barra inferior separada 12px; tablet: rail vertical a la izquierda),
  radius full, elevación 3, `backdrop-filter` y superficie translúcida
  (`color-mix` con respaldo opaco).
- **Color del contenido**: `m3.ts` pasó de `SchemeTonalSpot` a `SchemeContent`
  (el esquema Material You pensado para seeds extraídas de imagen; el
  `primary-container` es el color extraído). El indicador activo de la nav usa
  ese token: póster rojo → superficies casi negras teñidas de rojo y píldora
  activa roja; póster verde → verde y negro.
- **`dynamicColor.ts`**: `normalizeSeed()` (croma mínimo 40, tono en la banda
  38–72, descarta imágenes casi neutras) para que `SchemeContent`, que usa el
  color fuente tal cual, no pinte una interfaz apagada con pósters oscuros y
  lavados.
- **`navMetrics.ts`**: centraliza la geometría de la píldora y publica
  `--jfp-nav-bottom` / `--jfp-nav-left` en `<html>`; `aboveNav()`/`besideNav()`
  recolocan todo lo `position: fixed` (snackbar, FAB, progreso de tareas,
  banner de instalación, selección, búsqueda, barra superior). Al desmontar
  borra las vars → desktop sin rastro.
- `desktopIntegrity.test.tsx` ampliado: verifica que las custom properties
  nuevas no existen en escritorio.
