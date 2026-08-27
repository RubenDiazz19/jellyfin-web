#!/usr/bin/env bun
//
// Etiquetado automático de la biblioteca con un LLM.
//
//     bun run autotag --dry-run --limit 20   # probar con 20 títulos
//     bun run autotag                        # pasada completa
//
// Corre UNA vez: escribe `src/apps/frontend/data/autotag/autoTags.json` y la
// app lee de ahí. En tiempo de ejecución no se llama a ninguna IA.
//
// Es reanudable. Se guarda después de cada lote y al volver a lanzarlo se
// salta lo ya etiquetado, así que cortarlo con Ctrl-C —o quedarse sin cuota
// de la capa gratuita a media pasada— no pierde el trabajo hecho.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTagResponse } from '../../src/apps/frontend/data/autotag/parseResponse';
import { fetchLibrary, resolveUserId, type JellyfinConfig } from './jellyfin';
import { buildSystemPrompt, buildUserPrompt, type PromptItem } from './prompt';
import {
    createProvider, DEFAULT_MODELS, needsApiKey, type Provider, type ProviderName
} from './providers';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(SCRIPT_DIR, '../../src/apps/frontend/data/autotag/autoTags.json');
const PROVIDERS: readonly ProviderName[] = ['groq', 'gemini', 'ollama', 'openai'];

/** Lotes fallidos seguidos tras los que se da la pasada por perdida. */
const MAX_CONSECUTIVE_FAILURES = 3;

const USAGE = `Uso: bun run autotag [opciones]

  --dry-run        No escribe el fichero; enseña lo que saldría.
  --force          Reetiqueta también lo ya etiquetado.
  --prune          Borra del fichero los títulos que ya no están en la
                   biblioteca. No gasta ninguna llamada a la API.
  --limit N        Procesa como mucho N títulos (para probar).
  --only movies    Solo películas (o «series»).
  --batch N        Títulos por llamada (por defecto 20).
  --delay MS       Espera entre llamadas (por defecto 1500).

Variables de entorno (se leen también de .env):
  JELLYFIN_SERVER    URL del backend. Por defecto http://localhost:8096
  JELLYFIN_API_KEY   Clave de API (Panel → Avanzado → Claves de API). Obligatoria.
  JELLYFIN_USER_ID   Opcional; si no, se usa el primer administrador.
  AUTOTAG_PROVIDER   groq | gemini | ollama | openai. Por defecto groq.
  AUTOTAG_API_KEY    Clave del proveedor (no hace falta con ollama).
  AUTOTAG_MODEL      Modelo a usar. Por defecto, el del proveedor.
  AUTOTAG_BASE_URL   Solo para openai/ollama: URL alternativa.`;

function fail(message: string): never {
    console.error(`\n✖ ${message}\n`);
    process.exit(1);
}

// ── Opciones ────────────────────────────────────────────────────────────────

type Options = {
    dryRun: boolean;
    force: boolean;
    prune: boolean;
    limit?: number;
    batchSize: number;
    delayMs: number;
    only: 'all' | 'movies' | 'series';
    strict: boolean; // new flag
};

function parseArgs(argv: string[]): Options {
    const opts: Options = {
        dryRun: false,
        force: false,
        prune: false,
        limit: undefined,
        batchSize: Number(process.env.AUTOTAG_BATCH ?? 20),
        delayMs: Number(process.env.AUTOTAG_DELAY_MS ?? 1500),
        only: 'all',
        strict: false
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const value = () => argv[++i];
        switch (arg) {
            case '--dry-run':
                opts.dryRun = true;
                break;
            case '--force':
                opts.force = true;
                break;
            case '--prune':
                opts.prune = true;
                break;
            case '--limit':
                opts.limit = Number(value());
                break;
            case '--batch':
                opts.batchSize = Number(value());
                break;
            case '--strict':
                opts.strict = true;
                break;
            case '--only':
                opts.only = parseOnly(value());
                break;
            case '--help':
            case '-h':
                console.log(USAGE);
                process.exit(0);
                break;
            default:
                fail(`Opción desconocida: ${arg}\n\n${USAGE}`);
        }
    }
    return opts;
}

