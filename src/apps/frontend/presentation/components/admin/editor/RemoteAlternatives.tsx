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
    /** Cerrar la rejilla al aplicar, o dejarla para seguir eligiendo. */
    closeOnApply?: boolean;
    /** Para recargar las imágenes del item. */
    onApplied: () => void;
    onError: (e: unknown) => void;
};

export type RemoteAlternatives = ReturnType<typeof useRemoteAlternatives>;

export function useRemoteAlternatives({
    itemId, type, appliedMessage, closeOnApply, onApplied, onError
}: Options) {
    const toast = useToast();
    const [state, setState] = useState<'idle' | 'loading' | 'results'>('idle');
    const [images, setImages] = useState<JFRemoteImage[]>([]);
    /** URL de la que se está aplicando: la rejilla la marca como ocupada. */
    const [applying, setApplying] = useState<string | null>(null);

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

    return {
        open,
        apply,
        images,
        applying,
        loading: state === 'loading',
        showing: state === 'results',
        close: () => setState('idle')
    };
}

/** La rejilla de alternativas, con su filtro por idioma. */
export function RemoteAlternativesGrid({
    alt, thumbAspect, fit = 'cover'
}: {
    alt: RemoteAlternatives;
    /** `2/3` para carátulas, `16/9` para fondos y logos. */
    thumbAspect: string;
    fit?: 'cover' | 'contain';
}) {
    const [lang, setLang] = useState<string>('');
    if (!alt.showing) return null;

    const langs = Array.from(new Set(alt.images.map((i) => i.Language).filter(Boolean))) as string[];
    const filtered = lang ? alt.images.filter((i) => i.Language === lang) : alt.images;

    return (
        <div style={{
            marginTop: 16, padding: 14, borderRadius: 10,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: T.dim }}>
                    {filtered.length} alternativa{filtered.length === 1 ? '' : 's'}
                    {langs.length > 1 && (
                        <select
                            value={lang}
                            onChange={(e) => setLang(e.target.value)}
                            style={{
                                marginLeft: 10, background: 'rgba(255,255,255,0.06)',
                                color: '#fff', border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: 6, padding: '4px 8px', fontSize: 12
                            }}
                        >
                            <option value=''>{globalize.translate('AllLanguages')}</option>
                            {langs.map((l) => (<option key={l} value={l}>{l}</option>))}
                        </select>
                    )}
                </div>
                <button
                    onClick={alt.close}
                    style={{
                        marginLeft: 'auto', background: 'none', border: 'none',
                        color: T.dim, cursor: 'pointer', fontSize: 12
                    }}
                >{globalize.translate('ButtonClose')}</button>
            </div>
            {/* Sin resultados hay que decir por qué: un «0 alternativas» a
                secas se lee como que el botón no ha funcionado, cuando lo que
                pasa es que el proveedor no tiene esa imagen catalogada —típico
                en temporadas recién estrenadas—. La salida es subirla a mano,
                que es justo lo que hay encima. */}
            {filtered.length === 0 && (
                <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.6, padding: '2px 0 6px' }}>
                    {globalize.translate('MessageNoRemoteImages')}
                </div>
            )}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 10, maxHeight: 380, overflowY: 'auto'
            }}>
                {filtered.map((im) => (
                    <RemoteThumb
                        key={im.Url}
                        image={im}
                        aspect={thumbAspect}
                        fit={fit}
                        busy={alt.applying === im.Url}
                        onPick={() => alt.apply(im.Url)}
                    />
                ))}
            </div>
        </div>
    );
}

function RemoteThumb({
    image, aspect, fit, busy, onPick
}: {
    image: JFRemoteImage; aspect: string; fit: 'cover' | 'contain';
    busy: boolean; onPick: () => void;
}) {
    const size = image.Width && image.Height ? `${image.Width}×${image.Height}` : '';
    return (
        <button
            onClick={onPick}
            disabled={busy}
            title={[size, image.ProviderName, image.Language].filter(Boolean).join(' · ')}
            style={{
                padding: 0, border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)', borderRadius: 6,
                cursor: busy ? 'wait' : 'pointer',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                opacity: busy ? 0.6 : 1,
                transition: 'transform .12s, border-color .12s'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
            }}
        >
            <div style={{
                width: '100%', aspectRatio: aspect,
                background: fit === 'contain' ? 'rgba(0,0,0,0.35)' : undefined,
                backgroundImage: `url(${image.ThumbnailUrl || image.Url})`,
                backgroundSize: fit, backgroundPosition: 'center', backgroundRepeat: 'no-repeat'
            }} />
            <div style={{
                padding: '6px 8px', fontSize: 10, color: T.dim,
                display: 'flex', justifyContent: 'space-between', gap: 6,
                textAlign: 'left'
            }}>
                <span>{size}</span>
                <span>{image.Language ?? ''}</span>
            </div>
        </button>
    );
}
