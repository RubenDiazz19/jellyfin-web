import { useEffect, type MutableRefObject } from 'react';
import { videoPlayerVM } from '../../../domain/viewModels/VideoPlayerViewModel';
import { applyCueLine, applySubtitleAppearance, getSubtitleAppearance } from '../../../domain/player/subtitleStyle';
import { subtitleTrackMode } from '../../../domain/player/format';

type Params = {
    subtitleUrl: string | null;
    subtitleTrackRef: MutableRefObject<{ track: TextTrack } | null>;
    videoRef: MutableRefObject<HTMLVideoElement | null>;
};

export function usePlayerSettings({ subtitleUrl, subtitleTrackRef, videoRef }: Params) {
    // Aplica el modo de los text tracks cuando cambia el subtítulo activo:
    // solo se muestra la pista de la selección actual. El <track> anterior
    // no se desmonta al instante (el remount por key es asíncrono), así que
    // sin esto sus cues quedan "showing" y se pintan superpuestas a las
    // nuevas.
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const active = subtitleUrl ? subtitleTrackRef.current?.track ?? null : null;
        for (const track of Array.from(video.textTracks)) {
            track.mode = subtitleTrackMode(subtitleUrl, active, track);
        }
    }, [subtitleUrl, subtitleTrackRef, videoRef]);

    // Cómo se ven los subtítulos (tamaño, tipografía, color, altura).
    //
    // Se aplica al abrir el reproductor y cada vez que Ajustes lo cambia, que
    // es lo que avisa por `jfp-subtitle-appearance`: así se puede tener el
    // vídeo puesto en una pestaña y ver el efecto de cada cambio al momento,
    // sin reabrir nada.
    useEffect(() => {
        const apply = () => {
            const appearance = getSubtitleAppearance();
            applySubtitleAppearance(appearance);
            applyCueLine(subtitleTrackRef.current?.track?.cues ?? null, appearance.verticalPosition);
        };
        apply();
        window.addEventListener('jfp-subtitle-appearance', apply);
        return () => window.removeEventListener('jfp-subtitle-appearance', apply);
    }, [subtitleUrl, subtitleTrackRef]);

    // Longitud de los saltos y formato del reloj: lo mismo, desde Ajustes.
    useEffect(() => {
        const apply = videoPlayerVM.reloadPlaybackPrefs;
        apply();
        window.addEventListener('jfp-playback-prefs', apply);
        return () => window.removeEventListener('jfp-playback-prefs', apply);
    }, []);
}
