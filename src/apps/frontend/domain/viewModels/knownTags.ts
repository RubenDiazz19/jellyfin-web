// Vocabulario de etiquetas ya usadas en la biblioteca, para autosugerir al
// etiquetar.
//
// Sale del catálogo que haya cargado en memoria, y cuál sea depende de por
// dónde haya entrado el usuario: la búsqueda tiene el suyo, el listado de
// series el suyo. Así que cada ViewModel con catálogo se apunta aquí como
// fuente en cuanto se construye.
//
// La dependencia va en ese sentido —ViewModel → vocabulario— a propósito: al
// revés, este módulo tendría que importar los singletons de los ViewModels y
// cualquier diálogo que quisiera sugerencias arrastraría media aplicación.
//
// Se lee con `peek()` desde el ViewModel: es un dato de apoyo para un diálogo
// que se abre puntualmente, no algo a lo que la vista deba re-suscribirse.

import { getItemTags, normalizeTagForSearch, type TaggableItem } from '../tags';

/** Items etiquetables de un catálogo cargado. */
export type TagSource = () => readonly TaggableItem[];

const sources = new Set<TagSource>();

export function registerTagSource(source: TagSource): void {
    sources.add(source);
}

/** Todas las etiquetas del vocabulario vistas en la biblioteca, sin repetir y en orden alfabético. */
export function knownTags(): string[] {
    const seen = new Map<string, string>();
    for (const source of sources) {
        for (const item of source()) {
            for (const tag of getItemTags(item)) {
                const key = normalizeTagForSearch(tag);
                if (key && !seen.has(key)) {
                    seen.set(key, tag);
                }
            }
        }
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
