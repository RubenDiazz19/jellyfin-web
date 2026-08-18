// El encuadre del hero se calcula leyendo los píxeles de la imagen, así que
// llega después de descargarla. Lo que se prueba aquí es que ese desfase nunca
// se ve: la imagen no se enseña centrada para recolocarse luego.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Backdrop } from '../Backdrop';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// El provider del tema arrastra el análisis de imagen y la cadena legacy del
// tema; aquí solo interesa qué encuadre entrega y cuándo.
const theme = {
    peek: undefined as number | null | undefined,
    resolve: null as ((x: number | null) => void) | null
};

vi.mock('../../../theme/MobileThemeProvider', () => ({
    useMobileTheme: () => ({
        applyImageSeed: () => undefined,
        peekFocusX: () => theme.peek,
        imageFocusX: () => new Promise((res) => { theme.resolve = res; })
    })
}));

let root: Root | null = null;
let host: HTMLElement | null = null;

function render(src = 'http://srv/a.jpg') {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => { root?.render(<Backdrop src={src} />); });
}

/** La capa de imagen: el primer div con background-image. */
function layer(): HTMLElement {
    const el = [...(host?.querySelectorAll('div') ?? [])]
        .find((d) => d.style.backgroundImage.includes('url('));
    expect(el, 'no hay capa de imagen').toBeDefined();
    return el as HTMLElement;
}

describe('Backdrop: encuadre sin salto', () => {
    beforeEach(() => {
        theme.peek = undefined;
        theme.resolve = null;
    });

    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
    });

    it('con el encuadre ya en memoria nace colocada y visible', () => {
        // Es el caso del carrusel que vuelve a un slide ya visto: el valor
        // estaba en caché y aun así se pintaba centrado un frame.
        theme.peek = 30;
        render();
        // 30 medido → 50 + (30-50)/2: el encuadre se amortigua a medio
        // recorrido hacia el centro (ver FadeLayer).
        expect(layer().style.backgroundPosition).toBe('40% center');
        expect(layer().style.opacity).toBe('1');
        // La capa de imagen se recorta al área útil (a la derecha del rail
        // de tablet): sin eso, su centro no casaba con el del contenido.
        expect(layer().style.left).toBe('var(--jfp-nav-left, 0px)');
    });

    it('sin encuadre todavía, la imagen no se enseña centrada', async () => {
        render();
        // Escondida: aparecer al 50% para deslizarse después es justo el salto.
        expect(layer().style.opacity).toBe('0');

        await act(async () => {
            theme.resolve?.(30);
            await Promise.resolve();
        });
        expect(layer().style.backgroundPosition).toBe('40% center');
    });

    it('una imagen sin encuadre medible se queda en el centro de siempre', async () => {
        render();
        await act(async () => {
            theme.resolve?.(null);
            await Promise.resolve();
        });
        expect(layer().style.backgroundPosition).toBe('50% center');
    });

    it('en escritorio no espera a nada: se pinta entera de una', () => {
        // El provider inerte contesta null en el acto, así que el hero —que es
        // el LCP de la página— no paga ni un frame de retraso.
        theme.peek = null;
        render();
        expect(layer().style.opacity).toBe('1');
        expect(layer().style.backgroundPosition).toBe('50% center');
    });
});
