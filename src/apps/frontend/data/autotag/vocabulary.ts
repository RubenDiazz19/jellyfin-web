// Vocabulario CERRADO de etiquetas automáticas, en castellano.

// Es la pieza que hace que el etiquetado sirva de algo. Los keywords que
// vienen de TMDB son cola larga —«aftercreditsstinger», «blind girl»— y como
// filtro no valen: cada uno casa con uno o dos items. Un modelo que genere
// texto libre reproduce ese mismo problema traducido, así que aquí se le
// obliga a elegir de esta lista y de ninguna otra.

// Encima del género van las etiquetas que el género NO dice: tono, tema,
// subgénero y ambientación. Son las que hacen que el filtro sirva de algo más
// que para repetir lo que ya sabías.

// Editar la lista es seguro: `data/autotag/index.ts` valida el JSON generado
// contra este vocabulario al leerlo, así que quitar una etiqueta la hace
// desaparecer de la UI sin tener que volver a pasar el script. Añadir una sí
// obliga a regenerar (`bun run autotag --force`) para que el modelo la use.

/** Una etiqueta y la pista que se le da al modelo para desambiguarla. */
export type VocabularyEntry = {
    tag: string;
    hint: string;
};

export const VOCABULARY: readonly VocabularyEntry[] = [
    // ── Franquicias y Universos ──────────────────────────────────────────────
    { tag: 'Star Wars', hint: 'perteneciente a la saga de La Guerra de las Galaxias' },
    { tag: 'Batman', hint: 'relacionado con el superhéroe de DC o Gotham' },
    { tag: 'El Señor de los Anillos', hint: 'Tierra Media, Tolkien, El Hobbit' },
    { tag: 'Marvel', hint: 'superhéroes del universo Marvel (MCU o cómics)' },
    { tag: 'DC Comics', hint: 'superhéroes del universo DC (Superman, Flash, Liga de la Justicia)' },
    { tag: 'Harry Potter', hint: 'mundo mágico de Hogwarts' },
    { tag: 'Spider-Man', hint: 'historias del hombre araña' },

    // ── Origen ───────────────────────────────────────────────────────────────
    { tag: 'Hechos reales', hint: 'biografía o suceso que ocurrió' },

    // ── Tono ─────────────────────────────────────────────────────────────────
    { tag: 'Humor negro', hint: 'comedia sobre temas incómodos o macabros' },
    { tag: 'Surrealista', hint: 'absurda, onírica, no busca ser verosímil' },
    { tag: 'Feelgood', hint: 'amable, reconfortante, final luminoso' },
    { tag: 'Perturbadora', hint: 'incómoda, angustiosa, deja mal cuerpo' },
    { tag: 'Violenta', hint: 'violencia explícita como rasgo central' },
    { tag: 'Melancólica', hint: 'triste, nostálgica, de ritmo pausado' },
    { tag: 'Trepidante', hint: 'ritmo alto sin respiro, acción constante' },

    // ── Tema ─────────────────────────────────────────────────────────────────
    { tag: 'Venganza', hint: 'el motor es ajustar cuentas' },
    { tag: 'Supervivencia', hint: 'seguir vivo en un entorno hostil' },
    { tag: 'Mayoría de edad', hint: 'crecer, dejar atrás la adolescencia' },
    { tag: 'Familia disfuncional', hint: 'conflicto familiar como eje' },
    { tag: 'Duelo y pérdida', hint: 'elaborar la muerte de alguien' },
    { tag: 'Amistad', hint: 'el vínculo entre amigos es el centro' },
    { tag: 'Corrupción y poder', hint: 'política, mafia o empresas corruptas' },
    { tag: 'Clase social', hint: 'desigualdad, pobreza, lucha de clases' },
    { tag: 'Salud mental', hint: 'trastornos, terapia, adicción' },
    { tag: 'Identidad', hint: 'quién es uno; género, raza, origen' },

    // ── Subgénero ────────────────────────────────────────────────────────────
    { tag: 'Bucle temporal', hint: 'se repite el mismo periodo de tiempo' },
    { tag: 'Viajes en el tiempo', hint: 'desplazarse a otra época' },
    { tag: 'Universos paralelos', hint: 'realidades alternativas o multiverso' },
    { tag: 'Inteligencia artificial', hint: 'robots, IA, conciencia artificial' },
    { tag: 'Extraterrestres', hint: 'vida alienígena, contacto o invasión' },
    { tag: 'Mafia', hint: 'crimen organizado, clanes, narcotráfico' },
    { tag: 'Distopía', hint: 'sociedad futura opresiva' },
    { tag: 'Postapocalíptico', hint: 'después del colapso de la civilización' },
    { tag: 'Space opera', hint: 'aventura espacial de gran escala' },
    { tag: 'Ciberpunk', hint: 'alta tecnología, hackers, megacorporaciones' },
    { tag: 'Steampunk', hint: 'tecnología de vapor en estética decimonónica' },
    { tag: 'Recuentos de la vida', hint: 'cotidiano, sin gran trama; slice of life' },
    { tag: 'Superhéroes', hint: 'personajes con poderes' },
    { tag: 'Atraco', hint: 'planear y ejecutar un robo' },
    { tag: 'Juicios', hint: 'tribunales, abogados, proceso judicial' },
    { tag: 'Investigación policial', hint: 'resolver un crimen; detectives' },
    { tag: 'Espionaje', hint: 'agentes, servicios secretos, infiltración' },
    { tag: 'Cine negro', hint: 'noir: crimen, sombras, moral ambigua' },
    { tag: 'Terror psicológico', hint: 'miedo por tensión, no por sustos' },
    { tag: 'Slasher', hint: 'asesino que caza víctimas una a una' },
    { tag: 'Zombis', hint: 'muertos vivientes o infectados' },
    { tag: 'Vampiros', hint: 'vampiros, hombres lobo y afines' },
    { tag: 'Monstruos gigantes', hint: 'kaiju, criaturas de gran tamaño' },
    { tag: 'Artes marciales', hint: 'combate cuerpo a cuerpo coreografiado' },
    { tag: 'Road movie', hint: 'un viaje por carretera estructura el relato' },
    { tag: 'Catástrofe', hint: 'desastre natural o accidente masivo' },

    // ── Ambientación ─────────────────────────────────────────────────────────
    { tag: 'Época histórica', hint: 'ambientada en el pasado, antes de 1970' },
    { tag: 'Instituto', hint: 'adolescentes en el colegio o instituto' },
    { tag: 'Prisión', hint: 'transcurre en la cárcel' },
    { tag: 'Espacio exterior', hint: 'naves, estaciones u otros planetas' }
] as const;

