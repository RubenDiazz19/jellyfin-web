import { describe, expect, test, vi } from 'vitest';
import { PersonViewModel } from '../PersonViewModel';
import type { ApiService } from '../../../data/api/ApiService';
import type { Movie, Show } from '../../../data/models';
import { calculateAge, resolveCountry, type PersonMetadata } from '../../../data/api/person';

vi.mock('../../../data/api/ApiService', () => ({ apiService: {} }));

const mockShow = (id: string) => ({ id, title: `Serie ${id}` }) as Show;
const mockMovie = (id: string) => ({ id, title: `Peli ${id}` }) as Movie;

const mockMeta: PersonMetadata = {
    name: 'Ian McKellen',
    birthDate: '1939-05-25',
    deathDate: null,
    age: 84,
    isDeceased: false,
    placeOfBirth: 'Burnley, Lancashire, England, UK',
    country: 'Reino Unido',
    countryCode: 'gb',
    bio: 'Sir Ian Murray McKellen es un actor británico...',
    description: 'actor británico',
    photo: 'https://example.com/photo.jpg',
    imdbId: 'nm0005212',
    tmdbId: '1327',
    wikiUrl: 'https://es.wikipedia.org/wiki/Ian_McKellen'
};

function createStubVM() {
    const api = {
        discover: {
            getByPerson: vi.fn((name: string) =>
                Promise.resolve({ shows: [mockShow(`s-${name}`)], movies: [mockMovie(`m-${name}`)] }))
        },
        person: {
            getPersonMetadata: vi.fn(() =>
                Promise.resolve(mockMeta))
        }
    } as unknown as ApiService;

    return { vm: new PersonViewModel(api), api };
}

describe('PersonViewModel', () => {
    test('carga la filmografía y metadatos reales de la persona', async () => {
        const { vm, api } = createStubVM();
        await vm.load('Ian McKellen');

        expect(api.discover.getByPerson).toHaveBeenCalledWith('Ian McKellen');
        expect(api.person.getPersonMetadata).toHaveBeenCalledWith('Ian McKellen');
        expect(vm.shows.value).toEqual([mockShow('s-Ian McKellen')]);
        expect(vm.movies.value).toEqual([mockMovie('m-Ian McKellen')]);
        expect(vm.details.value).toEqual(mockMeta);
        expect(vm.loading.value).toBe(false);
        expect(vm.error.value).toBeNull();
    });

    test('cambiar de persona resetea datos antes de resolver', async () => {
        const { vm } = createStubVM();
        await vm.load('Ian McKellen');

        const pending = vm.load('Pedro Pascal');
        expect(vm.shows.value).toEqual([]);
        expect(vm.movies.value).toEqual([]);
        expect(vm.details.value).toBeNull();
        expect(vm.loading.value).toBe(true);

        await pending;
        expect(vm.shows.value).toEqual([mockShow('s-Pedro Pascal')]);
    });

    test('un fallo del servidor limpia resultados y reporta el error', async () => {
        const api = {
            discover: {
                getByPerson: vi.fn(() => Promise.reject(new Error('Network error')))
            },
            person: {
                getPersonMetadata: vi.fn(() => Promise.resolve(mockMeta))
            }
        } as unknown as ApiService;

        const vm = new PersonViewModel(api);
        await vm.load('Error Actor');

        expect(vm.error.value).toBe('Network error');
        expect(vm.shows.value).toEqual([]);
        expect(vm.movies.value).toEqual([]);
        expect(vm.details.value).toBeNull();
        expect(vm.loading.value).toBe(false);
    });
});

describe('person data helpers', () => {
    test('resolveCountry resuelve países conocidos en español e inglés y códigos ISO', () => {
        expect(resolveCountry('London, England, UK')).toEqual({ code: 'gb', name: 'Reino Unido' });
        expect(resolveCountry('United States')).toEqual({ code: 'us', name: 'EE. UU.' });
        expect(resolveCountry('Santiago de Chile, Chile')).toEqual({ code: 'cl', name: 'Chile' });
        expect(resolveCountry('Guadalajara, Jalisco, México')).toEqual({ code: 'mx', name: 'México' });
        expect(resolveCountry('Madrid, España')).toEqual({ code: 'es', name: 'España' });
        expect(resolveCountry(null)).toBeNull();
    });

    test('calculateAge calcula la edad actual o al momento de defunción', () => {
        // Persona viva nacida en 1980
        const age = calculateAge('1980-01-01', null);
        expect(age).toBeGreaterThanOrEqual(44);

        // Persona fallecida
        const ageAtDeath = calculateAge('1956-10-21', '2016-12-27');
        expect(ageAtDeath).toBe(60);

        expect(calculateAge(null, null)).toBeNull();
    });
});
