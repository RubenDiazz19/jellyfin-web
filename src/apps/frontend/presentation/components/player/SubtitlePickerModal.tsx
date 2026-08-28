// Modal para buscar en OpenSubtitles o subir archivos de subtítulos directamente
// desde el reproductor de vídeo durante la reproducción.

import globalize from 'lib/globalize';

import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import {
    downloadSubtitle,
    fileToBase64,
    searchSubtitles,
    uploadSubtitle,
    type RemoteSubtitle
} from '../../../domain/api';
import { videoPlayerVM } from '../../../domain/viewModels/VideoPlayerViewModel';
import { T } from '../../theme/tokens';
import { ToastProvider, useToast } from '../toast/ToastProvider';
import { Muted, PillButton, TextField } from '../controls/fields';
import { Field } from '../admin/editor/primitives';

const POPULAR_LANGS = [
    { code: 'spa', label: 'Español (spa)' },
    { code: 'eng', label: 'English (eng)' },
    { code: 'fre', label: 'Français (fre)' },
    { code: 'ger', label: 'Deutsch (ger)' },
    { code: 'ita', label: 'Italiano (ita)' },
    { code: 'por', label: 'Português (por)' },
    { code: 'jpn', label: 'Japanese (jpn)' },
    { code: 'kor', label: 'Korean (kor)' }
];

type Props = {
    itemId: string;
    onClose: () => void;
};

export function SubtitlePickerModal({ itemId, onClose }: Props) {
    // El reproductor (/video) se monta fuera de App.tsx, donde vive el
    // ToastProvider global. Envolver aquí garantiza que useToast funcione
    // siempre, y si ya hay un provider ancestro no interfiere (React usa
    // el más cercano).
    return ReactDOM.createPortal(
        <ToastProvider>
            <SubtitlePickerInner itemId={itemId} onClose={onClose} />
        </ToastProvider>,
        document.body
    );
}

