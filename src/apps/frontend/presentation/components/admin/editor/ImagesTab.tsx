import globalize from 'lib/globalize';

import { useEffect, useRef, useState } from 'react';
import {
    deleteImage,
    getItemRaw,
    imageUrl,
    moveImage,
    setImageByUrl,
    uploadImageFile
} from '../../../../domain/api';
import { T } from '../../../theme/tokens';
import { useToast } from '../../toast/ToastProvider';
import { PillButton } from '../../controls/fields';
import { BackdropTile } from './BackdropTile';
import { ConfirmDeleteButton, type ImgType } from './primitives';
import {
    RemoteAlternativesTrack,
    useRemoteAlternatives,
    type RemoteAlternatives
} from './RemoteAlternatives';
import { useImageDrop } from './useImageDrop';

export function ImagesTab({ itemId }: { itemId: string }) {
    const [refreshTick, setRefreshTick] = useState(0);
    const [backdropTags, setBackdropTags] = useState<string[]>([]);
    const [primaryTag, setPrimaryTag] = useState<string | undefined>();
    const [logoTag, setLogoTag] = useState<string | undefined>();
    const toast = useToast();

    useEffect(() => {
        let cancelled = false;
        getItemRaw(itemId).then((it) => {
            if (cancelled) return;
            setBackdropTags(it.BackdropImageTags ?? []);
            setPrimaryTag(it.ImageTags?.Primary);
            setLogoTag(it.ImageTags?.Logo);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [itemId, refreshTick]);

    // La etiqueta de la imagen cambia con ella, así que sirve de cache-buster;
    // donde no la hay (los fondos van por índice) vale el contador de recargas.
    const bust = (u?: string, tag?: string) =>
        u ? `${u}${u.includes('?') ? '&' : '?'}bust=${tag ?? refreshTick}` : undefined;

    /**
     * La imagen que el item tiene AHORA, o nada si no tiene ninguna.
     *
     * Sin etiqueta no se compone la URL. `imageUrl` la devuelve igualmente y el
     * servidor contesta 404, con lo que la caja quedaba en un rectángulo vacío
     * —sin su «arrastra o pulsa»— que parecía una imagen que no carga y no una
     * casilla donde soltar la tuya. Se veía en cualquier temporada que el
     * proveedor no haya catalogado todavía.
     */
    const currentImage = (type: 'Primary' | 'Logo', tag?: string, maxHeight?: number) =>
        (tag ? bust(imageUrl(itemId, type, { maxHeight, tag }), tag) : undefined);
    const applyOk = () => setRefreshTick((n) => n + 1);
    const showErr = (e: unknown) => toast((e as Error).message, 'warn');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
            <SingleImageSection
                label={globalize.translate('Primary')} itemId={itemId} type='Primary'
                src={currentImage('Primary', primaryTag, 600)}
                onDone={applyOk} onError={showErr}
            />
            <BackdropSection
                itemId={itemId} tags={backdropTags} refreshTick={refreshTick}
                onDone={applyOk} onError={showErr}
            />
            <SingleImageSection
                label={globalize.translate('Logo')} itemId={itemId} type='Logo' wide
                src={currentImage('Logo', logoTag, 300)}
                onDone={applyOk} onError={showErr}
            />
        </div>
    );
}

/**
 * Todo lo que se hace en esta pestaña tiene la misma forma: pedirle algo al
 * servidor, decir que salió bien y volver a leer las imágenes del item. De
 * contar los fallos se encarga quien pasa `onError`, que es quien sabe dónde
 * enseñarlos.
 */
function useImageAction(onDone: () => void, onError: (e: unknown) => void) {
    const toast = useToast();
    return async (action: Promise<unknown>, ok?: string) => {
        try {
            await action;
            if (ok) toast(ok, 'success');
            onDone();
        } catch (e) { onError(e); }
    };
}

/**
 * Una imagen de la que solo hay una: la carátula y el logo.
 *
 * La diferencia entre las dos es cómo se encajan —el logo es un PNG con su
 * propia proporción, así que se ve entero (`contain`) y no recortado— y la
 * proporción de las alternativas que se ofrecen.
 */
function SingleImageSection({
    label, itemId, type, src, wide, onDone, onError
}: {
    label: string; itemId: string; type: ImgType; src?: string; wide?: boolean;
    onDone: () => void; onError: (e: unknown) => void;
}) {
    const fit = type === 'Logo' ? 'contain' : 'cover';
    const cardWidth = wide ? 220 : 100;
    const aspect = wide ? '16/9' : '2/3';
    const run = useImageAction(onDone, onError);
    const alt = useRemoteAlternatives({
        itemId, type, onApplied: onDone, onError,
        appliedMessage: globalize.translate('MessageImageApplied', label),
        closeOnApply: true
    });

    return (
        <div>
            <SectionHeader
                label={label}
                onSearch={alt.toggle}
                loading={alt.loading}
                showing={alt.showing}
                lang={alt.lang}
                setLang={alt.setLang}
                langs={alt.langs}
                onApplyUrl={(url) => run(setImageByUrl(itemId, type, url))}
            />
            <ImageEditor
                src={src}
                wide={wide}
                fit={fit}
                selected={alt.showing}
                alt={alt}
                aspect={aspect}
                cardWidth={cardWidth}
                addLabel={label}
                onUploadFile={(file) => run(
                    uploadImageFile(itemId, type, file),
                    globalize.translate('MessageImageUploaded', label)
                )}
                onDelete={src ? () => run(
                    deleteImage(itemId, type),
                    globalize.translate('MessageImageDeleted')
                ) : undefined}
            />
        </div>
    );
}

/** Un fondo: la etiqueta con la que se pide y su posición en el servidor. */
type Backdrop = { tag: string; index: number };

/** `list` con el elemento que estaba en `from` colocado en `to`. */
export function movedTo<T>(list: readonly T[], from: number, to: number): T[] {
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
}

/** Los fondos: varios, ordenables, y con un hueco al final para añadir más. */
function BackdropSection({
    itemId, tags, refreshTick, onDone, onError
}: {
    itemId: string; tags: string[]; refreshTick: number;
    onDone: () => void; onError: (e: unknown) => void;
}) {
    const toast = useToast();

    /**
     * El orden que se pinta. Es copia local de `tags` porque al reordenar se
     * mueve la miniatura antes de que conteste el servidor: arrastrar algo que
     * se queda quieto hasta que llega la respuesta se siente roto.
     *
     * Cada entrada conserva su `index` de origen, que es por el que se pide la
     * imagen: durante ese rato la posición en pantalla y la del servidor no
     * coinciden, y pedir por posición enseñaría la imagen equivocada.
     */
    const [order, setOrder] = useState<Backdrop[]>([]);
    const [dragFrom, setDragFrom] = useState<number | null>(null);
    const [dragTo, setDragTo] = useState<number | null>(null);
    /** Tile con el ratón encima o con el foco dentro: el que enseña sus controles. */
    const [active, setActive] = useState<number | null>(null);
    const [moving, setMoving] = useState(false);

    useEffect(() => {
        setOrder(tags.map((tag, index) => ({ tag, index })));
    }, [tags]);

    const added = globalize.translate('MessageBackdropAdded');
    const run = useImageAction(onDone, onError);
    const alt = useRemoteAlternatives({
        itemId, type: 'Backdrop', onApplied: onDone, onError,
        // Sin cerrar: los fondos se suman, y normalmente se quiere más de uno.
        appliedMessage: added
    });

    /**
     * Mueve el fondo de la posición `from` a la `to`.
     *
     * Se usan posiciones y no los `index` de servidor porque mientras no haya
     * un movimiento en vuelo son lo mismo: `moving` bloquea el siguiente hasta
     * que la recarga vuelve a alinearlos.
     */
    const move = async (from: number, to: number) => {
        if (moving || from === to || to < 0 || to >= order.length) return;
        const previous = order;
        setOrder(movedTo(order, from, to));
        setMoving(true);
        try {
            await moveImage(itemId, 'Backdrop', from, to);
            onDone();
        } catch (e) {
            setOrder(previous);
            onError(e);
        } finally {
            setMoving(false);
        }
    };

    const drop = useImageDrop({
        multiple: true,
        onFiles: async (files) => {
            for (const f of files) {
                try {
                    await uploadImageFile(itemId, 'Backdrop', f);
                    toast(added, 'success');
                } catch (e) { onError(e); }
            }
            onDone();
        }
    });

    return (
        <div>
            <SectionHeader
                label={`Fondos (${order.length})`}
                onSearch={alt.toggle}
                loading={alt.loading}
                showing={alt.showing}
                lang={alt.lang}
                setLang={alt.setLang}
                langs={alt.langs}
                onApplyUrl={(url) => run(setImageByUrl(itemId, 'Backdrop', url), added)}
            />
            <div style={{ fontSize: 12, color: T.dim, marginBottom: 12 }}>
                {globalize.translate('MessageBackdropsHelp')}
            </div>
            <div
                onWheel={(e) => {
                    if (alt.showing && e.deltaY !== 0 && e.currentTarget.scrollWidth > e.currentTarget.clientWidth) {
                        e.currentTarget.scrollLeft += e.deltaY;
                    }
                }}
                style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    flexWrap: alt.showing ? 'nowrap' : 'wrap',
                    overflowX: alt.showing ? 'auto' : 'visible',
                    padding: '8px 10px 14px 8px',
                    margin: '-6px -8px 0 -6px',
                    scrollbarWidth: 'thin'
                }}
            >
                {order.map((b, i) => (
                    <BackdropTile
                        key={b.tag}
                        src={imageUrl(itemId, 'Backdrop', { tag: b.tag, maxWidth: 640, index: b.index })
                            + `&bust=${refreshTick}`}
                        position={i}
                        total={order.length}
                        active={active === i}
                        selected={alt.showing}
                        dragging={dragFrom === i}
                        dropTarget={dragTo === i && dragFrom !== null && dragFrom !== i}
                        busy={moving}
                        onActivate={(on) => setActive((p) => (on ? i : p === i ? null : p))}
                        onMove={(to) => move(i, to)}
                        onDragStart={() => setDragFrom(i)}
                        onDragEnter={() => setDragTo(i)}
                        onDragEnd={() => { setDragFrom(null); setDragTo(null); }}
                        onDrop={() => {
                            if (dragFrom !== null) void move(dragFrom, i);
                            setDragFrom(null);
                            setDragTo(null);
                        }}
                        onDelete={() => run(
                            deleteImage(itemId, 'Backdrop', b.index),
                            globalize.translate('MessageImageDeleted')
                        )}
                    />
                ))}
                {!alt.showing && (
                    <div
                        {...drop.props}
                        style={{
                            width: 220, aspectRatio: '16/9', borderRadius: 6, cursor: 'pointer',
                            flexShrink: 0,
                            background: 'rgba(255,255,255,0.05)',
                            border: `1px dashed ${drop.over ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: T.dim, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase',
                            transition: 'border-color .15s'
                        }}
                    >
                        + {globalize.translate('Backdrop')}
                    </div>
                )}
                {alt.showing && (
                    <RemoteAlternativesTrack
                        alt={alt}
                        thumbAspect='16/9'
                        cardWidth={220}
                    />
                )}
            </div>
            {drop.input}
        </div>
    );
}

/** Icono de lupa stroke minimalista. */
function SearchIcon() {
    return (
        <svg
            width='13'
            height='13'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2.2'
            strokeLinecap='round'
            strokeLinejoin='round'
        >
            <circle cx='11' cy='11' r='7' />
            <line x1='21' y1='21' x2='16.65' y2='16.65' />
        </svg>
    );
}

/** Campo desplegable minimalista para añadir imágenes por URL directa desde la lupa. */
function UrlSearchExpand({ onApply }: { onApply: (url: string) => void }) {
    const [open, setOpen] = useState(false);
    const [url, setUrl] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onPointerDownOutside = (e: MouseEvent | TouchEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onPointerDownOutside);
        document.addEventListener('touchstart', onPointerDownOutside);
        return () => {
            document.removeEventListener('mousedown', onPointerDownOutside);
            document.removeEventListener('touchstart', onPointerDownOutside);
        };
    }, [open]);

    const handleApply = () => {
        const trimmed = url.trim();
        if (trimmed) {
            onApply(trimmed);
            setUrl('');
            setOpen(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleApply();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
        }
    };

    return (
        <div
            ref={containerRef}
            onBlur={(e) => {
                if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
                    setOpen(false);
                }
            }}
            style={{
                display: 'flex',
                alignItems: 'center',
                height: 28,
                borderRadius: 14,
                background: open ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${open ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)'}`,
                transition: 'width .25s cubic-bezier(0.2, 0.8, 0.2, 1), background .2s, border-color .2s',
                width: open ? 240 : 28,
                overflow: 'hidden',
                boxSizing: 'border-box'
            }}
        >
            <button
                type='button'
                onClick={() => setOpen((o) => !o)}
                title={open ? globalize.translate('Close') : globalize.translate('LabelImageUrl')}
                aria-label={open ? globalize.translate('Close') : globalize.translate('LabelImageUrl')}
                style={{
                    width: 26,
                    height: 26,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    border: 'none',
                    color: open ? '#fff' : T.dim,
                    cursor: 'pointer',
                    flexShrink: 0,
                    padding: 0,
                    transition: 'color .15s'
                }}
            >
                <SearchIcon />
            </button>
            {open && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        flex: 1,
                        minWidth: 0,
                        paddingRight: 4,
                        gap: 4
                    }}
                >
                    <input
                        type='url'
                        value={url}
                        autoFocus
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder='https://…'
                        style={{
                            flex: 1,
                            minWidth: 0,
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            color: '#fff',
                            fontSize: 11,
                            fontFamily: T.ui,
                            padding: '2px 4px'
                        }}
                    />
                    <button
                        type='button'
                        disabled={!url.trim()}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleApply}
                        style={{
                            background: url.trim() ? 'rgba(255,255,255,0.2)' : 'transparent',
                            color: url.trim() ? '#fff' : T.dim,
                            border: 'none',
                            borderRadius: 10,
                            padding: '2px 8px',
                            fontSize: 10,
                            fontWeight: 500,
                            fontFamily: T.ui,
                            cursor: url.trim() ? 'pointer' : 'default',
                            transition: 'background .15s, color .15s'
                        }}
                    >
                        {globalize.translate('Apply')}
                    </button>
                </div>
            )}
        </div>
    );
}

