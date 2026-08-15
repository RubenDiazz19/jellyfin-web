import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlayTarget } from 'types/playTarget';
import Events from 'utils/events';

import type { Player } from '../types/player';
import { bindToFullscreenChange, triggerPlayerChange } from './playerEvents';

// Screenfull mira el document real al cargarse; se sustituye para poder
// probar las dos ramas (API estándar y el prefijo de Safari en iOS).
// `vi.hoisted` porque `vi.mock` sube al principio del fichero y no vería una
// constante declarada aquí abajo.
const screenfull = vi.hoisted(() => ({ isEnabled: true, on: vi.fn() }));
vi.mock('screenfull', () => ({ default: screenfull }));

const makePlayer = (): Player => ({
    name: 'Reproductor', id: 'p1', canPlayMediaType: () => true
});

const target = (id: string): PlayTarget => ({ id, name: id, playableMediaTypes: [] });

beforeEach(() => {
    screenfull.isEnabled = true;
    screenfull.on.mockReset();
});

describe('bindToFullscreenChange', () => {
    it('con la API estándar, se suscribe a Screenfull', () => {
        bindToFullscreenChange(makePlayer());
        expect(screenfull.on).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('reemite el cambio como evento del player', () => {
        const player = makePlayer();
        const onChange = vi.fn();
        Events.on(player, 'fullscreenchange', onChange);

        bindToFullscreenChange(player);
        // Dispara el listener que Screenfull acaba de registrar.
        (screenfull.on.mock.calls[0][1] as () => void)();

        expect(onChange).toHaveBeenCalledOnce();
    });

    it('sin la API estándar (Safari iOS), escucha el evento con prefijo', () => {
        screenfull.isEnabled = false;
        const player = makePlayer();
        const onChange = vi.fn();
        Events.on(player, 'fullscreenchange', onChange);

        bindToFullscreenChange(player);
        document.dispatchEvent(new Event('webkitfullscreenchange'));

        expect(screenfull.on).not.toHaveBeenCalled();
        expect(onChange).toHaveBeenCalledOnce();
    });
});

describe('triggerPlayerChange', () => {
    it('avisa al cambiar de player', () => {
        const instance = {};
        const onChange = vi.fn();
        Events.on(instance, 'playerchange', onChange);

        const nuevo = makePlayer();
        triggerPlayerChange(instance, nuevo, target('b'), null, target('a'));

        expect(onChange).toHaveBeenCalledOnce();
    });

    it('calla si no había player antes ni lo hay ahora', () => {
        const instance = {};
        const onChange = vi.fn();
        Events.on(instance, 'playerchange', onChange);

        triggerPlayerChange(instance, null, null, null, null);

        expect(onChange).not.toHaveBeenCalled();
    });

    it('calla si el destino es el mismo (reconexión a la misma sesión)', () => {
        const instance = {};
        const onChange = vi.fn();
        Events.on(instance, 'playerchange', onChange);

        triggerPlayerChange(instance, makePlayer(), target('cast-1'), makePlayer(), target('cast-1'));

        expect(onChange).not.toHaveBeenCalled();
    });

    it('sí avisa si se pierde el player que había', () => {
        const instance = {};
        const onChange = vi.fn();
        Events.on(instance, 'playerchange', onChange);

        triggerPlayerChange(instance, null, null, makePlayer(), target('cast-1'));

        expect(onChange).toHaveBeenCalledOnce();
    });
});
