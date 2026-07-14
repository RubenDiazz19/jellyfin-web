import { T } from '../theme/tokens';
import { PROTO_DATA, useProtoData } from '../data';
import { Nav } from '../components/layout/Nav';
import { PosterCard } from '../components/cards/PosterCard';
import { LibraryMovieCard } from '../components/cards/LibraryMovieCard';
import { EmptyState } from '../components/skeleton/Skeleton';
import type { Navigate } from '../router';

type Props = { genre: string; navigate: Navigate };

// Página de género: agrupa series y películas cuyo `genres` contiene el género.
// Se muestra en dos secciones (series primero, películas después).
export function GenrePage({ genre, navigate }: Props) {
  useProtoData();
  const g = genre.toLowerCase();
  const shows = Object.values(PROTO_DATA.shows).filter((s) =>
    s.genres.some((x) => x.toLowerCase() === g),
  );
  const movies = Object.values(PROTO_DATA.movies).filter((m) =>
    m.genres.some((x) => x.toLowerCase() === g),
  );

  return (
    <>
      <Nav navigate={navigate} breadcrumb={[{ label: 'Inicio', to: { page: 'home' } }, { label: `Género · ${genre}` }]} />
      <section style={{
        background: '#000', color: '#fff', minHeight: '100vh',
        padding: '120px 56px 96px', fontFamily: T.ui,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 44 }}>
          <h1 style={{
            fontFamily: T.display, fontStyle: 'italic', fontWeight: 300,
            fontSize: 52, margin: 0, letterSpacing: -0.5,
          }}>
            {genre}
          </h1>
          <span style={{ fontFamily: T.ui, fontSize: 13, color: T.dim }}>
            {shows.length + movies.length} títulos
          </span>
        </div>

        {shows.length > 0 && (
          <>
            <SectionHead label="Series" count={shows.length} />
            <div style={grid}>
              {shows.map((s) => <PosterCard key={s.id} slide={s} navigate={navigate} />)}
            </div>
          </>
        )}

        {movies.length > 0 && (
          <>
            <div style={{ height: 56 }} />
            <SectionHead label="Películas" count={movies.length} />
            <div style={grid}>
              {movies.map((m) => <LibraryMovieCard key={m.id} movie={m} navigate={navigate} />)}
            </div>
          </>
        )}

        {shows.length === 0 && movies.length === 0 && (
          <EmptyState
            title={`No hay títulos del género «${genre}»`}
            hint="Prueba a explorar otras filas de la Home o cambia de género."
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
        fontFamily: T.display, fontStyle: 'italic', fontWeight: 300, fontSize: 28, margin: 0,
      }}>{label}</h2>
      <span style={{ fontSize: 12, color: T.dim }}>{count}</span>
    </div>
  );
}

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: 28,
};
