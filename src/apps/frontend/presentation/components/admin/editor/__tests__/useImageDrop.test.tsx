import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test, vi } from 'vitest';

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

const mockToast = vi.fn();
vi.mock('../../../toast/ToastProvider', () => ({
    useToast: () => mockToast
}));

import { useImageDrop } from '../useImageDrop';

function DropTester({
    onFiles,
    multiple
}: {
    onFiles: (files: File[]) => void;
    multiple?: boolean;
}) {
    const drop = useImageDrop({ onFiles, multiple });
    return (
        <div>
            {drop.input}
            <button id='trigger-open' onClick={drop.open}>Abrir</button>
            <div id='drop-zone' {...drop.props}>Zona</div>
        </div>
    );
}

let root: Root | null = null;
let host: HTMLElement | null = null;

async function render(ui: React.ReactElement) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root?.render(ui); });
}

afterEach(() => {
    act(() => { root?.unmount(); });
    host?.remove();
    root = null;
    host = null;
    mockToast.mockClear();
});

describe('useImageDrop', () => {
    test('acepta ficheros con MIME type de imagen', async () => {
        const onFiles = vi.fn();
        await render(<DropTester onFiles={onFiles} />);

        const input = host?.querySelector('input[type="file"]') as HTMLInputElement;
        const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });

        await act(async () => {
            Object.defineProperty(input, 'files', { value: [file], configurable: true });
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });

        expect(onFiles).toHaveBeenCalledWith([file]);
    });

    test('acepta ficheros de imagen con MIME type vacío guiándose por la extensión', async () => {
        const onFiles = vi.fn();
        await render(<DropTester onFiles={onFiles} />);

        const input = host?.querySelector('input[type="file"]') as HTMLInputElement;
        const file = new File(['data'], 'wallpaper.webp', { type: '' });

        await act(async () => {
            Object.defineProperty(input, 'files', { value: [file], configurable: true });
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });

        expect(onFiles).toHaveBeenCalledWith([file]);
    });

    test('alerta con toast si se selecciona un fichero que no es imagen', async () => {
        const onFiles = vi.fn();
        await render(<DropTester onFiles={onFiles} />);

        const input = host?.querySelector('input[type="file"]') as HTMLInputElement;
        const file = new File(['data'], 'document.pdf', { type: 'application/pdf' });

        await act(async () => {
            Object.defineProperty(input, 'files', { value: [file], configurable: true });
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });

        expect(onFiles).not.toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'warn');
    });

    test('el botón de abrir dispara el click en el input offscreen', async () => {
        const onFiles = vi.fn();
        await render(<DropTester onFiles={onFiles} />);

        const input = host?.querySelector('input[type="file"]') as HTMLInputElement;
        const clickSpy = vi.spyOn(input, 'click');

        const button = host?.querySelector('#trigger-open') as HTMLButtonElement;
        await act(async () => { button.click(); });

        expect(clickSpy).toHaveBeenCalled();
    });
});