import { GENRE_TRANSLATIONS } from '../../domain/genres';

/** Returns the Spanish tag for a known English synonym, or undefined if none */
export function translateEnglishTag(tag: string): string | undefined {
    return GENRE_TRANSLATIONS.get(tag.trim().toLowerCase());
}

export const VOCABULARY_TAGS: readonly string[] = VOCABULARY.map((e) => e.tag);

// Se indexa en minúsculas porque ni el modelo ni un JSON editado a mano
// respetan la grafía exacta: lo que llegue como «anime» debe resolverse a
// «Anime», que es como se pinta en los chips.
const BY_KEY = new Map(VOCABULARY.map((e) => [e.tag.toLowerCase(), e.tag]));

/**
 * Devuelve la etiqueta canónica del vocabulario, o `undefined` si no está.
 * Es el único punto por el que entra una etiqueta automática: lo que no
 * reconozca aquí no llega a la UI.
 */
export function canonicalTag(raw: string): string | undefined {
    return BY_KEY.get(raw.trim().toLowerCase());
}

/** True si la etiqueta pertenece al vocabulario cerrado. */
export function isVocabularyTag(raw: string): boolean {
    return canonicalTag(raw) !== undefined;
}

/**
 * Etiquetas que sobran cuando ya está una más específica: `general -> específica`.
 *
 * Se resuelve en código y no pidiéndoselo al modelo porque el modelo lo ignora:
 * aun diciéndole que «Animación» es la no japonesa, etiquetaba todo el anime
 * con las dos y se comía una plaza de las cinco para no decir nada nuevo.
 */
const REDUNDANT_WITH: Readonly<Record<string, string>> = {};

/** Quita las etiquetas que no aportan porque ya está la más específica. */
export function dropRedundant(tags: readonly string[]): string[] {
    return tags.filter((tag) => {
        const specific = REDUNDANT_WITH[tag];
        return !specific || !tags.includes(specific);
    });
}

/**
 * Tope de etiquetas por item. Cinco y no menos porque ahora hay dos capas que
 * cubrir —género y origen primero, tono/tema/subgénero después— y con cuatro
 * las segundas se quedaban fuera. Subirlo más haría que los chips dejasen de
 * decir nada: si una película es «todo», no es nada en particular.
 */
export const MAX_TAGS_PER_ITEM = 5;
