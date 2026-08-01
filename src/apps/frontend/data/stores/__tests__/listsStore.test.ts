// Listas del servidor: de reproducción y colecciones.
//
// Lo que de verdad se prueba aquí: que las diferencias entre los dos tipos
// —una expande las series y borra por id de entrada, la otra no— quedan
// dentro del store, y que el comportamiento optimista revierte si el servidor
// falla.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const getPlaylists = vi.fn();
const getCollections = vi.fn();
const getPlaylistItems = vi.fn();
const getCollectionItems = vi.fn();
const addToPlaylist = vi.fn();
const addToCollection = vi.fn();
const removeFromPlaylist = vi.fn();
const removeFromCollection = vi.fn();
const createPlaylist = vi.fn();
const createCollection = vi.fn();
const setImageByUrl = vi.fn();
const uploadImageFile = vi.fn();
const deleteImage = vi.fn();
const updateItemMetadata = vi.fn();

vi.mock('../../api/metadata', () => ({
    updateItemMetadata: (...a: unknown[]) => updateItemMetadata(...a)
}));

vi.mock('../../api/remote-images', () => ({
    setImageByUrl: (...a: unknown[]) => setImageByUrl(...a),
    uploadImageFile: (...a: unknown[]) => uploadImageFile(...a),
    deleteImage: (...a: unknown[]) => deleteImage(...a)
}));

// La URL de la imagen propia se construye con `imageUrl`, que necesita sesión.
vi.mock('../../api/images', () => ({
    imageUrl: (id: string) => `cover://${id}`
}));

// `collapseSeries` y `entryIndex` no se simulan: son puras y plegar los
// episodios es justo parte de lo que se quiere comprobar. Solo se corta la red.
vi.mock('../../api/lists', async (importActual) => {
    const actual = await importActual<typeof import('../../api/lists')>();
    return {
        ...actual,
        getPlaylists: (...a: unknown[]) => getPlaylists(...a),
        getCollections: (...a: unknown[]) => getCollections(...a),
        getPlaylistItems: (...a: unknown[]) => getPlaylistItems(...a),
        getCollectionItems: (...a: unknown[]) => getCollectionItems(...a),
        addToPlaylist: (...a: unknown[]) => addToPlaylist(...a),
        addToCollection: (...a: unknown[]) => addToCollection(...a),
        removeFromPlaylist: (...a: unknown[]) => removeFromPlaylist(...a),
        removeFromCollection: (...a: unknown[]) => removeFromCollection(...a),
        createPlaylist: (...a: unknown[]) => createPlaylist(...a),
        createCollection: (...a: unknown[]) => createCollection(...a)
    };
});

import { LISTS } from '../listsStore';
import { LIST_COVERS } from '../listCoversStore';

/** Lo que deja el servidor al meter una serie en una LISTA: uno por capítulo. */
const asEpisodes = (n: number) => Array.from({ length: n }, (_, i) => ({
    id: `ep${i}`, entryId: `e-ep${i}`, kind: 'episode' as const,
    title: `Episodio ${i}`, seriesId: 'serie1', seriesName: 'Mi serie',
    seriesPoster: 'caratula', seriesLogo: 'logo'
}));

beforeEach(() => {
    vi.clearAllMocks();
    LISTS._reset();
    getPlaylists.mockResolvedValue([{ id: 'p1', name: 'Pendientes' }]);
    getCollections.mockResolvedValue([{ id: 'c1', name: 'Saga' }]);
    getPlaylistItems.mockResolvedValue([
        { id: 'peli', entryId: 'e-peli', kind: 'movie', title: 'Peli', backdrop: 'img' }
    ]);
    getCollectionItems.mockResolvedValue([
        { id: 'serie1', kind: 'show', title: 'Mi serie', backdrop: 'img-col' }
    ]);
    for (const m of [addToPlaylist, addToCollection, removeFromPlaylist, removeFromCollection]) {
        m.mockResolvedValue(undefined);
    }
    for (const m of [setImageByUrl, uploadImageFile, deleteImage]) m.mockResolvedValue(undefined);
    updateItemMetadata.mockResolvedValue(undefined);
    createPlaylist.mockResolvedValue('p9');
    createCollection.mockResolvedValue('c9');
});

