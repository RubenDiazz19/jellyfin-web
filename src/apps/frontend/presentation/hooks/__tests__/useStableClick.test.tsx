import { describe, expect, test, vi } from 'vitest';
import { act, type MouseEvent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { preventMouseDown, useStableClick } from '../useStableClick';

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

describe('preventMouseDown', () => {
    test('llama a e.preventDefault()', () => {
        const preventDefault = vi.fn();
        const fakeEvent = { preventDefault } as unknown as MouseEvent;
        preventMouseDown(fakeEvent);
        expect(preventDefault).toHaveBeenCalledOnce();
    });
});

describe('useStableClick', () => {
    test('devuelve una función que previene el comportamiento por defecto dentro de un componente', async () => {
        let handler!: (e: MouseEvent) => void;
        function Component() {
            handler = useStableClick();
            return null;
        }

        await mount(<Component />);
        const preventDefault = vi.fn();
        const fakeEvent = { preventDefault } as unknown as MouseEvent;
        handler(fakeEvent);
        expect(preventDefault).toHaveBeenCalledOnce();

        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
    });
});
