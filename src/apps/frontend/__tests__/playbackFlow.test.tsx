// Integración del arranque de la reproducción: el punto donde una página
// pide "reproduce esto" y acaba montándose el reproductor con los parámetros
// correctos. Son dos mitades que solo se tocan a través de la URL —
// PlayerProvider.play() la escribe y VideoRoute la lee — así que un cambio en
// el nombre de un query param rompe la reproducción sin que falle ningún test
// de los dos lados por separado.
//
// La mecánica interna (PlaybackInfo, HLS, subtítulos, reporting) ya la cubre
// VideoPlayerViewModel.test; aquí solo se prueba la costura.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// El reproductor real arrastra hls.js y el ViewModel entero; aquí solo
// interesa qué props recibe.
vi.mock('../presentation/components/player/VideoPlayer', () => ({
    VideoPlayer: (props: { itemId: string; startTicks?: number; title?: string }) => (
        <div data-testid='player'>
            {`item=${props.itemId} start=${String(props.startTicks)} title=${String(props.title)}`}
        </div>
    )
}));

vi.mock('components/loading/loading', () => ({
    default: { show: () => undefined, hide: () => undefined },
    show: () => undefined,
    hide: () => undefined
}));

// El ViewModel del reproductor llega a `data/session`, y con él a
// ServerConnections: importarlo arrastra medio bootstrap legacy, que al
// evaluarse construye el hash router raíz y engancha playbackmanager a
// ServerConnections. Nada de eso pinta aquí, pero sus efectos de módulo se
// escapan del test como errores no capturados (y tumban el exit code aunque
// los 849 tests pasen). Se corta en la misma frontera que playbackHarness.
vi.mock('lib/jellyfin-apiclient', () => ({
    ServerConnections: {
        getApi: () => null,
        getCurrentUserId: () => null,
        getCurrentServerId: () => null,
        connect: () => Promise.resolve(),
        logout: () => Promise.resolve()
    }
}));

vi.mock('../shared/adaptiveLayout', () => ({
    initAdaptiveLayout: () => () => undefined,
    resetAdaptiveLayout: () => undefined
}));

import { Component as VideoRoute } from '../app/VideoRoute';
import { PlayerProvider, usePlayer } from '../presentation/components/player/PlayerProvider';

function LocationProbe() {
    const location = useLocation();
    return <span data-testid='url'>{location.pathname + location.search}</span>;
}

// Dispara un play() con los datos que le pasemos por props.
function PlayTrigger({ req }: { req: { itemId: string; title?: string; startTicks?: number } }) {
    const { play } = usePlayer();
    return <button type='button' onClick={() => play(req)}>reproducir</button>;
}

let root: Root | null = null;
let host: HTMLElement | null = null;

function mount(ui: React.ReactNode, initialPath = '/') {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
        root?.render(
            <MemoryRouter initialEntries={[initialPath]}>
                {ui}
                <LocationProbe />
            </MemoryRouter>
        );
    });
}

function url(): string {
    return host?.querySelector('[data-testid="url"]')?.textContent ?? '';
}

async function clickPlay() {
    const btn = host?.querySelector('button');
    await act(async () => {
        btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
}

describe('flujo de reproducción', () => {
    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
    });

    describe('play() construye la URL del reproductor', () => {
        it('lleva el id del item', async () => {
            mount(
                <PlayerProvider>
                    <PlayTrigger req={{ itemId: 'abc' }} />
                </PlayerProvider>
            );
            await clickPlay();
            expect(url()).toBe('/video?item=abc');
        });

        it('incluye posición y título cuando se reanuda', async () => {
            mount(
                <PlayerProvider>
                    <PlayTrigger req={{ itemId: 'abc', startTicks: 1234, title: 'Episodio 1' }} />
                </PlayerProvider>
            );
            await clickPlay();
            expect(url()).toContain('item=abc');
            expect(url()).toContain('start=1234');
            expect(url()).toContain('title=Episodio+1');
        });

        it('trunca ticks fraccionarios (el servidor espera un entero)', async () => {
            mount(
                <PlayerProvider>
                    <PlayTrigger req={{ itemId: 'abc', startTicks: 99.9 }} />
                </PlayerProvider>
            );
            await clickPlay();
            expect(url()).toContain('start=99');
        });

        it('empezar desde cero no ensucia la URL con start=0', async () => {
            mount(
                <PlayerProvider>
                    <PlayTrigger req={{ itemId: 'abc', startTicks: 0 }} />
                </PlayerProvider>
            );
            await clickPlay();
            expect(url()).toBe('/video?item=abc');
        });

        it('sin id no navega a ninguna parte', async () => {
            mount(
                <PlayerProvider>
                    <PlayTrigger req={{ itemId: '' }} />
                </PlayerProvider>
            );
            await clickPlay();
            expect(url()).toBe('/');
        });

        it('escapa ids e ilustra que el título viaja entero', async () => {
            mount(
                <PlayerProvider>
                    <PlayTrigger req={{ itemId: 'a b&c', title: 'Cañón / Sur' }} />
                </PlayerProvider>
            );
            await clickPlay();
            // Los separadores del query string no pueden aparecer sin escapar.
            expect(url()).toContain('item=a+b%26c');
            expect(url()).toContain('title=Ca%C3%B1%C3%B3n+%2F+Sur');
        });
    });

    describe('VideoRoute lee de vuelta lo que play() escribió', () => {
        function mountVideoAt(path: string) {
            mount(
                <Routes>
                    <Route path='/video' element={<VideoRoute />} />
                    <Route path='/' element={<div data-testid='home'>home</div>} />
                </Routes>,
                path
            );
        }

        it('pasa item, posición y título al reproductor', () => {
            mountVideoAt('/video?item=abc&start=1234&title=Episodio+1');
            expect(host?.querySelector('[data-testid="player"]')?.textContent)
                .toBe('item=abc start=1234 title=Episodio 1');
        });

        it('sin posición ni título los deja en undefined, no en cero ni vacío', () => {
            mountVideoAt('/video?item=abc');
            expect(host?.querySelector('[data-testid="player"]')?.textContent)
                .toBe('item=abc start=undefined title=undefined');
        });

        it('una URL de vídeo sin item devuelve a la home en vez de montar el reproductor', () => {
            mountVideoAt('/video');
            expect(host?.querySelector('[data-testid="player"]')).toBeNull();
            expect(host?.querySelector('[data-testid="home"]')).not.toBeNull();
        });
    });

    describe('ida y vuelta completa', () => {
        it('lo que escribe play() es exactamente lo que monta VideoRoute', async () => {
            // Las dos mitades en el mismo árbol: se pulsa reproducir en la
            // home y el router acaba montando el reproductor.
            mount(
                <PlayerProvider>
                    <Routes>
                        <Route
                            path='/'
                            element={<PlayTrigger req={{ itemId: 'x1', startTicks: 500, title: 'Peli' }} />}
                        />
                        <Route path='/video' element={<VideoRoute />} />
                    </Routes>
                </PlayerProvider>
            );

            await clickPlay();

            expect(host?.querySelector('[data-testid="player"]')?.textContent)
                .toBe('item=x1 start=500 title=Peli');
        });
    });
});
