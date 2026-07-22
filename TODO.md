# TODO: PWA + Material 3 Expressive solo para mobile/tablet

> **Estado (2026-07-22): las 8 fases están implementadas y committeadas** (un commit por fase, jj).
> 310+ tests, tsc/eslint/stylelint limpios, build de producción OK.
> Pendiente de verificación humana:
> - Verificación manual en PC y en dispositivo real (sección 8.2).
> - Lighthouse PWA/Mobile (8.3) — requiere navegador real contra el server.
> - Screenshots del manifest (2.3) — capturas reales cuando la UI esté validada.
> - Media Session prev/next — bloqueado por la falta de cola de reproducción.
> En dev el service worker exige opt-in: `localStorage.setItem('jfp-sw-dev', '1')`.

## ⚠️ Regla cardinal

**Desktop (`layout-desktop`) se queda EXACTAMENTE como está hoy.** Sin cambios de tema, sin navegación nueva, sin PWA, sin nada. Todo lo que sigue aplica ÚNICAMENTE cuando el dispositivo es móvil o tablet (`layout-mobile`, `layout-tablet`). El sistema de LayoutMode (`layoutManager.js`) ya pone estas clases en `<html>`.

---

## Visión

Cuando el usuario abre jellyfin-web en un **móvil o tablet**, se convierte en una **PWA instalable** con Material 3 Expressive (dark/light), navegación adaptativa, gestos táctiles y experiencia nativa-símil. En desktop no se entera de nada.

## Stack de diseño (solo mobile/tablet)

- **Material 3 Expressive tokens** — CSS custom properties inyectadas solo cuando `.layout-mobile` o `.layout-tablet` están activos
- **Dark + Light theme** — conmutable por el usuario, persiste en localStorage
- **MUI v6** como base de componentes con theme M3
- **Service Worker** — Workbox o manual, solo útil cuando la app está instalada (standalone)
- **Signals + MVVM** — arquitectura existente intacta

---

## Fase 1 — Sistema de tema Material 3 Expressive (scopeado a mobile/tablet)

### 1.1 M3 Design Tokens (solo bajo `.layout-mobile` / `.layout-tablet`)
- [x] Implementar `M3Theme` con todos los tokens: `primary`, `onPrimary`, `primaryContainer`, `secondary`, `tertiary`, `error`, `surface`, `surfaceVariant`, `outline`, etc.
- [x] `md-sys-color` light + dark palettes completas (basadas en `@material/material-color-utilities`)
- [x] `md-sys-elevation` — niveles 0–5
- [x] `md-sys-shape` — corner tokens
- [x] `md-sys-typescale` — 14 escalas tipográficas
- [x] CSS custom properties en selector `html.layout-mobile, html.layout-tablet` — **NUNCA** en `:root` global (para no contaminar desktop)

### 1.2 Temas dinámicos
- [x] `MobileThemeProvider` que aplica light u oscuro según preferencia del usuario + override manual
- [x] **Dynamic color**: extraer color acento del backdrop del hero / wallpaper
- [x] Persistencia en localStorage + sincronización con server
- [x] Transición suave entre temas
- [x] En desktop: el provider no hace nada, se sigue usando el tema dark actual

### 1.3 Migración del CSS existente en mobile
- [x] Los colores hardcodeados del `global.css` que afectan a mobile se reemplazan por `var(--md-sys-*)`
- [x] Los estilos de desktop (`.layout-desktop`) no se tocan

---

## Fase 2 — PWA: Service Worker y offline (solo standalone / mobile)

### 2.1 Service Worker
- [x] Registrar SW en entry point
- [x] **Precaching** de app shell
- [x] **Runtime caching**: `NetworkFirst` para API, `CacheFirst` para imágenes, `StaleWhileRevalidate` para assets
- [x] Offline fallback page
- [x] Network status indicator "Sin conexión"
- [x] NO register si está en desktop (`layout-desktop`) — solo en mobile/tablet

### 2.2 Instalación PWA
- [x] `beforeinstallprompt` → banner M3 de instalación (solo en mobile/tablet)
- [x] Detectar `display-mode: standalone` para ajustes de layout (notch, chin)

### 2.3 Manifest y meta
- [ ] Actualizar `manifest.json`: screenshots mobile + tablet — PENDIENTE: requieren capturas reales en dispositivo
- [x] `theme-color` dinámico

### 2.4 Media Session API
- [x] Integrar en VideoPlayerViewModel
- [x] Handlers: play, pause, seek/seekto (prev/next pendiente: el reproductor aún no tiene cola de episodios)

---

## Fase 3 — App Shell responsive (solo mobile/tablet)

En desktop: **sin cambios**. El `<AppLayout>` actual (que no tiene navegación) sigue igual.

### 3.1 Sistema de navegación adaptable (mobile/tablet)
- [x] **Bottom Navigation** (móvil < 600px): 4–5 tabs — Home, Buscar, Bibliotecas, Ajustes, Perfil
  - Icono + label, active indicator M3, safe-area-inset-bottom
- [x] **Navigation Rail** (tablet 600+px): rail vertical a la izquierda
  - Misma estructura que bottom nav pero en vertical
  - Transición entre bottom nav y rail al girar/resize (fade de montaje; sin morph geométrico)
- [x] **Desktop**: no se renderiza ni bottom nav ni rail. El layout sigue siendo el actual (sin navegación persistente)

