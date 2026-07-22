import { describe, expect, it, vi } from 'vitest';

import type { ThemePrefs } from '../../../data/stores/themeStore';
import { ThemeViewModel } from '../ThemeViewModel';

type RemotePrefs = { mode?: string; seed?: string } | null;

function makeVm(initial?: Partial<ThemePrefs>, remote: RemotePrefs = null) {
    const saved: ThemePrefs[] = [];
    const store = {
        load: (): ThemePrefs => ({ mode: 'dark', seed: null, ...initial }),
        save: (p: ThemePrefs) => { saved.push(p); }
    };
    const sync = {
        get: vi.fn(() => Promise.resolve(remote)),
        save: vi.fn(() => Promise.resolve())
    };
    return { vm: new ThemeViewModel(store, sync), saved, sync };
}

describe('ThemeViewModel', () => {
    it('por defecto: dark (el look actual de la app)', () => {
        const { vm } = makeVm();
        expect(vm.mode.value).toBe('dark');
        expect(vm.scheme.value).toBe('dark');
        expect(vm.seed.value).toBeNull();
    });

    it('carga las preferencias persistidas del store', () => {
        const { vm } = makeVm({ mode: 'light', seed: '#aabbcc' });
        expect(vm.scheme.value).toBe('light');
        expect(vm.seed.value).toBe('#aabbcc');
    });

    it('modo system sigue a prefers-color-scheme via systemDark', () => {
        const { vm } = makeVm({ mode: 'system' });
        vm.systemDark.value = true;
        expect(vm.scheme.value).toBe('dark');
        vm.systemDark.value = false;
        expect(vm.scheme.value).toBe('light');
    });

    it('setMode persiste en el store y sube al server', () => {
        const { vm, saved, sync } = makeVm();
        vm.setMode('light');
        expect(vm.scheme.value).toBe('light');
        expect(saved.at(-1)).toEqual({ mode: 'light', seed: null });
        expect(sync.save).toHaveBeenCalledWith({ mode: 'light', seed: null });
    });

    it('setSeed normaliza a minúsculas y rechaza valores inválidos', () => {
        const { vm, sync } = makeVm();
        vm.setSeed('#AABB00');
        expect(vm.seed.value).toBe('#aabb00');
        expect(sync.save).toHaveBeenCalledTimes(1);

        vm.setSeed('rojo');
        vm.setSeed('#12345');
        expect(vm.seed.value).toBe('#aabb00');
        expect(sync.save).toHaveBeenCalledTimes(1);
    });

    it('applyDynamicSeed persiste en local pero NO hace POST al server', () => {
        const { vm, saved, sync } = makeVm();
        vm.applyDynamicSeed('#336699');
        expect(vm.seed.value).toBe('#336699');
        expect(saved.at(-1)).toEqual({ mode: 'dark', seed: '#336699' });
        expect(sync.save).not.toHaveBeenCalled();
    });

    it('pullFromServer aplica valores remotos válidos e ignora basura', async () => {
        const { vm } = makeVm({}, { mode: 'light', seed: 'no-es-color' });
        await vm.pullFromServer();
        expect(vm.mode.value).toBe('light');
        expect(vm.seed.value).toBeNull();
    });

    it('pullFromServer sobrevive a errores de red (manda la copia local)', async () => {
        const { vm, sync } = makeVm();
        sync.get.mockRejectedValueOnce(new Error('offline'));
        await vm.pullFromServer();
        expect(vm.mode.value).toBe('dark');
    });
});