/** El título de una sección y su botón de buscar alternativas con filtro opcional de idioma y URL desplegable. */
function SectionHeader({
    label, onSearch, loading, showing, lang, setLang, langs, onApplyUrl
}: {
    label: string;
    onSearch: () => void;
    loading: boolean;
    showing?: boolean;
    lang?: string;
    setLang?: (l: string) => void;
    langs?: string[];
    onApplyUrl?: (url: string) => void;
}) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 10 }}>
            <div style={{
                fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: T.dim
            }}>{label}</div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                {showing && onApplyUrl && (
                    <UrlSearchExpand onApply={onApplyUrl} />
                )}
                {showing && langs && langs.length > 1 && setLang && (
                    <select
                        value={lang}
                        onChange={(e) => setLang(e.target.value)}
                        style={{
                            height: 28,
                            background: 'rgba(255,255,255,0.06)',
                            color: '#eee',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: 14,
                            padding: '0 10px',
                            fontSize: 11,
                            fontFamily: T.ui,
                            cursor: 'pointer',
                            outline: 'none',
                            boxSizing: 'border-box'
                        }}
                    >
                        <option value=''>{globalize.translate('AllLanguages')}</option>
                        {langs.map((l) => (<option key={l} value={l}>{l}</option>))}
                    </select>
                )}
                <PillButton
                    variant={showing ? 'primary' : 'ghost'}
                    onClick={onSearch}
                    busy={loading}
                    style={{
                        height: 28,
                        padding: '0 12px',
                        fontSize: 11,
                        lineHeight: '26px',
                        fontWeight: showing ? 600 : 500,
                        letterSpacing: 0,
                        boxSizing: 'border-box'
                    }}
                >
                    {loading ? 'Buscando…' : showing ? 'Ocultar sugerencias' : 'Buscar alternativas'}
                </PillButton>
            </div>
        </div>
    );
}

