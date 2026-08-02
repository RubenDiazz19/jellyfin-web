import globalize from 'lib/globalize';

import { useEffect, useRef, useState } from 'react';
import {
    deleteImage,
    getItemRaw,
    getRemoteImages,
    imageUrl,
    moveImage,
    setImageByUrl,
    uploadImageFile,
    type JFRemoteImage
} from '../../../../domain/api';
import { T } from '../../../theme/tokens';
import { useToast } from '../../toast/ToastProvider';
import {
    ConfirmDeleteButton,
    ImgType,
    PrimaryBtn,
    SecondaryBtn,
    SectionHeader,
    TextInput
} from './primitives';

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

    const bust = (u?: string, tag?: string) =>
        u ? `${u}${u.includes('?') ? '&' : '?'}bust=${tag ?? refreshTick}` : undefined;

    const primary = bust(
        imageUrl(itemId, 'Primary', { maxHeight: 600, tag: primaryTag }),
        primaryTag
    );
    const logo = bust(
        imageUrl(itemId, 'Logo', { maxHeight: 300, tag: logoTag }),
        logoTag
    );

    const applyOk = () => setRefreshTick((n) => n + 1);
    const showErr = (e: unknown) => toast((e as Error).message, 'warn');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
            <SingleImageSection
                label={globalize.translate('Primary')} itemId={itemId} type='Primary' src={primary}
                onDone={applyOk} onError={showErr}
            />
            <BackdropSection
                itemId={itemId} tags={backdropTags} refreshTick={refreshTick}
                onDone={applyOk} onError={showErr}
            />
            <SingleImageSection
                label={globalize.translate('Logo')} itemId={itemId} type='Logo' src={logo} wide
                onDone={applyOk} onError={showErr}
            />
        </div>
    );
}

