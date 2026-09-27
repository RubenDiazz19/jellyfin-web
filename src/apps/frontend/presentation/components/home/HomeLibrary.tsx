import globalize from 'lib/globalize';
import React, { useEffect, useMemo, useState } from 'react';
import { C, T } from '../../theme/tokens';
import { PROTO_DATA } from '../../../domain/models';
import { homeVM } from '../../../domain/viewModels/HomeViewModel';
import { COLLECTION_STYLES } from '../../../domain/stores';
import { useVmSignals } from '../../../domain/bridge/useViewModel';
import { useSession } from '../../../domain/bridge/useSession';
import { Row, RowScroller } from '../layout/Row';
import { CwCard } from '../cards/CwCard';
import { CatalogCard } from '../cards/CatalogCard';
import { POSTER_W } from '../cards/PosterShell';
import { CollectionCard } from '../collection/CollectionCard';
import { SkeletonRow } from '../skeleton/Skeleton';
import { useResponsive } from '../../theme/responsive';
import type { Navigate } from '../../../app/router';

function getSectionStyle(touch: boolean) {
    return {
        background: 'transparent',
        color: C.fg,
        paddingTop: 0,
        paddingBottom: touch ? 'calc(var(--jfp-viewport-h, 100vh) - 180px)' : 'calc(100vh - 240px)',
        fontFamily: T.ui
    } as const;
}

function getHeadingStyle(titleOpacity?: number, titleTranslateY?: number) {
    return titleOpacity !== undefined ? {
        opacity: titleOpacity,
        transform: titleTranslateY ? `translateY(${titleTranslateY}px)` : undefined,
        willChange: 'opacity, transform'
    } : undefined;
}

export const HomeLibrary = React.memo(function HomeLibraryBase({
    navigate,
    titleOpacity,
    titleTranslateY
}: {
    navigate: Navigate;
    titleOpacity?: number;
    titleTranslateY?: number;
}) {
    const { session } = useSession();
    const jellyfinMode = !!session?.accessToken;
    if (jellyfinMode) {
        return (
            <HomeLibraryJellyfin
                navigate={navigate}
                titleOpacity={titleOpacity}
                titleTranslateY={titleTranslateY}
            />
        );
    }
    return (
        <HomeLibraryProto
            data={PROTO_DATA}
            navigate={navigate}
            titleOpacity={titleOpacity}
            titleTranslateY={titleTranslateY}
        />
    );
});

function HomeLibraryJellyfin({
    navigate,
    titleOpacity,
    titleTranslateY
}: {
    navigate: Navigate;
    titleOpacity?: number;
    titleTranslateY?: number;
}) {
    const r = useResponsive();
    const sectionStyle = getSectionStyle(r.touch);
    const headingStyle = getHeadingStyle(titleOpacity, titleTranslateY);

    useVmSignals(homeVM, (vm) => [
        vm.continueWatching,
        vm.recentlyAdded,
        vm.collections,
        vm.mostPlayed,
        vm.rowsLoading,
        vm.rowsReady
    ]);
    const cw = homeVM.continueWatching.value;
    const recent = homeVM.recentlyAdded.value;
    const allCollections = homeVM.collections.value;
    const played = homeVM.mostPlayed.value;

    const [styleRev, setStyleRev] = useState(0);
    useEffect(() => {
        const onStyleChange = () => setStyleRev(prev => prev + 1);
        window.addEventListener(COLLECTION_STYLES.event, onStyleChange);
        return () => window.removeEventListener(COLLECTION_STYLES.event, onStyleChange);
    }, []);

    const collections = useMemo(() => {
        if (styleRev < 0) return [];
        return allCollections.filter(c => COLLECTION_STYLES.getShowOnHome(c.id));
    }, [allCollections, styleRev]);

    if (homeVM.rowsLoading.value || !homeVM.rowsReady.value) {
        return (
            <section style={sectionStyle}>
                <SkeletonRow title={globalize.translate('ContinueWatching')} variant='landscape' />
                <SkeletonRow title={globalize.translate('TabLatest')} />
            </section>
        );
    }

    const hasAny = cw.length > 0 || recent.length > 0 || collections.length > 0 || played.length > 0;
    if (!hasAny) {
        return (
            <section style={sectionStyle}>
                <div style={{ padding: r.touch ? `0 ${r.pagePad}px` : '0 56px', color: T.dim, fontSize: 14 }}>
                    {globalize.translate('MessageNoShowsInLibrary')}
                </div>
            </section>
        );
    }

    const colCardWidth = r.touch ? r.cardW : POSTER_W;

    return (
        <section style={sectionStyle}>
            {cw.length > 0 && (
                <Row title={globalize.translate('ContinueWatching')} headingStyle={headingStyle}>
                    <RowScroller>
                        {cw.map((s) => <CwCard key={s.jfEpisodeId ?? s.id} slide={s} navigate={navigate} />)}
                    </RowScroller>
                </Row>
            )}

            {collections.length > 0 && (
                <Row title={globalize.translate('Collections')} headingStyle={headingStyle}>
                    <RowScroller>
                        {collections.map((col) => (
                            <CollectionCard
                                key={col.id}
                                id={col.id}
                                title={col.name}
                                logo={col.logo}
                                backdrop={col.backdrop}
                                image={col.image}
                                style={{ width: colCardWidth, flex: `0 0 ${colCardWidth}px` }}
                                onClick={() => navigate({ page: 'list', kind: 'collection', listId: col.id })}
                            />
                        ))}
                    </RowScroller>
                </Row>
            )}

            {recent.length > 0 && (
                <Row title={globalize.translate('TabLatest')} headingStyle={headingStyle}>
                    <RowScroller>
                        {recent.map((it) => <CatalogCard key={it.id} item={it} navigate={navigate} />)}
                    </RowScroller>
                </Row>
            )}

            {played.length > 0 && (
                <Row title={globalize.translate('MostPlayed')} headingStyle={headingStyle}>
                    <RowScroller>
                        {played.map((it) => <CatalogCard key={it.id} item={it} navigate={navigate} />)}
                    </RowScroller>
                </Row>
            )}
        </section>
    );
}

