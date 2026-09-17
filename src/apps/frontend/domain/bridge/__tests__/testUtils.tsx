import { act } from 'react';
import { createRoot } from 'react-dom/client';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * A minimalistic testing utility for React hooks without relying on
 * @testing-library/react (which is not installed in the workspace).
 */
export function renderHook<T>(hookFn: () => T) {
    let current: T;

    function TestComponent() {
        current = hookFn();
        return null;
    }

    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
        root.render(<TestComponent />);
    });

    const result = {
        get current() { return current; }
    };

    return {
        result,
        unmount() {
            act(() => {
                root.unmount();
            });
        }
    };
}
