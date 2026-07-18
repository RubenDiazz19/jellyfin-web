# TODO: MVVM, limpieza y optimización de jellyfin-web

## Estrategia general

MVVM clásico con Signals:

```
data/    → Model  (API, sesión, stores, caché en memoria)
domain/viewModels/ → ViewModel (clase @observable, comandos, 0 imports de React)
presentation/ → View (componentes React, solo render + binding)
domain/bridge/  → Hooks puente (único lugar con React hooks)
```

Reglas:
- **ViewModel es una clase**, nunca un hook.
- **ViewModel no importa nada de React ni de presentation/**.
- **View no importa nada de data/** — solo ve ViewModels a través del bridge.
- **Bridge** es el único sitio con hooks (`useViewModel()` suscribe signals → React).
- **Signals** (`@preact/signals-core`) para reactividad: propiedades observables sin decoradores.

---

## Fase 0 — Instalar Signals y crear estructura MVVM

### 0.1 Instalar Signals

```bash
npm install @preact/signals-core @preact/signals-react
```

### 0.2 Crear estructura de directorios

```
src/apps/frontend/
├── data/           ← Model (ya existe)
│   ├── api/
│   ├── models/
│   ├── session/
│   └── stores/
├── domain/
│   ├── bridge/     ← NUEVO: hooks puente ViewModel ↔ React
│   │   └── useViewModel.ts
│   └── viewModels/ ← NUEVO: clases ViewModel (reemplaza domain/hooks/)
│       ├── HomeViewModel.ts
│       ├── ShowViewModel.ts
│       ├── MovieViewModel.ts
│       ├── SearchViewModel.ts
│       ├── LibraryViewModel.ts
│       └── VideoPlayerViewModel.ts
├── presentation/   ← View (ya existe)
│   ├── components/
│   ├── pages/
│   ├── styles/
│   └── theme/
└── app/            ← bootstrap
```

### 0.3 Crear el bridge

`domain/bridge/useViewModel.ts`:
```ts
import { useSyncExternalStore } from 'react';
import type { Signal } from '@preact/signals-core';

// El bridge convierte cualquier ViewModel con signals en estado React.
// useSyncExternalStore garantiza 0 re-renders innecesarios.
export function useViewModel<T extends Record<string, Signal<any>>>(
  vm: T
): { [K in keyof T]: T[K] extends Signal<infer V> ? V : never } {
  const snapshot = Object.fromEntries(
    Object.entries(vm).map(([key, signal]) => [key, signal.peek()])
  ) as any;

  return useSyncExternalStore(
    (onChange) => {
      const unsubs = Object.values(vm).map((s) =>
        s.subscribe(() => onChange())
      );
      return () => unsubs.forEach((u) => u());
    },
    () => {
      const next = Object.fromEntries(
        Object.entries(vm).map(([key, signal]) => [key, signal.value])
      ) as any;
      return next;
    }
  );
}

// Versión simple con @preact/signals-react:
export { useSignals } from '@preact/signals-react/runtime';
```

O usar directamente `useSignals()` de `@preact/signals-react` que auto-detecta accesos a `.value` en el render.

### 0.4 Crear ApiService (inyección de dependencias)

`data/api/ApiService.ts`:
```ts
// Servicio único que los ViewModels reciben por constructor.
// Centraliza: auth, fetch, session, imágenes, caché.
export class ApiService {
  constructor(
    public session: SessionService,
    public http: HttpClient,
    public cache: CacheService,
    public images: ImageService,
    public playback: PlaybackService
  ) {}
}
```

Esto permite:
- Testear ViewModels con mocks: `new HomeViewModel(mockApiService)`
- Cambiar implementación sin tocar ViewModels
- Un solo punto de importación desde data/

### 0.5 Escribir ViewModels como clases

```ts
// domain/viewModels/HomeViewModel.ts  ← 0 imports de React
import { signal } from '@preact/signals-core';
import type { ApiService } from '../../data/api/ApiService';
import type { CarouselSlide, Show } from '../../data/models';

export class HomeViewModel {
  slides = signal<CarouselSlide[]>([]);
  shows = signal<Show[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(private api: ApiService) {}

  async load() {
    this.loading.value = true;
    this.error.value = null;
    try {
      const [slides, shows] = await Promise.all([
        this.api.getHomeCarousel(),
        this.api.getShows(),
      ]);
      this.slides.value = slides;
      this.shows.value = shows;
    } catch (e) {
      this.error.value = (e as Error).message;
    } finally {
      this.loading.value = false;
    }
  }

  // Commands
  play = (itemId: string) => this.api.playback.play({ itemId });
  navigateToShow = (id: string) => this.api.router.navigate({ page: 'show', showId: id });
}
```

### 0.6 Refactorizar páginas (View)

```tsx
// presentation/pages/HomePage.tsx  ← solo render, sin lógica
import { useSignals } from '@preact/signals-react/runtime';
import { HomeViewModel } from '../../domain/viewModels/HomeViewModel';
import { apiService } from '../../data/api/ApiService';  // singleton o DI

const homeVM = new HomeViewModel(apiService); // o usar un hook de instanciación

export function HomePage({ navigate }: { navigate: Navigate }) {
  useSignals();  // auto-detecta accesos a .value y re-renderiza

  // mount effect
  useEffect(() => { homeVM.load(); }, []);

  if (homeVM.loading.value) return <Skeleton />;
  if (homeVM.error.value) return <Error msg={homeVM.error.value} />;

  return (
    <div>
      {homeVM.slides.value.map(s => <HeroSlide ... />)}
      {homeVM.shows.value.map(s => <PosterCard ... />)}
    </div>
  );
}
```

### 0.7 Lista completa de ViewModels a crear

- [ ] `domain/viewModels/HomeViewModel.ts` — carrusel, biblioteca, play
- [ ] `domain/viewModels/ShowViewModel.ts` — detalle de serie, temporadas, comando play
- [ ] `domain/viewModels/MovieViewModel.ts` — detalle de película, comando play
- [ ] `domain/viewModels/SearchViewModel.ts` — búsqueda, resultados
- [ ] `domain/viewModels/LibraryViewModel.ts` — listado de series/películas
- [ ] `domain/viewModels/VideoPlayerViewModel.ts` — reproductor (OSD)
- [ ] `domain/viewModels/LoginViewModel.ts` — login, sesión

Cada ViewModel:
- Es una clase con `constructor(private api: ApiService)`
- Props observables: `signal<T>` para estado que la View lee
- Métodos: `load()`, `refresh()`, `play()`, etc. — llaman a `this.api.*`
- NO importa React, NO importa de presentation/

### 0.8 Regla estricta de importación

Agregar a `eslint.config.mjs`:
```js
rules: {
    'import/no-restricted-paths': ['error', {
        zones: [
            { target: 'presentation', from: 'data', message: 'View no puede importar de data/. Usa domain/viewModels/.' },
            { target: 'domain/viewModels', from: 'presentation', message: 'ViewModel no puede importar de presentation/.' },
            { target: 'domain/viewModels', from: 'react', message: 'ViewModel no puede importar React. Usa signals.' },
        ]
    }]
}
```

### 0.9 Tests de ViewModels

- [ ] `domain/viewModels/__tests__/HomeViewModel.test.ts`
- [ ] `domain/viewModels/__tests__/ShowViewModel.test.ts`
- [ ] `domain/viewModels/__tests__/VideoPlayerViewModel.test.ts`

```ts
// Ejemplo de test (sin React, sin DOM):
test('HomeViewModel loads slides', async () => {
  const mockApi = { getHomeCarousel: vi.fn().mockResolvedValue([...]) };
  const vm = new HomeViewModel(mockApi as any);
  await vm.load();
  expect(vm.slides.value.length).toBeGreaterThan(0);
  expect(vm.loading.value).toBe(false);
});
```

---

## Fase 1 — Mover dependencias compartidas

Antes de borrar directorios legacy, extraer archivos que otros componentes necesitan.

### 1.1 Mover `DrawerHeaderLink` (usado por dashboard)

```
from: apps/modern/components/drawers/DrawerHeaderLink.tsx
  to: apps/dashboard/components/drawer/DrawerHeaderLink.tsx
```

Actualizar import en `apps/dashboard/components/drawer/AppDrawer.tsx`.

### 1.2 Mover constantes de playback (usadas por playbackmanager)

```
from: apps/legacy/features/playback/constants/playerEvent.ts
  to: components/playback/constants/playerEvent.ts

from: apps/legacy/features/playback/utils/mediaSegmentManager.ts
  to: components/playback/utils/mediaSegmentManager.ts

from: apps/legacy/features/playback/utils/mediaSessionSubscriber.ts
  to: components/playback/utils/mediaSessionSubscriber.ts
```

Actualizar imports en `components/playback/playbackmanager.js`.

---

## Fase 2 — Eliminar directorios completos

### 2.1 Apps completas

```
rm -rf src/apps/legacy/       ← reemplazado por frontend custom
rm -rf src/apps/modern/       ← reemplazado por frontend (DrawerHeaderLink ya movido)
rm -rf src/apps/wizard/       ← no se necesita
```

### 2.2 Web components

```
rm -rf src/elements/          ← emby-button, emby-slider, etc.
```

### 2.3 Plugins

```
rm -rf src/plugins/
```

### 2.4 Scripts globales legacy

```
rm -f src/scripts/autoThemes.js
rm -f src/scripts/screensavermanager.js
rm -f src/scripts/mouseManager.js
rm -f src/scripts/keyboardNavigation.js
```

### 2.5 Limpiar controllers

```
rm -rf src/apps/legacy/controllers/   ← controllers legacy ya borrados con apps/legacy
```

### 2.6 Estilos globales no usados

```
rm -f src/styles/livetv.scss
rm -f src/styles/detailtable.scss
rm -f src/styles/librarybrowser.scss
rm -f src/styles/ios.scss
rm -f src/styles/fonts.sized.scss
rm -f src/styles/fonts.noto.scss
```

---

## Fase 3 — Eliminar componentes no usados

### 3.1 Componentes de playback secundarios

No los necesita ni el frontend ni el dashboard:
```
rm -rf src/components/playback/playerSelectionMenu.js
rm -rf src/components/playback/remotecontrolautoplay.js
rm -rf src/components/playback/playbackorientation.js
rm -rf src/components/playback/volumeosd.js
rm -rf src/components/playback/brightnessosd.js
rm -rf src/components/playback/skipsegment.ts
rm -rf src/components/playback/displayMirrorManager.ts
```

### 3.2 Componentes UI legacy

```
rm -rf src/components/nowPlayingBar/
rm -rf src/components/actionSheet/
rm -rf src/components/dialogHelper/
rm -rf src/components/directorybrowser/
rm -rf src/components/favoriteitems.js
rm -rf src/components/imageDownloader/
rm -rf src/components/imageeditor/
rm -rf src/components/imageOptionsEditor/
rm -rf src/components/itemidentifier/
rm -rf src/components/libraryoptionseditor/
rm -rf src/components/lyricseditor/
rm -rf src/components/lyricsuploader/
rm -rf src/components/mediaLibraryCreator/
rm -rf src/components/mediaLibraryEditor/
rm -rf src/components/metadataEditor/
rm -rf src/components/multiSelect/
rm -rf src/components/playmenu.js
rm -rf src/components/playerstats/
rm -rf src/components/qualityOptions.js
rm -rf src/components/recordingcreator/
rm -rf src/components/refreshdialog/
rm -rf src/components/sanitizeFilename.js
rm -rf src/components/settingshelper.js
rm -rf src/components/shortcuts.js
rm -rf src/components/slideshow/
rm -rf src/components/sortmenu/
rm -rf src/components/subtitleeditor/
rm -rf src/components/subtitlesettings/
rm -rf src/components/subtitleuploader/
rm -rf src/components/subtitlesync/
rm -rf src/components/tabbedview/
rm -rf src/components/themeMediaPlayer.js
rm -rf src/components/tunerPicker.js
rm -rf src/components/tvproviders/
rm -rf src/components/upnextdialog/
rm -rf src/components/channelMapper/
rm -rf src/components/collectionEditor/
rm -rf src/components/displaySettings/
rm -rf src/components/homeScreenSettings/
rm -rf src/components/playbackSettings/
rm -rf src/components/remotecontrol/
rm -rf src/components/viewContainer.js
rm -rf src/components/viewSettings/
```

### 3.3 NO borrar (usados por frontend, dashboard, o playbackmanager)

```
components/AppBody.tsx               ← AppBody (puede que aún necesario)
components/AppHeader.tsx             ← dashboard RootAppLayout
components/Backdrop.tsx              ← RootAppLayout
components/backdrop/                 ← RootAppLayout
components/ConnectionRequired.tsx    ← dashboard
components/ConfirmDialog.tsx         ← dashboard
components/ListItemLink.tsx          ← dashboard drawer
components/OffsetAppBar.tsx          ← dashboard
components/Page.tsx                  ← dashboard
components/ResponsiveDrawer.tsx      ← dashboard
components/ServerContentPage.tsx     ← dashboard
components/ThemeCss.tsx              ← dashboard
components/dashboard/                ← dashboard
components/images/                   ← frontend cardbuilder
components/indicators/               ← frontend
components/loading/loading.ts        ← frontend + dashboard
components/router/                   ← dashboard (appRouter, LegacyRoute)
components/toolbar/                  ← dashboard
components/viewManager/ViewManagerPage.tsx  ← puede que dashboard lo necesite
components/cardbuilder/              ← frontend
components/listview/                 ← frontend
components/homesections/            ← frontend
components/itemDetails/             ← frontend
components/itemHelper.js            ← frontend
components/itemMediaInfo/           ← frontend
components/itemContextMenu.js       ← frontend
components/playback/playbackmanager.js   ← frontend (reproducción)
components/playback/playqueuemanager.js  ← playbackmanager
components/playback/playerinfo.js        ← verificar
components/alphaPicker/                  ← verificar si dashboard lo usa
```

---

## Fase 4 — Nuevo reproductor de vídeo en React (OSD simplificado)

### 4.1 Arquitectura del reproductor

```
VideoPlayerViewModel.ts  ← clase, 0 React, usa signals + ApiService
VideoPlayer.tsx          ← View, suscribe al ViewModel con useSignals()
VideoControls.tsx        ← sub-View: controles
VideoSettingsMenu.tsx    ← sub-View: menú audio/subs/calidad
```

Flujo:
1. ViewModel llama a `playbackManager.play()` para iniciar
2. ViewModel escucha eventos del player (timeupdate, pause, etc.)
3. ViewModel expone signals: `currentTime`, `duration`, `playing`, `volume`, etc.
4. View renderiza según signals y llama a comandos del ViewModel

### 4.2 ViewModel del reproductor

`domain/viewModels/VideoPlayerViewModel.ts`:
```ts
export class VideoPlayerViewModel {
  // Estado
  currentTime = signal(0);
  duration = signal(0);
  playing = signal(false);
  volume = signal(1);
  muted = signal(false);
  fullscreen = signal(false);
  audioTracks = signal<MediaStream[]>([]);
  subtitleTracks = signal<MediaStream[]>([]);
  selectedAudio = signal<string>('');
  selectedSubtitle = signal<string>('');
  buffering = signal(false);

  constructor(private api: ApiService) {}

  async play(itemId: string, startTicks?: number) {
    await this.api.playback.play({ itemId, startTicks });
  }

  stop() { this.api.playback.stop(); }
  togglePlay() { this.playing.value ? this.api.playback.pause() : this.api.playback.resume(); }
  seek(ticks: number) { this.api.playback.seek(ticks); }
  setVolume(v: number) { this.api.playback.setVolume(v); }
  toggleMute() { this.api.playback.setVolume(this.muted.value ? 1 : 0); }
  toggleFullscreen() { this.api.playback.toggleFullscreen(); }
  setAudioTrack(index: number) { this.api.playback.setAudioStreamIndex(index); }
  setSubtitleTrack(index: number) { this.api.playback.setSubtitleStreamIndex(index); }
}
```

### 4.3 Componentes del reproductor

Archivos bajo `src/apps/frontend/presentation/components/player/`:

- [ ] `VideoPlayerViewModel.ts` — ViewModel (ver 4.2)
- [ ] `VideoPlayer.tsx` — componente principal con `<div.videoContainer>` + overlay
- [ ] `VideoControls.tsx` — play/pause, seek bar, time display, fullscreen
- [ ] `VolumeSlider.tsx` — slider volumen + mute button
- [ ] `VideoSettingsMenu.tsx` — selector de pista audio/subtítulos/calidad

### 4.4 Funcionalidades del nuevo OSD

MVP:
- [ ] Play / Pause (barra espaciadora, click en botón)
- [ ] Seek bar (arrastrable + click en progreso)
- [ ] Tiempo actual / duración total
- [ ] Volumen (slider + mute, tecla M)
- [ ] Fullscreen (botón + tecla F, doble click)
- [ ] Selección de pista de audio
- [ ] Selección de pista de subtítulos
- [ ] Tecla Escape para salir del reproductor
- [ ] Auto-ocultar controles tras 3s de inactividad
- [ ] Mostrar controles al mover el ratón / tocar pantalla
- [ ] Loading spinner durante buffering

Post-MVP:
- [ ] "Up Next" / siguiente episodio automático
- [ ] Skip Intro / Skip Credits
- [ ] Estadísticas del player (bitrate, codec, resolución)
- [ ] Velocidad de reproducción (0.5x, 1x, 1.5x, 2x)
- [ ] Picture-in-Picture

### 4.5 Actualizar VideoRoute.tsx

`apps/frontend/app/VideoRoute.tsx`:
- [ ] Reemplazar import de `apps/modern/routes/video` por `VideoPlayer`
- [ ] Quitar dependencia de `components/AppBody`
- [ ] Pasear `itemId` y `startTicks` al ViewModel

### 4.6 CSS del reproductor

Agregar estilos a `presentation/styles/global.css`:
- [ ] `.jfp-video-controls` — barra de controles (posición absoluta, fade in/out)
- [ ] `.jfp-video-progress` — seek bar (arrastrable)
- [ ] `.jfp-video-volume` — slider volumen
- [ ] `.jfp-video-btn` — botones de control
- [ ] `.jfp-video-settings` — menú desplegable

---

## Fase 5 — Limpiar entry point (`src/index.jsx`)

### 5.1 Quitar imports de polyfills

```js
// ELIMINAR:
import 'lib/legacy';           // polyfills para IE11
```

### 5.2 Quitar auto-imports (antipatrón)

```js
// ELIMINAR:
import './components/playback/displayMirrorManager';
import './components/playback/playerSelectionMenu';
import './components/themeMediaPlayer';
import './scripts/autoThemes';
import './scripts/mouseManager';
import './scripts/screensavermanager';
```

### 5.3 Quitar CSS global no usado

```js
// ELIMINAR:
import './styles/livetv.scss';
import './styles/detailtable.scss';
import './styles/librarybrowser.scss';
```

### 5.4 Quitar funciones de inicialización legacy

- [ ] Eliminar `loadPlugins()` y su llamada
- [ ] Eliminar `loadPlatformFeatures()` y su llamada
- [ ] Eliminar `registerServiceWorker()` (re-implementar en frontend si se necesita)
- [ ] Eliminar `initializeServerConnections()` (WebSocket no usado por frontend)
- [ ] Eliminar `keyboardNavigation.enable()` / `autoFocuser.enable()`
- [ ] Eliminar handlers `pageClassOn('viewshow'/'viewhide', ...)`

### 5.5 Mantener

```js
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { appHost } from './components/apphost';
import loading from 'components/loading/loading';
import globalize from './lib/globalize';
import { loadCoreDictionary } from 'lib/globalize/loader';
import { appRouter } from './components/router/appRouter';
import Events from './utils/events';
import browser from './scripts/browser';
```

---

## Fase 6 — Limpiar `RootAppRouter.tsx`

- [ ] Quitar import de `WIZARD_APP_ROUTES`
- [ ] Quitar imports de `DASHBOARD_APP_PATHS`, `APP_ROUTES` de modern/legacy
- [ ] Mantener solo: `DASHBOARD_APP_ROUTES` + `FRONTEND_APP_ROUTES`

```tsx
const router = createHashRouter([
    {
        element: <RootAppLayout />,
        children: [
            ...DASHBOARD_APP_ROUTES,
            ...FRONTEND_APP_ROUTES,   // /video + /*
        ]
    }
]);
```

- [ ] Simplificar `RootAppLayout`: quitar `isDashboardPath`/`isWizardPath`, el `AppHeader` siempre visible

---

## Fase 7 — Limpiar `package.json`

### 7.1 Dependencias runtime a eliminar

```json
"jquery": "3.7.1",              // no usado en React
"jstree": "3.3.17",             // solo legacy
"webcomponents.js": "0.7.24",   // polyfill obsoleto
"headroom.js": "0.12.0",        // solo legacy header
"sortablejs": "1.15.7",         // solo legacy
"epubjs": "0.3.93",             // lector EPUB (no implementado)
"pdfjs-dist": "3.11.174",       // lector PDF (no implementado)
"material-design-icons-iconfont": "6.7.0",  // frontend usa SVG
"abortcontroller-polyfill": "1.7.8",
"classlist.js": "...",
"element-closest-polyfill": "1.0.7",
"fast-text-encoding": "1.0.6",
"intersection-observer": "0.12.2",
"native-promise-only": "0.8.1",
"proxy-polyfill": "0.3.2",
"resize-observer-polyfill": "1.5.1",
"whatwg-fetch": "3.6.20"
```

### 7.2 DevDependencies a eliminar

```json
"@uupaa/dynamic-import-polyfill": "1.0.2",
"speed-measure-webpack-plugin": "1.6.0",
"webpack-bundle-analyzer": "5.3.0",
"worker-loader": "3.0.8"
```

### 7.3 Dependencias a verificar

- `flv.js` / `hls.js` → si playbackmanager los importa dinámicamente, mantener
- `screenfull` → si playbackmanager lo usa, mantener; si no, usar Fullscreen API nativa
- `@fontsource/noto-sans*` → si frontend usa system fonts, eliminar
- `core-js` → babel lo necesita para transpilación, mantener
- `blurhash` / `react-blurhash` → si frontend usa blurhash en cards, mantener

### 7.4 Limpiar scripts de build

- [ ] Eliminar: `"build:analyze"`, `"serve:webpack"`, `"build:development"`, `"build:production"`, `"build:es-check"`, `"escheck"`
- [ ] Mantener: `"dev"`, `"start"`, `"build:check"`, `"lint"`, `"test"`, `"stylelint"`

---

## Fase 8 — Verificar y testear

### 8.1 TypeScript
```bash
npm run build:check
```

### 8.2 Lint
```bash
npm run lint
```

### 8.3 Tests unitarios (ViewModels)
```bash
npm test
```

### 8.4 Build
```bash
npm run build:production
```

### 8.5 Verificación manual

- [ ] Navegación completa: home → serie → temporada → episodio
- [ ] Búsqueda
- [ ] Reproducción: play, pausa, seek, volumen, fullscreen, audio/subs
- [ ] Dashboard: usuarios, plugins, librerías, tareas
- [ ] Login / logout / cambio de usuario
- [ ] Tema oscuro
- [ ] Responsive / móvil / TV

---

## Fase 9 — Limpiar archivos huérfanos (opcional)

```bash
npx ts-prune
```

Eliminar archivos sin referencias:
- `src/apiclient.d.ts`
- `src/global.d.ts`
- Constantes no usadas en `constants/`, `types/`

---

## Resumen de impacto

| Métrica | Antes | Después |
|---------|-------|---------|
| Directorios `apps/` | 5 (legacy, modern, dashboard, wizard, frontend) | 2 (dashboard, frontend) |
| Componentes en `components/` | ~107 | ~40-50 |
| Líneas de JS/TS eliminadas | — | ~15000-20000 |
| Líneas nuevas (MVVM + player) | — | ~800-1200 |
| Dependencias npm | ~75 | ~53-58 |
| ViewModels testeables sin React | 0 | ~6 |
| Archivos con React hooks | 50+ | ~10 (solo bridge + pages) |

---

## Notas importantes

- `apphost.js` y `pluginManager.js` → verificar si playbackmanager los necesita antes de borrar.
- `playbackManager` importa `apps/legacy/features/playback/` — mover esos archivos a `components/playback/` ANTES de borrar `apps/legacy/`.
- Dashboard importa `components/router/appRouter.js` — mantener mientras dashboard exista.
- Signals (`@preact/signals-core`) pesa ~1.9kB gzip. Signals-react ~1kB extra. Total <3kB.
- Los ViewModels se testean sin React, sin DOM, sin Jest/jsdom: `new ViewModel(mockApi).method()` → assert sobre `.value`.