### 3.2 Puntos de ruptura (solo afectan a mobile/tablet)
- `mobile-sm`: 0–399px
- `mobile-lg`: 400–599px  
- `tablet`: 600–1023px
- `desktop`: ≥1024px → NO se aplica ningún cambio

### 3.3 Transiciones de navegación (solo mobile/tablet)
- [x] Slide horizontal entre páginas
- [x] Swipe-back gesture
- [x] En desktop: animación fade actual se mantiene

### 3.4 Gestión de scroll
- [x] Scroll position restoration por tab en bottom nav (mobile/tablet)
- [x] Desktop: comportamiento actual sin cambios

---

## Fase 4 — Layout responsive de páginas (solo mobile/tablet)

En desktop: **todas las páginas se renderizan exactamente igual que hoy**.

### 4.1 Home
- [x] Hero mobile: 40vh, sin backdrop, poster + info, overlay gradiente corto
- [x] Hero tablet: 55vh, backdrop ligero
- [x] Grid de filas con scroll táctil horizontal
- [x] Márgenes: 12px mobile, 16px tablet
- [x] Tamaño tarjetas: 130px mobile, 160px tablet

### 4.2 Biblioteca / Grid
- [x] Grid responsive solo en mobile/tablet: `repeat(auto-fill, minmax(var(--card-w), 1fr))`
- [x] Skeleton loading con M3

### 4.3 Páginas de detalle
- [x] Single column en mobile (hoy es two-column)
- [x] Cast en horizontal scroll
- [x] Botones de acción → bottom sheet en mobile
- [x] Desktop: se conserva el layout two-column actual

### 4.4 Buscador
- [x] Search adaptado a página completa M3 (Buscar es destino de la bottom nav; un modal duplicaría la vía de acceso)
- [x] Barra expandible en tablet
- [x] Desktop: input de búsqueda actual

### 4.5 Settings / Profile (solo mobile/tablet)
- [x] Lista M3 con drill-down navigation
- [x] Desktop: se queda el layout actual de settings

---

## Fase 5 — Video player táctil (solo mobile/tablet)

En desktop: **el OSD actual sin gestos se mantiene exactamente igual** (funciona con mouse + teclado).

### 5.1 Gestos táctiles (solo mobile/tablet)
- [x] Swipe horizontal: seek con preview de tiempo (thumbnails reales requieren trickplay del servidor)
- [x] Swipe vertical izquierdo: brillo
- [x] Swipe vertical derecho: volumen
- [x] Doble tap izquierda: -10s / derecha: +10s
- [x] Tap: play/pause
- [x] Pinch zoom: aspect ratio
- [x] Desktop: estos gestos NO se activan (seguiría todo por mouse/keyboard como hoy)

### 5.2 OSD responsive (mobile/tablet)
- [x] Mobile landscape: controles compactos
- [x] Mobile portrait: botones esenciales, time grande
- [x] Overlay de hints de gestos en el primer uso

### 5.3 Mejoras de UX táctil
- [x] Lock screen controls
- [x] Sugerir landscape al reproducir
- [x] Swipe down para cerrar reproductor

---

## Fase 6 — Componentes con diseño M3 (solo mobile/tablet)

- [x] Cards con M3 shape + elevation (solo mobile/tablet)
- [x] FABs con M3 primary color
- [x] Bottom sheets para menús contextuales
- [x] Snackbar/toast M3
- [x] Desktop: componentes actuales sin cambios

---

## Fase 7 — Rendimiento táctil y animaciones (solo mobile/tablet)

- [x] M3 easing system
- [x] Ripple en botones
- [x] Shared axis transitions
- [x] Haptic feedback (`navigator.vibrate`)
- [x] `touch-action: manipulation` en botones
- [x] Desktop: animaciones actuales, sin ripple, sin haptic

---

## Fase 8 — Pulido y verificación

### 8.1 Testing
- [x] Tests: theme switching solo mobile, responsive breakpoints, touch gestures, PWA
- [x] Tests: desktop NO se ve afectado por nada

### 8.2 Verificación manual
- [ ] **Desktop**: abrir en PC → misma app de siempre. Sin cambios visuales, sin navegación extra, sin PWA
- [ ] **Mobile/tablet**: PWA instalable, bottom nav/rail, M3 theme, gestos táctiles
- [ ] **Transición**: al redimensionar de mobile a desktop, la app vuelve al layout original (hay test automatizado en desktopIntegrity.test.tsx; falta el ojo humano)

### 8.3 Rendimiento
- [ ] Lighthouse PWA: score 100 (solo mobile/tablet)
- [ ] Lighthouse Mobile: score > 90
- [ ] Desktop: sin regresión de rendimiento

---

## Resumen de impacto

| Aspecto | Desktop | Mobile / Tablet |
|---------|---------|----------------|
| Tema | Dark actual (sin cambios) | M3 Expressive light/dark |
| Navegación | Sin navegación persistente | Bottom nav / Rail |
| Layout | Two-column, full width | Single column, responsive |
| Video player | Mouse + teclado | Gestos táctiles + OSD responsive |
| PWA | No | Sí (instalable, offline, SW) |
| Service Worker | No se registra | Sí |
| Media Session | No | Sí |
| Material 3 | No | Sí (CSS vars scopeadas) |
