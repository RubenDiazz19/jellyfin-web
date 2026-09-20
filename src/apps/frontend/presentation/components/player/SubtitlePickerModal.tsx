import globalize from 'lib/globalize';

import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { videoPlayerVM } from '../../../domain/viewModels/VideoPlayerViewModel';
import { T } from '../../theme/tokens';
import { ToastProvider } from '../toast/ToastProvider';
import { Muted, PillButton, TextField } from '../controls/fields';
import { TabBar } from '../controls/TabBar';
import { Field } from '../admin/editor/primitives';
import { POPULAR_LANGS, useSubtitleSearch } from '../admin/editor/useSubtitleSearch';
import { SubtitleSearchAndUpload } from '../admin/editor/SubtitleSearchAndUpload';

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

    const searchArgs = useSubtitleSearch({
        itemId,
        onSubtitleUpdated: async () => {
            await videoPlayerVM.refreshSubtitleTracks(true);
            onClose();
        }
    });

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

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
                <TabBar
                    active={tab}
                    onChange={(id) => setTab(id as 'search' | 'upload')}
                    tabs={[
                        { id: 'search', label: `${globalize.translate('SearchForSubtitles')} (OpenSubtitles)` },
                        { id: 'upload', label: globalize.translate('HeaderUploadSubtitle') }
                    ]}
                />

                {/* Contenido con scroll */}
                <div style={{ overflowY: 'auto', padding: 20, flex: 1 }}>
                    <SubtitleSearchAndUpload tab={tab} searchArgs={searchArgs} />
                </div>
            </div>
        </div>
    );
}
