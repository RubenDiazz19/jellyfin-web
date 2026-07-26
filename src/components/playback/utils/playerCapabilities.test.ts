import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppFeature } from 'constants/appFeature';

import type { PlaybackManagerLike, Player } from '../types/player';

const supports = vi.fn();
// apphost arrastra media app legacy al entorno de test; solo hace falta
// `supports` para decidir si el volumen es físico.
vi.mock('components/apphost', () => ({ appHost: { supports: (f: string) => supports(f) } }));

const {
    enableLocalPlaylistManagement,
    getAutomaticPlayers,
    isAutomaticPlayer,
    supportsPhysicalVolumeControl
} = await import('./playerCapabilities');

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
        getSupportedCommands: () => [],
        ...overrides
    };
}

beforeEach(() => {
    supports.mockReturnValue(false);
});

describe('enableLocalPlaylistManagement', () => {
    it('el player local sin cola propia deja la cola al manager', () => {
        expect(enableLocalPlaylistManagement(makePlayer({ isLocalPlayer: true }))).toBe(true);
    });

    it('un player con cola propia se la queda, aunque sea local', () => {
        const player = makePlayer({ isLocalPlayer: true, getPlaylist: () => Promise.resolve([]) });
        expect(enableLocalPlaylistManagement(player)).toBe(false);
    });

    it('un remoto sin cola propia tampoco la delega en el manager', () => {
        expect(enableLocalPlaylistManagement(makePlayer())).toBe(false);
    });
});

describe('supportsPhysicalVolumeControl', () => {
    it('solo si el player es local y el host declara volumen físico', () => {
        supports.mockImplementation((f) => f === AppFeature.PhysicalVolumeControl);
        expect(supportsPhysicalVolumeControl(makePlayer({ isLocalPlayer: true }))).toBe(true);
    });

    it('no, si el host no lo declara', () => {
        expect(supportsPhysicalVolumeControl(makePlayer({ isLocalPlayer: true }))).toBe(false);
    });

    it('no, en un player remoto aunque el host lo declare', () => {
        supports.mockReturnValue(true);
        expect(supportsPhysicalVolumeControl(makePlayer())).toBe(false);
    });
});

describe('isAutomaticPlayer', () => {
    it('solo el local recibe reproducción sin que el usuario lo elija', () => {
        expect(isAutomaticPlayer(makePlayer({ isLocalPlayer: true }))).toBe(true);
        expect(isAutomaticPlayer(makePlayer())).toBe(false);
    });
});

describe('getAutomaticPlayers', () => {
    it('si hay una sesión remota activa, la reproducción sigue yendo allí', () => {
        const remoto = makePlayer({ id: 'cast' });
        const local = makePlayer({ id: 'local', isLocalPlayer: true });
        const manager = makeManager({ _currentPlayer: remoto, getPlayers: () => [local, remoto] });

        expect(getAutomaticPlayers(manager)).toEqual([remoto]);
    });

    it('forceLocalPlayer se salta la sesión remota activa', () => {
        const remoto = makePlayer({ id: 'cast' });
        const local = makePlayer({ id: 'local', isLocalPlayer: true });
        const manager = makeManager({ _currentPlayer: remoto, getPlayers: () => [local, remoto] });

        expect(getAutomaticPlayers(manager, true)).toEqual([local]);
    });

    it('sin sesión remota activa, devuelve los locales', () => {
        const local = makePlayer({ id: 'local', isLocalPlayer: true });
        const otro = makePlayer({ id: 'cast' });
        const manager = makeManager({ _currentPlayer: null, getPlayers: () => [local, otro] });

        expect(getAutomaticPlayers(manager)).toEqual([local]);
    });

    it('un player local activo no impide mirar la lista completa', () => {
        const local = makePlayer({ id: 'local', isLocalPlayer: true });
        const otroLocal = makePlayer({ id: 'local2', isLocalPlayer: true });
        const manager = makeManager({
            _currentPlayer: local,
            getPlayers: () => [local, otroLocal]
        });

        expect(getAutomaticPlayers(manager)).toEqual([local, otroLocal]);
    });
});
