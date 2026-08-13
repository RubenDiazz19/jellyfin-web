/// <reference types="vitest" />
/// <reference types="vite/client" />
/**
 * Vite configuration — the single builder for this repo: development server
 * (HMR), production bundle (`bun run build` → dist/) and unit tests (Vitest).
 * There is no webpack config any more.
 *
 * The plugins that used to live in build/vite/plugins/ are inlined here so
 * this config stays self-contained.
 */
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

import { JF_PROXY_PATTERN } from './scripts/apiRoots';

const REPO_ROOT = path.resolve(__dirname);
const SRC_DIR = path.join(REPO_ROOT, 'src');
const NODE_MODULES_DIR = path.join(REPO_ROOT, 'node_modules');

/**
 * Backend de desarrollo. El frontend habla con el servidor por URL ABSOLUTA
 * (la que se guarda al iniciar sesión), así que el proxy de abajo solo hace
 * falta cuando esa URL apunta al propio dev server — el caso de quien venía
 * usando el contenedor, que también servía en :8080.
 *
 * `loadEnv` con prefijo vacío lee el `.env` de la RAÍZ DEL REPO (no de `root`,
 * que aquí es src/) y sin exigir el prefijo `VITE_`: esta variable la consume
 * el config en Node, no el navegador, así que no debe acabar en el bundle. El
 * entorno real manda sobre el fichero, que es lo que se espera al hacer
 * `JELLYFIN_SERVER=… bun start`.
 */
function backendUrl(mode: string): string {
    const fromFile = loadEnv(mode, REPO_ROOT, '').JELLYFIN_SERVER;
    return process.env.JELLYFIN_SERVER || fromFile || 'http://localhost:8096';
}

// Compile-time globals declared in src/global.d.ts. The webpack build fills
// these in from git/package.json — for dev we ship reasonable defaults.
function getDefines(isServe: boolean): Record<string, string> {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8'));
    return {
        __COMMIT_SHA__: JSON.stringify('dev'),
        __JF_BUILD_VERSION__: JSON.stringify(pkg.version ?? '0.0.0'),
        __PACKAGE_JSON_NAME__: JSON.stringify(pkg.name ?? 'jellyfin-web'),
        __PACKAGE_JSON_VERSION__: JSON.stringify(pkg.version ?? '0.0.0'),
        __USE_SYSTEM_FONTS__: JSON.stringify(false),
        __WEBPACK_SERVE__: JSON.stringify(isServe)
    };
}

// Enumerate the runtime .js modules of a package, skipping .d.ts. Used to
// pre-bundle deep imports of packages like @jellyfin/sdk.
function listPackageModules(spec: string): string[] {
    try {
        const dir = path.join(NODE_MODULES_DIR, spec);
        return fs.readdirSync(dir)
            .filter((f) => (f.endsWith('.js') || f.endsWith('.mjs')) && !f.endsWith('.d.ts'))
            .map((f) => `${spec}/${f.replace(/\.m?js$/, '')}`);
    } catch {
        return [];
    }
}

/**
 * Los submódulos de MUI que el código IMPORTA de verdad.
 *
 * Antes aquí había `'@mui/icons-material/*'` y `'@mui/material/*'`. Ese primer
 * glob manda a pre-empaquetar los ~10.600 módulos del paquete de iconos, de
 * los que el repo entero usa menos de cien: era una carga de arranque del dev
 * server que no compraba nada. Escanear las fuentes cuesta ~30 ms sobre ~830
 * ficheros y no se queda obsoleto solo, que es lo que pasaría con una lista a
 * mano.
 */
