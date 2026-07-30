import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { preconnectToServer, resetPreconnectForTests } from '../preconnect';

function links(): HTMLLinkElement[] {
    return [...document.querySelectorAll('link[rel="preconnect"]')] as HTMLLinkElement[];
}

describe('preconnectToServer', () => {
    beforeEach(() => {
        resetPreconnectForTests();
    });

    afterEach(() => {
        for (const link of links()) link.remove();
    });

    it('anuncia el origen de un servidor remoto', () => {
        preconnectToServer('https://192.168.1.100:8096');
        expect(links().map((l) => l.href)).toEqual([
            'https://192.168.1.100:8096/',
            'https://192.168.1.100:8096/'
        ]);
    });

    it('emite una conexión anónima y otra con credenciales', () => {
        preconnectToServer('https://192.168.1.100:8096');
        // La API va por fetch CORS sin credenciales; las imágenes son <img src>
        // sin crossorigin. Son dos pools distintos en el navegador.
        expect(links().map((l) => l.getAttribute('crossorigin'))).toEqual(['', null]);
    });

    it('se queda con el origen y descarta la ruta', () => {
        preconnectToServer('https://mi-servidor:8096/jellyfin/algo?x=1');
        expect(links()[0].href).toBe('https://mi-servidor:8096/');
    });

    it('no anuncia el mismo origen que la página', () => {
        preconnectToServer(window.location.origin);
        expect(links()).toHaveLength(0);
    });

    it('no repite un origen ya anunciado', () => {
        preconnectToServer('https://192.168.1.100:8096');
        preconnectToServer('https://192.168.1.100:8096/otra/ruta');
        expect(links()).toHaveLength(2);
    });

    it('una URL inservible no revienta el arranque', () => {
        for (const bad of [null, undefined, '', 'no es una url', '://roto']) {
            expect(() => preconnectToServer(bad)).not.toThrow();
        }
        expect(links()).toHaveLength(0);
    });
});
