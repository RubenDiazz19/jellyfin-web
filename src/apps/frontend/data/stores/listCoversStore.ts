// Qué listas tienen un fondo puesto a mano.
//
// El problema que resuelve: Jellyfin acaba generando una portada para cada
// lista —un collage de sus títulos, en `metadata/library/…/poster.png`— y la
// guarda en el MISMO sitio y con la misma forma que una imagen subida por el
// usuario. Mirando el servidor no hay manera de distinguirlas: una lista
// recién creada llega con `ImageTags: {}`, pero en cuanto el collage aparece
// ya no se sabe quién lo puso.
//
// Así que se anota aquí. Es LOCAL y solo decide qué se pinta: perderlo no
// borra ninguna imagen del servidor, solo hace que la lista vuelva a enseñar
// la portada automática (la del último título añadido).

import { createSetStore } from './persistentStore';

// Sin evento: quien lo consulta ya se repinta al recargar las listas, que es
// lo único que puede haber cambiado esto.
const store = createSetStore({ key: 'jfp-list-covers' });

export const LIST_COVERS = {
    /** True si el fondo de esa lista lo puso el usuario. */
    has: (key: string) => store.has(key),

    mark: (key: string) => { store.add([key]); },

    unmark: (key: string) => { store.remove([key]); },

    /** Solo para tests. */
    _reset: () => { store._reset(); }
};
