# AGENTS.md

Contexto para herramientas de IA que trabajen en este repo. Lo que sigue son las
convenciones que **ya están en el código**, no aspiraciones; donde ESLint las
vigila, se dice explícitamente.

## Qué es esto

Un fork de `jellyfin-web`. Sobre el cliente oficial se ha construido un frontend
propio, y conviven dos mundos:

| Zona | Qué es | Estado |
|---|---|---|
| `src/apps/frontend/` | El frontend propio: React + TypeScript con MVVM estricto | Donde se trabaja |
| `src/apps/dashboard/` | El panel de administración oficial | Se conserva tal cual |
| `src/legacy/components/`, `src/legacy/scripts/`, `src/legacy/elements/`, `src/legacy/lib/` | Legacy del cliente oficial (web components `emby-*`, `.template.html`, JS imperativo) | Se toca solo lo necesario |

El reproductor de vídeo es propio (`presentation/components/player/` +
`domain/viewModels/VideoPlayerViewModel.ts`), no el del cliente oficial.

## Comandos

```bash
bun start           # dev server con HMR en :8080
bun run build       # build de producción (Vite/Rollup) a dist/
bun run build:check # tsc --noEmit  ← el typecheck, no lo hace el build
bun run lint        # eslint
bun run test        # vitest, una pasada
bun run build:analyze  # treemap de los chunks en bundle-stats.html
```

Se usa **bun**, no npm ni yarn (`package.json` lo declara en `engines`).

Antes de dar algo por terminado: `bun run build:check`, `bun run lint` y
`bun run test`. El build **no** typechequea (Vite transpila sin comprobar
tipos), así que un `tsc` limpio no es opcional.

## Arquitectura del frontend propio

Tres capas, con la dirección de las dependencias forzada por
`import/no-restricted-paths`:

```
presentation/  (Views: React, JSX, estilos)
      ↓ solo puede importar de domain/
domain/        (ViewModels: estado y lógica, con @preact/signals-core)
      ↓ solo puede importar de data/
data/          (API, sesión, persistencia, modelos)
```

Estas cuatro **fallan** el lint (`error`):

- **`presentation/` no puede importar de `data/`.** Pasa por `domain/viewModels/`
  o por las fachadas de `domain/`.
- **`domain/viewModels/` no puede importar `react` ni `react-dom`** — ni el
  router. El estado se publica con **signals**, y la View se suscribe con
  `useVmSignals`. Un ViewModel que necesite navegar recibe un callback.
- **`data/` no puede importar de `presentation/`.**
- **Nada de `console.log`.** Usa el nivel que corresponda: `debug` para traza de
  desarrollo (el navegador la oculta por defecto), `warn` para algo raro pero
  recuperable, `error` para un fallo de verdad.

Y esta **avisa** (`warn`), pero se respeta en el código nuevo:

- **Nada de `React.FC`.** Componentes como función normal, props tipadas en el
  parámetro: `function Foo({ a }: Props)`.

## Estilo

- **Idiomas, tal como está el repo**: los identificadores, en inglés. Los
  comentarios del frontend propio, **en español** (153 de sus 197 ficheros); el
  legacy heredado los conserva en inglés (solo 8 de 133 en español), así que
  sigue el idioma del fichero que estés tocando. Los mensajes de commit, en
  español.
- Los comentarios explican **por qué**, no qué hace la línea: si se puede
  deducir del código de al lado, sobra. Los que hay documentan decisiones y
  trampas encontradas a base de depurar — no los borres al refactorizar,
  actualízalos.
- Los textos de interfaz van por `globalize.translate('Clave')`, con la clave
  dada de alta en `src/strings/en-us.json` y `src/strings/es.json`. No hay regla
  de lint que lo vigile, pero es lo que hace todo el código: un literal en la UI
  se nota.
- 4 espacios, comillas simples, punto y coma. Lo impone ESLint.

## Tests

Vitest con jsdom. Los tests van en `__tests__/` junto a lo que prueban.

El umbral global de cobertura es bajo a propósito (5% de líneas) porque cubre
todo el legacy heredado; `src/apps/frontend/**` tiene el suyo, más alto. Al
tocar el frontend propio, añade tests.

Hay dos suites que son redes de seguridad y conviene entender antes de pelearse
con ellas:

- `apps/frontend/__tests__/desktopIntegrity.test.tsx` — que la maquinaria de
  mobile (tokens M3, nav, `theme-color`) **no se filtre a desktop**. Si falla,
  probablemente el bug es tuyo, no del test.
- `apps/frontend/__tests__/playbackFlow.test.tsx` — la costura entre "reproduce
  esto" y el reproductor, que solo se tocan por la URL. Lanza dos
  `Uncaught Exception` del `playbackmanager` legacy bajo jsdom: son
  preexistentes y no rompen la suite.

## Entorno de desarrollo

El backend es un Jellyfin en Docker (`docker compose up -d jellyfin-backend`,
API en `:8096`). Para el frontend basta `bun start`: **no hace falta reconstruir
la imagen** para ver un cambio.

Detalle que confunde: el frontend habla con el servidor por **URL absoluta**, la
que se guardó al iniciar sesión. Si esa URL es `http://localhost:8080` (el propio
dev server, el caso de quien venía usando el contenedor), toda la API sale contra
él y depende del `server.proxy` de `vite.config.ts`. Consecuencia al depurar: una
ruta que no empareje con ese proxy **no da 404, sino un 200 con el index.html**
— el síntoma es recibir HTML donde se esperaba JSON. El backend admite CORS desde
cualquier origen, así que apuntar el login directamente a `:8096` evita el proxy.

## Trampas conocidas

- **Los controladores legacy no recargan con HMR.** Editar
  `apps/dashboard/controllers` no surte efecto sin recargar la página entera: los
  handlers se enlazan una sola vez al montar.
- **Jellyfin genera algunas de sus URLs en minúscula** (el `TranscodingUrl` de
  PlaybackInfo es `/videos/{id}/master.m3u8`), mientras las que construye esta app
  van en PascalCase. Cualquier cosa que empareje rutas tiene que aceptar las dos.
- **Ojo con los tamaños de `node_modules`.** `du` cuenta documentación y demos:
  varias dependencias "enormes" publican unos pocos KB. Mide con
  `bun run build:analyze`.
