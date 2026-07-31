import globalize from 'lib/globalize';

import { useState } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme/tokens';

type Props = {
    /** Cuántos items recibirán las etiquetas; solo para el encabezado. */
    count: number;
    suggestions?: string[];
    onApply: (tags: string[]) => void | Promise<void>;
    onClose: () => void;
};

/**
 * Etiquetas para un lote. A diferencia de `TagsDialog`, aquí no se leen las
 * etiquetas actuales: los items seleccionados tienen cada uno las suyas y
 * enseñar una lista combinada invitaría a creer que se van a reemplazar.
 * Lo que se hace es SUMAR: nadie pierde las que ya tenía.
 */
export function BulkTagsDialog({ count, suggestions = [], onApply, onClose }: Props) {
    const [tags, setTags] = useState<string[]>([]);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);

    const add = (tag: string) => {
        const clean = tag.trim();
        if (!clean) return;
        if (!tags.some((t) => t.toLowerCase() === clean.toLowerCase())) setTags([...tags, clean]);
        setDraft('');
    };

    const matches = suggestions
        .filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()))
        .filter((s) => !draft.trim() || s.toLowerCase().includes(draft.trim().toLowerCase()))
        .slice(0, 8);

    const apply = async () => {
        if (tags.length === 0) return;
        setBusy(true);
        try {
            await onApply(tags);
        } finally {
            setBusy(false);
        }
    };

    return ReactDOM.createPortal(
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 10001,
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: 'min(420px, 100%)', background: 'rgba(18,18,20,0.98)',
                    borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 18px 50px rgba(0,0,0,0.6)',
                    padding: 20, fontFamily: T.ui, color: '#fff'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>
                        {globalize.translate('EditTags')}
                    </div>
                    <button
                        onClick={onClose}
                        aria-label={globalize.translate('ButtonClose')}
                        style={{
                            marginLeft: 'auto', background: 'none', border: 'none',
                            color: T.dim, cursor: 'pointer', fontSize: 18, lineHeight: 1
                        }}
                    >×</button>
                </div>
                <div style={{ fontSize: 12, color: T.dim, marginBottom: 16 }}>
                    {globalize.translate('HeaderSelectedCount', count)}
                </div>

                {tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                        {tags.map((tag) => (
                            <span
                                key={tag}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 8,
                                    padding: '6px 8px 6px 14px', borderRadius: 999,
                                    background: 'rgba(255,255,255,0.10)', fontSize: 13
                                }}
                            >
                                {tag}
                                <button
                                    onClick={() => setTags(tags.filter((t) => t !== tag))}
                                    aria-label={`${globalize.translate('Delete')} ${tag}`}
                                    style={{
                                        background: 'none', border: 'none', color: T.dim,
                                        cursor: 'pointer', fontSize: 15, lineHeight: 1,
                                        padding: 0, width: 18, height: 18
                                    }}
                                >×</button>
                            </span>
                        ))}
                    </div>
                )}

                {matches.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                        {matches.map((s) => (
                            <button
                                key={s}
                                onClick={() => add(s)}
                                style={{
                                    padding: '5px 12px', borderRadius: 999,
                                    background: 'none', color: T.dim,
                                    border: '1px dashed rgba(255,255,255,0.25)',
                                    fontFamily: T.ui, fontSize: 12, cursor: 'pointer'
                                }}
                            >
                                + {s}
                            </button>
                        ))}
                    </div>
                )}

                <div style={{
                    display: 'flex', gap: 8, paddingTop: 12,
                    borderTop: '1px solid rgba(255,255,255,0.08)'
                }}>
                    <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); add(draft); }
                        }}
                        placeholder={globalize.translate('LabelNewTag')}
                        style={{
                            flex: 1, background: 'rgba(255,255,255,0.06)', color: '#fff',
                            border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
                            padding: '9px 12px', fontFamily: T.ui, fontSize: 13, outline: 'none'
                        }}
                    />
                    <button
                        disabled={busy || tags.length === 0}
                        onClick={apply}
                        style={{
                            padding: '9px 16px', borderRadius: 999, border: 'none',
                            background: tags.length ? '#fff' : 'rgba(255,255,255,0.15)',
                            color: tags.length ? '#000' : T.dim,
                            fontFamily: T.ui, fontSize: 13, fontWeight: 600,
                            cursor: busy || !tags.length ? 'default' : 'pointer'
                        }}
                    >
                        {globalize.translate('Save')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
