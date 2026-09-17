import { describe, it, expect, vi } from 'vitest';
import { APP_ROUTES } from '../routes';

vi.mock('../VideoRoute', () => ({ default: () => 'VideoRoute' }));
vi.mock('../AppLayout', () => ({ default: () => 'AppLayout' }));

describe('APP_ROUTES', () => {
    it('define las rutas principales de la aplicación', () => {
        expect(APP_ROUTES).toHaveLength(2);
        expect(APP_ROUTES[0].path).toBe('/video');
        expect(APP_ROUTES[1].path).toBe('/*');
    });

    it('carga perezosamente VideoRoute y AppLayout', async () => {
        const videoLazy = APP_ROUTES[0].lazy;
        const appLayoutLazy = APP_ROUTES[1].lazy;

        expect(videoLazy).toBeDefined();
        expect(appLayoutLazy).toBeDefined();

        if (videoLazy) {
            const videoMod = await videoLazy();
            expect(videoMod).toBeDefined();
        }

        if (appLayoutLazy) {
            const layoutMod = await appLayoutLazy();
            expect(layoutMod).toBeDefined();
        }
    });
});
