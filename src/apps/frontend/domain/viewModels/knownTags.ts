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

import { translateGenre } from '../genres';

/** Items etiquetables y categorizables de un catálogo cargado. */
export type TagSource = () => readonly {
    tags?: string[];
    genres?: string[];
    autoTags?: string[];
}[];

const sources = new Set<TagSource>();

export function registerTagSource(source: TagSource): void {
    sources.add(source);
}

/** Todas las etiquetas y géneros vistos, sin repetir y en orden alfabético. */
export function knownTags(): string[] {
    // Agrupadas ignorando mayúsculas; se enseña la primera grafía vista o el género traducido.
    const seen = new Map<string, string>();
    for (const source of sources) {
        for (const item of source()) {
            for (const g of item.genres ?? []) {
                const translated = translateGenre(g);
                if (translated) {
                    const key = translated.toLowerCase();
                    if (!seen.has(key)) seen.set(key, translated);
                }
            }
            for (const tag of item.tags ?? []) {
                const clean = tag.trim();
                if (clean) {
                    const key = clean.toLowerCase();
                    if (!seen.has(key)) seen.set(key, clean);
                }
            }
            for (const tag of item.autoTags ?? []) {
                const clean = tag.trim();
                if (clean) {
                    const key = clean.toLowerCase();
                    if (!seen.has(key)) seen.set(key, clean);
                }
            }
        }
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

