// ViewModel del selector de avatar de perfil: rejilla de personajes,
// búsqueda entre las tres fuentes y la elección (candidato + color de fondo)
// que luego se compone y sube al servidor.
//
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { signal } from '@preact/signals-core';

import globalize from 'lib/globalize';

import { apiService, type ApiService } from '../../data/api/ApiService';
import { normalizeName } from '../../data/api/characterArt';
import type { AvatarCandidate } from '../../data/api/avatars';
import { guardedLoad } from './guardedLoad';
import { LoadGuard } from './loadGuard';

// El tipo de los candidatos también lo pinta la vista; se reexporta aquí
// porque presentation no puede importar de data/ ni aunque sea un tipo.
export type { AvatarCandidate };
// El fondo de la composición (fijo): la vista lo usa para que la vista
// previa de un PNG transparente se parezca al avatar final.
export { AVATAR_BACKGROUND } from '../../data/api/avatars';

/**
 * Cuánto se espera antes de salir a buscar: la caja se teclea letra a letra
 * y cada búsqueda son hasta cuatro peticiones (local + AniList + créditos de
 * TMDB). Sin debounce, escribir «frodo» son veinte.
 */
const SEARCH_DEBOUNCE_MS = 300;

/** Cuelga la etapa del fallo al mensaje original; lo ve el toast del diálogo. */
function stageError(caught: unknown, stage: string): Error {
    const message = caught instanceof Error ? caught.message : String(caught);
    return new Error(`${message} · ${stage}`);
}

export class AvatarPickerViewModel {
    query = signal('');
    candidates = signal<AvatarCandidate[]>([]);
    loading = signal(false);
    /** El retrato elegido; se mantiene aunque desaparezca de la rejilla al seguir buscando: el pie siempre lo enseña. */
    selected = signal<AvatarCandidate | null>(null);
    /** true mientras se compone y sube la imagen; la vista bloquea el cierre. */
    saving = signal(false);
    /**
     * id de candidato → arte del personaje cuando AniList lo tiene. Se pinta
     * con la foto del intérprete hasta que llega; ver `enrich`.
     */
    artById = signal<Map<string, string>>(new Map());

    private loads = new LoadGuard();
    private guarded = guardedLoad(this.loading, undefined, this.loads).guarded;
    private timer: ReturnType<typeof setTimeout> | null = null;
    /** Series para las que ya se pidió el arte: un solo disparo por serie. */
    private enrichingSeries = new Set<string>();

    constructor(private api: ApiService) {}

    /**
     * Arranca el selector: estado limpio y la rejilla por defecto (una
     * muestra aleatoria de la biblioteca, que además cambia entre aperturas).
     */
    open(): void {
        this.clearTimer();
        this.loads.begin();
        this.query.value = '';
        this.selected.value = null;
        this.candidates.value = [];
        this.artById.value = new Map();
        this.enrichingSeries.clear();
        void this.refresh();
    }

    /** Al cerrar: nada pendiente de dispararse ni respuestas que puedan llegar tarde. */
    close(): void {
        this.clearTimer();
        this.loads.begin();
        this.loading.value = false;
    }

    /**
     * Pide a AniList el DIBUJO de los personajes de los candidatos de la
     * biblioteca y lo publica en `artById` por id de candidato. El
     * emparejamiento es por nombre de rol normalizado; lo que no se encuentre
     * se queda con la foto del intérprete. Un solo disparo por serie, tolerante
     * a fallos — que AniList esté caído nunca vacía la rejilla.
     */
    private enrich(candidates: AvatarCandidate[]): void {
        const bySeries = new Map<string, AvatarCandidate[]>();
        for (const c of candidates) {
            if (c.source !== 'library' || !c.series) continue;
            const list = bySeries.get(c.series);
            if (list) list.push(c);
            else bySeries.set(c.series, [c]);
        }
        for (const [series, members] of bySeries) {
            if (this.enrichingSeries.has(series)) continue;
            this.enrichingSeries.add(series);
            void this.api.avatars.resolveSeriesArt(series)
                .then((art) => this.applyArt(art, members))
                .catch(() => {});
        }
    }

    private applyArt(art: Map<string, string>, members: AvatarCandidate[]): void {
        let changed = false;
        const next = new Map(this.artById.peek());
        for (const c of members) {
            const url = art.get(normalizeName(c.name));
            if (!url) continue;
            next.set(c.id, url);
            changed = true;
        }
        // Solo se publica si hay algo nuevo: un render de la rejilla por nada
        // molestaría a tiles que ya tienen su arte.
        if (changed) this.artById.value = next;
    }

    setQuery = (q: string) => {
        this.query.value = q;
        this.clearTimer();
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.refresh();
        }, SEARCH_DEBOUNCE_MS);
    };

    select = (candidate: AvatarCandidate) => { this.selected.value = candidate; };

    /**
     * Compone la imagen elegida y la sube como avatar. Lanza si algo falla
     * (la vista lo enseña y el selector sigue abierto para reintentar);
     * `saving` vuelve a false pase lo que pase.
     */
    async apply(): Promise<void> {
        const candidate = this.selected.peek();
        if (!candidate || this.saving.peek()) return;
        this.saving.value = true;
        try {
            // Compone con el arte del personaje si ya ha llegado; si no, con la
            // foto del intérprete: el avatar subido es lo que se ve en la tile.
            const artUrl = this.artById.peek().get(candidate.id);
            const photo = artUrl ? { ...candidate, imageUrl: artUrl } : candidate;
            // Contexto de la etapa que rompe: el «Failed to fetch» nativo no
            // distingue entre bajar la imagen y subirla, y es lo único que
            // llega al toast. Se etiqueta dónde cae el fallo.
            let file: File;
            try {
                file = await this.api.avatars.buildAvatarFile(photo);
            } catch (e) {
                throw stageError(e, globalize.translate('AvatarPickerStageImage'));
            }
            try {
                await this.api.users.uploadAvatar(file);
            } catch (e) {
                throw stageError(e, globalize.translate('AvatarPickerStageUpload'));
            }
        } finally {
            this.saving.value = false;
        }
    }

    private clearTimer(): void {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
    }

    /**
     * Trae lo que toca ahora mismo: sin texto, la muestra de la biblioteca;
     * con texto, la unión de las tres fuentes. Cada fuente con error cuenta
     * como vacía — que AniList esté caído no puede vaciar los resultados
     * locales, que son los que seguro funcionan.
     */
    private async refresh(): Promise<void> {
        const term = this.query.peek().trim();
        this.loading.value = true;
        await this.guarded(async (isLatest) => {
            const results = term ?
                await this.mergeSources(term) :
                await this.api.avatars.getLibraryCharacters();
            if (!isLatest()) return;
            this.candidates.value = results;
            this.enrich(results);
        }, () => {
            // Sin nada que pintar: el hueco se nota menos que un error que
            // corta el diálogo, y el pie sigue ofreciendo «guardar» sobre la
            // selección previa si la había.
            this.candidates.value = [];
            return false;
        });
    }

    /** Local primero (es tu biblioteca), AniList después y TMDB al final. */
    private async mergeSources(term: string): Promise<AvatarCandidate[]> {
        const empty: AvatarCandidate[] = [];
        const [library, anilist, tmdb] = await Promise.all([
            this.api.avatars.searchLibraryCharacters(term).catch(() => empty),
            this.api.avatars.searchAniListCharacters(term).catch(() => empty),
            this.api.avatars.searchTmdbCharacters(term).catch(() => empty)
        ]);
        return [...library, ...anilist, ...tmdb];
    }
}

export const avatarPickerVM = new AvatarPickerViewModel(apiService);