function usedMuiModules(): string[] {
    const spec = /['"](@mui\/(?:material|icons-material)\/\w+)['"]/g;
    const found = new Set<string>();
    // Síncrono a propósito: el config se evalúa antes de que exista servidor.
    const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (/\.(?:[jt]sx?)$/.test(entry.name)) {
                for (const [, mod] of fs.readFileSync(full, 'utf-8').matchAll(spec)) {
                    found.add(mod);
                }
            }
        }
    };
    try {
        walk(SRC_DIR);
    } catch {
        // Si el escaneo falla, Vite descubre las dependencias sobre la marcha:
        // más lento en el primer arranque, pero nada se rompe.
        return [];
    }
    // Descarta lo que solo existe como tipos: el regex no distingue un
    // `import type` de uno normal, y `@mui/material/themeCssVarsAugmentation`
    // —que solo trae un .d.ts— hacía que Vite avisara de una dependencia
    // imposible de resolver en cada arranque.
    return [...found].filter(hasRuntimeModule).sort();
}

function hasRuntimeModule(spec: string): boolean {
    const base = path.join(NODE_MODULES_DIR, spec);
    return ['.js', '.mjs', '/index.js', '/index.mjs']
        .some((suffix) => fs.existsSync(base + suffix));
}

/**
 * Agrupación de los chunks de vendor.
 *
 * Sin esto todo node_modules cae en el chunk de entrada y tocar cualquier
 * dependencia invalida la caché del navegador para todas. Pero agrupar de más
 * SALE CARO: un grupo compartido entre el grafo estático y uno diferido sube
 * entero a la carga inicial. Medido sobre este repo (bytes del entry más lo
 * que precarga index.html):
 *
 *   sin agrupar                              937 586
 *   + vendor-react + vendor-color            934 828  ← lo que hay aquí
 *   + vendor-sdk                             953 511
 *   + vendor-mui                           1 156 984
 *
 * `@mui` es el caso de libro: casi todo vive hoy en los chunks diferidos del
 * dashboard, y nombrarlo lo hoisteaba a un chunk que la entrada sí importa de
 * forma estática — +219 KB en la primera pantalla a cambio de nada. Antes de
 * añadir un grupo nuevo, medidlo igual.
 */
const VENDOR_CHUNKS: [string, string[]][] = [
    // react-dom depende de internals de react y scheduler: van juntos o el
    // orden de evaluación entre chunks puede romperse. Son versiones fijadas
    // que cambian poquísimo: aisladas, sobreviven a cada despliegue en caché.
    ['vendor-react', ['react', 'react-dom', 'scheduler', 'react-router', 'react-router-dom']],
    // Solo lo usa el tema dinámico de mobile/tablet, que lo carga con
    // `import()` (ver colorScheme.ts): en su propio chunk, desktop no lo
    // descarga nunca.
    ['vendor-color', ['@material/material-color-utilities']]
];

function vendorChunk(id: string): string | undefined {
    const marker = `${path.sep}node_modules${path.sep}`;
    const at = id.lastIndexOf(marker);
    if (at === -1) return undefined;
    // Ruta del paquete dentro de node_modules, con '/' aunque el SO use '\'.
    const rest = id.slice(at + marker.length).split(path.sep).join('/');
    for (const [chunk, packages] of VENDOR_CHUNKS) {
        if (packages.some((p) => rest === p || rest.startsWith(`${p}/`))) return chunk;
    }
    return undefined;
}

// `import template from './x.html'` → default-exports the raw markup string.
// Matches the webpack html-loader behaviour the legacy views rely on.
//  - dev: transform directo a JS (el escáner de optimizeDeps lo entiende).
//  - build: se reescribe el import a `?raw` para que el plugin interno
//    build-html no intente parsear la plantilla como entry (rompe el build).
function htmlTemplates(): Plugin[] {
    return [
        {
            name: 'jf-html-templates-serve',
            apply: 'serve',
            enforce: 'pre',
            transform(_code, id) {
                if (!id.endsWith('.html')) return null;
                if (id.split('?')[0] === path.join(SRC_DIR, 'index.html')) return null;
                const raw = fs.readFileSync(id.split('?')[0], 'utf-8');
                return {
                    code: `export default ${JSON.stringify(raw)};`,
                    map: null
                };
            }
        },
        {
            name: 'jf-html-templates-build',
            apply: 'build',
            enforce: 'pre',
            async resolveId(source, importer) {
                if (!source.split('?')[0].endsWith('.html') || !importer) return null;
                if (source.includes('?raw')) return null;
                // The app entry point must go through Vite's own HTML pipeline.
                if (importer.endsWith('.html')) return null;
                const resolved = await this.resolve(source, importer, { skipSelf: true });
                if (!resolved) return null;
                if (resolved.id.split('?')[0] === path.join(SRC_DIR, 'index.html')) return null;
                return resolved.id.split('?')[0] + '?raw';
            }
        }
    ];
}

