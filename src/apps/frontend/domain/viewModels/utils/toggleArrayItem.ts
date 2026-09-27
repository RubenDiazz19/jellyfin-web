import type { Signal } from '@preact/signals-core';

/**
 * Helper genérico para alternar elementos en señales con arrays.
 */
export function toggleArrayItem<T>(
    sig: Signal<T[]>,
    item: T,
    equals: (a: T, b: T) => boolean = (a, b) => a === b
): void {
    const current = sig.value;
    sig.value = current.some((x) => equals(x, item)) ?
        current.filter((x) => !equals(x, item)) :
        [...current, item];
}
