import { describe, it, expect } from 'vitest';
import { signal } from '@preact/signals-core';
import { guardedLoad } from '../guardedLoad';
import { LoadGuard } from '../loadGuard';

describe('guardedLoad', () => {
    it('sets loading to false on completion', async () => {
        const loading = signal(true);
        const { guarded } = guardedLoad(loading);

        await guarded(async (isLatest) => {
            expect(isLatest()).toBe(true);
        });

        expect(loading.value).toBe(false);
    });

    it('sets error on failure', async () => {
        const loading = signal(true);
        const error = signal<string | null>(null);
        const { guarded } = guardedLoad(loading, error);

        await guarded(async () => {
            throw new Error('test error');
        });

        expect(error.value).toBe('test error');
        expect(loading.value).toBe(false);
    });

    it('does not set error or clear loading if aborted by newer request', async () => {
        const loading = signal(true);
        const error = signal<string | null>(null);
        const loads = new LoadGuard();
        const { guarded } = guardedLoad(loading, error, loads);

        let resolveFirst: () => void;
        const p1 = guarded(async (isLatest) => {
            await new Promise<void>(r => { resolveFirst = r; });
            expect(isLatest()).toBe(false);
            throw new Error('should be ignored');
        });

        const p2 = guarded(async (isLatest) => {
            expect(isLatest()).toBe(true);
        });

        await p2;
        resolveFirst!();
        await p1;

        expect(error.value).toBeNull(); // El error del primero se ignora
        // El loading lo limpió p2
        expect(loading.value).toBe(false);
    });

    it('allows onError to suppress error assignment', async () => {
        const loading = signal(true);
        const error = signal<string | null>(null);
        const { guarded } = guardedLoad(loading, error);

        await guarded(async () => {
            throw new Error('test error');
        }, () => false); // Supress

        expect(error.value).toBeNull();
    });
});
