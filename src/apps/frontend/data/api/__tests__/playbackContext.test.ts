import { describe, expect, test } from 'vitest';
import { extractTrickplay, getTrickplayThumbnail, type TrickplayData } from '../playbackContext';

describe('Trickplay Helpers', () => {
    const trickplay: TrickplayData = {
        itemId: 'item-123',
        mediaSourceId: 'src-456',
        resolutions: {
            '320': {
                width: 320,
                height: 180,
                tileWidth: 10,
                tileHeight: 10,
                thumbnailCount: 150,
                interval: 10000
            }
        }
    };

    test('getTrickplayThumbnail calcula posición y coordenadas de sprites correctamente', () => {
        // En t=0 (primer fotograma del tile 0)
        const thumb0 = getTrickplayThumbnail(trickplay, 0, 'http://jellyfin.local');
        expect(thumb0).not.toBeNull();
        expect(thumb0?.url).toBe('http://jellyfin.local/Videos/item-123/Trickplay/320/0.jpg?MediaSourceId=src-456');
        expect(thumb0?.x).toBe(0);
        expect(thumb0?.y).toBe(0);
        expect(thumb0?.width).toBe(320);
        expect(thumb0?.height).toBe(180);
        expect(thumb0?.sheetWidth).toBe(3200);
        expect(thumb0?.sheetHeight).toBe(1800);

        // En t=25s -> index = floor(25000 / 10000) = 2 -> col 2, row 0 en sheet 0
        const thumb25 = getTrickplayThumbnail(trickplay, 25, 'http://jellyfin.local');
        expect(thumb25).not.toBeNull();
        expect(thumb25?.url).toBe('http://jellyfin.local/Videos/item-123/Trickplay/320/0.jpg?MediaSourceId=src-456');
        expect(thumb25?.x).toBe(640);
        expect(thumb25?.y).toBe(0);

        // En t=1050s -> index = floor(1050000 / 10000) = 105 -> sheet 1 (105 / 100), indexInSheet = 5 -> col 5, row 0
        const thumb1050 = getTrickplayThumbnail(trickplay, 1050, 'http://jellyfin.local');
        expect(thumb1050).not.toBeNull();
        expect(thumb1050?.url).toBe('http://jellyfin.local/Videos/item-123/Trickplay/320/1.jpg?MediaSourceId=src-456');
        expect(thumb1050?.x).toBe(1600);
        expect(thumb1050?.y).toBe(0);

        // Clamp cuando el tiempo excede la cuenta de miniaturas
        const thumbBeyond = getTrickplayThumbnail(trickplay, 99999, 'http://jellyfin.local');
        expect(thumbBeyond).not.toBeNull();
        // thumbnailCount es 150, maxIndex es 149 -> sheet 1, indexInSheet 49 -> row 4, col 9 -> x = 9*320=2880, y = 4*180=720
        expect(thumbBeyond?.url).toBe('http://jellyfin.local/Videos/item-123/Trickplay/320/1.jpg?MediaSourceId=src-456');
        expect(thumbBeyond?.x).toBe(2880);
        expect(thumbBeyond?.y).toBe(720);
    });

    test('getTrickplayThumbnail devuelve null con datos inválidos', () => {
        expect(getTrickplayThumbnail(null, 10, 'http://localhost')).toBeNull();

        const invalid = { ...trickplay, resolutions: { '320': { ...trickplay.resolutions['320'], interval: 0 } } };
        expect(getTrickplayThumbnail(invalid, 10, 'http://localhost')).toBeNull();
    });

    test('extractTrickplay extrae correctamente estructuras anidadas por mediaSourceId', () => {
        const raw = {
            'src-456': {
                '320': {
                    Width: 320,
                    Height: 180,
                    TileWidth: 10,
                    TileHeight: 10,
                    ThumbnailCount: 100,
                    Interval: 10000
                }
            }
        };
        const extracted = extractTrickplay('item-1', 'src-456', raw);
        expect(extracted).toBeDefined();
        expect(extracted?.resolutions['320']?.width).toBe(320);
        expect(extracted?.resolutions['320']?.height).toBe(180);
    });

    test('extractTrickplay soporta camelCase y mapas de resolución directos', () => {
        const raw = {
            '320': {
                width: 320,
                height: 180,
                tileWidth: 10,
                tileHeight: 10,
                thumbnailCount: 50,
                interval: 5000
            }
        };
        const extracted = extractTrickplay('item-2', undefined, raw);
        expect(extracted).toBeDefined();
        expect(extracted?.resolutions['320']?.interval).toBe(5000);
        expect(extracted?.resolutions['320']?.thumbnailCount).toBe(50);
    });
});
