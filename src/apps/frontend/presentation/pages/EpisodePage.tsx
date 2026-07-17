import { T } from '../theme/tokens';
import { Ic } from '../theme/icons';
import { PROTO_DATA, findSeason, useProtoData } from '../../data/models';
import type { Show, Season, Episode } from '../../data/models';
import { useJellyfinShow } from '../../domain/hooks/useJellyfin';
import { Backdrop } from '../components/layout/Backdrop';
import { Nav } from '../components/layout/Nav';
import { ScrollHint } from '../components/layout/ScrollHint';
import { PlayBtn } from '../components/controls/PlayBtn';
import { usePlayer } from '../components/player/PlayerProvider';
import { MoreButton } from '../components/controls/MoreButton';
import { FavButton } from '../components/controls/FavButton';
import { WatchedButton } from '../components/controls/WatchedButton';
import { CastList } from '../components/cast/CastList';
import type { Navigate } from '../../app/router';

type PageProps = { showId: string; seasonN: number; epN: number; navigate: Navigate };

export function EpisodePage({ showId, seasonN, epN, navigate }: PageProps) {
  useProtoData();
  const proto = PROTO_DATA.shows[showId];
  const jf = useJellyfinShow(proto ? undefined : showId);
  const show = proto ?? jf.data;
  const season = show ? findSeason(show, seasonN) : null;
  const ep = season ? season.episodes.find((e) => e.n === epN) : null;
  if (!show || !season || !ep) {
    if (jf.loading) {
      return (
        <section style={{
          minHeight: '100vh', background: '#000', color: T.dim, fontFamily: T.ui,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, letterSpacing: 3, textTransform: 'uppercase',
        }}>
          Cargando…
        </section>
      );
    }
    if (jf.error) {
      return (
        <section style={{
          minHeight: '100vh', background: '#000', color: '#ff6b6b', fontFamily: T.ui,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          {jf.error}
        </section>
      );
    }
    return null;
  }
  const nextEp = season.episodes.find((e) => e.n === epN + 1);
  return (
    <>
      <EpisodeHero show={show} season={season} ep={ep} navigate={navigate} />
      <EpisodeDetail show={show} season={season} ep={ep} nextEp={nextEp} navigate={navigate} />
    </>
  );
}

function EpisodeHero({
  show, season, ep, navigate,
}: {
  show: Show; season: Season; ep: Episode; navigate: Navigate;
}) {
  const { play } = usePlayer();
  const startPlay = () => {
    if (!ep.jfId) return;
    play({
      itemId: ep.jfId,
      title: `${show.title} · T${season.n} E${String(ep.n).padStart(2, '0')} — ${ep.title ?? ''}`,
      startTicks: ep.watched > 0 && ep.watched < 1 && ep.runtime
        ? Math.round(ep.runtime * 60 * ep.watched * 10_000_000)
        : undefined,
    });
  };
  return (
    <section style={{
      position: 'relative', height: '100vh', width: '100%', overflow: 'hidden', background: '#000',
    }}>
      <Nav
        navigate={navigate}
        breadcrumb={[
          { label: 'Series', to: { page: 'home' } },
          { label: show.title, to: { page: 'show', showId: show.id } },
          { label: `Temporada ${season.n}`, to: { page: 'season', showId: show.id, seasonN: season.n } },
          { label: `Episodio ${ep.n}` },
        ]}
        actionId={ep.jfId ?? `${show.id}-s${season.n}-e${ep.n}`}
      />
      <Backdrop src={ep.thumbHD || ep.thumb || ''} fadeBottom={0.92} sharp />

      <div style={{
        position: 'absolute', inset: 0, padding: '0 56px 100px',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-end',
        textAlign: 'center',
      }}>
        <PlayBtn
          size={108} onClick={startPlay}
          progress={ep.watched > 0 && ep.watched < 1 ? ep.watched : null}
        />

        <div style={{
          marginTop: 28, display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 8,
        }}>
          <div style={{
            fontFamily: T.ui, fontSize: 11, letterSpacing: 4, textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.55)',
          }}>
            {show.title} · T{season.n} · E{String(ep.n).padStart(2, '0')}
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center', columnGap: 16, width: '100%',
          }}>
            <span aria-hidden="true" style={{
              visibility: 'hidden', justifySelf: 'end',
              display: 'inline-flex', fontSize: 'clamp(32px, 4vw, 58px)',
              transform: 'translateY(0.15em)',
            }}>
              <MoreButton id={ep.jfId ?? 'spacer'} size={28} type="episode" />
            </span>
            <h1 style={{
              fontFamily: T.display, fontSize: 'clamp(32px, 4vw, 58px)', lineHeight: 1.05,
              margin: 0, fontWeight: 300, letterSpacing: -0.5,
              textShadow: '0 2px 24px rgba(0,0,0,0.7)', textWrap: 'balance',
            }}>
              {ep.title}
            </h1>
            <span style={{
              justifySelf: 'start',
              display: 'inline-flex', fontSize: 'clamp(32px, 4vw, 58px)',
              transform: 'translateY(0.15em)',
            }}>
              <MoreButton
                id={ep.jfId ?? `${show.id}-s${season.n}-e${ep.n}`}
                size={28} type="episode" itemTitle={ep.title}
              />
            </span>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            flexWrap: 'wrap', justifyContent: 'center',
            fontFamily: T.ui, fontSize: 13, color: 'rgba(255,255,255,0.6)',
          }}>
            {ep.runtime != null && <><span>{ep.runtime} min</span><Ic.Dot /></>}
            {ep.date && (
              <>
                <span>
                  {new Date(ep.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <Ic.Dot />
              </>
            )}
            {ep.video && <span>{ep.video}</span>}
          </div>

          {ep.watched > 0 && ep.watched < 1 && (
            <div style={{
              fontFamily: T.ui, fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2,
            }}>
              Reanudar · {Math.round((1 - ep.watched) * (ep.runtime || 0))} min restantes
            </div>
          )}
        </div>
      </div>

      <ScrollHint label="Detalles" />
    </section>
  );
}

