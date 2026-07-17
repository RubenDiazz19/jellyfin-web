import { T } from '../theme/tokens';
import { PROTO_DATA, useProtoData } from '../../data/models';
import { Nav } from '../components/layout/Nav';
import { PosterCard } from '../components/cards/PosterCard';
import { LibraryMovieCard } from '../components/cards/LibraryMovieCard';
import { EmptyState } from '../components/skeleton/Skeleton';
import type { Navigate } from '../../app/router';

type Props = { kind: 'series' | 'movies'; navigate: Navigate };

export function LibraryPage({ kind, navigate }: Props) {
  useProtoData();
  const isSeries = kind === 'series';
  const items = isSeries ? Object.values(PROTO_DATA.shows) : Object.values(PROTO_DATA.movies);
  const title = isSeries ? 'Series' : 'Películas';
  return (
    <>
      <Nav navigate={navigate} active={isSeries ? 'series' : 'movies'} />
      <section style={{
        background: '#000', color: '#fff', minHeight: '100vh',
        padding: '120px 56px 96px', fontFamily: T.ui,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 44 }}>
          <h1 style={{
            fontFamily: T.display, fontStyle: 'italic', fontWeight: 300,
            fontSize: 52, margin: 0, letterSpacing: -0.5,
          }}>
            {title}
          </h1>
          <span style={{ fontFamily: T.ui, fontSize: 13, color: T.dim }}>
            {items.length} {isSeries ? 'títulos' : 'películas'}
          </span>
        </div>
        {items.length === 0 ? (
          <EmptyState
            title={isSeries ? 'No hay series todavía' : 'No hay películas todavía'}
            hint="Cuando enchufemos Jellyfin, aparecerá aquí tu biblioteca real."
          />
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 28,
          }}>
            {isSeries
              ? (items as any[]).map((s) => <PosterCard key={s.id} slide={s} navigate={navigate} />)
              : (items as any[]).map((m) => <LibraryMovieCard key={m.id} movie={m} navigate={navigate} />)}
          </div>
        )}
      </section>
    </>
  );
}
