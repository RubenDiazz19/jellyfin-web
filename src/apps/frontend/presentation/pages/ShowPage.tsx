import globalize from 'lib/globalize';

import { T } from '../theme/tokens';
import { formatDateLong, formatRemaining } from '../utils/format';
import { translateStatus } from '../../domain/status';
import { episodeKey, WATCHED } from '../../domain/stores';
import { useWatchedVersion } from '../../domain/bridge/useWatched';
import type { Show } from '../../domain/models';
import { getHeroCategories, getItemCategories } from '../../domain/genres';
import {
    HeroFrame, HeroGenres, HeroMeta, HeroTitle, useHeroLayout, type HeroTweaks
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
import { useItemContextMenu } from '../components/controls/useItemContextMenu';
import { usePlayer } from '../components/player/PlayerProvider';
import { SeasonCard } from '../components/cards/SeasonCard';
import { DetailPageShell } from '../components/layout/DetailPageShell';
import { DetailOverviewSection } from '../components/layout/DetailOverviewSection';
import { Similar } from '../components/similar/Similar';
import { RuntimeDisplay } from '../components/media/RuntimeDisplay';
import { useLandscape, useResponsive, useShortViewport } from '../theme/responsive';
import type { Navigate } from '../../app/router';
import { ticksFromProgress } from '../../domain/player/format';
import { useShowEntity } from './useDetailEntity';

type PageProps = { showId: string; navigate: Navigate; hero?: HeroTweaks };

export function ShowPage({ showId, navigate, hero }: PageProps) {
    const { item: show, error } = useShowEntity(showId, navigate);
    if (!show) return <DetailStatus error={error} />;
    return (
        <DetailPageShell hero={<ShowHero show={show} navigate={navigate} hero={hero} />}>
            <ShowDetail show={show} navigate={navigate} />
        </DetailPageShell>
    );
}

function ShowHero({ show, navigate, hero }: { show: Show; navigate: Navigate; hero?: HeroTweaks }) {
    const cont = show.cont;
    const target = cont ?
        { seasonN: cont.seasonN, epN: cont.epN } :
        { seasonN: show.seasons[0].n, epN: 1 };
    const label = `T${target.seasonN}:E${String(target.epN).padStart(2, '0')}`;
    useWatchedVersion(show.id);
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
    const short = useShortViewport();
    const landscape = useLandscape();
    const { play, prewarm } = usePlayer();
    // En vertical manda el póster: el backdrop es 16:9 y a `cover` en una
    // pantalla alargada solo se ve su franja central. Tumbado o en tablet, el
    // backdrop encaja y es el que se usa (con su rotación de fondos).
    const portraitPhone = r.mobile && !landscape;
    const heroImage = portraitPhone ? (show.poster || show.backdrop || '') : (show.backdrop || '');
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

    const handleShuffle = () => {
        const allEpisodes = (show.seasons || [])
            .filter((s) => s.n >= 0)
            .flatMap((s) => s.episodes.map((ep) => ({ season: s, episode: ep })))
            .filter((item) => !!item.episode.jfId);

        if (allEpisodes.length === 0) return;
        const randomArr = new Uint32Array(1);
        crypto.getRandomValues(randomArr);
        const choice = allEpisodes[randomArr[0] % allEpisodes.length];
        play({
            itemId: choice.episode.jfId!,
            title: `${show.title} · T${choice.season.n} E${String(choice.episode.n).padStart(2, '0')} — ${choice.episode.title ?? ''}`,
            startTicks: 0
        });
    };

    const showBadges = targetEp?.mediaBadges ?? show.mediaBadges;

    // Menú contextual sobre el hero: el mismo que el MoreButton visible, pero
    // se invoca con clic derecho sin tocar el botón.
    const ctx = useItemContextMenu({
        id: show.id,
        type: 'show',
        itemTitle: show.title,
        nextEpisodeId: targetEp?.jfId,
        onShuffle: handleShuffle,
        queueSubtitle: globalize.translate(
            'ValueSeasonEpisode',
            show.cont?.seasonN ?? show.defaultSeason,
            show.cont?.epN ?? 1
        ),
        queuePoster: show.poster
    });
    return (
        <HeroFrame
            hero={hero}
            backdrop={heroImage}
            backdrops={portraitPhone ? undefined : show.backdrops}
            onContextMenu={ctx.onContextMenu}
            nav={
                <Nav
                    navigate={navigate}
                    breadcrumb={[
                        { label: globalize.translate('Shows'), to: { page: 'home' } },
                        { label: getItemCategories(show)[0] ?? 'Drama' },
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
                        genres={getHeroCategories(show)}
                        navigate={navigate}
                        fontSize={10}
                        marginBottom={short ? 8 : 18}
                        justifyContent={inlineJustify}
                    />
                )}

                <HeroTitle
                    logo={show.logo}
                    title={show.title}
                    logoMaxWidth={r.touch ? 'min(78vw, 305px)' : 450}
                    // En táctil el tope va en vh: lo que no debe pasar es que
                    // el logo se coma el alto que necesitan el dato y el botón.
                    logoMaxHeight={r.touch ? (short ? 'min(20vh, 58px)' : 'min(14vh, 94px)') : 153}
                    logoShadow='rgba(0,0,0,0.5)'
                    fontSize={
                        short ? 'clamp(22px, 5.5vh, 34px)' :
                            r.touch ? 'clamp(31px, 7vw, 54px)' : 'clamp(68px, 8vw, 120px)'
                    }
                    letterSpacing={r.touch ? -1 : -3}
                />

                {!minimal && (
                    <HeroMeta
                        items={[show.year, `${show.seasons.length} temporadas`]}
                        ageRating={show.rating.age}
                        imdbRating={show.rating.imdb}
                        badges={showBadges}
                        align={inlineJustify === 'center' ? 'center' : 'left'}
                        marginTop={short ? 8 : r.touch ? 12 : 18}
                    />
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
                            onShuffle={handleShuffle}
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
                        onHover={() => targetEp?.jfId && prewarm(targetEp.jfId)}
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
            {ctx.menu}
        </HeroFrame>
    );
}

function ShowDetail({ show, navigate }: { show: Show; navigate: Navigate }) {
    const r = useResponsive();
    return (
        <DetailBody>
            <DetailColumns>
                <DetailOverviewSection
                    synopsis={show.synopsis}
                    cast={show.cast}
                    navigate={navigate}
                />

                <div>
                    <SectionLabel>{globalize.translate('HeaderDetails')}</SectionLabel>
                    <DetailTable>
                        {show.creator && (
                            <DetailRow label={globalize.translate('Creator')}>{show.creator}</DetailRow>
                        )}
                        {show.directors && (
                            <DetailRow label={globalize.translate('Director')}>{show.directors}</DetailRow>
                        )}
                        {show.studio && (
                            <DetailRow label={globalize.translate('Studio')}>{show.studio}</DetailRow>
                        )}
                        {show.country && (
                            <DetailRow label={globalize.translate('Country')}>{show.country}</DetailRow>
                        )}
                        {getItemCategories(show).length > 0 && (
                            <DetailRow label={globalize.translate('Genres')}>
                                <GenreLinks genres={getItemCategories(show)} navigate={navigate} />
                            </DetailRow>
                        )}
                        {show.runtime && show.runtime !== '—' && (
                            <DetailRow label={globalize.translate('LabelRuntimeMinutes')}>
                                <RuntimeDisplay runtime={show.runtime} />
                            </DetailRow>
                        )}
                        {show.premiere && (
                            <DetailRow label={globalize.translate('OptionPremiereDate')}>
                                {formatDateLong(show.premiere)}
                            </DetailRow>
                        )}
                        {show.status && (
                            <DetailRow label={globalize.translate('HeaderStatus')}>
                                <span style={{ color: '#fff' }}>{translateStatus(show.status)}</span>
                            </DetailRow>
                        )}
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

            <Similar currentId={show.id} navigate={navigate} />
        </DetailBody>
    );
}