describe('carga de los dos tipos', () => {
    test('trae listas y colecciones juntas, cada una con su tipo', async () => {
        await LISTS.ensure();
        expect(LISTS.all()).toHaveLength(2);
        expect(LISTS.ofKind('playlist').map((l) => l.name)).toEqual(['Pendientes']);
        expect(LISTS.ofKind('collection').map((l) => l.name)).toEqual(['Saga']);
    });

    test('`has` mira en los dos tipos', async () => {
        await LISTS.ensure();
        expect(LISTS.has('peli')).toBe(true); // en la lista de reproducción
        expect(LISTS.has('serie1')).toBe(true); // en la colección
        expect(LISTS.has('nada')).toBe(false);
    });

    test('si un tipo falla entero, el otro se sigue pudiendo usar', async () => {
        getCollections.mockRejectedValue(new Error('sin permiso'));
        await LISTS.ensure();
        expect(LISTS.ofKind('playlist')).toHaveLength(1);
        expect(LISTS.ofKind('collection')).toHaveLength(0);
    });

    test('ensure() no repite la carga; refresh() sí', async () => {
        await LISTS.ensure();
        await LISTS.ensure();
        expect(getPlaylists).toHaveBeenCalledTimes(1);
        await LISTS.refresh();
        expect(getPlaylists).toHaveBeenCalledTimes(2);
    });

    test('find localiza una lista por tipo e id', async () => {
        await LISTS.ensure();
        expect(LISTS.find('collection', 'c1')?.name).toBe('Saga');
        // El mismo id en el otro tipo no debe confundirse.
        expect(LISTS.find('playlist', 'c1')).toBeUndefined();
    });
});

describe('una serie en una lista de reproducción', () => {
    beforeEach(() => {
        getPlaylistItems.mockResolvedValue(asEpisodes(14));
    });

    test('cuenta como UN título, no como sus 14 capítulos', async () => {
        await LISTS.ensure();
        expect(LISTS.contains('playlist', 'p1', 'serie1')).toBe(true);
        expect(LISTS.ofKind('playlist')[0].count).toBe(1);
    });

    test('quitarla borra las entradas de todos sus capítulos de una vez', async () => {
        await LISTS.ensure();
        await LISTS.toggle('playlist', 'p1', 'serie1');
        expect(removeFromPlaylist).toHaveBeenCalledTimes(1);
        const [, ids] = removeFromPlaylist.mock.calls[0] as [string, string];
        expect(ids.split(',')).toHaveLength(14);
    });

    test('la portada es la carátula de la serie, no un fotograma', async () => {
        await LISTS.ensure();
        expect(LISTS.ofKind('playlist')[0].image).toBe('caratula');
    });
});

describe('una serie en una colección', () => {
    test('se guarda entera: el servidor no la expande', async () => {
        await LISTS.ensure();
        expect(LISTS.contains('collection', 'c1', 'serie1')).toBe(true);
        expect(LISTS.ofKind('collection')[0].count).toBe(1);
    });

    test('se quita con el id del ITEM, no con un id de entrada', async () => {
        await LISTS.ensure();
        await LISTS.toggle('collection', 'c1', 'serie1');
        expect(removeFromCollection).toHaveBeenCalledWith('c1', 'serie1');
        expect(removeFromPlaylist).not.toHaveBeenCalled();
    });
});

