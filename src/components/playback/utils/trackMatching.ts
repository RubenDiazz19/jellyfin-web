import type { MediaSourceInfo } from '@jellyfin/sdk/lib/generated-client/models/media-source-info';
import type { MediaStream } from '@jellyfin/sdk/lib/generated-client/models/media-stream';

/**
 * Continuidad de pistas entre items.
 *
 * Al pasar de un episodio al siguiente, el usuario espera seguir oyendo el
 * mismo idioma y viendo los mismos subtítulos. Los índices no sirven —cada
 * fichero ordena sus pistas como quiere—, así que se busca en el item nuevo la
 * pista que más se parece a la que estaba puesta.
 *
 * Es una heurística: si ninguna candidata se parece lo bastante, no se elige
 * nada y manda la preferencia por defecto del usuario. Equivocarse callado es
 * peor que no hacer nada.
 */

/** Cuánto suma cada coincidencia. El idioma y el título pesan más que el resto. */
const MATCH_SCORE = {
    /** Mismo códec: indicio débil, hay muchas pistas con el mismo. */
    codec: 1,
    /** Misma posición dentro de las pistas de su tipo. */
    position: 1,
    /** Mismo título visible ("Comentario del director"). */
    title: 2,
    /** Mismo idioma, sin contar el marcador 'und' (indeterminado). */
    language: 2
} as const;

/**
 * Puntuación mínima para dar por buena una coincidencia.
 *
 * Con 3 hace falta al menos una señal fuerte (idioma o título): códec y
 * posición juntos suman 2 y no bastan, que es lo que se quiere — coinciden con
 * demasiada facilidad entre pistas que no tienen nada que ver.
 */
export const MATCH_THRESHOLD = 3;

/** Selección de pistas que se le pasa al player. */
export interface TrackOptions {
    DefaultAudioStreamIndex?: number;
    DefaultSubtitleStreamIndex?: number;
    DefaultSecondarySubtitleStreamIndex?: number;
}

type StreamType = 'Audio' | 'Subtitle';

/**
 * Fuente con la pista de subtítulos secundaria. El SDK no la declara todavía,
 * pero el servidor la manda y el reproductor la usa.
 */
type SourceWithSecondarySubtitle = MediaSourceInfo & {
    DefaultSecondarySubtitleStreamIndex?: number;
};

/** Parecido entre la pista anterior y una candidata. */
export function scoreStreamMatch(
    previous: MediaStream,
    candidate: MediaStream,
    samePosition: boolean
): number {
    let score = 0;

    if (previous.Codec === candidate.Codec) score += MATCH_SCORE.codec;
    if (samePosition) score += MATCH_SCORE.position;
    if (previous.DisplayTitle && previous.DisplayTitle === candidate.DisplayTitle) {
        score += MATCH_SCORE.title;
    }
    if (previous.Language
        && previous.Language !== 'und'
        && previous.Language === candidate.Language
    ) {
        score += MATCH_SCORE.language;
    }

    return score;
}

/** Posición de una pista entre las de su mismo tipo (0 = la primera). */
function relativeIndexOf(
    streams: MediaStream[],
    absoluteIndex: number,
    streamType: StreamType
): number {
    let position = 0;
    for (const stream of streams) {
        if (stream.Type !== streamType) continue;
        if (stream.Index === absoluteIndex) break;
        position += 1;
    }
    return position;
}

/**
 * Índice de la pista que mejor se parece a la anterior, o `null` si ninguna
 * llega al umbral.
 */
export function findBestMatchingStream(
    previous: MediaStream,
    previousPosition: number,
    candidates: MediaStream[],
    streamType: StreamType
): number | null {
    let bestIndex: number | null = null;
    let bestScore = 0;
    let position = 0;

    for (const candidate of candidates) {
        if (candidate.Type !== streamType) continue;

        const score = scoreStreamMatch(previous, candidate, position === previousPosition);
        if (score > bestScore && score >= MATCH_THRESHOLD) {
            bestScore = score;
            bestIndex = candidate.Index ?? null;
        }

        position += 1;
    }

    return bestIndex;
}

/** Anota la pista elegida en el hueco que le corresponde. */
function applyChoice(
    trackOptions: TrackOptions,
    streamType: StreamType,
    isSecondarySubtitle: boolean,
    index: number
): void {
    if (streamType === 'Audio') {
        trackOptions.DefaultAudioStreamIndex = index;
    } else if (isSecondarySubtitle) {
        trackOptions.DefaultSecondarySubtitleStreamIndex = index;
    } else {
        trackOptions.DefaultSubtitleStreamIndex = index;
    }
}

/**
 * Traslada una pista del item anterior al nuevo.
 *
 * `previousIndex` a −1 significa "el usuario los tenía quitados": eso sí se
 * respeta tal cual, y solo para subtítulos — no hay forma de reproducir vídeo
 * sin pista de audio.
 */
function carryOverTrack(
    previousIndex: number,
    previousSource: MediaSourceInfo,
    candidates: MediaStream[],
    trackOptions: TrackOptions,
    streamType: StreamType,
    isSecondarySubtitle = false
): void {
    if (previousIndex === -1) {
        if (streamType === 'Subtitle') {
            applyChoice(trackOptions, streamType, isSecondarySubtitle, -1);
        }
        return;
    }

    const previousStreams = previousSource.MediaStreams;
    if (!previousStreams?.length) return;

    const previous = previousStreams.find((s) => s.Index === previousIndex);
    if (!previous) return;

    const position = relativeIndexOf(previousStreams, previousIndex, streamType);
    const bestIndex = findBestMatchingStream(previous, position, candidates, streamType);

    if (bestIndex != null) {
        applyChoice(trackOptions, streamType, isSecondarySubtitle, bestIndex);
    }
}

/**
 * Traslada al item nuevo las pistas que estaban puestas en el anterior.
 *
 * Escribe sobre `trackOptions`. No lanza nunca: esto es una comodidad, y si
 * la heurística falla es preferible reproducir con las pistas por defecto que
 * no reproducir.
 */
export function autoSetNextTracks(
    previousSource: SourceWithSecondarySubtitle | null | undefined,
    candidates: MediaStream[] | null | undefined,
    trackOptions: TrackOptions,
    audio: boolean,
    subtitle: boolean
): void {
    try {
        if (!previousSource) return;
        if (!candidates) {
            console.warn('[trackMatching] el item nuevo no declara pistas');
            return;
        }

        const {
            DefaultAudioStreamIndex,
            DefaultSubtitleStreamIndex,
            DefaultSecondarySubtitleStreamIndex
        } = previousSource;

        if (audio && typeof DefaultAudioStreamIndex === 'number') {
            carryOverTrack(
                DefaultAudioStreamIndex, previousSource, candidates, trackOptions, 'Audio'
            );
        }

        if (subtitle && typeof DefaultSubtitleStreamIndex === 'number') {
            carryOverTrack(
                DefaultSubtitleStreamIndex, previousSource, candidates, trackOptions, 'Subtitle'
            );
        }

        if (subtitle && typeof DefaultSecondarySubtitleStreamIndex === 'number') {
            carryOverTrack(
                DefaultSecondarySubtitleStreamIndex, previousSource, candidates,
                trackOptions, 'Subtitle', true
            );
        }
    } catch (e) {
        console.error('[trackMatching] error inesperado al trasladar las pistas', e);
    }
}