// `import Worker from './x.worker.ts'` → Worker constructor, mirroring
// webpack's worker-loader default export.
function workerImports(): Plugin {
    return {
        name: 'jf-worker-imports',
        enforce: 'pre',
        async resolveId(source, importer) {
            if (!/\.worker(\.ts|\.js)?$/.test(source)) return null;
            if (source.includes('?worker')) return null;
            const resolved = await this.resolve(source + '?worker', importer, { skipSelf: true });
            return resolved;
        }
    };
}

// Emits serviceworker.js (sin hash, en la raíz) into the build output. Vite
// only bundles modules reachable from index.html, and the SW must keep a
// stable URL for navigator.serviceWorker.register('/serviceworker.js').
function emitServiceWorker(): Plugin {
    return {
        name: 'jf-emit-serviceworker',
        apply: 'build',
        generateBundle() {
            this.emitFile({
                type: 'asset',
                fileName: 'serviceworker.js',
                source: fs.readFileSync(path.join(SRC_DIR, 'serviceworker.js'), 'utf-8')
            });
        }
    };
}

// Injects the entry <script> into src/index.html. The HTML on disk only
// declares #reactRoot; the runtime module is added here so index.html stays
// framework-agnostic.
function injectApp(): Plugin {
    return {
        name: 'jf-inject-app',
        transformIndexHtml: {
            // 'pre' para que el build recoja el script como entry module;
            // con el orden por defecto la inyección llega tarde y el bundle
            // sale vacío.
            order: 'pre',
            handler() {
                return [
                    {
                        tag: 'script',
                        attrs: { type: 'module', src: './index.jsx' },
                        injectTo: 'body'
                    }
                ];
            }
        }
    };
}

// Dev-time static asset middleware: /libraries, /node-assets, /favicons and
// /serviceworker.js live outside Vite's src/ root, so the built-in static
// server ignores them. Serve them directly from node_modules / repo root.
function devStaticAssets(): Plugin {
    return {
        name: 'jf-dev-static-assets',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const url = req.url ?? '';
                let filePath: string | null = null;
                if (url.startsWith('/libraries/')) {
                    filePath = path.join(NODE_MODULES_DIR, url.slice('/libraries/'.length));
                } else if (url.startsWith('/node-assets/')) {
                    filePath = path.join(NODE_MODULES_DIR, url.slice('/node-assets/'.length));
                } else if (url.startsWith('/favicons/')) {
                    // Igual que manifest.json (que referencia estos ficheros
                    // por su nombre): viven en el paquete @jellyfin/ux-web,
                    // no en src/.
                    filePath = path.join(
                        NODE_MODULES_DIR, '@jellyfin/ux-web/favicons', url.slice('/favicons/'.length)
                    );
                } else if (url === '/serviceworker.js') {
                    filePath = path.join(SRC_DIR, 'serviceworker.js');
                }
                if (!filePath) return next();
                // isFile(), no existsSync(): pedir un directorio (`/libraries/`)
                // abría un ReadStream sobre él y el EISDIR resultante llega como
                // 'error' sin manejar → se lleva por delante el dev server
                // entero, que desde el navegador se ve como una página en negro.
                if (!fs.statSync(filePath, { throwIfNoEntry: false })?.isFile()) return next();
                res.setHeader('Content-Type', filePath.endsWith('.js') ?
                    'application/javascript' :
                    'application/octet-stream');
                const stream = fs.createReadStream(filePath);
                stream.on('error', () => {
                    res.statusCode = 500;
                    res.end();
                });
                stream.pipe(res);
            });
        }
    };
}

