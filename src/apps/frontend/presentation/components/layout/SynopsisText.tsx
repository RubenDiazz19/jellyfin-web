import { useState, type CSSProperties } from 'react';
import { useResponsive } from '../../theme/responsive';
import { T } from '../../theme/tokens';
import { SectionLabel } from './DetailSections';

type Props = {
    text: string | null | undefined;
    label?: string;
    maxLines?: number;
    maxWidth?: number | string;
    fontSize?: number | string;
    lineHeight?: number | string;
    color?: string;
    style?: CSSProperties;
};

/**
 * Texto de sinopsis o biografía unificado para fichas de detalle y biografías.
 * Soporta etiqueta opcional y plegado/desplegado si se especifica maxLines.
 */
export function SynopsisText({
    text,
    label,
    maxLines,
    maxWidth = 640,
    fontSize,
    lineHeight = 1.55,
    color = 'rgba(255,255,255,0.82)',
    style
}: Props) {
    const [expanded, setExpanded] = useState(false);
    const r = useResponsive();

    if (!text) return null;

    const actualFontSize = fontSize ?? (r.touch ? 15 : 17);
    const isClamped = maxLines != null && maxLines > 0 && !expanded;

    const pElement = (
        <p
            style={{
                fontFamily: T.ui,
                fontSize: actualFontSize,
                lineHeight,
                margin: 0,
                color,
                maxWidth,
                textWrap: 'pretty',
                fontWeight: 400,
                ...(isClamped ? {
                    display: '-webkit-box',
                    WebkitLineClamp: maxLines,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                } : {})
            }}
        >
            {text}
        </p>
    );

    return (
        <div style={style}>
            {label && <SectionLabel>{label}</SectionLabel>}
            {maxLines ? (
                <button
                    type='button'
                    onClick={() => setExpanded(!expanded)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'block',
                        width: '100%',
                        maxWidth
                    }}
                >
                    {pElement}
                </button>
            ) : (
                pElement
            )}
        </div>
    );
}
