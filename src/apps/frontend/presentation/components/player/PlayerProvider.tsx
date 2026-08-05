import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { prewarmPlayback } from '../../../domain/api';

type PlayRequest = { itemId: string; title?: string; startTicks?: number };

type PlayerContextValue = {
    play: (req: PlayRequest) => void;
    /**
     * Adelanta la negociación de un item que el usuario está a punto de
     * reproducir (el puntero sobre su botón de Play, el foco en él). Es
     * opcional por completo: no reproduce, no navega y si falla no se entera
     * nadie. Ver `prewarmPlayback`.
     */
    prewarm: (itemId: string) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

// play() navega a la ruta /video del reproductor propio. Toda la mecánica de
// reproducción (PlaybackInfo, HLS, subtítulos, reporting) vive en
// VideoPlayerViewModel; aquí solo se construye la URL y se le da al servidor
// la ventaja de saberlo antes que el reproductor.
export function PlayerProvider({ children }: { children: ReactNode }) {
    const navigate = useNavigate();
    const play = useCallback((req: PlayRequest) => {
        if (!req.itemId) return;
        // Antes de navegar: montar la ruta del reproductor, cargar hls.js y
        // enganchar el <video> son unos cuantos cientos de milisegundos en los
        // que el servidor puede ir negociando y levantando el transcode. Aquí
        // la reproducción ya es segura, así que se calienta también el
        // manifiesto.
        void prewarmPlayback(req.itemId, { manifest: true });
        const q = new URLSearchParams({ item: req.itemId });
        if (req.startTicks) q.set('start', String(Math.floor(req.startTicks)));
        if (req.title) q.set('title', req.title);
        navigate(`/video?${q.toString()}`);
    }, [navigate]);
    // Sin manifiesto: pasar el ratón por encima no es reproducir, y arrancar
    // un transcode por cada botón que se roza sale caro en el servidor.
    const prewarm = useCallback((itemId: string) => {
        void prewarmPlayback(itemId);
    }, []);
    const value = useMemo(() => ({ play, prewarm }), [play, prewarm]);
    return (
        <PlayerContext.Provider value={value}>
            {children}
        </PlayerContext.Provider>
    );
}

export function usePlayer(): PlayerContextValue {
    const ctx = useContext(PlayerContext);
    if (!ctx) throw new Error('usePlayer must be used inside <PlayerProvider>');
    return ctx;
}
