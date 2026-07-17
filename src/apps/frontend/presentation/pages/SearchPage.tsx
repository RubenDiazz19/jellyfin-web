import { useEffect, useMemo, useRef, useState } from 'react';
import { T } from '../theme/tokens';
import { Ic } from '../theme/icons';
import { PROTO_DATA, useProtoData } from '../../data/models';
import { Nav } from '../components/layout/Nav';
import { EmptyState } from '../components/skeleton/Skeleton';
import { FAVS } from '../../data/stores/favsStore';
import { WATCHED } from '../../data/stores/watchedStore';
import { useFavVersion } from '../../domain/hooks/useFav';
import { useWatchedVersion } from '../../domain/hooks/useWatched';
import type { Navigate } from '../../app/router';

type TypeFilter = 'todo' | 'series' | 'peliculas';
type StateFilter = 'todo' | 'favs' | 'vistos' | 'no-vistos';

const TYPE_TABS: { id: TypeFilter; label: string }[] = [
  { id: 'todo',       label: 'Todo' },
  { id: 'series',     label: 'Series' },
  { id: 'peliculas',  label: 'Películas' },
];

const STATE_TABS: { id: StateFilter; label: string }[] = [
  { id: 'todo',      label: 'Todos' },
  { id: 'favs',      label: 'Favoritos' },
  { id: 'vistos',    label: 'Vistos' },
  { id: 'no-vistos', label: 'No vistos' },
];

// Comprueba si una serie está "vista" (todos sus episodios marcados).
function isSeriesWatched(show: any): boolean {
  const ids = (show.seasons || []).flatMap((s: any) =>
    (s.episodes || []).map((e: any) => `${show.id}-s${s.n}-e${e.n}`),
  );
  return ids.length > 0 && ids.every((id: string) => WATCHED.has(id));
}

// Comprueba si una serie está en favoritos (por id) o alguno de sus episodios.
function isSeriesFav(show: any): boolean {
  return FAVS.has(show.id);
}

function isMovieWatched(movie: any): boolean {
  return (movie.watched ?? 0) >= 1 || WATCHED.has(`movie-${movie.id}`);
}

function isMovieFav(movie: any): boolean {
  return FAVS.has(`movie-${movie.id}`);
}

