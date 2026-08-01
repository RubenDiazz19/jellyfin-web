// Etiquetas que ha escrito el usuario a mano, para poder distinguirlas de los
// keywords crudos de TMDB.
//
// El problema que resuelve: en `item.Tags` del servidor conviven dos cosas muy
// distintas —los cientos de keywords que baja TMDB («aftercreditsstinger»,
// «blind girl») y lo que el usuario teclea en el diálogo de etiquetas— y el
// servidor no las marca de ninguna forma. La fila de chips solo debe enseñar
// las segundas; sin este registro habría que elegir entre enseñarlo todo (la
// tira infinita de la captura) o perder las etiquetas propias.
//
// Es LOCAL y solo aditivo: no es la fuente de verdad de nada, únicamente
// decide qué se pinta. Perderlo no borra ninguna etiqueta — las etiquetas
// siguen en el servidor y se siguen encontrando con `#`.

import { createSetStore } from './persistentStore';

// Sin evento: nadie se suscribe. Lo consulta el computed de la búsqueda, que
// ya se recalcula por otras razones cuando esto puede haber cambiado.
const store = createSetStore({
    key: 'jfp-manual-tags',
    // Una etiqueta es la misma se escriba como se escriba.
    normalize: (tag) => tag.trim().toLowerCase()
});

export const MANUAL_TAGS = {
    /** Registra etiquetas como escritas por el usuario. */
    add: (tags: readonly string[]) => { store.add(tags); },

    /** True si el usuario ha escrito esta etiqueta alguna vez. */
    has: (tag: string) => store.has(tag),

    /** Solo para tests. */
    _reset: () => { store._reset(); }
};
