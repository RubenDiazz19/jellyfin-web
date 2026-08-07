import globalize from 'lib/globalize';

import {
    subtitleTextStyle, type SubtitleAppearance
} from '../../../domain/player/subtitleStyle';
import { T } from '../../theme/tokens';

/**
 * Cómo va a verse el subtítulo sobre el vídeo.
 *
 * El fondo es un degradado y no un gris plano por un motivo concreto: el color
 * del texto y la sombra son justo las dos cosas que se eligen mal cuando solo
 * se prueban contra un fondo. Un blanco sin contorno se lee perfectamente
 * sobre negro y desaparece en una escena nevada, así que la muestra tiene
 * ambos extremos y el texto los cruza.
 *
 * La altura elegida no se representa: en el vídeo se cuenta en líneas contra
 * el alto real de la imagen, y fingirlo en una caja de 120 px daría una idea
 * equivocada de dónde va a quedar.
 */
export function SubtitlePreview({ appearance }: { appearance: SubtitleAppearance }) {
    const style = subtitleTextStyle(appearance);
    return (
        <div
            aria-label={globalize.translate('Preview')}
            style={{
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                minHeight: 120, padding: '18px 16px', marginBottom: 24,
                borderRadius: 10, overflow: 'hidden',
                border: `1px solid ${T.hairline}`,
                background: 'linear-gradient(100deg, #000 0%, #1b1b1f 42%, #8a8f98 78%, #e8e8ea 100%)',
                // El tamaño de las cues es relativo al del reproductor; aquí se
                // ancla a un cuerpo fijo para que la proporción entre los seis
                // tamaños sea la misma que se verá en pantalla.
                fontSize: 20
            }}
        >
            <span style={{
                ...style,
                display: 'inline-block',
                textAlign: 'center',
                padding: style.background === 'transparent' ? 0 : '2px 8px'
            }}>
                {globalize.translate('SubtitlePreviewText')}
            </span>
        </div>
    );
}