// El build de producción SOLO empaqueta lo alcanzable desde index.html (HTML/
// CSS/JS) o lo importado como módulo: un fichero de texto plano en src/ que
// nadie importa (config.json, robots.txt) o que vive fuera de src/ del todo
// (favicons/) desaparece sin más. Y manifest.json es JSON estático — Vite no
// reescribe las URLs que lleva dentro, así que sus iconos necesitan una ruta
// ESTABLE que exista de verdad en el output, no la que Vite le habría puesto
// de haber podido hashearlos.
//
// Mismo patrón que emitServiceWorker(): this.emitFile con un nombre fijo.
function emitStaticFiles(): Plugin {
    const favicons = path.join(NODE_MODULES_DIR, '@jellyfin/ux-web/favicons');
    return {
        name: 'jf-emit-static-files',
        apply: 'build',
        generateBundle() {
            const emit = (fileName: string, source: Buffer | string) => {
                this.emitFile({ type: 'asset', fileName, source });
            };
            emit('config.json', fs.readFileSync(path.join(SRC_DIR, 'config.json')));
            emit('robots.txt', fs.readFileSync(path.join(SRC_DIR, 'robots.txt')));
            for (const name of fs.readdirSync(favicons)) {
                emit(`favicons/${name}`, fs.readFileSync(path.join(favicons, name)));
            }
            // Sin hash A PROPÓSITO: manifest.json (JSON estático) referencia
            // estas dos rutas tal cual — un nombre hasheado por Vite sería
            // distinto en cada build y manifest.json no tiene forma de
            // enterarse de cuál le tocó.
            for (const name of [
                'jellyfin-icon.png',
                'jellyfin-icon-180.png',
                'jellyfin-maskable-512.png'
            ]) {
                emit(`assets/img/${name}`, fs.readFileSync(path.join(SRC_DIR, 'assets/img', name)));
            }
        }
    };
}

/**
 * Deja en el build un único formato por fuente: woff2.
 *
 * El paquete de los iconos declara la misma fuente cuatro veces —eot para
 * IE6-8, ttf, woff y woff2— y Vite emite los cuatro ficheros. El navegador se
 * queda con el woff2, que va primero en la lista `src`, así que los otros tres
 * no los descarga nadie: son 700 KB muertos dentro de la imagen. Se podan del
 * `@font-face` y, con eso, dejan de estar referenciados y salen del output.
 *
 * El `@font-face` sin woff2 se deja como está: ahí los formatos viejos no
 * sobran, son el único que hay.
 */
function woff2Only(): Plugin {
    const LEGACY_FONT = /\.(?:eot|ttf|woff)$/;
    const TEXT_ASSET = /\.(?:css|js|mjs|html|json)$/;

    return {
        name: 'jf-woff2-only',
        apply: 'build',
        generateBundle(_options, bundle) {
            for (const chunk of Object.values(bundle)) {
                if (chunk.type !== 'asset' || !chunk.fileName.endsWith('.css')) continue;
                chunk.source = String(chunk.source).replace(/@font-face\{[^}]*\}/g, (block) => {
                    if (!block.includes('.woff2')) return block;
                    return block
                        // El `src:url(…eot);` suelto que precede a la lista real.
                        .replace(/src:\s*url\([^)]*\.eot\);/g, '')
                        // Y las entradas con `format()`. `\.woff\)` no pilla el
                        // woff2 porque exige el paréntesis justo detrás.
                        .replace(/url\([^)]*\.(?:eot|ttf|woff)\)\s*format\([^)]*\),?\s*/g, '')
                        // Podar la última entrada deja una coma colgando.
                        .replace(/,(\s*\})/g, '$1');
                });
            }

            const referenced = Object.values(bundle)
                .filter((c) => c.type === 'chunk' || TEXT_ASSET.test(c.fileName))
                .map((c) => (c.type === 'chunk' ? c.code : String(c.source)))
                .join('\n');
            for (const fileName of Object.keys(bundle)) {
                if (!LEGACY_FONT.test(fileName)) continue;
                if (!referenced.includes(path.basename(fileName))) delete bundle[fileName];
            }
        }
    };
}

