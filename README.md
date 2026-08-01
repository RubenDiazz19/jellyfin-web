<h1 align="center">Jellyfin Web — fork personal</h1>

<p align="center">
Frontend custom de Jellyfin: UI/UX rehecha, reproductor propio y una capa de organización personal sobre la biblioteca.
</p>

<p align="center">
<a href="https://github.com/jellyfin/jellyfin-web"><img alt="Basado en" src="https://img.shields.io/badge/basado%20en-jellyfin--web-00A4DC"></a>
<img alt="Stack" src="https://img.shields.io/badge/stack-Bun%20%2B%20Vite%20%2B%20React-black">
<img alt="Licencia" src="https://img.shields.io/badge/licencia-GPL--2.0--or--later-blue">
</p>

---

## ¿Qué es esto?

Fork de [jellyfin-web](https://github.com/jellyfin/jellyfin-web) con un frontend propio
construido encima, enfocado en experiencia visual y funcional:

- **Fichas completas** de película y serie, con hero usando imágenes reales del servidor.
- **Reproductor integrado**, con menú contextual y ajustes funcionales contra la API real.
- **Organización personal de la biblioteca**: tags (sincronizados con el servidor), orden
  configurable, multiselección en lote y vistas guardadas.
- Múltiples optimizaciones de rendimiento sobre la carga y navegación.

El dashboard de administración oficial se conserva embebido en la misma SPA; el frontend
custom vive en `src/apps/frontend`.

## Stack

- **Runtime**: Bun + Node.js
- **Gestor de paquetes**: **Bun** (`bun.lock`) — es el único; no hay
  `package-lock.json` y `npm`/`yarn` están bloqueados en `engines` para que no
  se cuelen lockfiles paralelos. El CI instala con `bun install --frozen-lockfile`.
- **Build**: Vite (dev y producción)
- **UI**: React + React Router + CSS Modules

## Desarrollo local

```sh
bun install
bun start
```

Por defecto el dev server (`:8080`) apunta contra `http://localhost:8096` como backend.
Para cambiarlo, copia `.env.example` a `.env` y ajusta `JELLYFIN_SERVER` (ver comentarios
del propio fichero para más detalle, incluida la configuración opcional del etiquetado
automático vía LLM).

Build de producción:

```sh
bun run build
```

Comprobaciones (las mismas que corre el CI):

```sh
bun run lint && bun run stylelint && bun run build:check && bun run test:coverage
```

## Despliegue

`docker-compose.yml` levanta el frontend (build de este repo) junto al backend oficial
([jellyfin/jellyfin](https://github.com/jellyfin/jellyfin)):

```sh
docker compose up -d
```

Sirve el frontend en `:8080` y el backend en `:8096`. Los datos persistentes del backend
(config, caché, biblioteca) quedan en `docker-config/`, `docker-cache/` y `docker-media/`,
ignorados por git.

## Licencia

GPL-2.0-or-later, heredada de [jellyfin/jellyfin-web](https://github.com/jellyfin/jellyfin-web).
