import { useEffect, useState } from 'react';

import globalize from 'lib/globalize';

import { getUserViews, refreshLibrary, type UserView } from '../../../domain/api';
import { LibraryCardMenu } from '../../components/admin/LibraryCardMenu';
import { useToast } from '../../components/toast/ToastProvider';
import { T } from '../../theme/tokens';
import type { GoDashboard } from './types';
import { SectionStatus, SectionTitle, btnSecondary } from './ui';

// Los collectionType de Jellyfin se muestran traducidos; los que no
// conocemos se pintan tal cual llegan del servidor.
const COLLECTION_TYPE_KEYS: Record<string, string> = {
    movies: 'Movies',
    tvshows: 'Shows',
    music: 'TabMusic'
};

export function LibrariesSection({ isAdmin, goDashboard }: { isAdmin: boolean; goDashboard: GoDashboard }) {
    const toast = useToast();
    const [views, setViews] = useState<UserView[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [scanning, setScanning] = useState(false);

    useEffect(() => {
        getUserViews().then(setViews).catch((e) => setError((e as Error).message));
    }, []);

    const onScan = async () => {
        setScanning(true);
        try {
            await refreshLibrary();
            toast(globalize.translate('MessageLibraryScanStarted'), 'success');
        } catch (e) {
            toast((e as Error).message, 'warn');
        } finally {
            setScanning(false);
        }
    };

    const typeLabel = (t?: string) => {
        const key = t ? COLLECTION_TYPE_KEYS[t] : undefined;
        return key ? globalize.translate(key) : t ?? '';
    };

    return (
        <div>
            <SectionTitle>{globalize.translate('HeaderLibraries')}</SectionTitle>
            <SectionStatus error={error} loaded={!!views} />
            {views && (
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 20, marginBottom: 36
                }}>
                    {views.map((v) => (
                        <div key={v.id} style={{
                            borderRadius: 10, overflow: 'hidden',
                            border: `1px solid ${T.hairline}`, background: 'rgba(255,255,255,0.03)'
                        }}>
                            <div style={{ position: 'relative' }}>
                                <div style={{
                                    aspectRatio: '16/9',
                                    backgroundImage: v.image ? `url(${v.image})` : undefined,
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    backgroundSize: 'cover', backgroundPosition: 'center'
                                }} />
                                {isAdmin && (
                                    <div style={{
                                        position: 'absolute', top: 6, right: 6,
                                        background: 'rgba(0,0,0,0.5)', borderRadius: 8
                                    }}>
                                        <LibraryCardMenu libraryId={v.id} libraryName={v.name} />
                                    </div>
                                )}
                            </div>
                            <div style={{ padding: '12px 14px' }}>
                                <div style={{ fontSize: 15, fontWeight: 500 }}>{v.name}</div>
                                <div style={{ fontSize: 12, color: T.dim, marginTop: 3 }}>
                                    {typeLabel(v.collectionType)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isAdmin && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button style={btnSecondary} disabled={scanning} onClick={onScan}>
                        {globalize.translate(scanning ? 'Starting' : 'ButtonScanAllLibraries')}
                    </button>
                    <button style={btnSecondary} onClick={() => goDashboard('/libraries')}>
                        {globalize.translate('HeaderLibraryFolders')}
                    </button>
                </div>
            )}
        </div>
    );
}
