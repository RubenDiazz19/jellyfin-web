// «Buscar alternativas»: lo que TMDB/TVDB tienen para este título.
//
// Carátula, fondo y logo lo hacían por separado, con tres copias del mismo
// ciclo —pedir, enseñar la rejilla, aplicar la elegida, avisar— que solo se
// diferenciaban en la proporción de la miniatura y en si el panel se cierra al
// aplicar (una carátula sustituye a la anterior y ahí acaba la tarea; los
// fondos se van sumando, así que la rejilla se queda abierta).

import globalize from 'lib/globalize';

import { useState } from 'react';
import { getRemoteImages, setImageByUrl, type JFRemoteImage } from '../../../../domain/api';
import { T } from '../../../theme/tokens';
import { useToast } from '../../toast/ToastProvider';
import type { ImgType } from './primitives';

type Options = {
    itemId: string;
    type: ImgType;
    /** Lo que se dice al aplicar una: «carátula aplicada», «fondo añadido». */
    appliedMessage: string;
    /** Cerrar la rejilla al aplicar, o dejarla para seguir eligiendo. Por defecto true. */
    closeOnApply?: boolean;
    /** Para recargar las imágenes del item. */
    onApplied: () => void;
    onError: (e: unknown) => void;
};

export type RemoteAlternatives = ReturnType<typeof useRemoteAlternatives>;

export function useRemoteAlternatives({
    itemId, type, appliedMessage, closeOnApply = true, onApplied, onError
}: Options) {
    const toast = useToast();
    const [state, setState] = useState<'idle' | 'loading' | 'results'>('idle');
    const [images, setImages] = useState<JFRemoteImage[]>([]);
    /** URL de la que se está aplicando: la rejilla la marca como ocupada. */
    const [applying, setApplying] = useState<string | null>(null);
    const [lang, setLang] = useState<string>('');

    const open = async () => {
        setState('loading');
        try {
            const { images: remote } = await getRemoteImages(itemId, type);
            setImages(remote);
            setState('results');
        } catch (e) {
            setState('idle');
            onError(e);
        }
    };

    const apply = async (url: string) => {
        setApplying(url);
        try {
            await setImageByUrl(itemId, type, url);
            toast(appliedMessage, 'success');
            onApplied();
            if (closeOnApply) setState('idle');
        } catch (e) {
            onError(e);
        } finally {
            setApplying(null);
        }
    };

    const langs = Array.from(new Set(images.map((i) => i.Language).filter(Boolean))) as string[];
    const filtered = lang ? images.filter((i) => i.Language === lang) : images;

    return {
        open,
        apply,
        images,
        filtered,
        lang,
        setLang,
        langs,
        applying,
        loading: state === 'loading',
        showing: state === 'results',
        close: () => setState('idle'),
        toggle: () => {
            if (state === 'results') setState('idle');
            else void open();
        }
    };
}

/** Tira horizontal integrada de alternativas online al lado de la imagen actual. */
export function RemoteAlternativesTrack({
    alt,
    thumbAspect,
    fit = 'cover',
    cardWidth
}: {
    alt: RemoteAlternatives;
    /** `2/3` para carátulas, `16/9` para fondos y logos. */
    thumbAspect: string;
    fit?: 'cover' | 'contain';
    cardWidth?: number;
}) {
    if (!alt.showing) return null;

    if (alt.filtered.length === 0) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                fontSize: 12,
                color: T.dim,
                lineHeight: 1.5,
                whiteSpace: 'nowrap',
                alignSelf: 'center'
            }}>
                {globalize.translate('MessageNoRemoteImages')}
            </div>
        );
    }

    return (
        <div
            onWheel={(e) => {
                if (e.deltaY !== 0 && e.currentTarget.scrollWidth > e.currentTarget.clientWidth) {
                    e.currentTarget.scrollLeft += e.deltaY;
                }
            }}
            style={{
                display: 'flex',
                gap: 10,
                overflowX: 'auto',
                padding: '8px 10px 14px 8px',
                margin: '-6px -8px 0 -6px',
                scrollbarWidth: 'thin',
                scrollBehavior: 'smooth'
            }}
        >
            {alt.filtered.map((im) => (
                <RemoteThumb
                    key={im.Url}
                    image={im}
                    aspect={thumbAspect}
                    fit={fit}
                    cardWidth={cardWidth}
                    busy={alt.applying === im.Url}
                    onPick={() => alt.apply(im.Url)}
                />
            ))}
        </div>
    );
}

/** Componente de compatibilidad para rejillas de alternativas. */
export function RemoteAlternativesGrid({
    alt, thumbAspect, fit = 'cover'
}: {
    alt: RemoteAlternatives;
    thumbAspect: string;
    fit?: 'cover' | 'contain';
}) {
    return <RemoteAlternativesTrack alt={alt} thumbAspect={thumbAspect} fit={fit} />;
}

function RemoteThumb({
    image, aspect, fit, cardWidth, busy, onPick
}: {
    image: JFRemoteImage; aspect: string; fit: 'cover' | 'contain';
    cardWidth?: number;
    busy: boolean; onPick: () => void;
}) {
    const isWide = aspect === '16/9';
    const width = cardWidth ?? (isWide ? 220 : 100);
    let resLabel = '';
    if (image.Width && image.Height) {
        if (image.Width >= 3840) resLabel = '4K';
        else if (image.Width >= 1920) resLabel = '1080p';
        else if (image.Width >= 1280) resLabel = '720p';
        else resLabel = `${image.Width}×${image.Height}`;
    }

    return (
        <button
            onClick={onPick}
            disabled={busy}
            title={[image.Width && image.Height ? `${image.Width}×${image.Height}` : '', image.ProviderName, image.Language].filter(Boolean).join(' · ')}
            style={{
                flexShrink: 0,
                width,
                padding: 0,
                border: '1px solid rgba(255,255,255,0.12)',
                background: fit === 'contain' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.05)',
                borderRadius: 6,
                cursor: busy ? 'wait' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
                opacity: busy ? 0.6 : 1,
                transition: 'transform .15s, border-color .15s, box-shadow .15s'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.45)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                e.currentTarget.style.boxShadow = 'none';
            }}
        >
            <div style={{
                width: '100%',
                aspectRatio: aspect,
                backgroundImage: `url(${image.ThumbnailUrl || image.Url})`,
                backgroundSize: fit,
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
            }} />

            {(resLabel || image.Language) && (
                <div style={{
                    position: 'absolute',
                    bottom: 4,
                    left: 4,
                    display: 'flex',
                    gap: 4,
                    alignItems: 'center'
                }}>
                    {resLabel && (
                        <span style={{
                            background: 'rgba(0,0,0,0.7)',
                            backdropFilter: 'blur(4px)',
                            padding: '2px 5px',
                            borderRadius: 4,
                            fontSize: 9,
                            fontWeight: 600,
                            color: '#fff',
                            lineHeight: 1
                        }}>
                            {resLabel}
                        </span>
                    )}
                    {image.Language && (
                        <span style={{
                            background: 'rgba(0,0,0,0.7)',
                            backdropFilter: 'blur(4px)',
                            padding: '2px 5px',
                            borderRadius: 4,
                            fontSize: 9,
                            color: T.dim,
                            lineHeight: 1,
                            textTransform: 'uppercase'
                        }}>
                            {image.Language}
                        </span>
                    )}
                </div>
            )}
        </button>
    );
}