function parseOnly(value: string): 'movies' | 'series' {
    if (value !== 'movies' && value !== 'series') {
        fail(`--only admite «movies» o «series», no «${value}»`);
    }
    return value;
}

// ── Configuración ───────────────────────────────────────────────────────────

function resolveJellyfin(): JellyfinConfig {
    const apiKey = process.env.JELLYFIN_API_KEY ?? '';
    if (!apiKey) {
        fail('Falta JELLYFIN_API_KEY. Se saca del panel de Jellyfin: Avanzado → Claves de API.');
    }
    return {
        server: process.env.JELLYFIN_SERVER ?? 'http://localhost:8096',
        apiKey,
        userId: process.env.JELLYFIN_USER_ID
    };
}

function resolveProvider(): Provider {
    const provider = (process.env.AUTOTAG_PROVIDER ?? 'groq') as ProviderName;
    if (!PROVIDERS.includes(provider)) {
        fail(`AUTOTAG_PROVIDER debe ser uno de: ${PROVIDERS.join(', ')}`);
    }
    const apiKey = process.env.AUTOTAG_API_KEY ?? '';
    if (needsApiKey(provider) && !apiKey) {
        fail(`Falta AUTOTAG_API_KEY para «${provider}». Ponla en .env — mira .env.example.`);
    }
    return createProvider({
        provider,
        apiKey,
        model: process.env.AUTOTAG_MODEL ?? DEFAULT_MODELS[provider],
        baseUrl: process.env.AUTOTAG_BASE_URL
    });
}

// ── Fichero de salida ───────────────────────────────────────────────────────

type OutFile = { items: Record<string, string[]> };

const OUT_COMMENT = 'Generado por `bun run autotag`. Mapa itemId -> etiquetas del '
    + 'vocabulario. Las claves que empiezan por _ se ignoran al leer.';

function readExisting(): OutFile {
    if (!existsSync(OUT_PATH)) return { items: {} };
    try {
        const parsed = JSON.parse(readFileSync(OUT_PATH, 'utf8')) as Partial<OutFile>;
        return { items: parsed.items ?? {} };
    } catch {
        fail(`${OUT_PATH} existe pero no es JSON válido. Bórralo o arréglalo.`);
    }
}

function write(file: OutFile) {
    const body = {
        _comment: OUT_COMMENT,
        _generatedAt: new Date().toISOString(),
        items: file.items
    };
    writeFileSync(OUT_PATH, `${JSON.stringify(body, null, 2)}\n`);
}

// ── Pasada ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function chunk<T>(list: readonly T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
}

type Totals = { tagged: number; empty: number; rejected: Set<string> };

async function runBatch(
    llm: Provider, system: string, batch: PromptItem[], out: OutFile, opts: Options, totals: Totals
) {
    const raw = await llm.complete(system, buildUserPrompt(batch));
    const result = parseTagResponse(raw, batch.map((b) => b.id));

    for (const item of batch) {
        const tags = result.tags.get(item.id) ?? [];
        // Se guarda también la lista vacía: es lo que marca el título como ya
        // visto para la próxima pasada.
        out.items[item.id] = tags;
        if (tags.length > 0) totals.tagged++;
        else totals.empty++;
        if (opts.dryRun) {
            console.log(`  ${item.title} → ${tags.length ? tags.join(', ') : '(ninguna)'}`);
        }
    }
    for (const tag of result.rejectedTags) totals.rejected.add(tag);
    return result.tags.size;
}

/**
 * Quita del fichero los títulos que ya no están en la biblioteca. Es la otra
 * mitad de reescanear: lo nuevo se etiqueta solo, pero lo borrado se quedaba
 * ahí para siempre, engordando el JSON que va en el bundle.
 *
 * No cuesta ninguna llamada a la API — es comparar dos listas de ids.
 */
function pruneMissing(library: PromptItem[], out: OutFile): number {
    const alive = new Set(library.map((i) => i.id));
    let removed = 0;
    for (const id of Object.keys(out.items)) {
        if (!alive.has(id)) {
            delete out.items[id];
            removed++;
        }
    }
    return removed;
}

