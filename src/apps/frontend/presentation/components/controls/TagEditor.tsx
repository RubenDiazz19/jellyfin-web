// Las etiquetas se editan en dos sitios —las de un item y las de un lote— y
// las dos cajas hacen lo mismo: enseñarlas como píldoras quitables y dejar
// buscar en el vocabulario cerrado para añadir nuevas. No hay texto libre:
// el usuario elige del vocabulario y de ninguna otra fuente.

import { useMemo, useState } from 'react';
import globalize from 'lib/globalize';

import { T } from '../../theme/tokens';
import { VOCABULARY_TAGS, canonicalTag } from '../../../domain/tags';

/** Cuántas sugerencias caben sin que la caja se convierta en una lista. */
const MAX_SUGGESTIONS = 12;

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Lo que se está buscando en el vocabulario y qué etiquetas encajan.
 *
 * `tags` a `null` es «todavía no se sabe» (se están leyendo del servidor):
 * entonces no se puede añadir nada, porque añadir sobre una lista que aún no
 * ha llegado la borraría al guardar.
 */
export function useTagDraft({
    tags, onAdd
}: {
    tags: string[] | null;
    onAdd: (tag: string) => void;
}) {
    const [draft, setDraft] = useState('');

    // Vocabulario completo filtrado: las que el item ya tiene se ocultan, y se
    // busca por lo tecleado. El usuario elige de aquí, no escribe texto libre.
    const matches = useMemo(() => {
        const assigned = tags ?? [];
        const needle = draft.trim().toLowerCase();
        return VOCABULARY_TAGS
            .filter((s) => !assigned.some((t) => same(t, s)))
            .filter((s) => !needle || s.toLowerCase().includes(needle))
            .slice(0, MAX_SUGGESTIONS);
    }, [tags, draft]);

    const add = (tag: string) => {
        const canon = canonicalTag(tag);
        if (!canon || !tags) return;
        // Repetida: no se añade, pero el campo se vacía igual.
        if (!tags.some((t) => same(t, canon))) onAdd(canon);
        setDraft('');
    };

    return { draft, setDraft, matches, add };
}

/** Las etiquetas puestas, cada una con su aspa. */
export function TagChips({ tags, onRemove }: { tags: string[]; onRemove: (tag: string) => void }) {
    if (tags.length === 0) return null;
    return (
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
                        onClick={() => onRemove(tag)}
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
    );
}

/** Las que están en el vocabulario y encajan con la búsqueda: se ponen de un toque. */
export function TagSuggestions({
    suggestions, onAdd
}: {
    suggestions: string[]; onAdd: (tag: string) => void;
}) {
    if (suggestions.length === 0) return null;
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {suggestions.map((s) => (
                <button
                    key={s}
                    onClick={() => onAdd(s)}
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
    );
}
