import { useEffect, useRef, useState } from 'react';
import {
    deleteImage,
    getItemRaw,
    getRemoteImages,
    imageUrl,
    setImageByUrl,
    uploadImageFile,
    type JFRemoteImage
} from '../../../../domain/api';
import { T } from '../../../theme/tokens';
import { useToast } from '../../toast/ToastProvider';
import {
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
                label='Póster (Primary)' itemId={itemId} type='Primary' src={primary}
                onDone={applyOk} onError={showErr}
            />
            <BackdropSection
                itemId={itemId} tags={backdropTags} refreshTick={refreshTick}
                onDone={applyOk} onError={showErr}
            />
            <SingleImageSection
                label='Logo' itemId={itemId} type='Logo' src={logo} wide
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
            toast(`${label} subida (${(file.size / 1024).toFixed(0)} KB)`, 'success');
            onDone();
        } catch (e) { onError(e); }
    };
    const doDelete = async () => {
        if (!window.confirm(`¿Borrar ${label}?`)) return;
        try {
            await deleteImage(itemId, type);
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
            toast(`${label} aplicada`, 'success');
            onDone();
            setAlt('idle');
        } catch (e) { onError(e); } finally { setApplying(null); }
    };

    return (
        <div>
            <SectionHeader label={label} onSearch={openAlternatives} loading={alt === 'loading'} />
            <ImageEditor
                src={src} wide={wide}
                onUploadFile={doUploadFile}
                onApplyUrl={doApplyUrl}
                onDelete={src ? doDelete : undefined}
            />
            {alt === 'results' && (
                <RemoteImagesGrid
                    images={images} thumbAspect={type === 'Primary' ? '2/3' : '16/9'}
                    onPick={applyRemote} applying={applying}
                    onClose={() => setAlt('idle')}
                />
            )}
        </div>
    );
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

    const thumbs = tags.map((tag, i) => ({
        index: i,
        url: imageUrl(itemId, 'Backdrop', { tag, maxWidth: 640, index: i })
            + `&bust=${refreshTick}`
    }));

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        for (const f of Array.from(files)) {
            if (!f.type.startsWith('image/')) continue;
            try {
                await uploadImageFile(itemId, 'Backdrop', f);
                toast(`Fondo añadido (${(f.size / 1024).toFixed(0)} KB)`, 'success');
            } catch (e) { onError(e); }
        }
        onDone();
    };

    const addByUrl = async () => {
        try {
            await setImageByUrl(itemId, 'Backdrop', newUrl);
            toast('Fondo añadido', 'success');
            setNewUrl('');
            onDone();
        } catch (e) { onError(e); }
    };

    const deleteAt = async (index: number) => {
        if (!window.confirm(`¿Borrar el fondo ${index + 1}?`)) return;
        try {
            await deleteImage(itemId, 'Backdrop', index);
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
            toast('Fondo añadido', 'success');
            onDone();
        } catch (e) { onError(e); } finally { setApplying(null); }
    };

    return (
        <div>
            <SectionHeader
                label={`Fondos (${tags.length})`}
                onSearch={openAlternatives}
                loading={alt === 'loading'}
            />
            <div style={{ fontSize: 12, color: T.dim, marginBottom: 12 }}>
                Se muestran rotando en el hero de la ficha. Puedes tener todos los que quieras.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {thumbs.map((b) => (
                    <div key={b.index} style={{ position: 'relative' }}>
                        <div style={{
                            width: 220, aspectRatio: '16/9', borderRadius: 6,
                            backgroundImage: `url(${b.url})`,
                            backgroundSize: 'cover', backgroundPosition: 'center',
                            border: '1px solid rgba(255,255,255,0.08)'
                        }} />
                        <button
                            onClick={() => deleteAt(b.index)}
                            aria-label='Borrar'
                            style={{
                                position: 'absolute', top: 6, right: 6,
                                width: 26, height: 26, borderRadius: '50%',
                                background: 'rgba(0,0,0,0.7)', color: '#fff',
                                border: '1px solid rgba(255,255,255,0.2)',
                                cursor: 'pointer', fontSize: 14, lineHeight: 1
                            }}
                        >×</button>
                    </div>
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
                    + Añadir fondo
                </div>
            </div>
            <input
                ref={fileRef} type='file' accept='image/*' multiple hidden
                onChange={(e) => { void handleFiles(e.target.files); e.target.value = ''; }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <div style={{ flex: 1 }}>
                    <TextInput value={newUrl} onChange={setNewUrl} placeholder='Añadir por URL: https://…' />
                </div>
                <SecondaryBtn onClick={addByUrl} disabled={!newUrl}>Añadir URL</SecondaryBtn>
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

// Reusable dropzone + URL + delete triplet.
function ImageEditor({
    src, wide, onUploadFile, onApplyUrl, onDelete
}: {
    src?: string; wide?: boolean;
    onUploadFile: (file: File) => void;
    onApplyUrl: (url: string) => void;
    onDelete?: () => void;
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
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px dashed ${dragOver ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.16)'}`,
                    backgroundImage: src ? `url(${src})` : undefined,
                    backgroundSize: 'cover', backgroundPosition: 'center',
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
                    <PrimaryBtn onClick={() => fileRef.current?.click()}>Subir archivo</PrimaryBtn>
                    {onDelete && <SecondaryBtn onClick={onDelete}>Borrar actual</SecondaryBtn>}
                </div>
                <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>o desde una URL:</div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                        <TextInput value={newUrl} onChange={setNewUrl} placeholder='https://…' />
                    </div>
                    <SecondaryBtn
                        onClick={() => { onApplyUrl(newUrl); setNewUrl(''); }}
                        disabled={!newUrl}
                    >Aplicar URL</SecondaryBtn>
                </div>
            </div>
        </div>
    );
}

// Grid of alternatives fetched from remote providers.
function RemoteImagesGrid({
    images, thumbAspect, onPick, applying, onClose
}: {
    images: JFRemoteImage[]; thumbAspect: string;
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
                            <option value=''>Todos los idiomas</option>
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
                >Cerrar ×</button>
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
                                backgroundImage: `url(${im.ThumbnailUrl || im.Url})`,
                                backgroundSize: 'cover', backgroundPosition: 'center'
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