function EpisodeDetail({
  show, season, ep, nextEp, navigate,
}: {
  show: Show; season: Season; ep: Episode; nextEp?: Episode; navigate: Navigate;
}) {
  return (
    <section style={{
      background: '#000', color: '#fff', padding: '32px 56px 96px', fontFamily: T.ui,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 80 }}>
        <div>
          <div style={{
            fontSize: 10, letterSpacing: 4, textTransform: 'uppercase',
            color: T.dim, marginBottom: 18,
          }}>
            Sinopsis
          </div>
          <p style={{
            fontFamily: T.ui, fontSize: 17, lineHeight: 1.55, margin: 0,
            color: 'rgba(255,255,255,0.82)', textWrap: 'pretty', fontWeight: 400,
          }}>
            {`${show.title} — Temporada ${season.n}, episodio ${ep.n}: «${ep.title}». ${season.synopsis ?? ''}`}
          </p>

          <div style={{ marginTop: 56 }}>
            <CastList cast={show.cast} navigate={navigate} label="Reparto" />
          </div>
        </div>

        <div>
          <div style={{
            fontSize: 10, letterSpacing: 4, textTransform: 'uppercase',
            color: T.dim, marginBottom: 18,
          }}>
            Datos técnicos
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: '130px 1fr', rowGap: 14, fontSize: 13,
          }}>
            {show.directors && (
              <>
                <span style={{ color: T.dim }}>Dirige</span>
                <span>{show.directors}</span>
              </>
            )}
            {show.creator && (
              <>
                <span style={{ color: T.dim }}>Guion</span>
                <span>{show.creator}</span>
              </>
            )}
            {ep.date && (
              <>
                <span style={{ color: T.dim }}>Emisión</span>
                <span>
                  {new Date(ep.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </>
            )}
            {ep.runtime != null && (
              <>
                <span style={{ color: T.dim }}>Duración</span>
                <span>{ep.runtime} min</span>
              </>
            )}
            <span style={{ color: T.dim }}>Vídeo</span>
            <span>{ep.video ?? '—'}</span>
            <span style={{ color: T.dim }}>Audio</span>
            <span>{ep.audio ?? '—'}</span>
            <span style={{ color: T.dim }}>Subtítulos</span>
            <span>{ep.subtitles ?? '—'}</span>
            {ep.container && (
              <>
                <span style={{ color: T.dim }}>Contenedor</span>
                <span>{ep.container.toUpperCase()}</span>
              </>
            )}
            {show.studio && (
              <>
                <span style={{ color: T.dim }}>Estudio</span>
                <span>{show.studio}</span>
              </>
            )}
          </div>

          {nextEp && (
            <div style={{ marginTop: 56 }}>
              <div style={{
                fontSize: 10, letterSpacing: 4, textTransform: 'uppercase',
                color: T.dim, marginBottom: 18,
              }}>
                Siguiente
              </div>
              <div
                onClick={() => navigate({
                  page: 'episode', showId: show.id, seasonN: season.n, epN: nextEp.n,
                })}
                style={{
                  borderRadius: 6, overflow: 'hidden',
                  border: `1px solid ${T.hairline}`, cursor: 'pointer',
                }}
                className="jfp-hoverlift"
              >
                <div style={{ aspectRatio: '16/9', position: 'relative', overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: `url(${nextEp.thumbHD || nextEp.thumb || ''})`,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    filter: 'blur(12px)', transform: 'scale(1.25)',
                  }} />
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent 50%)',
                  }} />
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <PlayBtn size={52} />
                  </div>
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute', right: 12, bottom: 10,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <FavButton id={`${show.id}-s${season.n}-e${nextEp.n}`} size={15} />
                    <WatchedButton id={`${show.id}-s${season.n}-e${nextEp.n}`} size={15} />
                  </div>
                  <div style={{
                    position: 'absolute', left: 16, bottom: 12,
                    fontFamily: T.display, fontSize: 22, fontStyle: 'italic',
                  }}>
                    {String(nextEp.n).padStart(2, '0')} · {nextEp.title}
                  </div>
                </div>
                <div style={{
                  padding: '12px 16px', fontSize: 12, color: T.dim,
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <span>{nextEp.runtime} min</span>
                  <span>
                    {nextEp.date &&
                      new Date(nextEp.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
