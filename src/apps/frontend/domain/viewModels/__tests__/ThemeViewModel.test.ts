import { describe, expect, it, vi } from 'vitest';

import type { ThemePrefs } from '../../../data/stores/themeStore';
import { ThemeViewModel } from '../ThemeViewModel';

// El módulo real de sync importa la cadena legacy (jellyfin-apiclient,
// playbackmanager) con efectos a nivel de módulo: se corta aquí. Los tests
// inyectan su propio sync por constructor.
vi.mock('../../../data/api/theme', () => ({
    getServerThemePrefs: () => Promise.resolve(null),
    saveServerThemePrefs: () => Promise.resolve()
}));

type RemotePrefs = { mode?: string; seed?: string } | null;

function makeVm(initial?: Partial<ThemePrefs>, remote: RemotePrefs = null) {
    const saved: ThemePrefs[] = [];
    const store = {
        load: (): ThemePrefs => ({ mode: 'dark', seed: null, seedSource: 'auto', ...initial }),
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
        expect(saved.at(-1)).toEqual({ mode: 'light', seed: null, seedSource: 'auto' });
        // Al server solo van mode y seed: seedSource es una decisión de este
        // dispositivo (una seed remota siempre es manual, ver pullFromServer).
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
        expect(saved.at(-1)).toEqual({ mode: 'dark', seed: '#336699', seedSource: 'auto' });
        expect(sync.save).not.toHaveBeenCalled();
    });

    it('con una seed manual elegida, el backdrop ya no la cambia', () => {
        const { vm } = makeVm();
        vm.setSeed('#aabb00');
        expect(vm.seedSource.value).toBe('manual');

        vm.applyDynamicSeed('#336699');
        expect(vm.seed.value).toBe('#aabb00');

        // Volver a automático devuelve el mando al dynamic color.
        vm.setSeed(null);
        expect(vm.seedSource.value).toBe('auto');
        expect(vm.seed.value).toBeNull();
        vm.applyDynamicSeed('#336699');
        expect(vm.seed.value).toBe('#336699');
    });

    it('pullFromServer aplica valores remotos válidos e ignora basura', async () => {
        const { vm } = makeVm({}, { mode: 'light', seed: 'no-es-color' });
        await vm.pullFromServer();
        expect(vm.mode.value).toBe('light');
        expect(vm.seed.value).toBeNull();
        expect(vm.seedSource.value).toBe('auto');
    });

    it('una seed remota es una elección del usuario: llega como manual', async () => {
        const { vm } = makeVm({}, { mode: 'dark', seed: '#8E24AA' });
        await vm.pullFromServer();
        expect(vm.seed.value).toBe('#8e24aa');
        expect(vm.seedSource.value).toBe('manual');
    });

    it('pullFromServer sobrevive a errores de red (manda la copia local)', async () => {
        const { vm, sync } = makeVm();
        sync.get.mockRejectedValueOnce(new Error('offline'));
        await vm.pullFromServer();
        expect(vm.mode.value).toBe('dark');
    });
});