describe('toggle', () => {
    test('añade a la lista con la API de listas', async () => {
        await LISTS.ensure();
        await LISTS.toggle('playlist', 'p1', 'nuevo');
        expect(addToPlaylist).toHaveBeenCalledWith('p1', 'nuevo');
        expect(addToCollection).not.toHaveBeenCalled();
    });

    test('añade a la colección con la API de colecciones', async () => {
        await LISTS.ensure();
        await LISTS.toggle('collection', 'c1', 'nuevo');
        expect(addToCollection).toHaveBeenCalledWith('c1', 'nuevo');
        expect(addToPlaylist).not.toHaveBeenCalled();
    });

    test('el cambio se ve antes de que conteste el servidor', async () => {
        await LISTS.ensure();
        let resolveAdd: () => void = () => undefined;
        addToPlaylist.mockReturnValue(new Promise<void>((r) => { resolveAdd = r; }));

        const pending = LISTS.toggle('playlist', 'p1', 'nuevo');
        expect(LISTS.contains('playlist', 'p1', 'nuevo')).toBe(true);

        resolveAdd();
        await pending;
    });

    test('si el servidor falla al añadir, se revierte y se propaga', async () => {
        await LISTS.ensure();
        addToCollection.mockRejectedValue(new Error('boom'));
        await expect(LISTS.toggle('collection', 'c1', 'nuevo')).rejects.toThrow('boom');
        expect(LISTS.contains('collection', 'c1', 'nuevo')).toBe(false);
    });

    test('si falla al quitar, el título vuelve a la lista', async () => {
        await LISTS.ensure();
        removeFromPlaylist.mockRejectedValue(new Error('boom'));
        await expect(LISTS.toggle('playlist', 'p1', 'peli')).rejects.toThrow('boom');
        expect(LISTS.contains('playlist', 'p1', 'peli')).toBe(true);
    });

    test('una lista desconocida no hace nada', async () => {
        await LISTS.ensure();
        await LISTS.toggle('playlist', 'no-existe', 'peli');
        expect(addToPlaylist).not.toHaveBeenCalled();
    });

    test('notifica el cambio para que los botones re-lean', async () => {
        await LISTS.ensure();
        const seen = vi.fn();
        window.addEventListener(LISTS.event, seen);
        await LISTS.toggle('playlist', 'p1', 'nuevo');
        window.removeEventListener(LISTS.event, seen);
        expect(seen).toHaveBeenCalled();
    });
});

describe('fondo personalizado', () => {
    beforeEach(() => {
        localStorage.clear();
        LIST_COVERS._reset();
    });

    test('sin fondo propio manda la portada automática', async () => {
        await LISTS.ensure();
        expect(LISTS.ofKind('playlist')[0].image).toBe('img');
        expect(LISTS.hasCustomCover('playlist', 'p1')).toBe(false);
    });

    test('poner uno desde URL lo sube y lo marca como propio', async () => {
        await LISTS.ensure();
        await LISTS.setCover('playlist', 'p1', 'https://ejemplo/x.jpg');
        expect(setImageByUrl).toHaveBeenCalledWith('p1', 'Primary', 'https://ejemplo/x.jpg');
        expect(LISTS.hasCustomCover('playlist', 'p1')).toBe(true);
    });

    test('poner uno desde fichero usa la subida, no la URL', async () => {
        await LISTS.ensure();
        const file = new File(['x'], 'fondo.jpg', { type: 'image/jpeg' });
        await LISTS.setCover('collection', 'c1', file);
        expect(uploadImageFile).toHaveBeenCalledWith('c1', 'Primary', file);
        expect(setImageByUrl).not.toHaveBeenCalled();
    });

    test('con fondo propio se deja de usar la portada automática', async () => {
        await LISTS.ensure();
        await LISTS.setCover('playlist', 'p1', 'https://ejemplo/x.jpg');
        // Ya no es la imagen del último título añadido.
        expect(LISTS.ofKind('playlist')[0].image).not.toBe('img');
        expect(LISTS.ofKind('playlist')[0].hasCustomCover).toBe(true);
    });

    test('quitarlo lo borra del servidor y vuelve a la automática', async () => {
        await LISTS.ensure();
        await LISTS.setCover('playlist', 'p1', 'https://ejemplo/x.jpg');
        await LISTS.clearCover('playlist', 'p1');
        expect(deleteImage).toHaveBeenCalledWith('p1', 'Primary');
        expect(LISTS.hasCustomCover('playlist', 'p1')).toBe(false);
        expect(LISTS.ofKind('playlist')[0].image).toBe('img');
    });

    test('quitarlo funciona aunque no hubiera imagen que borrar', async () => {
        // El objetivo del usuario —volver a la portada automática— se cumple
        // igual, así que un fallo del borrado no debe propagarse.
        await LISTS.ensure();
        await LISTS.setCover('playlist', 'p1', 'https://ejemplo/x.jpg');
        deleteImage.mockRejectedValue(new Error('404'));
        await expect(LISTS.clearCover('playlist', 'p1')).resolves.toBeUndefined();
        expect(LISTS.hasCustomCover('playlist', 'p1')).toBe(false);
    });

    test('la marca es por lista: dos no se pisan', async () => {
        await LISTS.ensure();
        await LISTS.setCover('playlist', 'p1', 'https://ejemplo/x.jpg');
        expect(LISTS.hasCustomCover('collection', 'c1')).toBe(false);
    });

    test('un fallo al subir se propaga y no marca nada', async () => {
        await LISTS.ensure();
        setImageByUrl.mockRejectedValue(new Error('formato no válido'));
        await expect(LISTS.setCover('playlist', 'p1', 'x')).rejects.toThrow('formato no válido');
        expect(LISTS.hasCustomCover('playlist', 'p1')).toBe(false);
    });
});

