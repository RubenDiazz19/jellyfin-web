import { episodeKey, WATCHED } from '../../../domain/stores';
import { useWatched, useWatchedVersion } from '../../../domain/bridge/useWatched';
import { useViewModel } from '../../../domain/bridge/useViewModel';
import { showVM } from '../../../domain/viewModels/ShowViewModel';
import { PROTO_DATA } from '../../../domain/models';
import { useWatchedToggle } from './useWatchedToggle';
import { WatchedToggleIcon } from './WatchedToggleIcon';

// "Visto" para series — calcula el estado agregado desde todos los episodios
// de todas las temporadas y marca/desmarca todos a la vez. Con sesión real,
// llama a markPlayed(showId) — el server propaga a episodios; en catálogos
// donde aún no se ha cargado el detalle (posters/carousel) el estado
// agregado no está disponible: usamos como fallback el propio showId en
// el store local para dar feedback inmediato.
type Props = { showId: string; size?: number; badge?: boolean };

export function ShowNavWatchedButton({ showId, size = 18, badge = false }: Props) {
    useWatchedVersion();
    useViewModel(showVM);
    const proto = PROTO_DATA.shows[showId];
    const show = proto ?? showVM.showFor(showId);
    const allEpIds = show ?
        (show.seasons || []).flatMap((season) =>
            (season.episodes || []).map((ep) => episodeKey(showId, season.n, ep.n))
        ) :
        [];
    // Con episodios cargados: agregado real. Sin ellos: fallback al showId
    // como "id de item" en el store — no se propaga a episodios pero permite
    // ver el toggle inmediato en un poster.
    const [fallback, toggleFallback] = useWatched(showId);
    const allWatched = allEpIds.length > 0 ?
        allEpIds.every((id) => WATCHED.has(id)) :
        fallback;

    const toggle = useWatchedToggle({
        active: allWatched,
        applyLocal: (next) => {
            if (allEpIds.length > 0) WATCHED.setMany(allEpIds, next);
            else toggleFallback();
        },
        serverId: showId,
        message: (next) =>
            `Serie marcada como ${next ? 'vista' : 'no vista'} · ${show?.title ?? ''}`
    });
    return (
        <WatchedToggleIcon
            active={allWatched}
            onClick={toggle}
            size={size}
            badge={badge}
            ariaLabel={allWatched ? 'Marcar serie como no vista' : 'Marcar serie como vista'}
        />
    );
}
