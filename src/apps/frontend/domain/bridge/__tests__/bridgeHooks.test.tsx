import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { signal } from '@preact/signals-core';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import { useViewModelLoad } from '../useViewModel';

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

afterEach(() => {
    act(() => { root?.unmount(); });
    host?.remove();
    root = null;
    host = null;
});

describe('useViewModelLoad', () => {
    test('ejecuta la función de carga al montar el componente', async () => {
        const dummyVM = {
            data: signal('initial')
        };
        const loadFn = vi.fn((vm: typeof dummyVM) => {
            vm.data.value = 'loaded';
        });

        function TestComponent() {
            const vm = useViewModelLoad(dummyVM, loadFn, []);
            return <div>{vm.data.value}</div>;
        }

        await mount(<TestComponent />);
        expect(loadFn).toHaveBeenCalledTimes(1);
        expect(host?.textContent).toBe('loaded');
    });
});
