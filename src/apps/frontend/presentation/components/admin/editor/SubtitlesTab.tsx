// Pestaña de gestión de subtítulos: lista pistas actuales (con borrado de
// externas), búsqueda remota (OpenSubtitles) y subida manual de archivos.

import globalize from 'lib/globalize';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    deleteSubtitle,
    downloadSubtitle,
    fileToBase64,
    getItemSubtitles,
    searchSubtitles,
    uploadSubtitle,
    type MediaStreamInfo,
    type RemoteSubtitle
} from '../../../../domain/api';
import { T } from '../../../theme/tokens';
import { useToast } from '../../toast/ToastProvider';
import { Muted, PillButton, TextField } from '../../controls/fields';
import { ConfirmDeleteButton, Field } from './primitives';

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

export function SubtitlesTab({ itemId }: { itemId: string }) {
    const [subtitles, setSubtitles] = useState<MediaStreamInfo[]>([]);
    const [loadingSubs, setLoadingSubs] = useState(true);
    const [tab, setTab] = useState<'search' | 'upload'>('search');

    // Búsqueda remota
    const [lang, setLang] = useState('spa');
    const [isPerfectMatch, setIsPerfectMatch] = useState(false);
    const [results, setResults] = useState<RemoteSubtitle[] | null>(null);
    const [searching, setSearching] = useState(false);
    const [downloading, setDownloading] = useState<string | null>(null);

    // Subida manual
    const [file, setFile] = useState<File | null>(null);
    const [uploadLang, setUploadLang] = useState('spa');
    const [isForced, setIsForced] = useState(false);
    const [isHearingImpaired, setIsHearingImpaired] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const toast = useToast();

    const loadInstalled = useCallback(async () => {
        try {
            const list = await getItemSubtitles(itemId);
            setSubtitles(list);
        } catch {
            // Ignoramos error inicial silenciosamente
        } finally {
            setLoadingSubs(false);
        }
    }, [itemId]);

    useEffect(() => {
        void loadInstalled();
    }, [loadInstalled]);

    const doSearch = async () => {
        if (!lang) return;
        setSearching(true);
        try {
            const rs = await searchSubtitles(itemId, lang.trim(), isPerfectMatch);
            setResults(rs);
            if (rs.length === 0) {
                toast(globalize.translate('NoSubtitleSearchResultsFound'), 'info');
            }
        } catch (e) {
            toast((e as Error).message, 'warn');
        } finally {
            setSearching(false);
        }
    };

    const doDownload = async (id: string) => {
        setDownloading(id);
        try {
            await downloadSubtitle(itemId, id);
            toast(globalize.translate('MessageSubtitleDownloaded'), 'success');
            await loadInstalled();
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
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            await loadInstalled();
        } catch (e) {
            toast((e as Error).message, 'warn');
        } finally {
            setUploading(false);
        }
    };

    const doDelete = async (index: number) => {
        try {
            await deleteSubtitle(itemId, index);
            toast(globalize.translate('MessageSubtitleDeleted'), 'info');
            await loadInstalled();
        } catch (e) {
            toast((e as Error).message, 'warn');
        }
    };

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const dropped = e.dataTransfer.files?.[0];
        if (dropped) setFile(dropped);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* ── Subtítulos instalados ── */}
            <div>
                <div style={{
                    fontSize: 12, fontWeight: 600, letterSpacing: 1.5,
                    textTransform: 'uppercase', color: T.dim, marginBottom: 8
                }}>
                    {globalize.translate('Subtitles')} ({subtitles.length})
                </div>

                {loadingSubs ? (
                    <div style={{ fontSize: 13, color: T.dim, padding: '8px 0' }}>…</div>
                ) : subtitles.length === 0 ? (
                    <div style={{
                        padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)', fontSize: 13, color: T.dim
                    }}>
                        {globalize.translate('NoSubtitleSearchResultsFound')}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {subtitles.map((s) => (
                            <div
                                key={s.index}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                                    background: 'rgba(255,255,255,0.04)', borderRadius: 8,
                                    border: '1px solid rgba(255,255,255,0.06)'
                                }}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500 }}>{s.displayTitle}</div>
                                    <div style={{
                                        display: 'flex', gap: 6, alignItems: 'center',
                                        marginTop: 4, flexWrap: 'wrap'
                                    }}>
                                        {s.language && <Badge label={s.language.toUpperCase()} />}
                                        {s.codec && <Badge label={s.codec.toUpperCase()} />}
                                        {s.isExternal && <Badge label='Externo' accent />}
                                        {!s.isExternal && <Badge label='Integrado' />}
                                        {s.isForced && <Badge label='Forzado' />}
                                        {s.isHearingImpaired && <Badge label='SDH' />}
                                    </div>
                                </div>

                                {s.isExternal && (
                                    <ConfirmDeleteButton
                                        variant='button'
                                        idleLabel='×'
                                        confirmLabel={globalize.translate('Delete')}
                                        onConfirm={() => doDelete(s.index)}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Selector de modo: Buscar vs Subir ── */}
            <div style={{
                display: 'flex', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.08)',
                paddingBottom: 2
            }}>
                <button
                    type='button'
                    onClick={() => setTab('search')}
                    style={{
                        padding: '8px 14px', background: 'none', border: 'none',
                        color: tab === 'search' ? '#fff' : T.dim, cursor: 'pointer',
                        fontFamily: T.ui, fontSize: 13, fontWeight: tab === 'search' ? 600 : 400,
                        borderBottom: tab === 'search' ? '2px solid #fff' : '2px solid transparent',
                        marginBottom: -2
                    }}
                >
                    {globalize.translate('SearchForSubtitles')} (OpenSubtitles)
                </button>
                <button
                    type='button'
                    onClick={() => setTab('upload')}
                    style={{
                        padding: '8px 14px', background: 'none', border: 'none',
                        color: tab === 'upload' ? '#fff' : T.dim, cursor: 'pointer',
                        fontFamily: T.ui, fontSize: 13, fontWeight: tab === 'upload' ? 600 : 400,
                        borderBottom: tab === 'upload' ? '2px solid #fff' : '2px solid transparent',
                        marginBottom: -2
                    }}
                >
                    {globalize.translate('HeaderUploadSubtitle')}
                </button>
            </div>

            {/* ── Pestaña 1: Búsqueda remota (OpenSubtitles) ── */}
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
                                onClick={() => setLang(item.code)}
                                style={{
                                    padding: '4px 10px', borderRadius: 999, fontSize: 12,
                                    background: lang === item.code ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${lang === item.code ? '#fff' : 'rgba(255,255,255,0.1)'}`,
                                    color: '#fff', cursor: 'pointer'
                                }}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'flex-end' }}>
                        <Field label={globalize.translate('LabelSubtitleLanguageCode')}>
                            <TextField size='md' value={lang} onChange={setLang} />
                        </Field>
                        <PillButton onClick={doSearch} busy={searching} disabled={!lang}>
                            {globalize.translate(searching ? 'Searching' : 'Search')}
                        </PillButton>
                    </div>

                    <label style={{
                        display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                        fontSize: 13, color: T.dim, userSelect: 'none'
                    }}>
                        <input
                            type='checkbox'
                            checked={isPerfectMatch}
                            onChange={(e) => setIsPerfectMatch(e.target.checked)}
                            style={{ accentColor: '#fff', cursor: 'pointer' }}
                        />
                        {globalize.translate('OptionRequirePerfectSubtitleMatch')}
                    </label>

                    {results && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                            <div style={{ fontSize: 12, color: T.dim }}>
                                {globalize.translate('SearchResultsCount', results.length)}
                            </div>
                            {results.map((r) => (
                                <div key={r.Id} style={{
                                    display: 'flex', alignItems: 'center', gap: 12, padding: 10,
                                    background: 'rgba(255,255,255,0.04)', borderRadius: 8,
                                    border: '1px solid rgba(255,255,255,0.06)'
                                }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 500 }}>{r.Name}</div>
                                        <div style={{
                                            display: 'flex', gap: 8, alignItems: 'center',
                                            fontSize: 11, color: T.dim, marginTop: 4, flexWrap: 'wrap'
                                        }}>
                                            <span>{r.ProviderName || 'OpenSubtitles'}</span>
                                            {r.Language && <span>· {r.Language}</span>}
                                            {r.Format && <span>· {r.Format.toUpperCase()}</span>}
                                            {r.DownloadCount != null && <span>· ⬇ {r.DownloadCount}</span>}
                                            {r.IsForced && <Badge label='Forzado' />}
                                            {r.IsHearingImpaired && <Badge label='SDH' />}
                                        </div>
                                    </div>
                                    <PillButton
                                        onClick={() => doDownload(r.Id)}
                                        variant='ghost'
                                        busy={downloading === r.Id}
                                    >
                                        {globalize.translate(downloading === r.Id ? 'Downloading' : 'Download')}
                                    </PillButton>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Pestaña 2: Subida manual de archivo ── */}
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
    );
}

function Badge({ label, accent }: { label: string; accent?: boolean }) {
    return (
        <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
            background: accent ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
            color: accent ? '#fff' : T.dim, letterSpacing: 0.5
        }}>
            {label}
        </span>
    );
}
