// El diálogo del selector de avatares visto como pieza: que la rejilla pinte
// los candidatos, que elegir habilite «Guardar» y que guardar llame al
// ViewModel con lo elegido y avise al que abrió. La búsqueda y las fuentes ya
// las cubren los tests del ViewModel.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('lib/jellyfin-apiclient', () => ({
    ServerConnections: {
        getApi: () => null,
        getCurrentUserId: () => null,
        getCurrentServerId: () => null,
        connect: () => Promise.resolve(),
        logout: () => Promise.resolve()
    }
}));

// El VM singleton se construye sobre esta fachada al importar el módulo; los
// mocks viven dentro del factory (hoisted) y se recuperan del propio módulo.
vi.mock('../../../../data/api/ApiService', () => ({
    apiService: {
        avatars: {
            getLibraryCharacters: vi.fn(() => Promise.resolve([
                { id: 'lib-1', name: 'Buffy Summers', subtitle: 'Buffy · Sarah', series: 'Buffy', imageUrl: 'img/1', source: 'library' },
                { id: 'ani-2', name: 'Spike', subtitle: 'Buffy', imageUrl: 'img/2', source: 'anilist' }
            ])),
            searchLibraryCharacters: vi.fn(() => Promise.resolve([])),
            searchAniListCharacters: vi.fn(() => Promise.resolve([])),
            searchTmdbCharacters: vi.fn(() => Promise.resolve([])),
            isTmdbConfigured: () => true,
            // El arte de «Buffy» llega ya resuelto: la tile debe pintarlo.
            resolveSeriesArt: vi.fn(() => Promise.resolve(new Map([['buffy summers', 'art/buffy']]))),
            buildAvatarFile: vi.fn(() => Promise.resolve(new File([], 'avatar.png')))
        },
        users: { uploadAvatar: vi.fn(() => Promise.resolve()) }
    }
}));

// eslint-disable-next-line import/no-restricted-paths -- solo en tests: hay que recuperar el objeto MOCK del ApiService para configurarlo y espiarlo; el código bajo prueba solo pasa por domain/
import { apiService, type ApiService } from '../../../../data/api/ApiService';
import { avatarPickerVM } from '../../../../domain/viewModels/AvatarPickerViewModel';
import { ToastProvider } from '../../../components/toast/ToastProvider';
import { AvatarPickerDialog } from '../AvatarPickerDialog';

const mockAvatars = (apiService as unknown as ApiService).avatars;
// El tipado real de la fachada no sabe que es un mock: cast para las
// llamadas que configuran comportamiento (Once) y las aserciones.
const mockBuild = mockAvatars.buildAvatarFile as unknown as ReturnType<typeof vi.fn>;

let root: Root | null = null;
let host: HTMLElement | null = null;
const onApplied = vi.fn();
const onClose = vi.fn();

function render() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
        root?.render(
            <ToastProvider>
                <AvatarPickerDialog onClose={onClose} onApplied={onApplied} />
            </ToastProvider>
        );
    });
}

async function flush() {
    await act(async () => {});
}

beforeEach(() => {
    vi.clearAllMocks();
    onApplied.mockClear();
    onClose.mockClear();
});

afterEach(() => {
    act(() => { root?.unmount(); });
    host?.remove();
    root = null;
    host = null;
});

function tile(name: string): HTMLButtonElement {
    const btn = [...document.querySelectorAll('button')]
        .find((b) => (b as HTMLElement).title.startsWith(`${name} —`));
    expect(btn, `casilla de «${name}»`).toBeDefined();
    return btn as HTMLButtonElement;
}

function saveButton(): HTMLButtonElement {
    const btn = [...document.querySelectorAll('button')]
        .find((b) => b.textContent === 'Save');
    expect(btn).toBeDefined();
    return btn as HTMLButtonElement;
}

describe('AvatarPickerDialog', () => {
    test('pinta la rejilla de salida con su etiqueta de anime', async () => {
        render();
        await flush();

        expect(document.body.textContent).toContain('Choose your avatar');
        expect(document.body.textContent).toContain('Buffy Summers');
        // El candidato de AniList lleva la marca «Anime»; nada más la usa.
        expect(document.body.textContent).toContain('Anime');

        act(() => { tile('Spike').click(); });
        expect(tile('Spike').getAttribute('aria-pressed')).toBe('true');
    });

    test('la tile enseña el arte del personaje cuando llega de AniList', async () => {
        render();
        await flush();

        const btn = tile('Buffy Summers');
        const photo = btn.querySelector('div') as HTMLElement;
        expect(photo, 'el contenedor de la foto de la tile').toBeDefined();
        expect(photo.style.backgroundImage).toContain('art/buffy');
    });

    test('guardar compone y avisa al que abrió', async () => {
        render();
        await flush();

        expect(saveButton().disabled).toBe(true);

        act(() => { tile('Spike').click(); });
        expect(saveButton().disabled).toBe(false);

        await act(async () => { saveButton().click(); });

        expect(mockBuild).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'ani-2' })
        );
        expect(onApplied).toHaveBeenCalledTimes(1);
        expect(document.body.textContent).toContain('Image saved');
    });

    test('si componer falla, avisa y mantiene el diálogo abierto para reintentar', async () => {
        mockBuild.mockRejectedValueOnce(new Error('Could not load the image'));
        render();
        await flush();

        act(() => { tile('Spike').click(); });
        await act(async () => { saveButton().click(); });

        expect(onApplied).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
        expect(document.body.textContent).toContain('Could not load the image');
        expect(avatarPickerVM.saving.value).toBe(false);
    });
});
