// Deja junto a cada fichero comprimible de dist/ su versión .br y .gz.
//
// Caddy las sirve con `file_server { precompressed br gzip }`: se comprime una
// vez al construir la imagen en vez de en cada petición, y de paso se entrega
// brotli, que Caddy no sabe generar al vuelo —no lleva compresor brotli— pero
// sí servir ya hecho. Sobre el chunk grande de la app la diferencia entre
// gzip y brotli son unas decenas de KB en cada carga en frío.
//
// No se mete en `bun run build` a propósito: comprimir dos veces cada fichero
// alarga el build unos segundos que en el bucle de desarrollo no compran nada.
// Lo llama el Dockerfile, que es quien construye lo que de verdad se sirve.

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';

const brotli = promisify(brotliCompress);
const gz = promisify(gzip);

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');

/** Lo que comprime bien. El resto —imágenes, woff2— ya viene comprimido. */
const COMPRESSIBLE = /\.(?:js|mjs|css|html|json|svg|txt|xml|webmanifest|map)$/;

/**
 * Por debajo de esto no compensa: el resultado puede salir más grande que el
 * original y, en cualquier caso, cabe de sobra en un solo paquete TCP.
 */
const MIN_BYTES = 1024;

/**
 * Solo se guarda la versión comprimida si ahorra algo de verdad. Un fichero ya
 * denso (un .map con mucha entropía) puede quedarse casi igual, y entonces
 * servirlo comprimido es gastar CPU en el navegador para nada.
 */
const MIN_RATIO = 0.9;

async function* walk(dir: string): AsyncGenerator<string> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(full);
        else if (entry.isFile()) yield full;
    }
}

/** Escribe `file + ext` si la compresión merece la pena. Devuelve lo ahorrado. */
async function writeIfWorthIt(
    file: string, ext: string, compressed: Buffer, original: number
): Promise<number> {
    if (compressed.length >= original * MIN_RATIO) return 0;
    await writeFile(file + ext, compressed);
    return original - compressed.length;
}

async function main() {
    if (!(await stat(DIST).catch(() => null))?.isDirectory()) {
        console.error(`[precompress] no existe ${DIST} — ¿falta \`bun run build\`?`);
        process.exit(1);
    }

    let files = 0;
    let original = 0;
    let savedBr = 0;
    let savedGz = 0;

    for await (const file of walk(DIST)) {
        if (!COMPRESSIBLE.test(file)) continue;
        const source = await readFile(file);
        if (source.length < MIN_BYTES) continue;

        const [br, gzipped] = await Promise.all([
            brotli(source, {
                params: {
                    [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
                    [constants.BROTLI_PARAM_SIZE_HINT]: source.length
                }
            }),
            gz(source, { level: constants.Z_BEST_COMPRESSION })
        ]);

        files++;
        original += source.length;
        savedBr += await writeIfWorthIt(file, '.br', br, source.length);
        savedGz += await writeIfWorthIt(file, '.gz', gzipped, source.length);
    }

    const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
    console.log(
        `[precompress] ${files} ficheros, ${mb(original)} en crudo → `
        + `${mb(original - savedBr)} con brotli, ${mb(original - savedGz)} con gzip`
    );
}

await main();
