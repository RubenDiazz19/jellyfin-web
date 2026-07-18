/// <reference types="vitest" />
/// <reference types="vite/client" />
/**
 * Vite configuration — development server (HMR) and unit tests (Vitest).
 *
 * The production build still runs through webpack (webpack.prod.js), which
 * targets legacy browsers and is verified with es-check. Vite is used only
 * for the dev loop and Vitest.
 *
 * The plugins that used to live in build/vite/plugins/ are inlined here so
 * this config stays self-contained.
 */
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const REPO_ROOT = path.resolve(__dirname);
const SRC_DIR = path.join(REPO_ROOT, 'src');
const NODE_MODULES_DIR = path.join(REPO_ROOT, 'node_modules');

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

// Dev-time static asset middleware: /libraries, /node-assets and
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
                } else if (url === '/serviceworker.js') {
                    filePath = path.join(SRC_DIR, 'serviceworker.js');
                }
                if (!filePath || !fs.existsSync(filePath)) return next();
                res.setHeader('Content-Type', filePath.endsWith('.js')
                    ? 'application/javascript'
                    : 'application/octet-stream');
                fs.createReadStream(filePath).pipe(res);
            });
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

export default defineConfig(({ command }) => ({
    // The app is rooted in src/ — index.html, config.json, manifest.json,
    // robots.txt and assets/ are all served from there as-is.
    root: SRC_DIR,
    publicDir: false,

    plugins: [
        // Resolves bare imports relative to src/ (tsconfig "baseUrl")
        tsconfigPaths(),
        ...htmlTemplates(),
        workerImports(),
        injectApp(),
        devStaticAssets(),
        devThemes()
    ],

    define: getDefines(command === 'serve'),

    build: {
        // Fuera de src/ (la raíz de Vite); si no, el bundle acaba en
        // src/dist y contamina el árbol de fuentes.
        outDir: path.join(REPO_ROOT, 'dist'),
        emptyOutDir: true
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
            '@mui/icons-material/*',
            '@mui/material/*',
            'date-fns/locale/*',
            ...listPackageModules('@jellyfin/sdk/lib/generated-client/api'),
            ...listPackageModules('@jellyfin/sdk/lib/generated-client/models'),
            ...listPackageModules('@jellyfin/sdk/lib/utils/api')
        ]
    },

    test: {
        coverage: {
            include: ['**']
        },
        environment: 'jsdom',
        restoreMocks: true
    }
}));
