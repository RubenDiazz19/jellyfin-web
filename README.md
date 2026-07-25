<h1 align="center">Jellyfin Web — fork personal</h1>

<p align="center">
Frontend custom de Jellyfin con mejoras en UI/UX, reproductor, fichas y rendimiento.
</p>

---

## ¿Qué es esto?

Este es un fork de [jellyfin-web](https://github.com/jellyfin/jellyfin-web) con modificaciones
enfocadas en mejorar la experiencia visual y funcional: hero con imágenes reales del servidor,
fichas de película completas, menú contextual funcional, ajustes contra la API real,
reproductor integrado, y múltiples optimizaciones de rendimiento.

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

Build de producción:

```sh
bun run build
```

Comprobaciones (las mismas que corre el CI):

```sh
bun run lint && bun run stylelint && bun run build:check && bun run test
```

## Despliegue

> Pendiente: docker-compose que integre este frontend con el backend oficial
> ([jellyfin/jellyfin](https://github.com/jellyfin/jellyfin)) para levantar todo
> junto con un solo comando.
