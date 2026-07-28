// Lista de la cola de reproducción: ver, reordenar, quitar y saltar a una
// entrada. Se usa igual dentro del reproductor (overlay) y en /queue
// (página), así que no conoce el sitio donde vive: recibe `onPlay`.

import globalize from 'lib/globalize';

import { useEffect } from 'react';

import { useViewModel } from '../../../domain/bridge/useViewModel';
import { queueVM, type QueueEntry } from '../../../domain/viewModels/QueueViewModel';
import { T } from '../../theme/tokens';

type Props = {
    /** Reproduce esa entrada ya, sacándola de la cola. */
    onPlay: (entry: QueueEntry) => void;
    /** Compacto para el overlay del reproductor. */
    dense?: boolean;
};

export function QueuePanel({ onPlay, dense = false }: Props) {
    useViewModel(queueVM);
    useEffect(() => queueVM.start(), []);

    const items = queueVM.items.value;

    if (items.length === 0) {
        return (
            <div style={{ color: T.dim, fontSize: 13, padding: dense ? '18px 4px' : '28px 0' }}>
                {globalize.translate('MessageQueueEmpty')}
            </div>
        );
    }

    return (
        <div>
            <div style={{
                display: 'flex', alignItems: 'baseline', gap: 12,
                marginBottom: dense ? 10 : 18
            }}>
                <span style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: T.dim }}>
                    {globalize.translate('ItemCount', items.length)}
                </span>
                <button
                    type='button'
                    onClick={queueVM.clear}
                    style={{
                        marginLeft: 'auto', background: 'none', border: 'none',
                        color: T.dim, fontFamily: T.ui, fontSize: 12,
                        cursor: 'pointer', padding: '4px 6px'
                    }}
                >
                    {globalize.translate('ClearQueue')}
                </button>
            </div>

            <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {items.map((entry, i) => (
                    <li
                        key={entry.itemId}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: dense ? '8px 0' : '12px 0',
                            borderBottom: `1px solid ${T.hairline}`
                        }}
                    >
                        <button
                            type='button'
                            onClick={() => onPlay(entry)}
                            title={globalize.translate('Play')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                flex: 1, minWidth: 0, textAlign: 'left',
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'inherit', fontFamily: T.ui, padding: 0
                            }}
                        >
                            <span
                                aria-hidden='true'
                                style={{
                                    width: dense ? 34 : 44, height: dense ? 50 : 64, flexShrink: 0,
                                    borderRadius: 4, background: entry.poster ?
                                        `url(${entry.poster}) center/cover` :
                                        'rgba(255,255,255,0.08)'
                                }}
                            />
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <span style={{
                                    display: 'block', fontSize: dense ? 13 : 14,
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                }}>
                                    {entry.title}
                                </span>
                                {entry.subtitle && (
                                    <span style={{
                                        display: 'block', fontSize: 11, color: T.dim, marginTop: 2,
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                    }}>
                                        {entry.subtitle}
                                    </span>
                                )}
                            </span>
                        </button>

                        <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                            <RowButton
                                label={globalize.translate('MoveUp')}
                                glyph='↑'
                                disabled={i === 0}
                                onClick={() => queueVM.moveUp(entry.itemId)}
                            />
                            <RowButton
                                label={globalize.translate('MoveDown')}
                                glyph='↓'
                                disabled={i === items.length - 1}
                                onClick={() => queueVM.moveDown(entry.itemId)}
                            />
                            <RowButton
                                label={globalize.translate('RemoveFromQueue')}
                                glyph='✕'
                                onClick={() => queueVM.remove(entry.itemId)}
                            />
                        </span>
                    </li>
                ))}
            </ol>
        </div>
    );
}

function RowButton({
    label, glyph, onClick, disabled = false
}: {
    label: string; glyph: string; onClick: () => void; disabled?: boolean;
}) {
    return (
        <button
            type='button'
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            title={label}
            style={{
                width: 32, height: 32, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', borderRadius: '50%',
                color: disabled ? 'rgba(255,255,255,0.25)' : T.dim,
                cursor: disabled ? 'default' : 'pointer',
                fontSize: 14, fontFamily: T.ui, padding: 0
            }}
        >
            <span aria-hidden='true'>{glyph}</span>
        </button>
    );
}
