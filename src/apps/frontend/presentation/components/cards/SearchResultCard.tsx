import globalize from 'lib/globalize';

import React from 'react';
import { T } from '../../theme/tokens';
import { useSelectionMode } from '../controls/useSelectionMode';
import type { SearchResult } from '../../../domain/viewModels/SearchViewModel';
import type { Navigate } from '../../../app/router';

// Resultado del buscador. No usa PosterShell a propósito: aquí la carátula
// no lleva acciones ni progreso, el título va debajo en vez de encima, y el
// item puede no tener ninguna imagen (el buscador incluye PROTO_DATA), caso
// en el que se pinta la inicial. Compartir carcasa saldría más caro en
// parámetros que en líneas ahorradas.

type Props = { item: SearchResult; navigate: Navigate };

export const SearchResultCard = React.memo(function SearchResultCardBase({ item, navigate }: Props) {
    const cover = item.poster || item.backdrop;
    const sel = useSelectionMode(
        {
            id: item.id,
            title: item.title,
            kind: item._type,
            poster: item.poster,
            year: item.year
        },
        () => navigate(item._type === 'show' ?
            { page: 'show', showId: item.id } :
            { page: 'movie', movieId: item.id })
    );
    return (
        <div
            onClick={sel.onClick}
            style={{ cursor: 'pointer' }}
            className='jfp-hoverlift'
        >
            <div style={{
                aspectRatio: '2/3', borderRadius: 8, overflow: 'hidden', position: 'relative',
                background: 'rgba(255,255,255,0.05)',
                backgroundImage: cover ? `url(${cover})` : 'none',
                backgroundSize: 'cover', backgroundPosition: 'center',
                outline: sel.selected ? '3px solid #fff' : undefined,
                outlineOffset: sel.selected ? -3 : undefined
            }}>
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 50%)'
                }} />
                <div style={{ position: 'absolute', top: 8, left: 10 }}>
                    {sel.selecting ? (
                        <span style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 22, height: 22, borderRadius: '50%',
                            background: sel.selected ? '#fff' : 'rgba(0,0,0,0.45)',
                            border: sel.selected ? 'none' : '2px solid rgba(255,255,255,0.7)',
                            color: '#000', fontSize: 13, lineHeight: 1
                        }}>
                            {sel.selected ? '✓' : ''}
                        </span>
                    ) : (
                        <span style={{
                            fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
                            color: 'rgba(255,255,255,0.55)',
                            background: 'rgba(0,0,0,0.5)',
                            padding: '3px 7px', borderRadius: 4
                        }}>
                            {globalize.translate(item._type === 'show' ? 'Series' : 'Movie')}
                        </span>
                    )}
                </div>
                {!cover && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: T.display, fontSize: 32,
                        color: 'rgba(255,255,255,0.15)'
                    }}>
                        {item.title?.[0]}
                    </div>
                )}
            </div>
            <div style={{ marginTop: 10 }}>
                <div style={{
                    fontFamily: T.ui, fontSize: 14, fontWeight: 500,
                    lineHeight: 1.3, marginBottom: 4
                }}>
                    {item.title}
                </div>
                <div style={{ fontSize: 11, color: T.dim }}>
                    {item.year}{item.genres?.[0] ? ` · ${item.genres[0]}` : ''}
                </div>
            </div>
        </div>
    );
});
