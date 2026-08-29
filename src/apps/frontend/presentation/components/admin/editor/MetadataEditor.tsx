import globalize from 'lib/globalize';

import { Suspense, lazy, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../../theme/tokens';
import { MetadataTab } from './MetadataTab';

const IdentifyTab = lazy(() => import('./IdentifyTab').then((m) => ({ default: m.IdentifyTab })));
const ImagesTab = lazy(() => import('./ImagesTab').then((m) => ({ default: m.ImagesTab })));
const SubtitlesTab = lazy(() => import('./SubtitlesTab').then((m) => ({ default: m.SubtitlesTab })));

export type EditorKind = 'movie' | 'show' | 'season' | 'episode';

// Las temporadas no tienen endpoint en /Items/RemoteSearch: en Jellyfin se
// identifican a través de la serie, no por sí solas.
export type IdentifiableKind = Exclude<EditorKind, 'season'>;
type Tab = 'metadata' | 'identify' | 'images' | 'subtitles';

type Props = {
    itemId: string;
    kind: EditorKind;
    initialTab?: Tab;
    onClose: () => void;
};

export function MetadataEditor({ itemId, kind, initialTab = 'metadata', onClose }: Props) {
    const [tab, setTab] = useState<Tab>(initialTab);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const canSubs = kind === 'episode' || kind === 'movie';
    // Ver IdentifiableKind: las temporadas no se identifican por sí solas.
    const canIdentify = kind !== 'season';

    return ReactDOM.createPortal(
        <div
            onMouseDown={onClose}
            // El editor vive en un portal a <body>, pero React propaga el clic
            // sintético por el árbol original: sin esto, pulsar cualquier botón
            // del editor burbujea hasta el div de la tarjeta (que lleva a la
            // ficha con su `onClick`) y navega lejos. El `onMouseDown` de más
            // arriba solo frena el mousedown; el click sigue su curso.
            onClick={(e) => e.stopPropagation()}
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
            }}
        >
            <div
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                    width: '100%', maxWidth: 720, maxHeight: '90vh',
                    background: 'rgba(18,18,20,0.99)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14,
                    fontFamily: T.ui, color: '#fff', display: 'flex', flexDirection: 'column',
                    boxShadow: '0 30px 80px rgba(0,0,0,0.7)', overflow: 'hidden'
                }}
            >
                <div style={{
                    display: 'flex', alignItems: 'center', padding: '16px 22px',
                    borderBottom: '1px solid rgba(255,255,255,0.08)'
                }}>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{globalize.translate('EditMetadata')}</div>
                    <button
                        onClick={onClose}
                        aria-label={globalize.translate('ButtonClose')}
                        style={{
                            marginLeft: 'auto', background: 'none', border: 'none',
                            color: T.dim, fontSize: 22, cursor: 'pointer', lineHeight: 1
                        }}
                    >×</button>
                </div>

                <div style={{
                    display: 'flex', gap: 4, padding: '6px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 13
                }}>
                    <TabButton label={globalize.translate('LabelMetadata')} active={tab === 'metadata'} onClick={() => setTab('metadata')} />
                    {canIdentify && (
                        <TabButton label={globalize.translate('Identify')} active={tab === 'identify'} onClick={() => setTab('identify')} />
                    )}
                    <TabButton label={globalize.translate('Images')} active={tab === 'images'} onClick={() => setTab('images')} />
                    {canSubs && (
                        <TabButton label={globalize.translate('Subtitles')} active={tab === 'subtitles'} onClick={() => setTab('subtitles')} />
                    )}
                </div>

                <div style={{ overflowY: 'auto', padding: 22, flex: 1 }}>
                    <Suspense fallback={<div style={{ padding: '32px 0', textAlign: 'center', color: T.dim }}>{globalize.translate('Loading')}</div>}>
                        {tab === 'metadata' && <MetadataTab itemId={itemId} onClose={onClose} />}
                        {tab === 'identify' && canIdentify && <IdentifyTab itemId={itemId} kind={kind} onClose={onClose} />}
                        {tab === 'images' && <ImagesTab itemId={itemId} />}
                        {tab === 'subtitles' && canSubs && <SubtitlesTab itemId={itemId} />}
                    </Suspense>
                </div>
            </div>
        </div>,
        document.body
    );
}

function TabButton({ label, active, onClick }: {
    label: string; active: boolean; onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: '10px 14px', background: 'none', border: 'none',
                color: active ? '#fff' : T.dim, cursor: 'pointer',
                fontFamily: T.ui, fontSize: 13, fontWeight: active ? 500 : 400,
                position: 'relative'
            }}
        >
            {label}
            {active && <div style={{
                position: 'absolute', bottom: 0, left: 10, right: 10, height: 2,
                background: '#fff', borderRadius: 1
            }} />}
        </button>
    );
}
