// Selector de géneros con píldoras interactivas, buscador con lupa animada y sugerencias.
//
// Mantiene el mismo lenguaje visual de `TagsDialog`: las etiquetas asignadas
// se muestran en píldoras sólidas con botón de descarte `×`, y las disponibles
// como sugerencias punteadas con `+`. El buscador se encuentra oculto en un
// icono minimalista de lupa junto al título «GÉNEROS» y se expande con una
// animación limpia y fluida al pulsarlo. Todo se normaliza al castellano.

import globalize from 'lib/globalize';
import React, { useMemo, useRef, useState } from 'react';
import { T } from '../../../theme/tokens';
import { Ic } from '../../../theme/icons';
import { ALL_GENRES, PRIMARY_GENRES, expandGenre, translateGenre } from '../../../../domain/genres';

type Props = {
    label?: string;
    genres: string[];
    onChange: (genres: string[]) => void;
};

/** Límite de sugerencias para no desbordar verticalmente el modal de edición. */
const MAX_SUGGESTIONS = 14;

export function GenreEditor({ label, genres, onChange }: Props) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Asegurar que todos los géneros asignados se muestran traducidos al español
    // y sin opciones compuestas (ej. «Acción y Aventura» se descompone en «Acción» y «Aventura»).
    const cleanAssigned = useMemo(() => {
        const seen = new Set<string>();
        const list: string[] = [];
        for (const g of genres) {
            for (const item of expandGenre(g)) {
                const key = item.toLowerCase();
                if (!seen.has(key)) {
                    seen.add(key);
                    list.push(item);
                }
            }
        }
        return list;
    }, [genres]);

    const assignedSet = useMemo(() => {
        return new Set(cleanAssigned.map((g) => g.toLowerCase()));
    }, [cleanAssigned]);

    const removeGenre = (genre: string) => {
        const target = genre.toLowerCase().trim();
        onChange(cleanAssigned.filter((g) => g.toLowerCase().trim() !== target));
    };

    const addGenre = (raw: string) => {
        const trimmed = raw.trim();
        if (!trimmed) return;

        // Por si el usuario pega varios géneros separados por comas o introduce compuestos
        const pieces = trimmed
            .split(',')
            .flatMap((p) => expandGenre(p.trim()))
            .filter(Boolean);

        const next = [...cleanAssigned];
        for (const piece of pieces) {
            const key = piece.toLowerCase();
            if (!next.some((g) => g.toLowerCase().trim() === key)) {
                next.push(piece);
            }
        }

        onChange(next);
        setQuery('');
        inputRef.current?.focus();
    };

    const cleanQuery = query.trim();
    const needle = cleanQuery.toLowerCase();

    // Sugerencias: cuando no hay búsqueda, mostramos géneros principales no asignados.
    // Con búsqueda, filtramos el catálogo completo de géneros conocidos.
    const suggestions = useMemo(() => {
        if (!needle) {
            return PRIMARY_GENRES
                .filter((g) => !assignedSet.has(g.toLowerCase()))
                .slice(0, MAX_SUGGESTIONS);
        }
        return ALL_GENRES
            .filter((g) => !assignedSet.has(g.toLowerCase()) && g.toLowerCase().includes(needle))
            .slice(0, MAX_SUGGESTIONS);
    }, [assignedSet, needle]);

    const hasExactSuggestion = suggestions.some((s) => s.toLowerCase() === needle);
    const isAlreadyAssigned = assignedSet.has(needle);
    const showCustomAdd = Boolean(cleanQuery && !hasExactSuggestion && !isAlreadyAssigned);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (suggestions.length > 0 && hasExactSuggestion) {
                const exact = suggestions.find((s) => s.toLowerCase() === needle);
                if (exact) addGenre(exact);
            } else if (cleanQuery) {
                addGenre(cleanQuery);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setQuery('');
            setOpen(false);
            inputRef.current?.blur();
        }
    };

    const isExpanded = open || Boolean(query);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Cabecera: Título 'GÉNEROS' + buscador minimalista con animación expansiva */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: 26
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                    {label && (
                        <label style={{
                            fontSize: 10,
                            letterSpacing: 3,
                            textTransform: 'uppercase',
                            color: T.dim,
                            userSelect: 'none',
                            whiteSpace: 'nowrap'
                        }}>
                            {label}
                        </label>
                    )}

                    {/* Lupa minimalista que se expande a un cuadro de búsqueda */}
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        height: 26,
                        borderRadius: 999,
                        background: isExpanded ? 'rgba(255,255,255,0.08)' : 'transparent',
                        border: isExpanded ? '1px solid rgba(255,255,255,0.18)' : '1px solid transparent',
                        width: isExpanded ? 220 : 26,
                        maxWidth: 'calc(100% - 90px)',
                        transition: 'width .26s cubic-bezier(0.16, 1, 0.3, 1), background .2s ease, border-color .2s ease',
                        overflow: 'hidden',
                        padding: isExpanded ? '0 8px' : '0',
                        boxSizing: 'border-box'
                    }}>
                        <button
                            type='button'
                            onClick={() => {
                                if (!open) {
                                    setOpen(true);
                                    setTimeout(() => inputRef.current?.focus(), 60);
                                } else if (!query) {
                                    setOpen(false);
                                }
                            }}
                            title={globalize.translate('LabelSearchGenres')}
                            aria-label={globalize.translate('LabelSearchGenres')}
                            style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                color: isExpanded ? '#fff' : T.dim,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                width: 24,
                                height: 24,
                                transition: 'color .15s'
                            }}
                        >
                            <Ic.Search size={13} />
                        </button>
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={() => {
                                if (!query.trim()) {
                                    setOpen(false);
                                }
                            }}
                            placeholder={globalize.translate('LabelSearchGenres')}
                            style={{
                                flex: 1,
                                width: isExpanded ? '100%' : 0,
                                opacity: isExpanded ? 1 : 0,
                                transition: 'opacity .2s ease',
                                background: 'none',
                                border: 'none',
                                outline: 'none',
                                color: '#fff',
                                fontFamily: T.ui,
                                fontSize: 12,
                                padding: '0 4px',
                                minWidth: 0
                            }}
                        />
                        {isExpanded && (
                            <button
                                type='button'
                                onClick={() => {
                                    setQuery('');
                                    setOpen(false);
                                }}
                                aria-label={globalize.translate('ButtonCancel')}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: T.dim,
                                    cursor: 'pointer',
                                    fontSize: 14,
                                    lineHeight: 1,
                                    padding: 0,
                                    width: 16,
                                    height: 16,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}
                            >×</button>
                        )}
                    </div>
                </div>
            </div>

            {/* Píldoras de géneros asignados */}
            {cleanAssigned.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 2 }}>
                    {cleanAssigned.map((g) => (
                        <span
                            key={g}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                padding: '6px 8px 6px 14px', borderRadius: 999,
                                background: 'rgba(255,255,255,0.10)', fontSize: 13,
                                color: '#fff'
                            }}
                        >
                            {g}
                            <button
                                type='button'
                                onClick={() => removeGenre(g)}
                                aria-label={`${globalize.translate('Delete')} ${g}`}
                                style={{
                                    background: 'none', border: 'none', color: T.dim,
                                    cursor: 'pointer', fontSize: 15, lineHeight: 1,
                                    padding: 0, width: 18, height: 18,
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                                }}
                            >×</button>
                        </span>
                    ))}
                </div>
            )}

            {/* Píldoras punteadas de sugerencias */}
            {(suggestions.length > 0 || showCustomAdd) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                    {showCustomAdd && (
                        <button
                            type='button'
                            onClick={() => addGenre(cleanQuery)}
                            style={{
                                padding: '5px 12px', borderRadius: 999,
                                background: 'rgba(255,255,255,0.06)', color: '#fff',
                                border: '1px dashed rgba(255,255,255,0.4)',
                                fontFamily: T.ui, fontSize: 12, cursor: 'pointer'
                            }}
                        >
                            + {translateGenre(cleanQuery)}
                        </button>
                    )}
                    {suggestions.map((s) => (
                        <button
                            key={s}
                            type='button'
                            onClick={() => addGenre(s)}
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
        </div>
    );
}
