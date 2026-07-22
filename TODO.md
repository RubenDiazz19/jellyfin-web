# TODO: PWA + Material 3 Expressive solo para mobile/tablet

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
- [ ] Implementar `M3Theme` con todos los tokens: `primary`, `onPrimary`, `primaryContainer`, `secondary`, `tertiary`, `error`, `surface`, `surfaceVariant`, `outline`, etc.
- [ ] `md-sys-color` light + dark palettes completas (basadas en `@material/material-color-utilities`)
- [ ] `md-sys-elevation` — niveles 0–5
- [ ] `md-sys-shape` — corner tokens
- [ ] `md-sys-typescale` — 14 escalas tipográficas
- [ ] CSS custom properties en selector `html.layout-mobile, html.layout-tablet` — **NUNCA** en `:root` global (para no contaminar desktop)

### 1.2 Temas dinámicos
- [ ] `MobileThemeProvider` que aplica light u oscuro según preferencia del usuario + override manual
- [ ] **Dynamic color**: extraer color acento del backdrop del hero / wallpaper
- [ ] Persistencia en localStorage + sincronización con server
- [ ] Transición suave entre temas
- [ ] En desktop: el provider no hace nada, se sigue usando el tema dark actual

### 1.3 Migración del CSS existente en mobile
- [ ] Los colores hardcodeados del `global.css` que afectan a mobile se reemplazan por `var(--md-sys-*)`
- [ ] Los estilos de desktop (`.layout-desktop`) no se tocan

---

## Fase 2 — PWA: Service Worker y offline (solo standalone / mobile)

### 2.1 Service Worker
- [ ] Registrar SW en entry point
- [ ] **Precaching** de app shell
- [ ] **Runtime caching**: `NetworkFirst` para API, `CacheFirst` para imágenes, `StaleWhileRevalidate` para assets
- [ ] Offline fallback page
- [ ] Network status indicator "Sin conexión"
- [ ] NO register si está en desktop (`layout-desktop`) — solo en mobile/tablet

### 2.2 Instalación PWA
- [ ] `beforeinstallprompt` → banner M3 de instalación (solo en mobile/tablet)
- [ ] Detectar `display-mode: standalone` para ajustes de layout (notch, chin)

### 2.3 Manifest y meta
- [ ] Actualizar `manifest.json`: screenshots mobile + tablet
- [ ] `theme-color` dinámico

### 2.4 Media Session API
- [ ] Integrar en VideoPlayerViewModel
- [ ] Handlers: play, pause, seek, prev/next

---

## Fase 3 — App Shell responsive (solo mobile/tablet)

En desktop: **sin cambios**. El `<AppLayout>` actual (que no tiene navegación) sigue igual.

### 3.1 Sistema de navegación adaptable (mobile/tablet)
- [ ] **Bottom Navigation** (móvil < 600px): 4–5 tabs — Home, Buscar, Bibliotecas, Ajustes, Perfil
  - Icono + label, active indicator M3, safe-area-inset-bottom
- [ ] **Navigation Rail** (tablet 600+px): rail vertical a la izquierda
  - Misma estructura que bottom nav pero en vertical
  - Transición suave entre bottom nav y rail al girar/resize
- [ ] **Desktop**: no se renderiza ni bottom nav ni rail. El layout sigue siendo el actual (sin navegación persistente)

### 3.2 Puntos de ruptura (solo afectan a mobile/tablet)
- `mobile-sm`: 0–399px
- `mobile-lg`: 400–599px  
- `tablet`: 600–1023px
- `desktop`: ≥1024px → NO se aplica ningún cambio

### 3.3 Transiciones de navegación (solo mobile/tablet)
- [ ] Slide horizontal entre páginas
- [ ] Swipe-back gesture
- [ ] En desktop: animación fade actual se mantiene

### 3.4 Gestión de scroll
- [ ] Scroll position restoration por tab en bottom nav (mobile/tablet)
- [ ] Desktop: comportamiento actual sin cambios

---

## Fase 4 — Layout responsive de páginas (solo mobile/tablet)

En desktop: **todas las páginas se renderizan exactamente igual que hoy**.

### 4.1 Home
- [ ] Hero mobile: 40vh, sin backdrop, poster + info, overlay gradiente corto
- [ ] Hero tablet: 55vh, backdrop ligero
- [ ] Grid de filas con scroll táctil horizontal
- [ ] Márgenes: 12px mobile, 16px tablet
- [ ] Tamaño tarjetas: 130px mobile, 160px tablet

### 4.2 Biblioteca / Grid
- [ ] Grid responsive solo en mobile/tablet: `repeat(auto-fill, minmax(var(--card-w), 1fr))`
- [ ] Skeleton loading con M3

### 4.3 Páginas de detalle
- [ ] Single column en mobile (hoy es two-column)
- [ ] Cast en horizontal scroll
- [ ] Botones de acción → bottom sheet en mobile
- [ ] Desktop: se conserva el layout two-column actual

### 4.4 Buscador
- [ ] Search como bottom sheet modal en mobile
- [ ] Barra expandible en tablet
- [ ] Desktop: input de búsqueda actual

### 4.5 Settings / Profile (solo mobile/tablet)
- [ ] Lista M3 con drill-down navigation
- [ ] Desktop: se queda el layout actual de settings

---

## Fase 5 — Video player táctil (solo mobile/tablet)

En desktop: **el OSD actual sin gestos se mantiene exactamente igual** (funciona con mouse + teclado).

### 5.1 Gestos táctiles (solo mobile/tablet)
- [ ] Swipe horizontal: seek con feedback de thumbnail
- [ ] Swipe vertical izquierdo: brillo
- [ ] Swipe vertical derecho: volumen
- [ ] Doble tap izquierda: -10s / derecha: +10s
- [ ] Tap: play/pause
- [ ] Pinch zoom: aspect ratio
- [ ] Desktop: estos gestos NO se activan (seguiría todo por mouse/keyboard como hoy)

### 5.2 OSD responsive (mobile/tablet)
- [ ] Mobile landscape: controles compactos
- [ ] Mobile portrait: botones esenciales, time grande
- [ ] Overlay de hints de gestos en el primer uso

### 5.3 Mejoras de UX táctil
- [ ] Lock screen controls
- [ ] Sugerir landscape al reproducir
- [ ] Swipe down para cerrar reproductor

---

## Fase 6 — Componentes con diseño M3 (solo mobile/tablet)

- [ ] Cards con M3 shape + elevation (solo mobile/tablet)
- [ ] FABs con M3 primary color
- [ ] Bottom sheets para menús contextuales
- [ ] Snackbar/toast M3
- [ ] Desktop: componentes actuales sin cambios

---

## Fase 7 — Rendimiento táctil y animaciones (solo mobile/tablet)

- [ ] M3 easing system
- [ ] Ripple en botones
- [ ] Shared axis transitions
- [ ] Haptic feedback (`navigator.vibrate`)
- [ ] `touch-action: manipulation` en botones
- [ ] Desktop: animaciones actuales, sin ripple, sin haptic

---

## Fase 8 — Pulido y verificación

### 8.1 Testing
- [ ] Tests: theme switching solo mobile, responsive breakpoints, touch gestures, PWA
- [ ] Tests: desktop NO se ve afectado por nada

### 8.2 Verificación manual
- [ ] **Desktop**: abrir en PC → misma app de siempre. Sin cambios visuales, sin navegación extra, sin PWA
- [ ] **Mobile/tablet**: PWA instalable, bottom nav/rail, M3 theme, gestos táctiles
- [ ] **Transición**: al redimensionar de mobile a desktop, la app vuelve al layout original

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
