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
import { SubtitleSearchAndUpload } from './SubtitleSearchAndUpload';

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

    const searchArgs = useSubtitleSearch({
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

            {/* ── Pestaña 1 y 2: Búsqueda remota y Subida (Compartido) ── */}
            <SubtitleSearchAndUpload tab={tab} searchArgs={searchArgs} />
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
