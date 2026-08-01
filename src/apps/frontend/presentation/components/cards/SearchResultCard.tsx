import globalize from 'lib/globalize';

import React from 'react';
import { T } from '../../theme/tokens';
import { useSelectionMode } from '../controls/useSelectionMode';
import type { SearchResult } from '../../../domain/viewModels/SearchViewModel';
import type { Navigate } from '../../../app/router';

// Resultado del buscador, con el mismo tratamiento que el póster de la home:
// logo (o título de respaldo) superpuesto abajo a la izquierda, sin pie de
// texto separado. No usa PosterShell a propósito: aquí no hay botones de
// visto/favorito ni barra de progreso, y el item puede no tener ninguna
// imagen (el buscador incluye PROTO_DATA), caso en el que se pinta la
// inicial centrada en vez del logo. Compartir carcasa saldría más caro en
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
                    background: 'linear-gradient(180deg, transparent 25%, rgba(0,0,0,0.92))'
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
                <div style={{
                    position: 'absolute', left: 12, right: 12, bottom: 12,
                    filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.7))'
                }}>
                    {item.logo ? (
                        <img
                            src={item.logo}
                            alt={item.title}
                            loading='lazy'
                            decoding='async'
                            style={{
                                maxWidth: '100%', maxHeight: 36, width: 'auto', height: 'auto',
                                objectFit: 'contain', objectPosition: 'left center'
                            }}
                        />
                    ) : (
                        // La sombra va como `drop-shadow` del contenedor y no
                        // como `text-shadow` aquí: el recorte a dos líneas
                        // necesita `overflow: hidden`, que cortaría la sombra
                        // en seco y dejaría un rectángulo alrededor del título.
                        <div style={{
                            fontFamily: T.display, fontSize: 15, fontWeight: 600, lineHeight: 1.2,
                            color: '#fff',
                            overflow: 'hidden',
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
                        }}>
                            {item.title}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});
