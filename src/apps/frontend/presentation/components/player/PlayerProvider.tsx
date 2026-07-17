import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { playbackManager } from 'components/playback/playbackmanager';
import { ServerConnections } from 'lib/jellyfin-apiclient';

type PlayRequest = { itemId: string; title?: string; startTicks?: number };

type PlayerContextValue = {
    play: (req: PlayRequest) => void;
    close: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

// Delega toda la reproducción en el playbackManager oficial. El overlay del
// vídeo (videoosd) lo monta el propio jellyfin-web al navegar a #!/video, así
// que aquí sólo lanzamos la orden y dejamos que el router del app raíz haga
// el resto.
export function PlayerProvider({ children }: { children: ReactNode }) {
    const play = useCallback(async (req: PlayRequest) => {
        const apiClient = ServerConnections.currentApiClient?.();
        const serverId = apiClient?.serverId?.();
        if (!serverId) return;
        try {
            await playbackManager.play({
                ids: [req.itemId],
                serverId,
                startPositionTicks: req.startTicks,
                autoplay: true
            });
        } catch (err) {
            console.error('[frontend] playbackManager.play failed', err);
        }
    }, []);
    const close = useCallback(() => {
        try {
            playbackManager.stop();
        } catch {
            // stop() lanza si no hay playback activo; lo ignoramos.
        }
    }, []);
    return (
        <PlayerContext.Provider value={{ play, close }}>
            {children}
        </PlayerContext.Provider>
    );
}

export function usePlayer(): PlayerContextValue {
    const ctx = useContext(PlayerContext);
    if (!ctx) throw new Error('usePlayer must be used inside <PlayerProvider>');
    return ctx;
}
