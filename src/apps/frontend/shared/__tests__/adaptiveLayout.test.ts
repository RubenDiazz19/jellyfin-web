import { afterEach, describe, expect, it, vi } from 'vitest';

import { initAdaptiveLayout } from '../adaptiveLayout';

type Listener = () => void;

function installMatchMedia(initial: boolean) {
    let matches = initial;
    const listeners = new Set<Listener>();
    const mql = {
        get matches() { return matches; },
        addEventListener: (_type: string, cb: Listener) => { listeners.add(cb); },
        removeEventListener: (_type: string, cb: Listener) => { listeners.delete(cb); }
    };
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql as unknown as MediaQueryList);
    return {
        setMatches(v: boolean) {
            matches = v;
            listeners.forEach((cb) => { cb(); });
        }
    };
}

const html = () => document.documentElement.classList;

async function flushMutations() {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('adaptiveLayout', () => {
    afterEach(() => {
        document.documentElement.className = '';
    });

    it('mobile + viewport ancho: añade layout-tablet (y la quita al estrechar)', () => {
        document.documentElement.classList.add('layout-mobile');
        const mm = installMatchMedia(true);

        const stop = initAdaptiveLayout();
        expect(html().contains('layout-tablet')).toBe(true);
        expect(html().contains('layout-mobile')).toBe(true); // nunca se retira

        mm.setMatches(false);
        expect(html().contains('layout-tablet')).toBe(false);

        mm.setMatches(true);
        expect(html().contains('layout-tablet')).toBe(true);

        stop();
        expect(html().contains('layout-tablet')).toBe(false);
    });

    it('desktop: no añade layout-tablet aunque el viewport sea ancho', () => {
        document.documentElement.classList.add('layout-desktop');
        installMatchMedia(true);

        const stop = initAdaptiveLayout();
        expect(html().contains('layout-tablet')).toBe(false);
        stop();
    });

    it('si layoutManager cambia a desktop en caliente, layout-tablet desaparece', async () => {
        document.documentElement.classList.add('layout-mobile');
        installMatchMedia(true);

        const stop = initAdaptiveLayout();
        expect(html().contains('layout-tablet')).toBe(true);

        document.documentElement.classList.remove('layout-mobile');
        document.documentElement.classList.add('layout-desktop');
        await flushMutations();

        expect(html().contains('layout-tablet')).toBe(false);
        stop();
    });
});
