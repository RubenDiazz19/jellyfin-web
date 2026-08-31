import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import { PosterFrame } from '../PosterFrame';
import { CardOverlay } from '../CardOverlay';
import { CardProgress } from '../CardProgress';
import { PosterOverlay } from '../PosterOverlay';

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

describe('PosterFrame', () => {
    test('renderiza contenedor con relación de aspecto 2/3 y outline si está seleccionado', async () => {
        await mount(
            <PosterFrame selected={true} borderRadius={8}>
                <span>Contenido</span>
            </PosterFrame>
        );
        const frame = host?.firstElementChild as HTMLElement;
        expect(frame).toBeTruthy();
        expect(frame.style.aspectRatio).toBe('2/3');

        expect(frame.style.borderRadius).toBe('8px');
        expect(frame.style.outline).toContain('3px solid');
    });
});

describe('CardOverlay', () => {
    test('renderiza slots topLeft y topRight en posiciones absolutas', async () => {
        await mount(
            <div style={{ position: 'relative' }}>
                <CardOverlay
                    topLeft={<span data-testid='tl'>Izquierda</span>}
                    topRight={<span data-testid='tr'>Derecha</span>}
                />
            </div>
        );
        const tl = host?.querySelector('[data-testid="tl"]');
        const tr = host?.querySelector('[data-testid="tr"]');
        expect(tl).toBeTruthy();
        expect(tr).toBeTruthy();
    });
});

describe('CardProgress', () => {
    test('no renderiza nada si el progreso es 0 o negativo', async () => {
        await mount(<CardProgress value={0} />);
        expect(host?.innerHTML).toBe('');
    });

    test('renderiza barra de progreso cuando el valor es mayor a 0', async () => {
        await mount(<CardProgress value={0.5} />);
        expect(host?.children.length).toBe(1);
        const container = host?.firstElementChild as HTMLElement;
        expect(container.style.bottom).toBe('0px');
    });
});

describe('PosterOverlay', () => {
    test('renderiza logo como imagen si está presente', async () => {
        await mount(<PosterOverlay logo='https://example.com/logo.png' title='Mi Serie' />);
        const img = host?.querySelector('img');
        expect(img).toBeTruthy();
        expect(img?.getAttribute('src')).toBe('https://example.com/logo.png');
        expect(img?.getAttribute('alt')).toBe('Mi Serie');
    });

    test('renderiza título como texto si no hay logo', async () => {
        await mount(<PosterOverlay title='Mi Película' />);
        expect(host?.textContent).toContain('Mi Película');
    });
});
