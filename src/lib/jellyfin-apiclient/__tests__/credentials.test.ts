// La clave y la forma del objeto son contrato con el almacenamiento que ya
// existe en los navegadores de la gente: si cambian, todo el mundo se queda
// desconectado al desplegar. De ahí que estos tests miren localStorage
// directamente en vez de solo la API de la clase.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import Credentials, { type ServerCredentials } from '../credentials';

const KEY = 'jellyfin_credentials';

describe('Credentials', () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => localStorage.clear());

    describe('compatibilidad con lo ya guardado', () => {
        it('lee una sesión escrita por la versión anterior', () => {
            localStorage.setItem(KEY, JSON.stringify({
                Servers: [{ Id: 'abc', Name: 'Casa', AccessToken: 'tok', UserId: 'u1' }]
            }));

            const servers = new Credentials().credentials()?.Servers;
            expect(servers).toHaveLength(1);
            expect(servers?.[0]).toMatchObject({ Id: 'abc', AccessToken: 'tok', UserId: 'u1' });
        });

        it('guarda bajo la misma clave heredada', () => {
            const c = new Credentials();
            c.credentials({ Servers: [{ Id: 'abc' }] });

            expect(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
                .toEqual({ Servers: [{ Id: 'abc' }] });
        });
    });

    describe('arranque a prueba de balas', () => {
        it('sin nada guardado empieza con la lista vacía, no con undefined', () => {
            expect(new Credentials().credentials()).toEqual({ Servers: [] });
        });

        it('un JSON corrupto no impide arrancar', () => {
            localStorage.setItem(KEY, '{esto no es json');
            expect(new Credentials().credentials()).toEqual({ Servers: [] });
        });

        it('un objeto sin Servers recibe la lista igualmente', () => {
            localStorage.setItem(KEY, JSON.stringify({ algo: 'otra cosa' }));
            expect(new Credentials().credentials()?.Servers).toEqual([]);
        });
    });

    describe('addOrUpdateServer', () => {
        it('sin Id es un error, no un servidor anónimo en la lista', () => {
            expect(() => new Credentials().addOrUpdateServer([], {}))
                .toThrow('Server.Id cannot be null or empty');
        });

        it('un servidor nuevo se añade tal cual', () => {
            const list: ServerCredentials[] = [];
            new Credentials().addOrUpdateServer(list, { Id: 'a', Name: 'Casa' });
            expect(list).toEqual([{ Id: 'a', Name: 'Casa' }]);
        });

        it('funde con el existente en vez de reemplazarlo', () => {
            // Lo importante: reconectar por una dirección no puede borrar lo
            // que ya se sabía de las otras.
            const list: ServerCredentials[] = [
                { Id: 'a', Name: 'Casa', LocalAddress: 'https://local', RemoteAddress: 'https://remoto' }
            ];
            new Credentials().addOrUpdateServer(list, { Id: 'a', ManualAddress: 'https://manual' });

            expect(list).toHaveLength(1);
            expect(list[0]).toMatchObject({
                Name: 'Casa',
                LocalAddress: 'https://local',
                RemoteAddress: 'https://remoto',
                ManualAddress: 'https://manual'
            });
        });

        it('un campo vacío no pisa al que ya había', () => {
            const list: ServerCredentials[] = [{ Id: 'a', Name: 'Casa' }];
            new Credentials().addOrUpdateServer(list, { Id: 'a', Name: undefined });
            expect(list[0].Name).toBe('Casa');
        });

        it('se queda con el acceso más reciente de los dos', () => {
            const list: ServerCredentials[] = [{ Id: 'a', DateLastAccessed: 200 }];
            new Credentials().addOrUpdateServer(list, { Id: 'a', DateLastAccessed: 100 });
            expect(list[0].DateLastAccessed).toBe(200);
        });

        it('un token nuevo arrastra su usuario', () => {
            const list: ServerCredentials[] = [{ Id: 'a', AccessToken: 'viejo', UserId: 'u1' }];
            new Credentials().addOrUpdateServer(list, { Id: 'a', AccessToken: 'nuevo', UserId: 'u2' });
            expect(list[0]).toMatchObject({ AccessToken: 'nuevo', UserId: 'u2' });
        });

        it('no toca los demás servidores de la lista', () => {
            const list: ServerCredentials[] = [{ Id: 'a', Name: 'Casa' }, { Id: 'b', Name: 'Trabajo' }];
            new Credentials().addOrUpdateServer(list, { Id: 'b', Name: 'Oficina' });
            expect(list[0].Name).toBe('Casa');
            expect(list[1].Name).toBe('Oficina');
        });

        it('LastConnectionMode 0 se guarda (es un modo válido, no un vacío)', () => {
            const list: ServerCredentials[] = [{ Id: 'a', LastConnectionMode: 2 }];
            new Credentials().addOrUpdateServer(list, { Id: 'a', LastConnectionMode: 0 });
            expect(list[0].LastConnectionMode).toBe(0);
        });
    });

    describe('clear', () => {
        it('borra lo guardado del almacenamiento', () => {
            const c = new Credentials();
            c.credentials({ Servers: [{ Id: 'a' }] });
            c.clear();
            expect(localStorage.getItem(KEY)).toBeNull();
        });
    });

    it('no deja los tokens escritos en la consola', () => {
        // El original hacía console.log del JSON entero, tokens incluidos.
        // Este test TIENE que hablar de console.log para poder interceptarlo,
        // de ahí la excepción a la regla que prohíbe usarlo.
        /* eslint-disable no-console */
        const seen: unknown[] = [];
        const original = console.log;
        console.log = (...args: unknown[]) => {
            seen.push(...args);
        };
        try {
            localStorage.setItem(KEY, JSON.stringify({ Servers: [{ Id: 'a', AccessToken: 'secreto' }] }));
            new Credentials().credentials();
        } finally {
            console.log = original;
        }
        /* eslint-enable no-console */
        expect(JSON.stringify(seen)).not.toContain('secreto');
    });
});
