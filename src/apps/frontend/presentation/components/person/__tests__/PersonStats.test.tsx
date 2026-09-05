import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, it, expect } from 'vitest';
import { getFlagFallback, PersonStats } from '../PersonStats';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

function render(ui: React.ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => { root?.render(ui); });
}

describe('PersonStats', () => {
    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
    });

    describe('getFlagFallback', () => {
        it('identifica correctamente países conocidos en español e inglés', () => {
            expect(getFlagFallback('United States')).toBe('🇺🇸');
            expect(getFlagFallback('USA')).toBe('🇺🇸');
            expect(getFlagFallback('España')).toBe('🇪🇸');
            expect(getFlagFallback('Spain')).toBe('🇪🇸');
            expect(getFlagFallback('United Kingdom')).toBe('🇬🇧');
            expect(getFlagFallback('Reino Unido')).toBe('🇬🇧');
            expect(getFlagFallback('France')).toBe('🇫🇷');
            expect(getFlagFallback('Japón')).toBe('🇯🇵');
            expect(getFlagFallback('Japan')).toBe('🇯🇵');
        });

        it('devuelve bandera blanca para países no mapeados', () => {
            expect(getFlagFallback('Desconocido / Sin registrar')).toBe('🏳️');
            expect(getFlagFallback('')).toBe('🏳️');
        });
    });

    describe('renderizado', () => {
        it('renderiza género, edad, país y ciudad de nacimiento', () => {
            render(
                <PersonStats
                    gender='Femenino'
                    age={35}
                    country='España'
                    birthCity='Madrid'
                    isWidescreen={true}
                />
            );

            expect(host?.textContent).toContain('Femenino');
            expect(host?.textContent).toContain('Género');
            expect(host?.textContent).toContain('35');
            expect(host?.textContent).toContain('Años');
            expect(host?.textContent).toContain('España');
            expect(host?.textContent).toContain('Madrid');
        });

        it('usa guión cuando no se proporciona género o edad', () => {
            render(
                <PersonStats
                    gender={null}
                    age={null}
                    country={null}
                />
            );

            expect(host?.textContent).toContain('—');
        });
    });
});