// Compiles themes/<id>/theme.scss to CSS on demand for the dev server.
// Falls back silently if sass isn't installed (webpack build handles prod).
function devThemes(): Plugin {
    return {
        name: 'jf-dev-themes',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const match = req.url?.match(/^\/themes\/([^/]+)\/theme\.css$/);
                if (!match) return next();
                const scss = path.join(SRC_DIR, 'themes', match[1], 'theme.scss');
                if (!fs.existsSync(scss)) return next();
                try {
                    // eslint-disable-next-line @typescript-eslint/no-require-imports
                    const sass = require('sass');
                    const result = sass.compile(scss);
                    res.setHeader('Content-Type', 'text/css');
                    res.end(result.css);
                } catch (err) {
                    next(err);
                }
            });
        }
    };
}

/**
 * Informe de composición de los chunks de producción. Opt-in (`bun run
 * build:analyze`) porque añade tiempo al build y escribe un HTML que no tiene
 * nada que hacer en un despliegue: por eso sale a la raíz del repo y no a
 * dist/, que es lo que se sirve.
 */
// El import es dinámico porque el paquete es ESM-only y este config se carga
// como CJS (usa __dirname y require('sass')). Vite acepta promesas en
// `plugins`, así que además el módulo solo se toca cuando se pide el análisis.
function bundleVisualizer(): Promise<Plugin> | false {
    if (!process.env.ANALYZE) return false;
    return import('rollup-plugin-visualizer').then(({ visualizer }) => visualizer({
        filename: path.join(REPO_ROOT, 'bundle-stats.html'),
        template: 'treemap',
        // Lo que de verdad paga el usuario es el transferido, no el crudo.
        gzipSize: true,
        brotliSize: true
    }) as Plugin);
}

