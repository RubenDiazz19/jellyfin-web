import { describe, expect, it, vi } from 'vitest';

import type { PlayTarget } from 'types/playTarget';

import type { PlaybackManagerLike, Player } from '../types/player';
import {
    createTarget,
    displayPlayerIndividually,
    getPlayerTargets,
    normalizeName,
    sortPlayerTargets
} from './playerTargets';

function makePlayer(overrides: Partial<Player> = {}): Player {
    return {
        name: 'Reproductor',
        id: 'p1',
        canPlayMediaType: () => true,
        ...overrides
    };
}

function makeManager(overrides: Partial<PlaybackManagerLike> = {}): PlaybackManagerLike {
    return {
        _playQueueManager: { getPlaylist: () => [] },
        getPlayers: () => [],
        getSupportedCommands: () => ['Play', 'Pause'],
        ...overrides
    };
}

const target = (over: Partial<PlayTarget>): PlayTarget => ({
    id: 'x', name: 'X', playableMediaTypes: [], ...over
});

describe('displayPlayerIndividually', () => {
    it('deja fuera el player local: ya está en la lista como "este dispositivo"', () => {
        expect(displayPlayerIndividually(makePlayer({ isLocalPlayer: true }))).toBe(false);
    });

    it('incluye los remotos', () => {
        expect(displayPlayerIndividually(makePlayer())).toBe(true);
    });
});

describe('createTarget', () => {
    it('copia nombre e id del player y pide los comandos al manager', () => {
        const t = createTarget(
            makeManager({ getSupportedCommands: () => ['Play', 'Mute'] }),
            makePlayer({ name: 'Salón', id: 'chromecast-1', isLocalPlayer: false })
        );

        expect(t).toMatchObject({
            name: 'Salón',
            id: 'chromecast-1',
            playerName: 'Salón',
            isLocalPlayer: false,
            supportedCommands: ['Play', 'Mute']
        });
    });

    it('playableMediaTypes son tipos de medio, no booleanos', () => {
        // El código original hacía `.map(canPlayMediaType)` y metía booleanos
        // en un campo declarado como MediaType[].
        const t = createTarget(
            makeManager(),
            makePlayer({ canPlayMediaType: (m) => m === 'Audio' || m === 'Video' })
        );

        expect(t.playableMediaTypes).toEqual(['Audio', 'Video']);
    });

    it('un player que no reproduce nada deja la lista vacía', () => {
        const t = createTarget(makeManager(), makePlayer({ canPlayMediaType: () => false }));
        expect(t.playableMediaTypes).toEqual([]);
    });
});

describe('getPlayerTargets', () => {
    it('delega en el player cuando enumera sus propios destinos', async () => {
        const remotos = [target({ id: 'a', name: 'A' }), target({ id: 'b', name: 'B' })];
        const getTargets = vi.fn().mockResolvedValue(remotos);

        await expect(getPlayerTargets(makeManager(), makePlayer({ getTargets })))
            .resolves.toBe(remotos);
        expect(getTargets).toHaveBeenCalledOnce();
    });

    it('si no los enumera, devuelve el único destino que lo representa', async () => {
        const targets = await getPlayerTargets(
            makeManager(),
            makePlayer({ name: 'Local', id: 'local' })
        );

        expect(targets).toHaveLength(1);
        expect(targets[0]).toMatchObject({ id: 'local', name: 'Local' });
    });
});

describe('sortPlayerTargets', () => {
    it('el local va primero', () => {
        const local = target({ id: 'l', name: 'Zzz', isLocalPlayer: true });
        const remoto = target({ id: 'r', name: 'Aaa' });

        expect([remoto, local].sort(sortPlayerTargets)).toEqual([local, remoto]);
    });

    it('dentro del mismo grupo, por nombre', () => {
        const salon = target({ id: '1', name: 'Salón' });
        const cocina = target({ id: '2', name: 'Cocina' });

        expect([salon, cocina].sort(sortPlayerTargets)).toEqual([cocina, salon]);
    });

    it('el orden es estable con nombres repetidos', () => {
        const a = target({ id: '1', name: 'TV' });
        const b = target({ id: '2', name: 'TV' });

        expect([a, b].sort(sortPlayerTargets)).toEqual([a, b]);
    });
});

describe('normalizeName', () => {
    it('ignora mayúsculas y espacios al comparar nombres de dispositivo', () => {
        expect(normalizeName('Salón TV')).toBe('salóntv');
    });

    it('quita TODOS los espacios, no solo el primero', () => {
        // `replace(' ', '')` —lo que hacía el original— dejaba "salónde estar".
        expect(normalizeName('Salón de Estar')).toBe('salóndeestar');
    });

    it('un nombre sin espacios se queda en minúsculas', () => {
        expect(normalizeName('Chromecast')).toBe('chromecast');
    });
});
