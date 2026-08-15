# Etapa 1: build
#
# Las versiones van fijadas a propósito: con `:alpine` a secas, este mismo
# commit construido dentro de tres meses puede no dar el mismo resultado, y
# entonces «funcionaba antes» deja de ser una pista útil.
FROM oven/bun:1.3-alpine AS build
WORKDIR /app

# Las dependencias antes que el código: mientras no cambien package.json ni
# bun.lock, esta capa sale de caché y `bun install` no se repite.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
# El segundo paso deja los .br/.gz junto a cada fichero; los sirve Caddy con
# `precompressed` (ver Caddyfile) en vez de comprimir en cada petición.
RUN bun run build && bun run build:compress

# Etapa 2: servir con Caddy
FROM caddy:2.11-alpine
COPY --from=build /app/dist /usr/share/caddy
COPY config/docker/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80

# Compose no puede esperar a un contenedor que no dice si está listo, y este
# es el que reenvía al backend: sin esto, «arriba» solo significa «el proceso
# no se ha muerto».
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost/index.html || exit 1
