import globalize from 'lib/globalize';

import { T } from '../theme/tokens';
import { Ic } from '../theme/icons';
import { formatRemaining } from '../theme/format';
import { episodeKey, WATCHED } from '../../domain/stores';
import { useWatchedVersion } from '../../domain/bridge/useWatched';
import type { Show } from '../../domain/models';
import {
    HeroFrame, HeroGenres, HeroTitle, useHeroLayout, type HeroTweaks
} from '../components/layout/DetailHero';
import { HeroActionsRow, HeroPlayButton } from '../components/layout/HeroActions';
import {
    DetailBody, DetailColumns, DetailHeading, DetailRow, DetailStatus, DetailTable,
    GenreLinks, SectionLabel
} from '../components/layout/DetailSections';
import { Nav } from '../components/layout/Nav';
import { ScrollHint } from '../components/layout/ScrollHint';
import { MoreButton } from '../components/controls/MoreButton';
import { MyListButton } from '../components/controls/MyListButton';
import { usePlayer } from '../components/player/PlayerProvider';
import { SeasonCard } from '../components/cards/SeasonCard';
import { CastList } from '../components/cast/CastList';
import { Similar } from '../components/similar/Similar';
import { useResponsive } from '../theme/responsive';
import type { Navigate } from '../../app/router';
import { ticksFromProgress } from '../../domain/player/format';
import { useShowEntity } from './useDetailEntity';

type PageProps = { showId: string; navigate: Navigate; hero?: HeroTweaks };

export function ShowPage({ showId, navigate, hero }: PageProps) {
    const { item: show, error } = useShowEntity(showId);
    if (!show) return <DetailStatus error={error} />;
    return (
        <>
            <ShowHero show={show} navigate={navigate} hero={hero} />
            <ShowDetail show={show} navigate={navigate} />
        </>
    );
}

function ShowHero({ show, navigate, hero }: { show: Show; navigate: Navigate; hero?: HeroTweaks }) {
    const cont = show.cont;
    const target = cont ?
        { seasonN: cont.seasonN, epN: cont.epN } :
        { seasonN: show.seasons[0].n, epN: 1 };
    const label = `T${target.seasonN}:E${String(target.epN).padStart(2, '0')}`;
    useWatchedVersion();
    const allEpIds = (show.seasons || []).flatMap((s) =>
        (s.episodes || []).map((ep) => episodeKey(show.id, s.n, ep.n))
    );
    const complete = allEpIds.length > 0 && allEpIds.every((id) => WATCHED.has(id));
    const progress = complete ? 0 : cont ? cont.progress : 0;
    const inProgress = !complete && !!cont && progress > 0;
    const epLabel = `T${target.seasonN} E${String(target.epN).padStart(2, '0')}`;
    const remaining = cont ? formatRemaining(cont.remaining, { suffix: '' }) : '';
    const { minimal, inlineJustify } = useHeroLayout(hero);
    const r = useResponsive();
    const { play } = usePlayer();
    const targetEp = show.seasons
        .find((s) => s.n === target.seasonN)
        ?.episodes.find((e) => e.n === target.epN);
    const startPlay = () => {
        if (targetEp?.jfId) {
            play({
                itemId: targetEp.jfId,
                title: `${show.title} · T${target.seasonN} E${String(target.epN).padStart(2, '0')} — ${targetEp.title ?? ''}`,
                startTicks: ticksFromProgress(targetEp.runtime, cont?.progress ?? 0)
            });
        } else {
            // Fallback: al menos llevamos al usuario a la ficha del episodio.
            navigate({ page: 'episode', showId: show.id, seasonN: target.seasonN, epN: target.epN });
        }
    };
    return (
        <HeroFrame
            hero={hero}
            backdrop={show.backdrop || ''}
            backdrops={show.backdrops}
            itemId={show.id}
            nav={
                <Nav
                    navigate={navigate}
                    breadcrumb={[
                        { label: globalize.translate('Shows'), to: { page: 'home' } },
                        { label: 'Drama' },
                        { label: show.title }
                    ]}
                    actionId={show.id}
                    actionData={{ type: 'show', id: show.id }}
                />
            }
            footer={<ScrollHint label={globalize.translate('Episodes')} />}
        >
            <>
                {!minimal && (
                    <HeroGenres
                        genres={show.genres}
                        navigate={navigate}
                        fontSize={10}
                        marginBottom={18}
                        justifyContent={inlineJustify}
                    />
                )}

                <HeroTitle
                    logo={show.logo}
                    title={show.title}
                    logoMaxWidth={r.touch ? 'min(78vw, 340px)' : 500}
                    logoMaxHeight={r.touch ? 110 : 170}
                    logoShadow='rgba(0,0,0,0.5)'
                    fontSize={r.touch ? 'clamp(36px, 9vw, 68px)' : 'clamp(76px, 9vw, 134px)'}
                    letterSpacing={r.touch ? -1 : -3}
                />

                {!minimal && (
                    <div style={{
                        marginTop: 18, display: 'flex', alignItems: 'center', gap: 14,
                        flexWrap: 'wrap',
                        justifyContent: inlineJustify,
                        fontFamily: T.ui, fontSize: 13, color: 'rgba(255,255,255,0.78)'
                    }}>
                        <span>{show.year}</span><Ic.Dot />
                        <span>{show.seasons.length} temporadas</span><Ic.Dot />
                        <span style={{
                            border: '1px solid rgba(255,255,255,0.35)', padding: '3px 8px',
                            fontSize: 11, letterSpacing: 1
                        }}>
                            {show.rating.age}
                        </span>
                        <Ic.Dot />
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Ic.Imdb /> {show.rating.imdb}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Ic.Tomato /> {show.rating.rt}%</span>
                    </div>
                )}

                <HeroActionsRow
                    myList={<MyListButton itemId={show.id} itemTitle={show.title} size='sm' />}
                    more={
                        <MoreButton
                            id={show.id} size={18} type='show' itemTitle={show.title}
                            nextEpisodeId={
                                show.seasons
                                    .find((s) => s.n === (show.cont?.seasonN ?? show.defaultSeason))
                                    ?.episodes.find((e) => e.n === (show.cont?.epN ?? 1))?.jfId
                            }
                            queueSubtitle={globalize.translate(
                                'ValueSeasonEpisode',
                                show.cont?.seasonN ?? show.defaultSeason,
                                show.cont?.epN ?? 1
                            )}
                            queuePoster={show.poster}
                        />
                    }
                >
                    <HeroPlayButton
                        onClick={startPlay}
                        complete={complete}
                        progress={inProgress ? progress : 0}
                        // Al hover: solo tiempo restante (se expande
                        // horizontalmente). Sin hover: episodio (T1 E01) o
                        // estado (Visto/Reproducir).
                        label={(hover) => (
                            inProgress && hover && remaining ? remaining :
                                inProgress ? epLabel :
                                    complete ? globalize.translate(hover ? 'WatchAgain' : 'Watched') :
                                        `${globalize.translate('Play')} ${label}`
                        )}
                    />
                </HeroActionsRow>
            </>
        </HeroFrame>
    );
}

