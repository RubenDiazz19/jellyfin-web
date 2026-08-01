// Estado «visto» persistido en localStorage. Emite un evento cuando cambia
// para que los hooks suscritos se re-lean. Las claves no son ids de Jellyfin:
// ver itemKeys.
//
// Es un espejo local de lo que dice el servidor, no la fuente de verdad: los
// listados lo rehidratan con `sync()` cada vez que traen datos frescos.

import { createSetStore } from './persistentStore';

export const WATCHED = createSetStore({
    key: 'jfp-watched',
    event: 'jfp-watched-change'
});
