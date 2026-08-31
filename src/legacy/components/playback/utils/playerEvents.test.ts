import { describe, expect, it, vi } from 'vitest';

import type { PlayTarget } from 'types/playTarget';
import Events from 'utils/events';

import type { Player } from '../types/player';
import { bindToFullscreenChange, triggerPlayerChange } from './playerEvents';

const makePlayer = (): Player => ({
    name: 'Reproductor', id: 'p1', canPlayMediaType: () => true
});

const target = (id: string): PlayTarget => ({ id, name: id, playableMediaTypes: [] });

describe('bindToFullscreenChange', () => {
    it('reemite el cambio estándar como evento del player', () => {
        const player = makePlayer();
        const onChange = vi.fn();
        Events.on(player, 'fullscreenchange', onChange);

        bindToFullscreenChange(player);
        document.dispatchEvent(new Event('fullscreenchange'));

        expect(onChange).toHaveBeenCalledOnce();
    });

    it('reemite el cambio con prefijo webkit como evento del player', () => {
        const player = makePlayer();
        const onChange = vi.fn();
        Events.on(player, 'fullscreenchange', onChange);

        bindToFullscreenChange(player);
        document.dispatchEvent(new Event('webkitfullscreenchange'));

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
