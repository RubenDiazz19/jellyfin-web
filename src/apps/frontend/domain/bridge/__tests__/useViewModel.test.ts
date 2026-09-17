import { describe, it, expect, vi } from 'vitest';
import { useVmSignals, useViewModel, useSignalValue, useSignalSelector, useViewModelLoad } from '../useViewModel';
import { signal } from '@preact/signals-core';
import { renderHook } from './testUtils';
import { act } from 'react';

describe('useViewModel bridge hooks', () => {
    it('useSignalValue subscribes and returns signal value', () => {
        const mySignal = signal(10);
        const { result } = renderHook(() => useSignalValue(mySignal));

        expect(result.current).toBe(10);

        act(() => {
            mySignal.value = 20;
        });
        expect(result.current).toBe(20);
    });

    it('useSignalSelector returns derived value', () => {
        const mySignal = signal({ a: 1, b: 2 });
        const { result } = renderHook(() => useSignalSelector(mySignal, (v) => v.b));

        expect(result.current).toBe(2);

        act(() => {
            mySignal.value = { a: 5, b: 2 }; // Should not re-render ideally, but value remains 2
        });
        expect(result.current).toBe(2);

        act(() => {
            mySignal.value = { a: 1, b: 3 };
        });
        expect(result.current).toBe(3);
    });

    it('useVmSignals subscribes to specific signals', () => {
        const vm = {
            s1: signal(1),
            s2: signal(2)
        };
        const { result } = renderHook(() => useVmSignals(vm, (v) => [v.s1]));

        expect(result.current).toBe(vm);

        act(() => {
            vm.s1.value = 10;
        });
        expect(result.current.s1.value).toBe(10);
    });

    it('useViewModel subscribes to all public signals on the object', () => {
        const vm = {
            s1: signal('hello'),
            s2: signal('world'),
            notASignal: 'plain value',
            method() {}
        };
        const { result } = renderHook(() => useViewModel(vm));

        expect(result.current).toBe(vm);
    });

    it('useViewModelLoad triggers the load function on mount', () => {
        const vm = { s1: signal(0) };
        const loadFn = vi.fn();

        renderHook(() => useViewModelLoad(vm, loadFn, []));

        expect(loadFn).toHaveBeenCalledWith(vm);
    });
});
