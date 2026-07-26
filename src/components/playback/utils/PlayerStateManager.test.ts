import { beforeEach, describe, expect, it } from 'vitest';

import type { Player } from '../types/player';
import { PlayerStateManager } from './PlayerStateManager';

function makePlayer(name = 'Reproductor'): Player {
    return { name, id: name, canPlayMediaType: () => true };
}

let states: PlayerStateManager;

beforeEach(() => {
    states = new PlayerStateManager();
});

describe('PlayerStateManager', () => {
    it('arranca vacío', () => {
        expect(states.size).toBe(0);
    });

    it('crea el estado la primera vez que se pide', () => {
        const player = makePlayer();

        expect(states.get(player)).toEqual({});
        expect(states.size).toBe(1);
    });

    it('pedirlo dos veces no duplica la entrada', () => {
        const player = makePlayer();

        expect(states.get(player)).toBe(states.get(player));
        expect(states.size).toBe(1);
    });

    it('devuelve el objeto vivo: escribir en él persiste', () => {
        const player = makePlayer();

        states.get(player).isChangingStream = true;

        expect(states.get(player).isChangingStream).toBe(true);
    });

    it('cada player tiene su propio estado', () => {
        const uno = makePlayer('Uno');
        const otro = makePlayer('Otro');

        states.get(uno).maxStreamingBitrate = 1000;

        expect(states.get(otro).maxStreamingBitrate).toBeUndefined();
        expect(states.size).toBe(2);
    });

    it('dos players con el mismo nombre no comparten estado', () => {
        // Se indexa por objeto, no por nombre: un player que se vuelve a crear
        // arranca limpio, igual que cuando el estado vivía en el propio objeto.
        const viejo = makePlayer('HtmlVideoPlayer');
        const nuevo = makePlayer('HtmlVideoPlayer');

        states.get(viejo).audioStreamIndex = 3;

        expect(states.get(nuevo).audioStreamIndex).toBeUndefined();
    });

    it('NO escribe el estado en el objeto del player', () => {
        // Esto es lo que hacía la versión anterior, y por eso el mapa estaba
        // siempre vacío: getPlayerData() devolvía el player, no el estado.
        const player = makePlayer();

        states.get(player).streamInfo = { url: 'https://srv/a.mkv' };

        expect(player).not.toHaveProperty('streamInfo');
    });
});

describe('PlayerStateManager: entradas inválidas', () => {
    it('sin player es un error de programación', () => {
        expect(() => states.get(null as unknown as Player)).toThrow('player cannot be null');
    });

    it('un player sin nombre también', () => {
        // El nombre identifica al plugin; sin él no es un player válido.
        expect(() => states.get({ id: 'x' } as unknown as Player))
            .toThrow('player name cannot be null');
    });
});