function ShowDetail({ show, navigate }: { show: Show; navigate: Navigate }) {
    const r = useResponsive();
    return (
        <DetailBody>
            <DetailColumns>
                <div>
                    <SectionLabel>{globalize.translate('Overview')}</SectionLabel>
                    <p style={{
                        fontFamily: T.ui, fontSize: 17, lineHeight: 1.55, margin: 0,
                        color: 'rgba(255,255,255,0.82)', maxWidth: 640, textWrap: 'pretty', fontWeight: 400
                    }}>
                        {show.synopsis}
                    </p>

                    <div style={{ marginTop: 48 }}>
                        <CastList cast={show.cast} navigate={navigate} />
                    </div>
                </div>

                <div>
                    <SectionLabel>{globalize.translate('HeaderDetails')}</SectionLabel>
                    <DetailTable>
                        <DetailRow label={globalize.translate('Creator')}>{show.creator}</DetailRow>
                        <DetailRow label={globalize.translate('Director')}>{show.directors}</DetailRow>
                        <DetailRow label={globalize.translate('Studio')}>{show.studio}</DetailRow>
                        <DetailRow label={globalize.translate('Country')}>{show.country}</DetailRow>
                        <DetailRow label={globalize.translate('Genres')}>
                            <GenreLinks genres={show.genres} navigate={navigate} />
                        </DetailRow>
                        <DetailRow label={globalize.translate('LabelRuntimeMinutes')}>{show.runtime}</DetailRow>
                        <DetailRow label={globalize.translate('OptionPremiereDate')}>{show.premiere}</DetailRow>
                        <DetailRow label={globalize.translate('HeaderStatus')}>
                            <span style={{ color: '#fff' }}>{show.status}</span>
                        </DetailRow>
                    </DetailTable>
                </div>
            </DetailColumns>

            <div style={{ marginTop: r.touch ? 44 : 88 }}>
                <DetailHeading
                    title={globalize.translate('HeaderSeasons')}
                    marginBottom={r.touch ? 18 : 32}
                >
                    <div style={{ marginLeft: 14, fontFamily: T.ui, fontSize: 12, color: T.dim }}>
                        {show.seasons.length} temporadas · {show.seasons.reduce((a, s) => a + s.total, 0)} episodios
                    </div>
                </DetailHeading>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: r.touch ? r.gap : 22 }}>
                    {show.seasons.map((s) => (
                        <SeasonCard key={s.n} show={show} season={s} navigate={navigate} />
                    ))}
                </div>
            </div>

            <Similar currentId={show.id} currentGenres={show.genres} kind='show' navigate={navigate} />
        </DetailBody>
    );
}
