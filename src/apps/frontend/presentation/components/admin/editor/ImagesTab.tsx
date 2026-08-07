import globalize from 'lib/globalize';

import { useEffect, useState } from 'react';
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
import { PillButton, TextField } from '../../controls/fields';
import { BackdropTile } from './BackdropTile';
import { ConfirmDeleteButton, type ImgType } from './primitives';
import { RemoteAlternativesGrid, useRemoteAlternatives } from './RemoteAlternatives';
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
    const run = useImageAction(onDone, onError);
    const alt = useRemoteAlternatives({
        itemId, type, onApplied: onDone, onError,
        appliedMessage: globalize.translate('MessageImageApplied', label),
        // Sustituida la que había, no queda nada que elegir.
        closeOnApply: true
    });

    return (
        <div>
            <SectionHeader label={label} onSearch={alt.open} loading={alt.loading} />
            <ImageEditor
                src={src} wide={wide} fit={fit}
                onUploadFile={(file) => run(
                    uploadImageFile(itemId, type, file),
                    globalize.translate('MessageImageUploaded', label)
                )}
                onApplyUrl={(url) => run(setImageByUrl(itemId, type, url))}
                onDelete={src ? () => run(
                    deleteImage(itemId, type),
                    globalize.translate('MessageImageDeleted')
                ) : undefined}
            />
            <RemoteAlternativesGrid
                alt={alt}
                thumbAspect={type === 'Primary' ? '2/3' : '16/9'}
                fit={fit}
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
    const [newUrl, setNewUrl] = useState('');

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
                onSearch={alt.open}
                loading={alt.loading}
            />
            <div style={{ fontSize: 12, color: T.dim, marginBottom: 12 }}>
                {globalize.translate('MessageBackdropsHelp')}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {order.map((b, i) => (
                    <BackdropTile
                        key={b.tag}
                        src={imageUrl(itemId, 'Backdrop', { tag: b.tag, maxWidth: 640, index: b.index })
                            + `&bust=${refreshTick}`}
                        position={i}
                        total={order.length}
                        active={active === i}
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
                <div
                    {...drop.props}
                    style={{
                        width: 220, aspectRatio: '16/9', borderRadius: 6, cursor: 'pointer',
                        background: 'rgba(255,255,255,0.05)',
                        border: `1px dashed ${drop.over ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: T.dim, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase',
                        transition: 'border-color .15s'
                    }}
                >
                    + {globalize.translate('Backdrop')}
                </div>
            </div>
            {drop.input}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <div style={{ flex: 1 }}>
                    <TextField
                        value={newUrl} onChange={setNewUrl} size='md'
                        placeholder={globalize.translate('LabelImageUrl')}
                    />
                </div>
                <PillButton
                    variant='ghost'
                    disabled={!newUrl}
                    onClick={() => {
                        void run(setImageByUrl(itemId, 'Backdrop', newUrl), added);
                        setNewUrl('');
                    }}
                >
                    {globalize.translate('ButtonAddImage')}
                </PillButton>
            </div>
            <RemoteAlternativesGrid alt={alt} thumbAspect='16/9' />
        </div>
    );
}

/** El título de una sección y su botón de buscar alternativas. */
function SectionHeader({
    label, onSearch, loading
}: {
    label: string; onSearch: () => void; loading: boolean;
}) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <div style={{
                fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: T.dim
            }}>{label}</div>
            <div style={{ marginLeft: 'auto' }}>
                <PillButton variant='ghost' onClick={onSearch} busy={loading}>
                    {loading ? 'Buscando…' : 'Buscar alternativas'}
                </PillButton>
            </div>
        </div>
    );
}

/** La imagen actual (o el hueco donde iría), y las tres formas de cambiarla. */
function ImageEditor({
    src, wide, fit = 'cover', onUploadFile, onApplyUrl, onDelete
}: {
    src?: string; wide?: boolean; fit?: 'cover' | 'contain';
    onUploadFile: (file: File) => void;
    onApplyUrl: (url: string) => void;
    onDelete?: () => Promise<void>;
}) {
    const [newUrl, setNewUrl] = useState('');
    const drop = useImageDrop({ onFiles: (files) => onUploadFile(files[0]) });

    return (
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div
                {...drop.props}
                style={{
                    ...(wide ? { width: 220, aspectRatio: '16/9' } : { width: 100, aspectRatio: '2/3' }),
                    borderRadius: 6, cursor: 'pointer',
                    // El logo (fit: 'contain') es un PNG con aspect ratio propio: con
                    // 'cover' se recortaba dentro de la caja 16/9 y no se veía entero.
                    background: fit === 'contain' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.05)',
                    border: `1px dashed ${drop.over ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.16)'}`,
                    backgroundImage: src ? `url(${src})` : undefined,
                    backgroundSize: fit, backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                    position: 'relative', transition: 'border-color .15s, transform .15s',
                    transform: drop.over ? 'scale(1.02)' : 'scale(1)'
                }}
            >
                {!src && (
                    <div style={{
                        position: 'absolute', inset: 0, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, color: T.dim, textAlign: 'center', padding: 8,
                        letterSpacing: 1, textTransform: 'uppercase'
                    }}>
                        Arrastra o pulsa
                    </div>
                )}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {drop.input}
                <div style={{ display: 'flex', gap: 8 }}>
                    <PillButton onClick={drop.open}>{globalize.translate('Upload')}</PillButton>
                    {onDelete && (
                        <ConfirmDeleteButton
                            variant='button'
                            onConfirm={onDelete}
                            idleLabel={globalize.translate('DeleteImage')}
                            confirmLabel={globalize.translate('ConfirmDeleteImage')}
                        />
                    )}
                </div>
                <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>o desde una URL:</div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                        <TextField value={newUrl} onChange={setNewUrl} size='md' placeholder='https://…' />
                    </div>
                    <PillButton
                        variant='ghost'
                        disabled={!newUrl}
                        onClick={() => { onApplyUrl(newUrl); setNewUrl(''); }}
                    >
                        {globalize.translate('Apply')}
                    </PillButton>
                </div>
            </div>
        </div>
    );
}