function HomeLibraryProto({
    data,
    navigate,
    titleOpacity,
    titleTranslateY
}: {
    data: typeof PROTO_DATA;
    navigate: Navigate;
    titleOpacity?: number;
    titleTranslateY?: number;
}) {
    const r = useResponsive();
    const sectionStyle = getSectionStyle(r.touch);
    const headingStyle = getHeadingStyle(titleOpacity, titleTranslateY);

    const cw = useMemo(() => data.carousel.filter((s) => s.type === 'continue'), [data.carousel]);
    const { recent, mostPlayed, hydrated } = useMemo(() => {
        const m = Object.values(data.movies).map((x) => ({ ...x, kind: 'movie' as const }));
        const s = Object.values(data.shows).map((x) => ({ ...x, kind: 'show' as const }));
        const all = [...m, ...s];
        const rec = [...all]
            .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
            .slice(0, 8);
        const played = [...all]
            .sort((a, b) => (b.rating?.imdb ?? 0) - (a.rating?.imdb ?? 0))
            .slice(0, 8);
        const hyd = all.some((x) => x.poster || x.backdrop);
        return { recent: rec, mostPlayed: played, hydrated: hyd };
    }, [data.movies, data.shows]);

    if (!hydrated) {
        return (
            <section style={sectionStyle}>
                <SkeletonRow title={globalize.translate('ContinueWatching')} variant='landscape' />
                <SkeletonRow title={globalize.translate('TabLatest')} />
            </section>
        );
    }
    return (
        <section style={sectionStyle}>
            {cw.length > 0 && (
                <Row title={globalize.translate('ContinueWatching')} headingStyle={headingStyle}>
                    <RowScroller>
                        {cw.map((s) => <CwCard key={s.id} slide={s} navigate={navigate} />)}
                    </RowScroller>
                </Row>
            )}
            {recent.length > 0 && (
                <Row title={globalize.translate('TabLatest')} headingStyle={headingStyle}>
                    <RowScroller>
                        {recent.map((item) => <CatalogCard key={item.id} item={item} navigate={navigate} />)}
                    </RowScroller>
                </Row>
            )}
            {mostPlayed.length > 0 && (
                <Row title={globalize.translate('MostPlayed')} headingStyle={headingStyle}>
                    <RowScroller>
                        {mostPlayed.map((item) => <CatalogCard key={item.id} item={item} navigate={navigate} />)}
                    </RowScroller>
                </Row>
            )}
        </section>
    );
}