// Single-image section (poster or logo).
function SingleImageSection({
    label, itemId, type, src, wide, onDone, onError
}: {
    label: string; itemId: string; type: ImgType; src?: string; wide?: boolean;
    onDone: () => void; onError: (e: unknown) => void;
}) {
    const [alt, setAlt] = useState<'idle' | 'loading' | 'results'>('idle');
    const [images, setImages] = useState<JFRemoteImage[]>([]);
    const [applying, setApplying] = useState<string | null>(null);
    const toast = useToast();

    const doApplyUrl = async (url: string) => {
        try {
            await setImageByUrl(itemId, type, url);
            onDone();
        } catch (e) { onError(e); }
    };
    const doUploadFile = async (file: File) => {
        try {
            await uploadImageFile(itemId, type, file);
            toast(globalize.translate('MessageImageUploaded', label), 'success');
            onDone();
        } catch (e) { onError(e); }
    };
    const doDelete = async () => {
        try {
            await deleteImage(itemId, type);
            toast(globalize.translate('MessageImageDeleted'), 'success');
            onDone();
        } catch (e) { onError(e); }
    };

    const openAlternatives = async () => {
        setAlt('loading');
        try {
            const { images: remote } = await getRemoteImages(itemId, type);
            setImages(remote);
            setAlt('results');
        } catch (e) {
            setAlt('idle');
            onError(e);
        }
    };

    const applyRemote = async (url: string) => {
        setApplying(url);
        try {
            await setImageByUrl(itemId, type, url);
            toast(globalize.translate('MessageImageApplied', label), 'success');
            onDone();
            setAlt('idle');
        } catch (e) { onError(e); } finally { setApplying(null); }
    };

    return (
        <div>
            <SectionHeader label={label} onSearch={openAlternatives} loading={alt === 'loading'} />
            <ImageEditor
                src={src} wide={wide} fit={type === 'Logo' ? 'contain' : 'cover'}
                onUploadFile={doUploadFile}
                onApplyUrl={doApplyUrl}
                onDelete={src ? doDelete : undefined}
            />
            {alt === 'results' && (
                <RemoteImagesGrid
                    images={images} thumbAspect={type === 'Primary' ? '2/3' : '16/9'}
                    fit={type === 'Logo' ? 'contain' : 'cover'}
                    onPick={applyRemote} applying={applying}
                    onClose={() => setAlt('idle')}
                />
            )}
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

// Backdrop section: multiple images with an "add" tile.
function BackdropSection({
    itemId, tags, refreshTick, onDone, onError
}: {
    itemId: string; tags: string[]; refreshTick: number;
    onDone: () => void; onError: (e: unknown) => void;
}) {
    const [alt, setAlt] = useState<'idle' | 'loading' | 'results'>('idle');
    const [images, setImages] = useState<JFRemoteImage[]>([]);
    const [applying, setApplying] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const [newUrl, setNewUrl] = useState('');
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

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        for (const f of Array.from(files)) {
            if (!f.type.startsWith('image/')) continue;
            try {
                await uploadImageFile(itemId, 'Backdrop', f);
                toast(globalize.translate('MessageBackdropAdded'), 'success');
            } catch (e) { onError(e); }
        }
        onDone();
    };

    const addByUrl = async () => {
        try {
            await setImageByUrl(itemId, 'Backdrop', newUrl);
            toast(globalize.translate('MessageBackdropAdded'), 'success');
            setNewUrl('');
            onDone();
        } catch (e) { onError(e); }
    };

    const deleteAt = async (index: number) => {
        try {
            await deleteImage(itemId, 'Backdrop', index);
            toast(globalize.translate('MessageImageDeleted'), 'success');
            onDone();
        } catch (e) { onError(e); }
    };

    const openAlternatives = async () => {
        setAlt('loading');
        try {
            const { images: remote } = await getRemoteImages(itemId, 'Backdrop');
            setImages(remote);
            setAlt('results');
        } catch (e) {
            setAlt('idle');
            onError(e);
        }
    };

    const applyRemote = async (url: string) => {
        setApplying(url);
        try {
            await setImageByUrl(itemId, 'Backdrop', url);
            toast(globalize.translate('MessageBackdropAdded'), 'success');
            onDone();
        } catch (e) { onError(e); } finally { setApplying(null); }
    };

    return (
        <div>
            <SectionHeader
                label={`Fondos (${order.length})`}
                onSearch={openAlternatives}
                loading={alt === 'loading'}
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
                        onDelete={() => deleteAt(b.index)}
                    />
                ))}
                <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        void handleFiles(e.dataTransfer.files);
                    }}
                    onClick={() => fileRef.current?.click()}
                    style={{
                        width: 220, aspectRatio: '16/9', borderRadius: 6, cursor: 'pointer',
                        background: 'rgba(255,255,255,0.05)',
                        border: `1px dashed ${dragOver ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: T.dim, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase',
                        transition: 'border-color .15s'
                    }}
                >
                    + {globalize.translate('Backdrop')}
                </div>
            </div>
            <input
                ref={fileRef} type='file' accept='image/*' multiple hidden
                onChange={(e) => { void handleFiles(e.target.files); e.target.value = ''; }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <div style={{ flex: 1 }}>
                    <TextInput value={newUrl} onChange={setNewUrl} placeholder={globalize.translate('LabelImageUrl')} />
                </div>
                <SecondaryBtn onClick={addByUrl} disabled={!newUrl}>{globalize.translate('ButtonAddImage')}</SecondaryBtn>
            </div>
            {alt === 'results' && (
                <RemoteImagesGrid
                    images={images} thumbAspect='16/9'
                    onPick={applyRemote} applying={applying}
                    onClose={() => setAlt('idle')}
                />
            )}
        </div>
    );
}

/**
 * Una miniatura de fondo, con lo que se puede hacer con ella.
 *
 * Se reordena de dos maneras a propósito. Arrastrar es lo que se espera de una
 * fila de imágenes, pero no existe para quien va por teclado y es incómodo con
 * muchas: por eso hay además dos flechas, que aparecen al pasar por encima o al
 * llegar el foco. Entre ellas, la posición — que es lo que de verdad se está
 * editando, porque el primero es el que se ve al abrir la ficha.
 */
function BackdropTile({
    src, position, total, active, dragging, dropTarget, busy,
    onActivate, onMove, onDragStart, onDragEnter, onDragEnd, onDrop, onDelete
}: {
    src: string;
    position: number;
    total: number;
    active: boolean;
    dragging: boolean;
    dropTarget: boolean;
    busy: boolean;
    onActivate: (on: boolean) => void;
    onMove: (to: number) => void;
    onDragStart: () => void;
    onDragEnter: () => void;
    onDragEnd: () => void;
    onDrop: () => void;
    onDelete: () => Promise<void>;
}) {
    const arrow: React.CSSProperties = {
        width: 24, height: 24, borderRadius: '50%', padding: 0,
        background: 'rgba(255,255,255,0.12)', color: '#fff',
        border: '1px solid rgba(255,255,255,0.2)',
        fontSize: 13, lineHeight: 1, cursor: 'pointer'
    };

    return (
        <div
            draggable={!busy}
            onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
            onDragEnter={onDragEnter}
            // Sin este preventDefault el navegador no considera el elemento un
            // destino válido y nunca llega el drop.
            onDragOver={(e) => e.preventDefault()}
            onDragEnd={onDragEnd}
            onDrop={(e) => { e.preventDefault(); onDrop(); }}
            onMouseEnter={() => onActivate(true)}
            onMouseLeave={() => onActivate(false)}
            onFocusCapture={() => onActivate(true)}
            onBlurCapture={(e) => {
                // Solo se apaga si el foco sale del tile entero, no al saltar
                // de una de sus flechas a la otra.
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onActivate(false);
            }}
            style={{
                position: 'relative', borderRadius: 6,
                cursor: busy ? 'wait' : 'grab',
                opacity: dragging ? 0.35 : 1,
                outline: dropTarget ? '2px solid #fff' : '2px solid transparent',
                outlineOffset: 2,
                transition: 'opacity .15s, outline-color .15s'
            }}
        >
            <div style={{
                width: 220, aspectRatio: '16/9', borderRadius: 6,
                backgroundImage: `url(${src})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                border: '1px solid rgba(255,255,255,0.08)'
            }} />

            <div style={{
                position: 'absolute', left: 0, right: 0, bottom: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '8px 0', borderRadius: '0 0 6px 6px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                opacity: active ? 1 : 0,
                // Invisible no debe seguir siendo clicable, ni por ratón ni
                // por teclado: de ahí el visibility además del opacity.
                visibility: active ? 'visible' : 'hidden',
                transition: 'opacity .15s'
            }}>
                <button
                    onClick={() => onMove(position - 1)}
                    disabled={busy || position === 0}
                    aria-label={globalize.translate('MoveLeft')}
                    title={globalize.translate('MoveLeft')}
                    style={{ ...arrow, opacity: position === 0 ? 0.3 : 1 }}
                >‹</button>
                <span style={{ fontFamily: T.ui, fontSize: 11, color: '#fff', letterSpacing: 1 }}>
                    {position + 1}/{total}
                </span>
                <button
                    onClick={() => onMove(position + 1)}
                    disabled={busy || position === total - 1}
                    aria-label={globalize.translate('MoveRight')}
                    title={globalize.translate('MoveRight')}
                    style={{ ...arrow, opacity: position === total - 1 ? 0.3 : 1 }}
                >›</button>
            </div>

            <ConfirmDeleteButton
                onConfirm={onDelete}
                idleLabel={globalize.translate('Delete')}
                confirmLabel={globalize.translate('ConfirmDeleteImage')}
            />
        </div>
    );
}