export function SearchPage({ navigate }: { navigate: Navigate }) {
  useProtoData();
  // Nos suscribimos a cambios de fav/visto para re-filtrar cuando el usuario
  // toca esos estados desde otro lugar mientras está en la búsqueda.
  useFavVersion();
  useWatchedVersion();

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('todo');
  const [stateFilter, setStateFilter] = useState<StateFilter>('todo');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const all = useMemo(() => {
    const shows = Object.values(PROTO_DATA.shows).map((s) => ({ ...s, _type: 'show' as const }));
    const movies = Object.values(PROTO_DATA.movies).map((m) => ({ ...m, _type: 'movie' as const }));
    return [...shows, ...movies];
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = all.filter((item) => {
    // Filtro por tipo
    if (typeFilter === 'series' && item._type !== 'show') return false;
    if (typeFilter === 'peliculas' && item._type !== 'movie') return false;

    // Filtro por estado
    if (stateFilter !== 'todo') {
      const isFav = item._type === 'show' ? isSeriesFav(item) : isMovieFav(item);
      const isWatched = item._type === 'show' ? isSeriesWatched(item) : isMovieWatched(item);
      if (stateFilter === 'favs' && !isFav) return false;
      if (stateFilter === 'vistos' && !isWatched) return false;
      if (stateFilter === 'no-vistos' && isWatched) return false;
    }

    // Filtro por texto
    if (!q) return true;
    return (
      item.title?.toLowerCase().includes(q) ||
      (item as any).synopsis?.toLowerCase().includes(q) ||
      item.genres?.some((g: string) => g.toLowerCase().includes(q)) ||
      (item as any).cast?.some((c: any) => c.name?.toLowerCase().includes(q))
    );
  });

  const anyFilterActive = typeFilter !== 'todo' || stateFilter !== 'todo' || !!q;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0b', color: T.fg, fontFamily: T.ui }}>
      <Nav
        navigate={navigate}
        breadcrumb={[{ label: 'Inicio', to: { page: 'home' } }, { label: 'Buscar' }]}
      />

      <div style={{ padding: '80px 64px 0' }}>
        <div style={{ position: 'relative', maxWidth: 720 }}>
          <div style={{
            position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)',
            color: T.dim, pointerEvents: 'none',
          }}>
            <Ic.Search size={20} />
          </div>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar series, películas, actores…"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12, padding: '18px 20px 18px 52px',
              color: T.fg, fontFamily: T.ui, fontSize: 18, outline: 'none',
              transition: 'border-color .2s',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.35)')}
            onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
          />
          {query && (
            <div
              onClick={() => setQuery('')}
              style={{
                position: 'absolute', right: 18, top: '50%',
                transform: 'translateY(-50%)', cursor: 'pointer',
                color: T.dim, fontSize: 20, lineHeight: 1,
              }}
            >
              ✕
            </div>
          )}
        </div>

        <FilterRow<TypeFilter>
          label="Tipo"
          tabs={TYPE_TABS}
          active={typeFilter}
          onChange={setTypeFilter}
        />
        <FilterRow<StateFilter>
          label="Estado"
          tabs={STATE_TABS}
          active={stateFilter}
          onChange={setStateFilter}
        />
      </div>

      <div style={{ padding: '36px 64px 80px' }}>
        {filtered.length === 0 ? (
          q ? (
            <EmptyState
              title={`Sin resultados para «${query}»`}
              hint="Prueba con otro título, actor o género — o afloja los filtros."
              icon="⌕"
            />
          ) : anyFilterActive ? (
            <EmptyState
              title="Sin resultados con estos filtros"
              hint="Cambia los filtros o escribe un título para buscar."
              icon="⌕"
            />
          ) : (
            <EmptyState
              title="Empieza a escribir"
              hint="Busca por título, sinopsis, actor o género en tu biblioteca."
              icon="⌕"
            />
          )
        ) : (
          <>
            <div style={{
              fontSize: 11, letterSpacing: 3, textTransform: 'uppercase',
              color: T.dim, marginBottom: 28,
            }}>
              {q || anyFilterActive
                ? `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''}`
                : 'Tu biblioteca'}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '28px 20px',
            }}>
              {filtered.map((item) => (
                <div
                  key={item.id}
                  onClick={() =>
                    navigate(item._type === 'show'
                      ? { page: 'show', showId: item.id }
                      : { page: 'movie', movieId: item.id })
                  }
                  style={{ cursor: 'pointer' }}
                  className="jfp-hoverlift"
                >
                  <div style={{
                    aspectRatio: '2/3', borderRadius: 8, overflow: 'hidden', position: 'relative',
                    background: 'rgba(255,255,255,0.05)',
                    backgroundImage: item.poster
                      ? `url(${item.poster})`
                      : item.backdrop ? `url(${item.backdrop})` : 'none',
                    backgroundSize: 'cover', backgroundPosition: 'center',
                  }}>
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 50%)',
                    }} />
                    <div style={{ position: 'absolute', top: 8, left: 10 }}>
                      <span style={{
                        fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.55)',
                        background: 'rgba(0,0,0,0.5)',
                        padding: '3px 7px', borderRadius: 4,
                      }}>
                        {item._type === 'show' ? 'Serie' : 'Película'}
                      </span>
                    </div>
                    {!item.poster && !item.backdrop && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: T.display, fontSize: 32,
                        color: 'rgba(255,255,255,0.15)',
                      }}>
                        {item.title?.[0]}
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div style={{
                      fontFamily: T.ui, fontSize: 14, fontWeight: 500,
                      lineHeight: 1.3, marginBottom: 4,
                    }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 11, color: T.dim }}>
                      {item.year}{item.genres?.[0] ? ` · ${item.genres[0]}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Chip row genérico para las dos dimensiones del filtro (tipo/estado).
function FilterRow<T extends string>({
  label, tabs, active, onChange,
}: {
  label: string;
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
      <span style={{
        fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
        color: T.dim, minWidth: 60,
      }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              padding: '7px 20px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontFamily: T.ui, fontSize: 13, fontWeight: 500, transition: 'all .15s',
              background: active === tab.id ? T.fg : 'rgba(255,255,255,0.08)',
              color: active === tab.id ? '#000' : T.dim,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