/** La imagen actual (con borrar arriba a la derecha), cuadro de subir (+) o sugerencias remotas integradas. */
function ImageEditor({
    src, wide, fit = 'cover', selected, alt, aspect = '2/3', cardWidth, addLabel,
    onUploadFile, onDelete
}: {
    src?: string; wide?: boolean; fit?: 'cover' | 'contain';
    selected?: boolean;
    alt?: RemoteAlternatives;
    aspect?: string;
    cardWidth?: number;
    addLabel: string;
    onUploadFile: (file: File) => void;
    onDelete?: () => Promise<void>;
}) {
    const drop = useImageDrop({ onFiles: (files) => onUploadFile(files[0]) });

    return (
        <div
            onWheel={(e) => {
                if (selected && e.deltaY !== 0 && e.currentTarget.scrollWidth > e.currentTarget.clientWidth) {
                    e.currentTarget.scrollLeft += e.deltaY;
                }
            }}
            style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                flexWrap: selected ? 'nowrap' : 'wrap',
                overflowX: selected ? 'auto' : 'visible',
                padding: '8px 10px 14px 8px',
                margin: '-6px -8px 0 -6px',
                scrollbarWidth: 'thin'
            }}
        >
            {drop.input}

            {/* Imagen actual si existe */}
            {src && (
                <div
                    style={{
                        ...(wide ? { width: 220, aspectRatio: '16/9' } : { width: 100, aspectRatio: '2/3' }),
                        flexShrink: 0,
                        borderRadius: 6,
                        background: fit === 'contain' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        outline: selected ? '2px solid #fff' : 'none',
                        outlineOffset: 2,
                        boxShadow: selected ? '0 0 14px rgba(255,255,255,0.45)' : 'none',
                        backgroundImage: `url(${src})`,
                        backgroundSize: fit,
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        position: 'relative',
                        transition: 'outline-color .15s, box-shadow .15s'
                    }}
                >
                    {!selected && onDelete && (
                        <ConfirmDeleteButton
                            onConfirm={onDelete}
                            idleLabel={globalize.translate('Delete')}
                            confirmLabel={globalize.translate('ConfirmDeleteImage')}
                        />
                    )}
                </div>
            )}

            {/* Cuadro gris punteado para subir, idéntico al de fondos */}
            {!selected && (
                <div
                    {...drop.props}
                    style={{
                        ...(wide ? { width: 220, aspectRatio: '16/9' } : { width: 100, aspectRatio: '2/3' }),
                        borderRadius: 6, cursor: 'pointer',
                        flexShrink: 0,
                        background: 'rgba(255,255,255,0.05)',
                        border: `1px dashed ${drop.over ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: T.dim, fontSize: wide ? 12 : 10, letterSpacing: 1, textTransform: 'uppercase',
                        textAlign: 'center', padding: 8,
                        transition: 'border-color .15s, transform .15s',
                        transform: drop.over ? 'scale(1.02)' : 'scale(1)'
                    }}
                >
                    + {addLabel}
                </div>
            )}

            {/* Alternativas integradas directamente al lado en la misma fila horizontal */}
            {selected && alt && (
                <RemoteAlternativesTrack
                    alt={alt}
                    thumbAspect={aspect}
                    fit={fit}
                    cardWidth={cardWidth}
                />
            )}
        </div>
    );
}