// Reusable dropzone + URL + delete triplet.
function ImageEditor({
    src, wide, fit = 'cover', onUploadFile, onApplyUrl, onDelete
}: {
    src?: string; wide?: boolean; fit?: 'cover' | 'contain';
    onUploadFile: (file: File) => void;
    onApplyUrl: (url: string) => void;
    onDelete?: () => Promise<void>;
}) {
    const [newUrl, setNewUrl] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const previewStyle: React.CSSProperties = wide ?
        { width: 220, aspectRatio: '16/9' } :
        { width: 100, aspectRatio: '2/3' };

    const handleFiles = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const f = files[0];
        if (!f.type.startsWith('image/')) return;
        onUploadFile(f);
    };

    return (
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    void handleFiles(e.dataTransfer.files);
                }}
                onClick={() => fileRef.current?.click()}
                style={{
                    ...previewStyle,
                    borderRadius: 6, cursor: 'pointer',
                    // El logo (fit: 'contain') es un PNG con aspect ratio propio: con
                    // 'cover' se recortaba dentro de la caja 16/9 y no se veía entero.
                    background: fit === 'contain' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.05)',
                    border: `1px dashed ${dragOver ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.16)'}`,
                    backgroundImage: src ? `url(${src})` : undefined,
                    backgroundSize: fit, backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                    position: 'relative', transition: 'border-color .15s, transform .15s',
                    transform: dragOver ? 'scale(1.02)' : 'scale(1)'
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
                <input
                    ref={fileRef} type='file' accept='image/*' hidden
                    onChange={(e) => { void handleFiles(e.target.files); e.target.value = ''; }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                    <PrimaryBtn onClick={() => fileRef.current?.click()}>{globalize.translate('Upload')}</PrimaryBtn>
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
                        <TextInput value={newUrl} onChange={setNewUrl} placeholder='https://…' />
                    </div>
                    <SecondaryBtn
                        onClick={() => { onApplyUrl(newUrl); setNewUrl(''); }}
                        disabled={!newUrl}
                    >{globalize.translate('Apply')}</SecondaryBtn>
                </div>
            </div>
        </div>
    );
}