describe('renombrar', () => {
    test('vale igual para listas y colecciones', async () => {
        await LISTS.ensure();
        await LISTS.rename('playlist', 'p1', 'Otro nombre');
        expect(updateItemMetadata).toHaveBeenCalledWith('p1', { Name: 'Otro nombre' });

        await LISTS.rename('collection', 'c1', 'Saga completa');
        expect(updateItemMetadata).toHaveBeenCalledWith('c1', { Name: 'Saga completa' });
    });

    test('el nombre nuevo se ve antes de que conteste el servidor', async () => {
        await LISTS.ensure();
        let resolveSave: () => void = () => undefined;
        updateItemMetadata.mockReturnValue(new Promise<void>((r) => { resolveSave = r; }));

        const pending = LISTS.rename('playlist', 'p1', 'Ya se ve');
        expect(LISTS.find('playlist', 'p1')?.name).toBe('Ya se ve');

        resolveSave();
        await pending;
    });

    test('si el servidor falla, vuelve el nombre anterior y se propaga', async () => {
        await LISTS.ensure();
        updateItemMetadata.mockRejectedValue(new Error('sin permiso'));
        await expect(LISTS.rename('playlist', 'p1', 'Otro')).rejects.toThrow('sin permiso');
        expect(LISTS.find('playlist', 'p1')?.name).toBe('Pendientes');
    });

    test('un nombre vacío o solo espacios no hace nada', async () => {
        await LISTS.ensure();
        await LISTS.rename('playlist', 'p1', '   ');
        expect(updateItemMetadata).not.toHaveBeenCalled();
        expect(LISTS.find('playlist', 'p1')?.name).toBe('Pendientes');
    });

    test('el mismo nombre no gasta una petición', async () => {
        await LISTS.ensure();
        await LISTS.rename('playlist', 'p1', 'Pendientes');
        expect(updateItemMetadata).not.toHaveBeenCalled();
    });

    test('se recortan los espacios de los lados', async () => {
        await LISTS.ensure();
        await LISTS.rename('playlist', 'p1', '  Con espacios  ');
        expect(updateItemMetadata).toHaveBeenCalledWith('p1', { Name: 'Con espacios' });
    });

    test('una lista desconocida no hace nada', async () => {
        await LISTS.ensure();
        await LISTS.rename('playlist', 'no-existe', 'X');
        expect(updateItemMetadata).not.toHaveBeenCalled();
    });
});

describe('create', () => {
    test('crea una lista de reproducción', async () => {
        await LISTS.create('playlist', 'Nueva', 'x');
        expect(createPlaylist).toHaveBeenCalledWith('Nueva', 'x');
        expect(createCollection).not.toHaveBeenCalled();
    });

    test('crea una colección', async () => {
        await LISTS.create('collection', 'Nueva', 'x');
        expect(createCollection).toHaveBeenCalledWith('Nueva', 'x');
        expect(createPlaylist).not.toHaveBeenCalled();
    });

    test('un fallo al crear se propaga', async () => {
        createCollection.mockRejectedValue(new Error('sin permiso'));
        await expect(LISTS.create('collection', 'Nueva', 'x')).rejects.toThrow('sin permiso');
    });
});
