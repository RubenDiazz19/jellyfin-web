import { signal, effect } from '@preact/signals-core';
import type { ApiService } from '../../../data/api/ApiService';
import { guardedLoad } from '../utils/guardedLoad';
import { LoadGuard } from '../utils/loadGuard';
import type { SearchResult } from '../SearchViewModel';
import { parseQuery } from './SearchQueryParser';

/**
 * A partir de cuántas letras se le pregunta al servidor. Con una sola el
 * ranking no dice nada y la petición se dispararía en cuanto se toca el campo.
 */
const MIN_REMOTE_QUERY = 2;

/**
 * Espera antes de salir a la red. Se teclea letra a letra: sin esto, escribir
 * «expediente» son diez búsquedas y solo importa la última.
 */
const REMOTE_DEBOUNCE_MS = 400;

export class RemoteSearchManager {
    remote = signal<SearchResult[]>([]);
    searching = signal(false);

    private loads = new LoadGuard();
    private timer: ReturnType<typeof setTimeout> | null = null;
    private guarded = guardedLoad(this.searching, undefined, this.loads).guarded;
    private stopEffect: (() => void) | null = null;

    constructor(private api: ApiService) {}

    /**
     * Programa la búsqueda en el servidor para `text`. No sale a la red hasta
     * que se deja de teclear, y por debajo del mínimo se limpia lo anterior:
     * borrar la caja tiene que borrar también lo que trajo el servidor.
     */
    schedule = (text: string) => {
        if (this.timer) clearTimeout(this.timer);
        if (text.length < MIN_REMOTE_QUERY) {
            // Invalida la petición en vuelo: si no, su respuesta repoblaría
            // los resultados de una búsqueda que el usuario ya ha borrado.
            this.loads.begin();
            this.timer = null;
            this.searching.value = false;
            this.remote.value = [];
            return;
        }
        this.timer = setTimeout(() => { void this.searchRemote(text); }, REMOTE_DEBOUNCE_MS);
    };

    private searchRemote = async (text: string) => {
        if (!this.api.session.load()?.accessToken) return;
        this.searching.value = true;
        await this.guarded(async (isLatest) => {
            const { shows, movies } = await this.api.discover.searchCatalog(text);
            if (!isLatest()) return;
            this.remote.value = [
                ...shows.map((s) => ({ ...s, kind: 'show' as const })),
                ...movies.map((m) => ({ ...m, kind: 'movie' as const }))
            ];
        }, () => {
            this.remote.value = [];
            return false;
        });
    };
    
    startAutoSearch(querySignal: { value: string }) {
        this.stopEffect = effect(() => {
            this.schedule(parseQuery(querySignal.value).text);
        });
    }

    cleanup() {
        if (this.stopEffect) {
            this.stopEffect();
            this.stopEffect = null;
        }
        if (this.timer) clearTimeout(this.timer);
    }
}
