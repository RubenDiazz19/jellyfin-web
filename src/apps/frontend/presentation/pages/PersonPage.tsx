import globalize from 'lib/globalize';

import { T } from '../theme/tokens';
import { PROTO_DATA, type Show, type Movie } from '../../domain/models';
import { Nav } from '../components/layout/Nav';
import { CatalogPage } from './CatalogPage';
import type { Navigate } from '../../app/router';

type Props = { name: string; navigate: Navigate };

/** Cuántos papeles distintos se enseñan bajo el nombre. */
const ROLES_SHOWN = 4;

// Ficha de una persona (actor, director, etc.): filmografía derivada de
// los datos locales — todo item cuyo `cast[]` contenga a esa persona.
// El "papel" que se muestra en la ficha es el primer role encontrado.
export function PersonPage({ name, navigate }: Props) {
    const shows: { show: Show; role: string; photo?: string | null }[] = [];
    const movies: { movie: Movie; role: string; photo?: string | null }[] = [];

    Object.values(PROTO_DATA.shows).forEach((s) => {
        const c = s.cast.find((x) => x.name === name);
        if (c) shows.push({ show: s, role: c.role, photo: c.photo });
    });
    Object.values(PROTO_DATA.movies).forEach((m) => {
        const c = m.cast.find((x) => x.name === name);
        if (c) movies.push({ movie: m, role: c.role, photo: c.photo });
    });

    const photo = shows[0]?.photo || movies[0]?.photo;
    const roles = [...shows.map((x) => x.role), ...movies.map((x) => x.role)];
    const uniqueRoles = [...new Set(roles)].slice(0, ROLES_SHOWN);

    return (
        <CatalogPage
            navigate={navigate}
            shows={shows.map((x) => x.show)}
            movies={movies.map((x) => x.movie)}
            nav={
                <Nav navigate={navigate} breadcrumb={[
                    { label: globalize.translate('Home'), to: { page: 'home' } },
                    { label: name }
                ]} />
            }
            header={
                <div style={{
                    display: 'grid', gridTemplateColumns: '260px 1fr', gap: 56, marginBottom: 72
                }}>
                    <div style={{
                        width: 260, height: 360, borderRadius: 16, overflow: 'hidden',
                        background: 'linear-gradient(160deg,#1a1a2e,#2d1b4e)',
                        border: `1px solid ${T.hairline}`
                    }}>
                        {photo ? (
                            <img src={photo} alt={name} decoding='async' style={{
                                width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top'
                            }} />
                        ) : (
                            <div style={{
                                width: '100%', height: '100%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 80, color: 'rgba(255,255,255,0.15)'
                            }}>
                                👤
                            </div>
                        )}
                    </div>
                    <div>
                        <div style={{
                            fontSize: 11, letterSpacing: 4, textTransform: 'uppercase',
                            color: T.dim, marginBottom: 12
                        }}>
                            {globalize.translate('People')}
                        </div>
                        <h1 style={{
                            fontFamily: T.display, fontStyle: 'italic', fontWeight: 300,
                            fontSize: 62, margin: 0, letterSpacing: -1
                        }}>
                            {name}
                        </h1>
                        {uniqueRoles.length > 0 && (
                            <div style={{
                                fontSize: 15, color: T.dim, marginTop: 12,
                                fontStyle: 'italic', fontFamily: T.display
                            }}>
                                {uniqueRoles.join(' · ')}
                            </div>
                        )}
                        <div style={{
                            fontSize: 13, color: T.dim, marginTop: 30, maxWidth: 560, lineHeight: 1.6
                        }}>
                            {globalize.translate('MessagePersonProfileLocalOnly')}
                        </div>
                    </div>
                </div>
            }
            empty={{
                title: globalize.translate('MessageNoAppearancesFor', name),
                hint: globalize.translate('MessageNoAppearancesForHelp')
            }}
        />
    );
}
