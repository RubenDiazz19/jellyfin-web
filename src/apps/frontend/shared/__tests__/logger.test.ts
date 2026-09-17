import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, logger } from '../logger';

describe('logger', () => {
    let debugSpy: ReturnType<typeof vi.spyOn>;
    let infoSpy: ReturnType<typeof vi.spyOn>;
    let warnSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
        infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('logger por defecto invoca los métodos de console sin prefijo', () => {
        logger.debug('debug msg', 123);
        expect(debugSpy).toHaveBeenCalledWith('debug msg', 123);

        logger.info('info msg');
        expect(infoSpy).toHaveBeenCalledWith('info msg');

        logger.warn('warn msg');
        expect(warnSpy).toHaveBeenCalledWith('warn msg');

        logger.error('error msg');
        expect(errorSpy).toHaveBeenCalledWith('error msg');
    });

    it('createLogger con prefijo añade [prefix] al primer argumento string', () => {
        const customLogger = createLogger('TestPrefix');

        customLogger.debug('hello', { foo: 'bar' });
        expect(debugSpy).toHaveBeenCalledWith('[TestPrefix] hello', { foo: 'bar' });

        customLogger.info('info message');
        expect(infoSpy).toHaveBeenCalledWith('[TestPrefix] info message');

        customLogger.warn('warning message');
        expect(warnSpy).toHaveBeenCalledWith('[TestPrefix] warning message');

        customLogger.error('error message');
        expect(errorSpy).toHaveBeenCalledWith('[TestPrefix] error message');
    });

    it('createLogger con prefijo maneja primer argumento no-string anteponiendo el prefijo', () => {
        const customLogger = createLogger('PrefixOnly');
        const obj = { key: 'val' };

        customLogger.info(obj);
        expect(infoSpy).toHaveBeenCalledWith('[PrefixOnly]', obj);
    });
});
