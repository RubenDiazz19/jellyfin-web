import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNavScroll, type NavScrollState } from '../useScrollY';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

function mount(ui: React.ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    return act(async () => {
        root?.render(ui);
    });
}

describe('useNavScroll', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
    });

    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
        vi.useRealTimers();
        window.scrollY = 0;
    });

    it('inicia en reposo en la parte superior (scrollY = 0)', async () => {
        let state!: NavScrollState;
        function TestConsumer() {
            state = useNavScroll(40, 350);
            return null;
        }

        await mount(<TestConsumer />);
        expect(state.isScrolled).toBe(false);
        expect(state.isScrolling).toBe(false);
    });

    it('detecta scroll activo al superar el umbral y cesa tras el retardo de inactividad', async () => {
        let state!: NavScrollState;
        function TestConsumer() {
            state = useNavScroll(40, 350);
            return null;
        }

        await mount(<TestConsumer />);

        act(() => {
            window.scrollY = 120;
            window.dispatchEvent(new Event('scroll'));
        });

        expect(state.isScrolled).toBe(true);
        expect(state.isScrolling).toBe(true);

        // Avanzar el tiempo pero no alcanzar los 350ms
        act(() => {
            vi.advanceTimersByTime(200);
        });
        expect(state.isScrolling).toBe(true);

        // Completar el tiempo de inactividad
        act(() => {
            vi.advanceTimersByTime(160);
        });
        expect(state.isScrolled).toBe(true);
        expect(state.isScrolling).toBe(false);
    });

    it('vuelve inmediatamente a reposo superior al regresar a scrollY = 0', async () => {
        let state!: NavScrollState;
        function TestConsumer() {
            state = useNavScroll(40, 350);
            return null;
        }

        await mount(<TestConsumer />);

        act(() => {
            window.scrollY = 150;
            window.dispatchEvent(new Event('scroll'));
        });
        expect(state.isScrolled).toBe(true);

        act(() => {
            window.scrollY = 10;
            window.dispatchEvent(new Event('scroll'));
        });

        expect(state.isScrolled).toBe(false);
        expect(state.isScrolling).toBe(false);
    });
});
