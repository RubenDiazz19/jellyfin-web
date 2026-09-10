// ViewModel de la Home: carrusel del hero + filas curadas (continuar viendo,
// añadidos recientemente, colecciones y más vistos).
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import { PROTO_DATA, type CarouselSlide, type CatalogItem, type ListEntry } from '../../data/models';
import { mutationOnLoad } from './mutationSubscription';
import { LoadGuard } from './loadGuard';
import { ticksFromProgress } from '../player/format';

/** Formatea temporada y episodio con la convención 'T{season} E{episode}' (ej. 'T1 E05'). */
export function formatEpisodeCode(season: number | string, episode: number | string): string {
    return `T${season} E${String(episode).padStart(2, '0')}`;
}

export class HomeViewModel {
    slides = signal<CarouselSlide[]>([]);

    continueWatching = signal<CarouselSlide[]>([]);
    recentlyAdded = signal<CatalogItem[]>([]);
    collections = signal<ListEntry[]>([]);
    mostPlayed = signal<CatalogItem[]>([]);

    heroLoading = signal(false);
    rowsLoading = signal(false);

    // "Ready" = ya se resolvió al menos una carga. Distingue el estado
    // inicial (aún sin pedir datos: la View pinta skeleton, no "vacío")
    // de una respuesta real sin resultados.
    heroReady = signal(false);
    rowsReady = signal(false);

    private rawRecentlyAdded: CatalogItem[] = [];
    private loads = new LoadGuard();

    constructor(private api: ApiService) {}

    async load() {
        this.subscribeToMutations();
        const isLatest = this.loads.begin();
        // Los esqueletos solo la primera vez. Con los listados cacheados una
        // vuelta a la Home resuelve en el mismo tick, y en la recarga por
        // mutación tirar el hero y las filas para volver a pintar lo mismo se
        // ve como un parpadeo.
        this.heroLoading.value = !this.heroReady.peek();
        this.rowsLoading.value = !this.rowsReady.peek();

        // Hero y filas en paralelo con estados independientes: el hero es
        // opcional (si falla, la Home sigue mostrando las filas).
        void this.api.catalog.getHomeCarousel()
            .then((slides) => {
                if (!isLatest()) return;
                this.slides.value = slides;
                this.applyExclusions();
            })
            .catch(() => {
                if (!isLatest()) return;
                this.slides.value = [];
                this.applyExclusions();
            })
            .finally(() => {
                if (!isLatest()) return;
                this.heroLoading.value = false;
                this.heroReady.value = true;
            });

        await this.loadRows(isLatest);
    }

    /**
     * Carga las cuatro fuentes curadas en paralelo. Cada fuente tiene un
     * fallback independiente a lista vacía para que el fallo de una (p.ej. sin
     * permisos o sin historial de reproducción) no bloquee las demás.
     */
    async loadRows(isLatest = this.loads.begin()) {
        try {
            const [continueWatching, recentlyAdded, collections, mostPlayed] = await Promise.all([
                this.api.catalog.getResume().catch(() => [] as CarouselSlide[]),
                this.api.catalog.getLatest(undefined, 24).catch(() => [] as CatalogItem[]),
                this.api.catalog.getCollections().catch(() => [] as ListEntry[]),
                this.api.catalog.getMostPlayed().catch(() => [] as CatalogItem[])
            ]);
            if (!isLatest()) return;
            this.continueWatching.value = continueWatching;
            this.rawRecentlyAdded = recentlyAdded;
            this.applyExclusions();
            this.collections.value = collections;
            this.mostPlayed.value = mostPlayed;
        } finally {
            if (isLatest()) {
                this.rowsLoading.value = false;
                this.rowsReady.value = true;
            }
        }
    }

    /**
     * Resuelve los datos de reproducción de un slide (para reproducir directamente
     * tanto películas como el episodio que toque en series, sean novedad o continuar viendo).
     */
    async getPlayable(slide: CarouselSlide): Promise<{
        itemId: string;
        title: string;
        startTicks?: number;
    } | null> {
        if (slide.kind === 'movie') {
            return {
                itemId: slide.jfEpisodeId ?? slide.id,
                title: slide.title,
                startTicks: slide.positionTicks ?? 0
            };
        }

        // Serie con episodio ya resuelto (ej. continuar viendo):
        if (slide.jfEpisodeId) {
            const title = slide.season != null && slide.episode != null ?
                `${slide.title} · ${formatEpisodeCode(slide.season, slide.episode)} — ${slide.episodeTitle}` :
                slide.title;
            return {
                itemId: slide.jfEpisodeId,
                title,
                startTicks: slide.positionTicks
            };
        }

        // Serie sin episodio resuelto todavía (ej. novedad en el hero):
        try {
            const show = await this.api.catalog.getShow(slide.id);
            const cont = show.cont;
            const targetSeason = cont ? cont.seasonN : (show.seasons[0]?.n ?? 1);
            const targetEpN = cont ? cont.epN : 1;
            const targetSeasonObj = show.seasons.find((s) => s.n === targetSeason) ?? show.seasons[0];
            const targetEp = targetSeasonObj?.episodes.find((e) => e.n === targetEpN) ?? targetSeasonObj?.episodes[0];
            if (targetEp?.jfId) {
                slide.jfEpisodeId = targetEp.jfId;
                const startTicks = targetEp.watched > 0 && targetEp.runtime ?
                    ticksFromProgress(targetEp.runtime, cont?.progress ?? 0) :
                    undefined;
                return {
                    itemId: targetEp.jfId,
                    title: `${show.title} · ${formatEpisodeCode(targetSeasonObj?.n ?? targetSeason, targetEp.n)} — ${targetEp.title ?? ''}`,
                    startTicks
                };
            }
        } catch {
            const protoShow = PROTO_DATA.shows[slide.id];
            const ep = protoShow?.seasons[0]?.episodes[0];
            if (ep?.jfId) {
                slide.jfEpisodeId = ep.jfId;
                return {
                    itemId: ep.jfId,
                    title: `${protoShow.title} · ${formatEpisodeCode(1, 1)} — ${ep.title ?? ''}`,
                    startTicks: 0
                };
            }
        }

        return null;
    }

    /**
     * Exclusión mutua: omite de «Novedades» cualquier título presente en el
     * Hero o en «Seguir viendo» para que cada título exista en un solo lugar.
     */
    private applyExclusions() {
        const heroIds = new Set(this.slides.value.map((s) => s.id));
        const cwIds = new Set(this.continueWatching.value.map((s) => s.id));
        this.recentlyAdded.value = this.rawRecentlyAdded.filter(
            (it) => !heroIds.has(it.id) && !cwIds.has(it.id)
        );
    }

    private ensureSubscribed = mutationOnLoad(() => {
        if (!this.rowsReady.value) return;
        void this.load();
    }, { debounce: true });

    private subscribeToMutations() {
        this.ensureSubscribed();
    }
}

export const homeVM = new HomeViewModel(apiService);
