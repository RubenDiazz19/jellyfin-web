// Todo el CSS del frontend, leído como texto.
//
// Varias comprobaciones de accesibilidad y de scope miran las reglas escritas,
// no el resultado en un navegador. Leen de aquí y no de un fichero concreto
// porque el reparto entre `global.css` (el shell) y `player.css` (el
// reproductor) es una cuestión de orden, no de significado: mover una regla de
// uno a otro no debe tumbar un test ni, peor, dejar de comprobarla en silencio.

import fs from 'node:fs';
import path from 'node:path';

const STYLES_DIR = 'src/apps/frontend/presentation/styles';

/** Los ficheros de estilos del frontend, en orden alfabético estable. */
export function frontendStyleFiles(): { name: string; css: string }[] {
    const dir = path.resolve(process.cwd(), STYLES_DIR);
    return fs.readdirSync(dir)
        .filter((f) => f.endsWith('.css'))
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ name, css: fs.readFileSync(path.join(dir, name), 'utf-8') }));
}

/** Todos ellos concatenados. */
export function frontendCss(): string {
    return frontendStyleFiles().map((f) => f.css).join('\n');
}
