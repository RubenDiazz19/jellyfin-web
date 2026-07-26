import { beforeEach, describe, expect, it, vi } from 'vitest';

import Events from 'utils/events';

import type { Player } from '../types/player';
import {
    PLAYER_PROGRESS_EVENTS,
    bindProgressEvents,
    type SendProgressUpdate
} from './playerProgressEvents';

function makePlayer(): Player {
    return { name: 'Reproductor', id: 'p1', canPlayMediaType: () => true };
}

let player: Player;
let send: ReturnType<typeof vi.fn> & SendProgressUpdate;

beforeEach(() => {
    player = makePlayer();
    send = vi.fn() as unknown as ReturnType<typeof vi.fn> & SendProgressUpdate;
});

describe('la tabla de eventos', () => {
    it('cubre los nueve que solo hay que informar', () => {
        expect(PLAYER_PROGRESS_EVENTS.map((b) => b.event)).toEqual([
            'timeupdate',
            'pause',
            'unpause',
            'volumechange',
            'repeatmodechange',
            'shufflequeuemodechange',
            'playlistitemmove',
            'playlistitemremove',
            'playlistitemadd'
        ]);
    });

    it('solo los cambios de cola adjuntan la cola al informe', () => {
        const conCola = PLAYER_PROGRESS_EVENTS
            .filter((b) => b.reportPlaylist)
            .map((b) => b.event);

        expect(conCola).toEqual(['playlistitemmove', 'playlistitemremove', 'playlistitemadd']);
    });
});

describe('bindProgressEvents', () => {
    it('cada evento del player se informa con su propio nombre', () => {
        bindProgressEvents(player, send);

        Events.trigger(player, 'pause');

        expect(send).toHaveBeenCalledWith(player, 'pause', undefined);
    });

    it('los cambios de cola se informan pidiendo la cola', () => {
        bindProgressEvents(player, send);

        Events.trigger(player, 'playlistitemadd');

        expect(send).toHaveBeenCalledWith(player, 'playlistitemadd', true);
    });

    it('engancha los nueve de una vez', () => {
        bindProgressEvents(player, send);

        for (const { event } of PLAYER_PROGRESS_EVENTS) {
            Events.trigger(player, event);
        }

        expect(send).toHaveBeenCalledTimes(PLAYER_PROGRESS_EVENTS.length);
    });

    it('un evento que no está en la tabla no informa nada', () => {
        bindProgressEvents(player, send);

        Events.trigger(player, 'stopped');

        expect(send).not.toHaveBeenCalled();
    });

    it('cada player recibe sus propios avisos', () => {
        const otro = makePlayer();
        bindProgressEvents(player, send);
        bindProgressEvents(otro, send);

        Events.trigger(otro, 'pause');

        expect(send).toHaveBeenCalledOnce();
        expect(send).toHaveBeenCalledWith(otro, 'pause', undefined);
    });
});
