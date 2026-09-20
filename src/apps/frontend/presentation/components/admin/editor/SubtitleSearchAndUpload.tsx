import globalize from 'lib/globalize';
import { T } from '../../../theme/tokens';
import { Muted, PillButton, TextField } from '../../controls/fields';
import { Field } from './primitives';
import { POPULAR_LANGS, type useSubtitleSearch } from './useSubtitleSearch';

type Props = {
    tab: 'search' | 'upload';
    searchArgs: ReturnType<typeof useSubtitleSearch>;
};

// UI compartida para la búsqueda en OpenSubtitles y la subida manual de subtítulos.
export function SubtitleSearchAndUpload({ tab, searchArgs }: Props) {
    const {
        lang, setLang, isPerfectMatch, results, searching, downloading, searchError,
        doSearch, handleSelectLanguage, handleTogglePerfectMatch, doDownload,
        file, setFile, uploadLang, setUploadLang, isForced, setIsForced, isHearingImpaired, setIsHearingImpaired,
        uploading, dragOver, setDragOver, fileInputRef, handleFileDrop, doUpload
    } = searchArgs;

    if (tab === 'search') {
        return (
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
        );
    }

    if (tab === 'upload') {
        return (
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
                        onClick={() => { void doUpload(); }}
                        disabled={!file || !uploadLang.trim()}
                        busy={uploading}
                    >
                        {globalize.translate('Upload')}
                    </PillButton>
                </div>
            </div>
        );
    }

    return null;
}