export default defineConfig(({ command, mode }) => ({
    // The app is rooted in src/ — index.html, config.json, manifest.json,
    // robots.txt and assets/ are all served from there as-is.
    root: SRC_DIR,
    publicDir: false,

    plugins: [
        // Resolves bare imports relative to src/ (tsconfig "baseUrl")
        tsconfigPaths(),
        ...htmlTemplates(),
        workerImports(),
        emitServiceWorker(),
        emitStaticFiles(),
        woff2Only(),
        injectApp(),
        devStaticAssets(),
        devThemes(),
        bundleVisualizer()
    ],

    define: getDefines(command === 'serve'),

    // tsconfig (jsx: react-jsx) solo cubre .tsx; los .jsx como index.jsx
    // necesitan que esbuild use también el runtime automático de React.
    esbuild: {
        jsx: 'automatic'
    },

    build: {
        // Fuera de src/ (la raíz de Vite); si no, el bundle acaba en
        // src/dist y contamina el árbol de fuentes.
        outDir: path.join(REPO_ROOT, 'dist'),
        emptyOutDir: true,
        // Explícito y no el 'modules' por defecto de Vite, que se mueve con
        // cada versión: estos cuatro son los navegadores con los que se
        // comprueba la app, y fijarlos hace el output reproducible.
        target: ['chrome107', 'edge107', 'firefox104', 'safari16'],
        // TRINQUETE, no meta. El chunk más gordo hoy es el de entrada, con
        // 725 KB minificados (medido el 2026-08-05); el aviso salta un poco
        // por encima para que una regresión de verdad se vea y el build
        // normal no haga ruido. hls.js (523 KB) va aparte y solo lo descarga
        // quien abre el reproductor. **Al bajar el bundle, bajad esto.**
        chunkSizeWarningLimit: 750,
        rollupOptions: {
            output: {
                manualChunks: (id) => vendorChunk(id)
            }
        }
    },

    resolve: {
        alias: [
            // Stylesheets use webpack-style urls into node_modules
            { find: /^~?@fontsource\//, replacement: path.join(NODE_MODULES_DIR, '@fontsource') + '/' },
            { find: /^~?@jellyfin\/ux-web\//, replacement: path.join(NODE_MODULES_DIR, '@jellyfin/ux-web') + '/' }
        ]
    },

    server: {
        port: 8080,
        fs: {
            // index.html references favicons directly from node_modules,
            // which lives outside the Vite root (src/)
            allow: [REPO_ROOT]
        },
        proxy: {
            [JF_PROXY_PATTERN]: {
                target: backendUrl(mode),
                changeOrigin: true,
                // `/socket` es el websocket por el que el servidor empuja los
                // cambios de sesión y biblioteca.
                ws: true
            }
        }
    },

    optimizeDeps: {
        include: [
            // Heavy players/readers loaded on demand
            'dompurify',
            'headroom.js',
            'hls.js',
            'markdown-it',
            'sortablejs',
            'blurhash',
            'react-dom',
            'lodash-es/debounce',
            'lodash-es/groupBy',
            'lodash-es/isEmpty',
            'lodash-es/isEqual',
            'lodash-es/merge',
            'lodash-es/union',
            // ESM con imports sin extensión: sin pre-empaquetar, el navegador
            // pide cada módulo suelto y el resolver de Vite tropieza (es el
            // mismo motivo por el que los tests lo llevan en `server.deps
            // .inline`).
            '@material/material-color-utilities',
            ...usedMuiModules(),
            'date-fns/locale/*',
            ...listPackageModules('@jellyfin/sdk/lib/generated-client/api'),
            ...listPackageModules('@jellyfin/sdk/lib/generated-client/models'),
            ...listPackageModules('@jellyfin/sdk/lib/utils/api')
        ]
    },

    test: {
        coverage: {
            include: ['**'],
            // Umbrales como TRINQUETE, no como meta (H2). El global sale bajo
            // a propósito: `include: ['**']` mide también las ~110 unidades
            // legacy sin tests, así que la cifra real hoy es ~5.6% de líneas.
            // Ponerlos justo por debajo de lo medido hace que una regresión
            // grande rompa el build, sin bloquear a nadie por el legacy.
            //
            // Los globs suben el listón donde el código sí está cubierto: el
            // frontend propio y utils/. **Al subir la cobertura de verdad,
            // subid estos números** — si no, el trinquete deja de servir.
            //
            // Medido el 2026-07-26 con `bun run test --coverage`:
            //   global            líneas 5.64  ramas 72.3  funciones 53.3
            //   apps/frontend     líneas 23.8  ramas 78.8  funciones 66.3
            //   utils             líneas 16.4  ramas 90.6  funciones 34.6
            thresholds: {
                lines: 5,
                statements: 5,
                branches: 70,
                functions: 50,
                '**/src/apps/frontend/**': {
                    lines: 22,
                    statements: 22,
                    branches: 75,
                    functions: 64
                },
                '**/src/utils/**': {
                    lines: 15,
                    statements: 15,
                    branches: 88,
                    functions: 32
                }
            }
        },
        environment: 'jsdom',
        restoreMocks: true,
        // `root` es `src/`, así que por defecto los tests de `scripts/` no se
        // recogerían. Se añaden explícitamente: `scripts/autotag` tiene lógica
        // propia (construcción del prompt) que merece red.
        include: [
            '**/*.{test,spec}.?(c|m)[jt]s?(x)',
            path.resolve(REPO_ROOT, 'scripts/**/*.{test,spec}.?(c|m)[jt]s?(x)')
        ],
        // Carga el diccionario de traducciones antes de los tests: los
        // componentes traducen en render y sin diccionario devolverían la
        // clave cruda. jsdom reporta en-US, así que los tests ven en-us.json.
        setupFiles: [path.resolve(SRC_DIR, 'lib/globalize/vitest.setup.ts')],
        server: {
            deps: {
                // material-color-utilities publica ESM con imports sin
                // extensión; Node no los resuelve al externalizar — inline
                // para que pasen por el resolver de Vite.
                inline: ['@material/material-color-utilities']
            }
        }
    }
}));
