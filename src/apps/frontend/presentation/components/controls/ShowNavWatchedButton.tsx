import { episodeKey, WATCHED } from '../../../domain/stores';
import { useWatchedVersion } from '../../../domain/bridge/useWatched';
import { useViewModel } from '../../../domain/bridge/useViewModel';
import { showVM } from '../../../domain/viewModels/ShowViewModel';
import { PROTO_DATA } from '../../../domain/models';
import { WatchedToggle } from './WatchedToggle';

// "Visto" para series. El servidor propaga `markPlayed(showId)` a los
// episodios; en local hay que mantener a mano las DOS caras del mismo hecho:
//
//   - la clave de la serie (`showId`), que es lo único que pueden leer las
//     tarjetas de la Home y de la biblioteca, donde no hay episodios;
//   - las claves de sus episodios, que es lo que agregan la ficha y los
//     botones de temporada.
//
// Escribir solo una de las dos era el origen de que el mismo título saliera
// visto en una pantalla y no visto en otra: marcabas desde la ficha (episodios)
// y la tarjeta de la Home seguía sin marca, o al revés. Los listados las
// reconcilian con el servidor (ver `hydrateShowWatched`); aquí se escriben las
// dos para que el cambio se vea al instante en todas partes.
type Props = { showId: string; size?: number; badge?: boolean };

export function ShowNavWatchedButton({ showId, size = 18, badge = false }: Props) {
    useWatchedVersion(showId);
    useViewModel(showVM);
    const proto = PROTO_DATA.shows[showId];
    const show = proto ?? showVM.showFor(showId);
    const allEpIds = show ?
        (show.seasons || []).flatMap((season) =>
            (season.episodes || []).map((ep) => episodeKey(showId, season.n, ep.n))
        ) :
        [];
    // Con los episodios cargados manda el agregado real —es lo que refleja
    // haberlos ido marcando uno a uno—; sin ellos, la clave de la serie.
    const allWatched = allEpIds.length > 0 ?
        allEpIds.every((id) => WATCHED.has(id)) :
        WATCHED.has(showId);

    return (
        <WatchedToggle
            active={allWatched}
            applyLocal={(next) => {
                if (allEpIds.length > 0) WATCHED.setMany(allEpIds, next);
                WATCHED.setMany([showId], next);
            }}
            serverId={showId}
            message={(next) =>
                `Serie marcada como ${next ? 'vista' : 'no vista'} · ${show?.title ?? ''}`
            }
            size={size}
            badge={badge}
            ariaLabel={allWatched ? 'Marcar serie como no vista' : 'Marcar serie como vista'}
        />
    );
}

