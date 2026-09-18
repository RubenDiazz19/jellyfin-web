// Construcción del prompt que se manda al modelo.
//
// Dos reglas mandan sobre el resto: el modelo elige de una lista cerrada y
// nada más, y puede devolver cero etiquetas. Sin la segunda, un modelo al que
// le pides etiquetas siempre te da cuatro, y acabas con «Bucle temporal» en
// una comedia romántica solo porque había que rellenar.

import { MAX_TAGS_PER_ITEM, VOCABULARY } from '../../src/apps/frontend/data/autotag/vocabulary';

export type PromptItem = {
    id: string;
    kind: 'Película' | 'Serie';
    title: string;
    year?: number;
    genres: string[];
    /** Keywords de TMDB. En inglés y de cola larga, pero buena señal de entrada. */
    keywords: string[];
    overview: string;
};

/** Las sinopsis largas no aportan y disparan el gasto de tokens. */
const OVERVIEW_LIMIT = 600;
/** Los keywords de TMDB pueden ser decenas; con los primeros basta. */
const KEYWORD_LIMIT = 25;

function truncate(text: string, limit: number): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length <= limit ? clean : `${clean.slice(0, limit)}…`;
}

export function buildSystemPrompt(): string {
    const list = VOCABULARY.map((e) => `- ${e.tag}: ${e.hint}`).join('\n');
    return `Eres un catalogador de una videoteca. Etiquetas películas y series en CASTELLANO.

Elige etiquetas de esta lista base. Intenta reutilizarlas copiando la grafía exacta.

${list}
LISTA_DINAMICA_PLACEHOLDER
Reglas:
1. Máximo ${MAX_TAGS_PER_ITEM} etiquetas por título. Menos es mejor que más.
2. Pon SIEMPRE el género o géneros principales (Acción, Comedia, Drama,
   Terror…) y, si aplican, las de origen (Anime, Animación, Documental,
   Hechos reales). Son objetivas: basta con que los géneros o los keywords las
   evidencien. Ojo: los géneros que te llegan pueden venir en inglés
   («Sci-Fi & Fantasy»); tradúcelos a la etiqueta castellana que corresponda.
3. Con las plazas que queden, añade lo que el género NO dice: tono, tema,
   subgénero o ambientación. Ahí sí, si ninguna encaja con seguridad, déjalo:
   una lista más corta es preferible a forzar una etiqueta dudosa.
4. Si crees que el título necesita imperativamente una etiqueta que NO está en
   la lista base ni en la dinámica, puedes proponerla en el campo "nuevas".
   SOLO hazlo si aporta valor real y no es un sinónimo de las que ya existen.
   Las etiquetas nuevas DEBEN estar en CASTELLANO estricto, nunca en inglés (p.ej. usa "Ópera espacial" en vez de "Space Opera").
5. Usa la sinopsis como fuente principal. Los keywords vienen de TMDB, están en
   inglés y son ruidosos: úsalos como pista, no como verdad.
6. Responde SOLO con este JSON estricto, sin markdown ni backticks:
   {"results":[{"n":<número>,"tags":["<etiqueta_existente>"],"nuevas":["<nueva_etiqueta>"]}]}
   Una entrada por cada título recibido. Si no hay nuevas, deja "nuevas" vacío.
   No incluyas razonamiento ni texto de pensamiento en tu salida, solo JSON.`;
}

export function buildUserPrompt(items: readonly PromptItem[]): string {
    const blocks = items.map((item, i) => {
        const year = item.year ? ` (${item.year})` : '';
        // Se numeran en vez de mandar el id real. Los ids de Jellyfin son
        // hexadecimales de 32 caracteres y el modelo los copiaba MAL —un
        // dígito cambiado en mitad de la cadena—, con lo que la entrada se
        // descartaba por id desconocido y el título perdía sus etiquetas sin
        // que nada lo delatara. Un número de una o dos cifras no se equivoca,
        // y si lo hiciera se detecta al instante por estar fuera de rango.
        const lines = [
            `n: ${i + 1}`,
            `tipo: ${item.kind}`,
            `título: ${item.title}${year}`
        ];
        if (item.genres.length > 0) lines.push(`géneros: ${item.genres.join(', ')}`);
        if (item.keywords.length > 0) {
            lines.push(`keywords: ${item.keywords.slice(0, KEYWORD_LIMIT).join(', ')}`);
        }
        lines.push(`sinopsis: ${item.overview ? truncate(item.overview, OVERVIEW_LIMIT) : '(sin sinopsis)'}`);
        return lines.join('\n');
    });
    return `Etiqueta estos ${items.length} títulos:\n\n${blocks.join('\n---\n')}`;
}
