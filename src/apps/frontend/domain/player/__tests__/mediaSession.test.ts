// Los mandos que el reproductor NO pinta: la pantalla de bloqueo, las teclas
// de multimedia y —esto es lo que se olvidó— la ventana flotante de
// picture-in-picture.
//
// El fallo que motiva estas pruebas: la sesión solo se enganchaba en
// mobile/tablet, razonando que en escritorio ya está el OSD. Pero al sacar el
// vídeo a la ventana flotante el OSD se queda atrás, y sus botones de ±10 s y
// su barra de arrastre son exactamente estos handlers: sin registrarlos, se
// veían y no hacían nada. Nada fallaba ni avisaba; simplemente no pasaba nada
// al pulsarlos.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaSessionBinding, type MediaSessionHost } from '../mediaSession';

/** El trozo de `navigator.mediaSession` que toca este módulo. */
function stubMediaSession() {
    const handlers = new Map<string, ((d: { seekOffset?: number; seekTime?: number }) => void) | null>();
    const ms = {
        metadata: null as unknown,
        playbackState: 'none',
        setActionHandler: vi.fn((action: string, handler: never) => {
            handlers.set(action, handler);
        }),
        setPositionState: vi.fn()
    };
    Object.defineProperty(navigator, 'mediaSession', {
        value: ms, configurable: true, writable: true
    });
    return {
        ms,
        /** Dispara la acción como haría el sistema. Falla si no hay handler. */
        fire(action: string, detail: { seekOffset?: number; seekTime?: number } = {}) {
            const handler = handlers.get(action);
            expect(handler, `no hay handler para «${action}»`).toBeTruthy();
            handler?.(detail);
        },
        handlerFor: (action: string) => handlers.get(action)
    };
}

function makeHost(): MediaSessionHost & { calls: string[] } {
    const calls: string[] = [];
    return {
        calls,
        title: () => 'Frieren · T1 E1',
        artwork: () => [],
        paused: () => false,
        position: () => ({ duration: 1440, position: 780, playbackRate: 1 }),
        play: () => calls.push('play'),
        pause: () => calls.push('pause'),
        seekBy: (delta) => calls.push(`seekBy:${delta}`),
        seekTo: (seconds) => calls.push(`seekTo:${seconds}`)
    };
}

describe('MediaSessionBinding', () => {
    let system: ReturnType<typeof stubMediaSession>;
    let host: ReturnType<typeof makeHost>;
    let binding: MediaSessionBinding;

    beforeEach(() => {
        system = stubMediaSession();
        host = makeHost();
        binding = new MediaSessionBinding(host);
    });

    it('engancha los mandos sin preguntar por el layout', () => {
        // Sin condición de mobile/tablet: en escritorio son los botones de la
        // ventana de picture-in-picture.
        binding.start();
        for (const action of ['play', 'pause', 'seekbackward', 'seekforward', 'seekto']) {
            expect(system.handlerFor(action), `falta «${action}»`).toBeTruthy();
        }
    });

    it('los saltos de ±10 s llegan al reproductor', () => {
        binding.start();
        system.fire('seekbackward');
        system.fire('seekforward');
        expect(host.calls).toEqual(['seekBy:-10', 'seekBy:10']);
    });

    it('respeta el salto que pida el sistema, si lo dice', () => {
        binding.start();
        system.fire('seekforward', { seekOffset: 30 });
        expect(host.calls).toEqual(['seekBy:30']);
    });

    it('arrastrar la barra salta a la posición pedida', () => {
        binding.start();
        system.fire('seekto', { seekTime: 421 });
        expect(host.calls).toEqual(['seekTo:421']);
    });

    it('publica la posición para que la barra tenga algo que pintar', () => {
        binding.start();
        expect(system.ms.setPositionState).toHaveBeenCalledWith({
            duration: 1440, position: 780, playbackRate: 1
        });
    });

    describe('«siguiente»', () => {
        it('no se ofrece si no hay nada detrás', () => {
            binding.start();
            // null y no un handler vacío: así el navegador lo pinta apagado en
            // vez de dejar un botón que se pulsa y no pasa nada.
            expect(system.handlerFor('nexttrack')).toBeFalsy();
        });

        it('se engancha cuando la View dice qué viene después', () => {
            binding.start();
            const next = vi.fn();
            binding.setNextTrack(next);
            system.fire('nexttrack');
            expect(next).toHaveBeenCalledTimes(1);
        });

        it('también si la View lo puso antes de abrir el item', () => {
            binding.setNextTrack(vi.fn());
            binding.start();
            expect(system.handlerFor('nexttrack')).toBeTruthy();
        });

        it('se suelta con el item, para que no lo herede el siguiente', () => {
            binding.start();
            binding.setNextTrack(vi.fn());
            binding.stop();
            binding.start();
            expect(system.handlerFor('nexttrack')).toBeFalsy();
        });
    });

    it('al parar suelta todos los mandos', () => {
        binding.start();
        binding.setNextTrack(vi.fn());
        binding.stop();
        for (const action of ['play', 'pause', 'seekbackward', 'seekforward', 'seekto', 'nexttrack']) {
            expect(system.handlerFor(action), `«${action}» sigue enganchado`).toBeFalsy();
        }
        expect(system.ms.playbackState).toBe('none');
    });
});
