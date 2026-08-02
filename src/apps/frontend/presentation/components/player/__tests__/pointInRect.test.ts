// La geometría con la que el OSD decide si el puntero está encima suyo.
//
// Antes esto se preguntaba con `.jfp-video-controls:hover`, y de ahí salía el
// bug: mientras el OSD está oculto la barra lleva `pointer-events: none`, así
// que el movimiento que lo despierta no impacta en ella; al volver a ser
// interactiva, Chrome no reevalúa el hover con el ratón quieto y `:hover`
// seguía valiendo false. Tres segundos después el OSD se desvanecía con el
// cursor justo encima. Comparar contra el rectángulo no depende de eso.

import { describe, expect, test, vi } from 'vitest';

// VideoPlayer llega, por el ViewModel, hasta ServerConnections y con él al
// bootstrap legacy (router raíz + playbackmanager), que tiene efectos a nivel
// de módulo. Se corta en la misma frontera que el resto de tests.
vi.mock('lib/jellyfin-apiclient', () => ({
    ServerConnections: {
        getApi: () => null,
        getCurrentUserId: () => null,
        getCurrentServerId: () => null,
        connect: () => Promise.resolve(),
        logout: () => Promise.resolve()
    }
}));

import { pointInRect } from '../VideoPlayer';

// Una barra de controles al uso: pegada abajo, de lado a lado.
const bar = { left: 0, right: 1920, top: 950, bottom: 1080 };

describe('pointInRect', () => {
    test('dentro', () => {
        expect(pointInRect({ x: 960, y: 1000 }, bar)).toBe(true);
    });

    test('justo encima de la barra, fuera', () => {
        expect(pointInRect({ x: 960, y: 949 }, bar)).toBe(false);
    });

    test('los bordes cuentan como dentro', () => {
        // El cursor sobre la primera fila de píxeles de la barra ya está
        // encima de ella: si no contara, el OSD podría irse al rozarla.
        expect(pointInRect({ x: 0, y: 950 }, bar)).toBe(true);
        expect(pointInRect({ x: 1920, y: 1080 }, bar)).toBe(true);
    });

    test('fuera por los lados', () => {
        expect(pointInRect({ x: -1, y: 1000 }, bar)).toBe(false);
        expect(pointInRect({ x: 1921, y: 1000 }, bar)).toBe(false);
    });

    test('sin puntero conocido, no está encima', () => {
        // Al abrir el reproductor aún no ha habido ningún movimiento: el OSD
        // tiene que poder ocultarse igualmente.
        expect(pointInRect(null, bar)).toBe(false);
    });
});