// Grid of alternatives fetched from remote providers.
function RemoteImagesGrid({
    images, thumbAspect, fit = 'cover', onPick, applying, onClose
}: {
    images: JFRemoteImage[]; thumbAspect: string; fit?: 'cover' | 'contain';
    onPick: (url: string) => void; applying: string | null;
    onClose: () => void;
}) {
    const [lang, setLang] = useState<string>('');
    const langs = Array.from(new Set(images.map((i) => i.Language).filter(Boolean))) as string[];
    const filtered = lang ? images.filter((i) => i.Language === lang) : images;
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
                    onClick={onClose}
                    style={{
                        marginLeft: 'auto', background: 'none', border: 'none',
                        color: T.dim, cursor: 'pointer', fontSize: 12
                    }}
                >{globalize.translate('ButtonClose')}</button>
            </div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 10, maxHeight: 380, overflowY: 'auto'
            }}>
                {filtered.map((im) => {
                    const isApplying = applying === im.Url;
                    return (
                        <button
                            key={im.Url}
                            onClick={() => onPick(im.Url)}
                            disabled={isApplying}
                            title={[im.Width && im.Height && `${im.Width}×${im.Height}`, im.ProviderName, im.Language]
                                .filter(Boolean).join(' · ')}
                            style={{
                                padding: 0, border: '1px solid rgba(255,255,255,0.08)',
                                background: 'rgba(255,255,255,0.04)', borderRadius: 6,
                                cursor: isApplying ? 'wait' : 'pointer',
                                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                                opacity: isApplying ? 0.6 : 1,
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
                                width: '100%', aspectRatio: thumbAspect,
                                background: fit === 'contain' ? 'rgba(0,0,0,0.35)' : undefined,
                                backgroundImage: `url(${im.ThumbnailUrl || im.Url})`,
                                backgroundSize: fit, backgroundPosition: 'center', backgroundRepeat: 'no-repeat'
                            }} />
                            <div style={{
                                padding: '6px 8px', fontSize: 10, color: T.dim,
                                display: 'flex', justifyContent: 'space-between', gap: 6,
                                textAlign: 'left'
                            }}>
                                <span>{im.Width && im.Height ? `${im.Width}×${im.Height}` : ''}</span>
                                <span>{im.Language ?? ''}</span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
