// Botón de emisión (Chromecast / AirPlay). Vive en la barra superior del
// reproductor, no en la fila de transporte: es una acción de "dónde se ve",
// no de reproducción, y abajo ocupaba sitio a los controles reales.
import globalize from 'lib/globalize';

import { useEffect } from 'react';
import { castVM } from '../../../domain/viewModels/CastViewModel';
import { videoPlayerVM } from '../../../domain/viewModels/VideoPlayerViewModel';
import { useSignalValue } from '../../../domain/bridge/useViewModel';
import { TICKS_PER_SECOND } from '../../../domain/player/format';
import { PlayerIc } from './playerIcons';

type Props = {
    /** Item en reproducción, para poder enviarlo al receptor Cast. */
    itemId: string;
};

export function CastButton({ itemId }: Props) {
    const castAvailable = useSignalValue(videoPlayerVM.castAvailable);
    const castState = useSignalValue(videoPlayerVM.castState);
    const gcastAvailable = useSignalValue(castVM.available);
    const gcastState = useSignalValue(castVM.state);

    // El SDK de Cast se carga bajo demanda al montar el reproductor: es un
    // script externo y no debe pesar en el arranque de la app.
    useEffect(() => { void castVM.init(); }, []);

    // Emitir = mandar el item al receptor y parar aquí; volver a pulsar
    // cierra la sesión y devuelve la reproducción a este navegador.
    const onCastClick = async () => {
        if (gcastState === 'connected') {
            await castVM.stopCasting();
            return;
        }
        await castVM.prompt();
        if (castVM.state.value !== 'connected') return;
        videoPlayerVM.pauseForCast();
        await castVM.playItem(
            itemId, Math.floor(videoPlayerVM.currentTime.value * TICKS_PER_SECOND)
        );
    };

    // Chromecast por el SDK de Google (receptor de Jellyfin) si hay
    // receptores; si no, la Remote Playback API del navegador, que cubre
    // AirPlay y el cast nativo de un <video> en directo. Visible mientras se
    // emite aunque la disponibilidad parpadee.
    if (gcastAvailable || gcastState === 'connected') {
        return (
            <button
                type='button'
                className={`jfp-video-btn${gcastState === 'connected' ? ' is-active' : ''}`}
                onClick={() => { void onCastClick(); }}
                aria-label={globalize.translate(
                    gcastState === 'connected' ? 'ButtonStopCasting' : 'ButtonCast'
                )}
            >
                <PlayerIc.Cast />
            </button>
        );
    }

    if (castAvailable || castState !== 'disconnected') {
        return (
            <button
                type='button'
                className={`jfp-video-btn${castState === 'connected' ? ' is-active' : ''}`}
                onClick={videoPlayerVM.promptCast}
                aria-label={globalize.translate(
                    castState === 'connected' ? 'ButtonChangeReceiver' : 'ButtonCast'
                )}
            >
                <PlayerIc.Cast />
            </button>
        );
    }

    return null;
}
