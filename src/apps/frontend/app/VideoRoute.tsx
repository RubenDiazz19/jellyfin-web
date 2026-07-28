import { useCallback, useEffect } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import loading from 'components/loading/loading';

import { queueVM, type QueueEntry } from '../domain/viewModels/QueueViewModel';
import { videoPlayerVM } from '../domain/viewModels/VideoPlayerViewModel';
import { VideoPlayer } from '../presentation/components/player/VideoPlayer';
import { initAdaptiveLayout } from '../shared/adaptiveLayout';
// Si el usuario entra directo a /video (F5 o URL directa) esta ruta se monta
// sin pasar por AppLayout — importar aquí garantiza que los estilos del
// reproductor estén cargados sin depender del orden de navegación.
import '../presentation/styles/global.css';

// Ruta /video?item=<id>&start=<ticks>&title=<texto>. Monta el reproductor
// propio (VideoPlayerViewModel + OSD React); al salir vuelve a la página
// anterior del historial.
export const Component = () => {
    const [params] = useSearchParams();
    const navigate = useNavigate();

    const itemId = params.get('item') ?? '';
    const startTicks = Number(params.get('start') ?? '0') || undefined;
    const title = params.get('title') ?? undefined;

    // Reproducir otra entrada = cambiar los parámetros de esta misma ruta.
    // `replace` para que el botón atrás no recorra toda la cola reproducida.
    const playEntry = useCallback((entry: QueueEntry) => {
        const q = new URLSearchParams({ item: entry.itemId });
        if (entry.title) q.set('title', entry.title);
        navigate(`/video?${q.toString()}`, { replace: true });
    }, [navigate]);

    useEffect(() => {
        // `jf-video-active` desactiva el scrollbar del navegador y neutraliza
        // el backdrop del RootAppRouter; `loading.hide()` quita el splash del
        // bootstrap si se entra directo a /video.
        document.body.classList.add('jf-video-active');
        loading.hide();
        // El layout táctil se deriva del viewport (los gestos del reproductor
        // dependen de layout-mobile/tablet); imprescindible si se entra
        // directo a /video sin pasar por AppLayout.
        initAdaptiveLayout();
        return () => document.body.classList.remove('jf-video-active');
    }, []);

    const onClose = useCallback(() => {
        // idx > 0 ⇒ hay una entrada previa de la propia app en el historial.
        if (window.history.state?.idx > 0) navigate(-1);
        else navigate('/', { replace: true });
    }, [navigate]);

    // Auto-avance: al terminar manda la cola; si está vacía, el siguiente
    // episodio de la serie (el que anuncia el aviso de los créditos). Sin
    // nada de eso, se sale. Vive aquí y no en el ViewModel porque implica
    // navegar (regla MVVM).
    const onEnded = useCallback(() => {
        const queued = queueVM.takeNext();
        if (queued) {
            playEntry(queued);
            return;
        }
        const next = videoPlayerVM.nextEpisode.peek();
        if (next) playEntry({ itemId: next.id, title: next.title });
        else onClose();
    }, [onClose, playEntry]);

    if (!itemId) return <Navigate to='/' replace />;

    return (
        <VideoPlayer
            itemId={itemId}
            startTicks={startTicks}
            title={title}
            onClose={onClose}
            onEnded={onEnded}
            onPlayQueued={playEntry}
        />
    );
};

export default Component;