function pendingItems(library: PromptItem[], out: OutFile, opts: Options): PromptItem[] {
    // La comprobación es «¿está la clave?», no «¿tiene etiquetas?»: un título
    // al que el modelo no supo ponerle nada se guarda como lista vacía, y sin
    // esto cada pasada volvería a preguntarle por los mismos.
    const pending = opts.force ? library : library.filter((item) => !(item.id in out.items));
    return opts.limit === undefined ? pending : pending.slice(0, opts.limit);
}

/**
 * Recorre los lotes guardando después de cada uno.
 *
 * Un lote suelto que falla no aborta la pasada: se queda sin escribir y la
 * siguiente ejecución lo verá como pendiente. Pero varios seguidos ya no son
 * mala suerte —es la cuota diaria agotada o una clave mal puesta— y seguir
 * sería martillear la API decenas de veces para nada; con facturación detrás,
 * además, pagándolas.
 */
async function runAllBatches(
    llm: Provider, batches: PromptItem[][], out: OutFile, opts: Options, totals: Totals
) {
    const system = buildSystemPrompt();
    let failures = 0;

    for (const [i, batch] of batches.entries()) {
        const label = `[${i + 1}/${batches.length}]`;
        try {
            const n = await runBatch(llm, system, batch, out, opts, totals);
            const plural = batch.length === 1 ? 'título' : 'títulos';
            console.log(`${label} ${batch.length} ${plural}, ${n} etiquetados`);
            failures = 0;
        } catch (err) {
            console.error(`${label} ✖ ${(err as Error).message}`);
            failures++;
        }
        if (!opts.dryRun) write(out);
        if (failures >= MAX_CONSECUTIVE_FAILURES) {
            console.error(
                `\n✖ ${MAX_CONSECUTIVE_FAILURES} lotes seguidos han fallado; se aborta.`
                + '\n  Lo etiquetado hasta aquí está guardado: relanza el comando para seguir.'
            );
            process.exit(1);
        }
        if (i < batches.length - 1) await sleep(opts.delayMs);
    }
}

function report(totals: Totals, opts: Options) {
    console.log(`\n✓ ${totals.tagged} etiquetados, ${totals.empty} sin etiquetas reconocibles`);
    if (totals.rejected.size > 0) {
        console.log(`  Inventadas y descartadas: ${[...totals.rejected].slice(0, 10).join(', ')}`);
    }
    if (opts.dryRun) console.log('  (--dry-run: no se ha escrito nada)');
    else console.log(`  Escrito en ${OUT_PATH}`);
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.strict) {
        process.env.AUTOTAG_STRICT = '1';
    }

    const jf = resolveJellyfin();
    const llm = resolveProvider();

    const library = await fetchLibrary(jf, await resolveUserId(jf), opts.only);
    console.log(`Biblioteca: ${library.length} títulos`);

    const out = readExisting();
    const known = Object.keys(out.items).length;
    if (known > 0) console.log(`Ya etiquetados: ${known}`);

    if (opts.prune) {
        const removed = pruneMissing(library, out);
        console.log(`Borrados del fichero: ${removed} que ya no están en la biblioteca`);
        if (removed > 0 && !opts.dryRun) write(out);
    }

    const pending = pendingItems(library, out, opts);
    if (pending.length === 0) {
        console.log('\n✓ No hay nada pendiente: la biblioteca ya está al día.');
        console.log('  --force reetiqueta todo de nuevo.');
        return;
    }

    const batches = chunk(pending, opts.batchSize);
    // Se dice cuántas llamadas van a salir ANTES de empezar. Con una capa
    // gratuita es lo que hay que contrastar con la cuota diaria; si la clave
    // resulta estar en un proyecto facturado, es lo que se va a cobrar.
    console.log(`Pendientes: ${pending.length} en ${batches.length} lotes de ${opts.batchSize}`);
    console.log(`→ ${batches.length} llamadas a la API\n`);

    const totals: Totals = { tagged: 0, empty: 0, rejected: new Set() };
    await runAllBatches(llm, batches, out, opts, totals);
    report(totals, opts);
}

main().catch((err: unknown) => fail((err as Error).message));
