import globalize from 'lib/globalize';

import { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme/tokens';
import { useToast } from '../toast/ToastProvider';
import { getItemRaw, setItemTags } from '../../../domain/api';

type Props = {
    itemId: string;
    itemTitle?: string;
    /** Etiquetas de toda la biblioteca, para autosugerir en vez de teclear. */
    suggestions?: string[];
    onClose: () => void;
};

/**
 * Editor de etiquetas de un item. Las etiquetas van al servidor (metadatos),
 * así que se leen frescas al abrir: otro cliente pudo cambiarlas.
 *
 * Guardar necesita permiso de edición de metadatos — `POST /Items/{id}` es la
 * misma puerta que el editor del admin. Sin permiso el servidor responde 403 y
 * se avisa por toast; leer y filtrar por etiquetas funciona para cualquiera.
 */
export function TagsDialog({ itemId, itemTitle, suggestions = [], onClose }: Props) {
    const toast = useToast();
    const [tags, setTags] = useState<string[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        getItemRaw(itemId)
            .then((raw) => { if (alive) setTags(raw.Tags ?? []); })
            .catch((e) => { if (alive) setError((e as Error).message); });
        return () => { alive = false; };
    }, [itemId]);

    // Etiquetas ya usadas en la biblioteca que encajan con lo tecleado y que
    // este item aún no tiene: sirven para no escribir la misma a mano dos
    // veces (y que no acaben «anime» y «Anime» como etiquetas distintas).
    const matches = useMemo(() => {
        const assigned = new Set((tags ?? []).map((t) => t.toLowerCase()));
        const needle = draft.trim().toLowerCase();
        return suggestions
            .filter((s) => !assigned.has(s.toLowerCase()))
            .filter((s) => !needle || s.toLowerCase().includes(needle))
            .slice(0, 8);
    }, [suggestions, tags, draft]);

    const add = (tag: string) => {
        const clean = tag.trim();
        if (!clean || !tags) return;
        if (tags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
            setDraft('');
            return;
        }
        setTags([...tags, clean]);
        setDraft('');
    };

    const remove = (tag: string) => {
        setTags((tags ?? []).filter((t) => t !== tag));
    };

    const save = async () => {
        if (!tags) return;
        setBusy(true);
        try {
            await setItemTags(itemId, tags);
            toast(
                globalize.translate('MessageTagsSaved') + (itemTitle ? ` · ${itemTitle}` : ''),
                'success'
            );
            onClose();
        } catch (e) {
            toast((e as Error).message, 'warn');
            setBusy(false);
        }
    };

    return ReactDOM.createPortal(
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: 'min(420px, 100%)', maxHeight: '70vh', overflowY: 'auto',
                    background: 'rgba(18,18,20,0.98)', borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 18px 50px rgba(0,0,0,0.6)',
                    padding: 20, fontFamily: T.ui, color: '#fff'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
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

                {error ? (
                    <div style={{ color: '#ff6b6b', fontSize: 13 }}>{error}</div>
                ) : !tags ? (
                    <div style={{ color: T.dim, fontSize: 13 }}>{globalize.translate('Loading')}</div>
                ) : (
                    <>
                        {tags.length === 0 ? (
                            <div style={{ color: T.dim, fontSize: 13, marginBottom: 14 }}>
                                {globalize.translate('MessageNoTagsYet')}
                            </div>
                        ) : (
                            <div style={{
                                display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14
                            }}>
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
                                            onClick={() => remove(tag)}
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
                            <div style={{
                                display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14
                            }}>
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
                                disabled={busy}
                                onClick={save}
                                style={{
                                    padding: '9px 16px', borderRadius: 999,
                                    background: '#fff', color: '#000', border: 'none',
                                    fontFamily: T.ui, fontSize: 13, fontWeight: 600,
                                    cursor: busy ? 'wait' : 'pointer'
                                }}
                            >
                                {globalize.translate('Save')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
}
