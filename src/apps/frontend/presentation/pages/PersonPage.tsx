import globalize from 'lib/globalize';

import { T } from '../theme/tokens';

import { Nav } from '../components/layout/Nav';
import { CatalogPage } from './CatalogPage';
import { personVM } from '../../domain/viewModels/DiscoverViewModel';
import { useViewModelLoad } from '../../domain/bridge/useViewModel';
import type { CastMember } from '../../domain/models';
import type { Navigate } from '../../app/router';

type Props = { name: string; navigate: Navigate };

/** Cuántos papeles distintos se enseñan bajo el nombre. */
const ROLES_SHOWN = 4;

// Ficha de una persona: su filmografía dentro de la biblioteca, filtrada por
// el servidor. El retrato y el papel salen del reparto de los propios títulos
// —cada uno trae su ficha de esta persona—, así que solo aparecen para quien
// figure como intérprete; de un director se lista su obra sin foto.
export function PersonPage({ name, navigate }: Props) {
    useViewModelLoad(personVM, (vm) => vm.load(name), [name]);

    const shows = personVM.shows.value;

    const movies = personVM.movies.value;

    const credits = [...shows, ...movies]
        .map((item) => item.cast.find((c: CastMember) => c.name === name))
        .filter((c): c is CastMember => !!c);
    const photo = credits.find((c) => c.photo)?.photo;
    const uniqueRoles = [...new Set(credits.map((c) => c.role).filter(Boolean))].slice(0, ROLES_SHOWN);

    return (
        <CatalogPage
            navigate={navigate}
            shows={shows}
            movies={movies}
            loading={personVM.loading.value}
            error={personVM.error.value}
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
                            {globalize.translate('MessagePersonProfileFromLibrary')}
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
