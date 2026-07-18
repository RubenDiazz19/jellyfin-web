import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

type PlayRequest = { itemId: string; title?: string; startTicks?: number };

type PlayerContextValue = {
    play: (req: PlayRequest) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

// play() navega a la ruta /video del reproductor propio. Toda la mecánica de
// reproducción (PlaybackInfo, HLS, subtítulos, reporting) vive en
// VideoPlayerViewModel; aquí solo se construye la URL.
export function PlayerProvider({ children }: { children: ReactNode }) {
    const navigate = useNavigate();
    const play = useCallback((req: PlayRequest) => {
        if (!req.itemId) return;
        const q = new URLSearchParams({ item: req.itemId });
        if (req.startTicks) q.set('start', String(Math.floor(req.startTicks)));
        if (req.title) q.set('title', req.title);
        navigate(`/video?${q.toString()}`);
    }, [navigate]);
    const value = useMemo(() => ({ play }), [play]);
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
