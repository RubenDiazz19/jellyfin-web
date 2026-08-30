export default class MultiSelect {
    constructor(options: { container: HTMLElement; bindOnClick?: boolean });
    onContainerClick(e: MouseEvent): boolean | void;
    destroy(): void;
}

export function startMultiSelect(card: HTMLElement): void;
export function stopMultiSelect(): void;
