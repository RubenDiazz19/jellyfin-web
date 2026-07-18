import { useCallback, useEffect } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import loading from 'components/loading/loading';

import { VideoPlayer } from '../presentation/components/player/VideoPlayer';
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

    useEffect(() => {
        // `jf-video-active` desactiva el scrollbar del navegador y neutraliza
        // el backdrop del RootAppRouter; `loading.hide()` quita el splash del
        // bootstrap si se entra directo a /video.
        document.body.classList.add('jf-video-active');
        loading.hide();
        return () => document.body.classList.remove('jf-video-active');
    }, []);

    const onClose = useCallback(() => {
        // idx > 0 ⇒ hay una entrada previa de la propia app en el historial.
        if (window.history.state?.idx > 0) navigate(-1);
        else navigate('/', { replace: true });
    }, [navigate]);

    if (!itemId) return <Navigate to='/' replace />;

    return (
        <VideoPlayer
            itemId={itemId}
            startTicks={startTicks}
            title={title}
            onClose={onClose}
        />
    );
};

export default Component;
