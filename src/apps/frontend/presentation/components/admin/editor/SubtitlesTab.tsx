import globalize from 'lib/globalize';

import { useState } from 'react';
import { downloadSubtitle, searchSubtitles, type RemoteSubtitle } from '../../../../domain/api';
import { T } from '../../../theme/tokens';
import { useToast } from '../../toast/ToastProvider';
import { Field, Muted, PrimaryBtn, SecondaryBtn, TextInput } from './primitives';

export function SubtitlesTab({ itemId }: { itemId: string }) {
    const [lang, setLang] = useState('spa');
    const [results, setResults] = useState<RemoteSubtitle[] | null>(null);
    const [searching, setSearching] = useState(false);
    const [downloading, setDownloading] = useState<string | null>(null);
    const toast = useToast();

    const doSearch = async () => {
        setSearching(true);
        try {
            const rs = await searchSubtitles(itemId, lang);
            setResults(rs);
            if (rs.length === 0) toast(globalize.translate('MessageNoResults'), 'info');
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
        } catch (e) {
            toast((e as Error).message, 'warn');
        } finally {
            setDownloading(null);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Muted>
                {globalize.translate('MessageSubtitleSearchHelp')}
            </Muted>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                <Field label={globalize.translate('LabelSubtitleLanguageCode')}>
                    <TextInput value={lang} onChange={setLang} />
                </Field>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <PrimaryBtn onClick={doSearch} disabled={searching || !lang}>
                        {globalize.translate(searching ? 'Searching' : 'Search')}
                    </PrimaryBtn>
                </div>
            </div>

            {results && results.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                    {results.map((r) => (
                        <div key={r.Id} style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: 10,
                            background: 'rgba(255,255,255,0.04)', borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.06)'
                        }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500 }}>{r.Name}</div>
                                <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>
                                    {[r.ProviderName, r.Language, r.Format].filter(Boolean).join(' · ')}
                                </div>
                            </div>
                            <SecondaryBtn onClick={() => doDownload(r.Id)} disabled={downloading === r.Id}>
                                {globalize.translate(downloading === r.Id ? 'Downloading' : 'Download')}
                            </SecondaryBtn>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
