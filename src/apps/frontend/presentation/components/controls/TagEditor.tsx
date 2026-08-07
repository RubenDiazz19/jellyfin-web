// Las etiquetas se editan en dos sitios —las de un item y las de un lote— y
// las dos cajas hacían exactamente lo mismo con ellas: enseñarlas como
// píldoras quitables, sugerir las que ya existen en la biblioteca según lo
// tecleado, y no dejar que entre dos veces la misma escrita con otras
// mayúsculas. Eso último es lo que importa que esté en un solo sitio: es la
// diferencia entre tener una etiqueta «anime» y tener «anime» y «Anime».

import { useMemo, useState } from 'react';
import globalize from 'lib/globalize';

import { T } from '../../theme/tokens';

/** Cuántas sugerencias caben sin que la caja se convierta en una lista. */
const MAX_SUGGESTIONS = 8;

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Lo que se está tecleando y qué etiquetas ya existentes encajan con ello.
 *
 * `tags` a `null` es «todavía no se sabe» (se están leyendo del servidor):
 * entonces no se puede añadir nada, porque añadir sobre una lista que aún no
 * ha llegado la borraría al guardar.
 */
export function useTagDraft({
    tags, suggestions, onAdd
}: {
    tags: string[] | null;
    suggestions: string[];
    onAdd: (tag: string) => void;
}) {
    const [draft, setDraft] = useState('');

    // Las que ya usa la biblioteca, que este item aún no tiene y que encajan
    // con lo tecleado: sirven para no volver a escribir a mano una que ya está.
    const matches = useMemo(() => {
        const assigned = tags ?? [];
        const needle = draft.trim().toLowerCase();
        return suggestions
            .filter((s) => !assigned.some((t) => same(t, s)))
            .filter((s) => !needle || s.toLowerCase().includes(needle))
            .slice(0, MAX_SUGGESTIONS);
    }, [suggestions, tags, draft]);

    const add = (tag: string) => {
        const clean = tag.trim();
        if (!clean || !tags) return;
        // Repetida: no se añade, pero el campo se vacía igual — para quien
        // escribe, el trabajo está hecho.
        if (!tags.some((t) => same(t, clean))) onAdd(clean);
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

/** Las que ya existen en la biblioteca: se ponen de un toque, sin teclearlas. */
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
