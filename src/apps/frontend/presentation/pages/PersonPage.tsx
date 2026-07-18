import { T } from '../theme/tokens';
import { PROTO_DATA, type Show, type Movie } from '../../domain/models';
import { Nav } from '../components/layout/Nav';
import { PosterCard } from '../components/cards/PosterCard';
import { LibraryMovieCard } from '../components/cards/LibraryMovieCard';
import { EmptyState } from '../components/skeleton/Skeleton';
import type { Navigate } from '../../app/router';

type Props = { name: string; navigate: Navigate };

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
    const uniqueRoles = [...new Set(roles)].slice(0, 4);

    return (
        <>
            <Nav navigate={navigate} breadcrumb={[{ label: 'Inicio', to: { page: 'home' } }, { label: name }]} />
            <section style={{
                background: '#000', color: '#fff', minHeight: '100vh',
                padding: '120px 56px 96px', fontFamily: T.ui
            }}>
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
                            Reparto
                        </div>
                        <h1 style={{
                            fontFamily: T.display, fontStyle: 'italic', fontWeight: 300,
                            fontSize: 62, margin: 0, letterSpacing: -1
                        }}>
                            {name}
                        </h1>
                        {uniqueRoles.length > 0 && (
                            <div style={{ fontSize: 15, color: T.dim, marginTop: 12, fontStyle: 'italic', fontFamily: T.display }}>
                                {uniqueRoles.join(' · ')}
                            </div>
                        )}
                        <div style={{ fontSize: 13, color: T.dim, marginTop: 30, maxWidth: 560, lineHeight: 1.6 }}>
                            Perfil generado desde tu biblioteca local. Cuando se conecte con
                            Jellyfin/TMDb aquí aparecerá la biografía completa.
                        </div>
                    </div>
                </div>

                {shows.length > 0 && (
                    <>
                        <SectionHead label='Series' count={shows.length} />
                        <div style={grid}>
                            {shows.map(({ show }) => <PosterCard key={show.id} slide={show} navigate={navigate} />)}
                        </div>
                    </>
                )}
                {movies.length > 0 && (
                    <>
                        <div style={{ height: 56 }} />
                        <SectionHead label='Películas' count={movies.length} />
                        <div style={grid}>
                            {movies.map(({ movie }) => <LibraryMovieCard key={movie.id} movie={movie} navigate={navigate} />)}
                        </div>
                    </>
                )}
                {shows.length === 0 && movies.length === 0 && (
                    <EmptyState
                        title={`Sin apariciones de ${name} en tu biblioteca`}
                        hint='Cuando conectemos con Jellyfin, aquí verás su filmografía completa.'
                    />
                )}
            </section>
        </>
    );
}

function SectionHead({ label, count }: { label: string; count: number }) {
    return (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
            <h2 style={{
                fontFamily: T.display, fontStyle: 'italic', fontWeight: 300, fontSize: 28, margin: 0
            }}>{label}</h2>
            <span style={{ fontSize: 12, color: T.dim }}>{count}</span>
        </div>
    );
}

const grid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 28
};
