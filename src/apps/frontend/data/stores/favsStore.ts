// Favoritos persistidos en localStorage. Los cambios se notifican por evento
// global para que los hooks re-lean. Las claves no son ids de Jellyfin: ver
// itemKeys.

import { createSetStore } from './persistentStore';

export const FAVS = createSetStore({
    key: 'jfp-favs',
    event: 'jfp-favs-change'
});
