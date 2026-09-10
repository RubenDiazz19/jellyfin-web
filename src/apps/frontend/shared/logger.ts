// Logger centralizado para el frontend propio.
// Cumple la convención de AGENTS.md:
// - debug: traza de desarrollo (el navegador la oculta por defecto)
// - warn: situación anómala pero recuperable
// - error: fallo de verdad
// No expone console.log para evitar violaciones de lint en todo el frontend.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
    debug(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
}

function createLogger(prefix?: string): Logger {
    const formatArgs = (args: unknown[]) => {
        if (!prefix) return args;
        if (typeof args[0] === 'string') {
            return [`[${prefix}] ${args[0]}`, ...args.slice(1)];
        }
        return [`[${prefix}]`, ...args];
    };

    return {
        debug: (...args: unknown[]) => {
            console.debug(...formatArgs(args));
        },
        info: (...args: unknown[]) => {
            console.info(...formatArgs(args));
        },
        warn: (...args: unknown[]) => {
            console.warn(...formatArgs(args));
        },
        error: (...args: unknown[]) => {
            console.error(...formatArgs(args));
        }
    };
}

export const logger = createLogger();
export { createLogger };
