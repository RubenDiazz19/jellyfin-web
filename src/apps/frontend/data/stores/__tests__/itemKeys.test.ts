import { describe, it, expect } from 'vitest';
import {
    movieKey,
    seasonKey,
    episodeKey,
    serverIdFromKey,
    parseItemKey
} from '../itemKeys';

describe('itemKeys', () => {
    describe('generadores de claves', () => {
        it('movieKey genera clave con prefijo movie-', () => {
            expect(movieKey('123')).toBe('movie-123');
        });

        it('seasonKey genera clave con sufijo -s<n>', () => {
            expect(seasonKey('show-1', 2)).toBe('show-1-s2');
        });

        it('episodeKey genera clave con sufijo -s<n>-e<m>', () => {
            expect(episodeKey('show-1', 2, 5)).toBe('show-1-s2-e5');
        });
    });

    describe('parseItemKey', () => {
        it('identifica claves de películas', () => {
            expect(parseItemKey('movie-abc')).toEqual({
                kind: 'movie',
                movieId: 'abc'
            });
        });

        it('identifica claves de episodios', () => {
            expect(parseItemKey('show-42-s1-e12')).toEqual({
                kind: 'episode',
                showId: 'show-42',
                seasonN: 1,
                epN: 12
            });
        });

        it('identifica claves de temporadas', () => {
            expect(parseItemKey('show-42-s3')).toEqual({
                kind: 'season',
                showId: 'show-42',
                seasonN: 3
            });
        });

        it('asume serie para cualquier otra clave', () => {
            expect(parseItemKey('show-guid-hex')).toEqual({
                kind: 'show',
                showId: 'show-guid-hex'
            });
        });
    });

    describe('serverIdFromKey', () => {
        it('extrae el id de una película', () => {
            expect(serverIdFromKey('movie-456')).toBe('456');
        });

        it('devuelve null si el id de la película está vacío', () => {
            expect(serverIdFromKey('movie-')).toBeNull();
        });

        it('extrae el id de una serie', () => {
            expect(serverIdFromKey('show-789')).toBe('show-789');
        });

        it('devuelve null si el id de la serie está vacío', () => {
            expect(serverIdFromKey('')).toBeNull();
        });

        it('devuelve null para temporadas y episodios porque se referencian por posición', () => {
            expect(serverIdFromKey('show-1-s2')).toBeNull();
            expect(serverIdFromKey('show-1-s2-e3')).toBeNull();
        });
    });
});
