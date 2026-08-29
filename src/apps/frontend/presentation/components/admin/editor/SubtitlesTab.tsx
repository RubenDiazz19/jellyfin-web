// Pestaña de gestión de subtítulos: lista pistas actuales (con borrado de
// externas), búsqueda remota (OpenSubtitles) y subida manual de archivos.

import globalize from 'lib/globalize';

import { useCallback, useEffect, useState } from 'react';
import {
    deleteSubtitle,
    getItemSubtitles,
    type MediaStreamInfo
} from '../../../../domain/api';
import { T } from '../../../theme/tokens';
import { useToast } from '../../toast/ToastProvider';
import { Muted, PillButton, TextField } from '../../controls/fields';
import { ConfirmDeleteButton, Field } from './primitives';
import { POPULAR_LANGS, useSubtitleSearch } from './useSubtitleSearch';

export function SubtitlesTab({ itemId }: { itemId: string }) {
    const [subtitles, setSubtitles] = useState<MediaStreamInfo[]>([]);
    const [loadingSubs, setLoadingSubs] = useState(true);
    const [tab, setTab] = useState<'search' | 'upload'>('search');

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

    const {
        lang, setLang, isPerfectMatch, results, searching, downloading, searchError,
        doSearch, handleSelectLanguage, handleTogglePerfectMatch, doDownload,
        file, setFile, uploadLang, setUploadLang, isForced, setIsForced, isHearingImpaired, setIsHearingImpaired,
        uploading, dragOver, setDragOver, fileInputRef, handleFileDrop, doUpload
    } = useSubtitleSearch({
        itemId,
        onSubtitleUpdated: loadInstalled
    });

    const doDelete = async (index: number) => {
        try {
            await deleteSubtitle(itemId, index);
            toast(globalize.translate('MessageSubtitleDeleted'), 'info');
            await loadInstalled();
        } catch (e) {
            toast((e as Error).message, 'warn');
        }
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
                        <div style={{ textAlign: 'center', padding: '24px 0', color: T.dim, fontSize: 13 }}>
                            {globalize.translate('Searching')}...
                        </div>
                    )}

                    {results && results.length === 0 && !searching && (
                        <div style={{
                            textAlign: 'center', padding: '24px 16px', borderRadius: 10,
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
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
                                                {r.CommunityRating != null && <span>· ★ {r.CommunityRating.toFixed(1)}</span>}
                                                {isForcedSub && <Badge label='Forzado' />}
                                                {isHImpaired && <Badge label='SDH' />}
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
                                );
                            })}
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
