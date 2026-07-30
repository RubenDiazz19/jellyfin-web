// Rutas que eslint no debe mirar nunca.

export default [
    {
        ignores: [
            'node_modules',
            // El reporte de cobertura se escribe dentro del root de Vite
            // (src/), no en la raíz del repo: hay que ignorar las dos rutas o
            // eslint acaba analizando el HTML/JS que genera Istanbul.
            'coverage',
            'src/coverage',
            'dist',
            '.idea',
            '.vscode',
            // Datos persistentes del docker-compose de desarrollo (config del
            // servidor, caché y biblioteca). Están en .gitignore, pero eslint
            // no lo lee: sin esto intenta parsear los .js que el propio
            // Jellyfin escribe ahí y `bun run lint` falla entero.
            'docker-config',
            'docker-cache',
            'docker-media'
        ]
    }
];