function SubtitlePickerInner({ itemId, onClose }: Props) {
    const [tab, setTab] = useState<'search' | 'upload'>('search');

    // Búsqueda
    const [lang, setLang] = useState('spa');
    const [isPerfectMatch, setIsPerfectMatch] = useState(false);
    const [results, setResults] = useState<RemoteSubtitle[] | null>(null);
    const [searching, setSearching] = useState(false);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);

    // Subida
    const [file, setFile] = useState<File | null>(null);
    const [uploadLang, setUploadLang] = useState('spa');
    const [isForced, setIsForced] = useState(false);
    const [isHearingImpaired, setIsHearingImpaired] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const toast = useToast();

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const doSearch = async (searchLang = lang, perfectMatch = isPerfectMatch) => {
        if (!searchLang.trim()) return;
        setSearching(true);
        setSearchError(null);
        try {
            const rs = await searchSubtitles(itemId, searchLang.trim(), perfectMatch || undefined);
            setResults(rs);
            if (rs.length === 0) {
                toast(globalize.translate('NoSubtitleSearchResultsFound'), 'info');
            }
        } catch (e) {
            const msg = (e as Error).message;
            setSearchError(msg);
            toast(msg, 'warn');
        } finally {
            setSearching(false);
        }
    };

    // Búsqueda automática inicial al abrir el modal
    useEffect(() => {
        if (itemId) {
            void doSearch('spa', isPerfectMatch);
        }
    }, [itemId]);

    const handleSelectLanguage = (code: string) => {
        setLang(code);
        void doSearch(code, isPerfectMatch);
    };

    const handleTogglePerfectMatch = (checked: boolean) => {
        setIsPerfectMatch(checked);
        void doSearch(lang, checked);
    };

    const doDownload = async (id: string) => {
        setDownloading(id);
        try {
            await downloadSubtitle(itemId, id);
            toast(globalize.translate('MessageSubtitleDownloaded'), 'success');
            await new Promise((resolve) => setTimeout(resolve, 400));
            await videoPlayerVM.refreshSubtitleTracks(true);
            onClose();
        } catch (e) {
            toast((e as Error).message, 'warn');
        } finally {
            setDownloading(null);
        }
    };

    const doUpload = async () => {
        if (!file) return;
        setUploading(true);
        try {
            const data = await fileToBase64(file);
            const format = file.name.split('.').pop()?.toLowerCase() || 'srt';
            await uploadSubtitle(itemId, {
                language: uploadLang.trim() || 'spa',
                format,
                isForced,
                isHearingImpaired,
                data
            });
            toast(globalize.translate('MessageSubtitleUploaded'), 'success');
            await new Promise((resolve) => setTimeout(resolve, 400));
            await videoPlayerVM.refreshSubtitleTracks(true);
            onClose();
        } catch (e) {
            toast((e as Error).message, 'warn');
        } finally {
            setUploading(false);
        }
    };

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const dropped = e.dataTransfer.files?.[0];
        if (dropped) setFile(dropped);
    };

    return (
        <div
            onMouseDown={onClose}
            onClick={(e) => e.stopPropagation()}
            style={{
                position: 'fixed', inset: 0, zIndex: 99999,
                background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
            }}
        >
            <div
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                    width: '100%', maxWidth: 620, maxHeight: '85vh',
                    background: 'rgba(22,22,26,0.98)',
                    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14,
                    fontFamily: T.ui, color: '#fff', display: 'flex', flexDirection: 'column',
                    boxShadow: '0 30px 90px rgba(0,0,0,0.8)', overflow: 'hidden'
                }}
            >
                {/* Cabecera */}
                <div style={{
                    display: 'flex', alignItems: 'center', padding: '16px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.08)'
                }}>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{globalize.translate('Subtitles')}</div>
                    <button
                        type='button'
                        onClick={onClose}
                        aria-label={globalize.translate('ButtonClose')}
                        style={{
                            marginLeft: 'auto', background: 'none', border: 'none',
                            color: T.dim, fontSize: 22, cursor: 'pointer', lineHeight: 1
                        }}
                    >×</button>
                </div>

                {/* Subpestañas */}
                <div style={{
                    display: 'flex', gap: 4, padding: '6px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 13
                }}>
                    <button
                        type='button'
                        onClick={() => setTab('search')}
                        style={{
                            padding: '10px 14px', background: 'none', border: 'none',
                            color: tab === 'search' ? '#fff' : T.dim, cursor: 'pointer',
                            fontFamily: T.ui, fontSize: 13, fontWeight: tab === 'search' ? 600 : 400,
                            position: 'relative'
                        }}
                    >
                        {globalize.translate('SearchForSubtitles')} (OpenSubtitles)
                        {tab === 'search' && (
                            <div style={{
                                position: 'absolute', bottom: 0, left: 10, right: 10, height: 2,
                                background: '#fff', borderRadius: 1
                            }} />
                        )}
                    </button>
                    <button
                        type='button'
                        onClick={() => setTab('upload')}
                        style={{
                            padding: '10px 14px', background: 'none', border: 'none',
                            color: tab === 'upload' ? '#fff' : T.dim, cursor: 'pointer',
                            fontFamily: T.ui, fontSize: 13, fontWeight: tab === 'upload' ? 600 : 400,
                            position: 'relative'
                        }}
                    >
                        {globalize.translate('HeaderUploadSubtitle')}
                        {tab === 'upload' && (
                            <div style={{
                                position: 'absolute', bottom: 0, left: 10, right: 10, height: 2,
                                background: '#fff', borderRadius: 1
                            }} />
                        )}
                    </button>
                </div>

                {/* Contenido con scroll */}
                <div style={{ overflowY: 'auto', padding: 20, flex: 1 }}>
                    {tab === 'search' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <Muted>
                                {globalize.translate('MessageSubtitleSearchHelp')}
                            </Muted>

                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {POPULAR_LANGS.map((item) => (
                                    <button
                                        key={item.code}
                                        type='button'
                                        onClick={() => handleSelectLanguage(item.code)}
                                        style={{
                                            padding: '4px 10px', borderRadius: 999, fontSize: 12,
                                            background: lang === item.code ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)',
                                            border: `1px solid ${lang === item.code ? '#fff' : 'rgba(255,255,255,0.1)'}`,
                                            color: '#fff', cursor: 'pointer',
                                            transition: 'background .15s, border-color .15s'
                                        }}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>

                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    void doSearch(lang, isPerfectMatch);
                                }}
                                style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'flex-end' }}
                            >
                                <Field label={globalize.translate('LabelSubtitleLanguageCode')}>
                                    <TextField size='md' value={lang} onChange={setLang} />
                                </Field>
                                <PillButton
                                    onClick={() => { void doSearch(lang, isPerfectMatch); }}
                                    busy={searching}
                                    disabled={!lang.trim()}
                                >
                                    {globalize.translate(searching ? 'Searching' : 'Search')}
                                </PillButton>
                            </form>

                            <label style={{
                                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                                fontSize: 13, color: T.dim, userSelect: 'none'
                            }}>
                                <input
                                    type='checkbox'
                                    checked={isPerfectMatch}
                                    onChange={(e) => handleTogglePerfectMatch(e.target.checked)}
                                    style={{ accentColor: '#fff', cursor: 'pointer' }}
                                />
                                {globalize.translate('OptionRequirePerfectSubtitleMatch')}
                            </label>

                            {searchError && (
                                <div style={{
                                    padding: '10px 14px', borderRadius: 8,
                                    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                                    color: '#fca5a5', fontSize: 13
                                }}>
                                    {searchError}
                                </div>
                            )}

                            {searching && !results && (
                                <div style={{ textAlign: 'center', padding: '30px 0', color: T.dim, fontSize: 13 }}>
                                    {globalize.translate('Searching')}...
                                </div>
                            )}

                            {results && results.length === 0 && !searching && (
                                <div style={{
                                    textAlign: 'center', padding: '28px 16px', borderRadius: 10,
                                    background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)',
                                    color: T.dim, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6
                                }}>
                                    <div style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>
                                        {globalize.translate('NoSubtitleSearchResultsFound')}
                                    </div>
                                    <div>
                                        Prueba buscando en otro idioma o desmarcando la coincidencia exacta.
                                    </div>
                                </div>
                            )}

                            {results && results.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                                    <div style={{ fontSize: 12, color: T.dim }}>
                                        {globalize.translate('SearchResultsCount', results.length)}
                                    </div>
                                    {results.map((r) => {
                                        const subLang = r.ThreeLetterISOLanguageName || r.Language || lang;
                                        const isForcedSub = Boolean(r.Forced ?? r.IsForced);
                                        const isHImpaired = Boolean(r.HearingImpaired ?? r.IsHearingImpaired);

                                        return (
                                            <div key={r.Id} style={{
                                                display: 'flex', alignItems: 'center', gap: 12, padding: 10,
                                                background: 'rgba(255,255,255,0.04)', borderRadius: 8,
                                                border: '1px solid rgba(255,255,255,0.06)'
                                            }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 500, wordBreak: 'break-word' }}>
                                                        {r.Name}
                                                    </div>
                                                    <div style={{
                                                        display: 'flex', gap: 8, alignItems: 'center',
                                                        fontSize: 11, color: T.dim, marginTop: 4, flexWrap: 'wrap'
                                                    }}>
                                                        <span>{r.ProviderName || 'OpenSubtitles'}</span>
                                                        {subLang && <span>· {subLang}</span>}
                                                        {r.Format && <span>· {r.Format.toUpperCase()}</span>}
                                                        {r.DownloadCount != null && <span>· ⬇ {r.DownloadCount}</span>}
                                                        {r.CommunityRating != null && (
                                                            <span>· ★ {r.CommunityRating.toFixed(1)}</span>
                                                        )}
                                                        {isForcedSub && (
                                                            <span style={{
                                                                fontSize: 10, fontWeight: 600, padding: '2px 5px',
                                                                borderRadius: 4, background: 'rgba(255,255,255,0.08)'
                                                            }}>
                                                                Forzado
                                                            </span>
                                                        )}
                                                        {isHImpaired && (
                                                            <span style={{
                                                                fontSize: 10, fontWeight: 600, padding: '2px 5px',
                                                                borderRadius: 4, background: 'rgba(255,255,255,0.08)'
                                                            }}>
                                                                SDH
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <PillButton
                                                    onClick={() => doDownload(r.Id)}
                                                    variant='primary'
                                                    size='sm'
                                                    busy={downloading === r.Id}
                                                >
                                                    {globalize.translate(downloading === r.Id ? 'Downloading' : 'Download')}
                                                </PillButton>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'upload' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleFileDrop}
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    padding: '24px 16px',
                                    border: `2px dashed ${dragOver ? '#fff' : 'rgba(255,255,255,0.18)'}`,
                                    borderRadius: 10,
                                    background: dragOver ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 8,
                                    transition: 'border-color .15s, background .15s'
                                }}
                            >
                                <input
                                    ref={fileInputRef}
                                    type='file'
                                    accept='.srt,.vtt,.ass,.ssa,.sub,.idx'
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                        const selected = e.target.files?.[0];
                                        if (selected) setFile(selected);
                                    }}
                                />
                                <div style={{ fontSize: 24 }}>📄</div>
                                <div style={{ fontSize: 14, fontWeight: 500 }}>
                                    {file ? file.name : globalize.translate('LabelDropSubtitleHere')}
                                </div>
                                <div style={{ fontSize: 12, color: T.dim }}>
                                    {file ?
                                        `${(file.size / 1024).toFixed(1)} KB · Formato: .${file.name.split('.').pop()?.toLowerCase()}` :
                                        '.srt, .vtt, .ass, .ssa, .sub'}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {POPULAR_LANGS.map((item) => (
                                    <button
                                        key={item.code}
                                        type='button'
                                        onClick={() => setUploadLang(item.code)}
                                        style={{
                                            padding: '4px 10px', borderRadius: 999, fontSize: 12,
                                            background: uploadLang === item.code ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)',
                                            border: `1px solid ${uploadLang === item.code ? '#fff' : 'rgba(255,255,255,0.1)'}`,
                                            color: '#fff', cursor: 'pointer'
                                        }}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>

                            <Field label={globalize.translate('LabelSubtitleLanguageCode')}>
                                <TextField size='md' value={uploadLang} onChange={setUploadLang} />
                            </Field>

                            <div style={{ display: 'flex', gap: 20 }}>
                                <label style={{
                                    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                                    fontSize: 13, color: '#fff', userSelect: 'none'
                                }}>
                                    <input
                                        type='checkbox'
                                        checked={isForced}
                                        onChange={(e) => setIsForced(e.target.checked)}
                                        style={{ accentColor: '#fff', cursor: 'pointer' }}
                                    />
                                    {globalize.translate('LabelIsForced')}
                                </label>

                                <label style={{
                                    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                                    fontSize: 13, color: '#fff', userSelect: 'none'
                                }}>
                                    <input
                                        type='checkbox'
                                        checked={isHearingImpaired}
                                        onChange={(e) => setIsHearingImpaired(e.target.checked)}
                                        style={{ accentColor: '#fff', cursor: 'pointer' }}
                                    />
                                    {globalize.translate('LabelIsHearingImpaired')}
                                </label>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                                <PillButton
                                    onClick={doUpload}
                                    busy={uploading}
                                    disabled={!file || !uploadLang}
                                >
                                    {globalize.translate(uploading ? 'Uploading' : 'Upload')}
                                </PillButton>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

