/// <reference types="vite/client" />

interface ImportMetaEnv {
    /**
     * Clave gratuita de TMDB para el selector de avatares (opcional). Es la
     * excepción a la regla del .env de este repo: por llevar el prefijo
     * VITE_ sí viaja al bundle del navegador — documentado en .env.example.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention -- nombre fijado por Vite (variables de entorno VITE_*)
    readonly VITE_TMDB_API_KEY?: string;
}
