export default class ScrollerFactory {
    constructor(frame: HTMLElement, options?: unknown);
    static create(frame: HTMLElement, options?: unknown): Promise<ScrollerFactory>;
    init(): void;
    destroy(): void;
    reload(): void;
    getScrollEventName(): string;
    getScrollSlider(): HTMLElement;
    getScrollFrame(): HTMLElement;
    slideTo(newPos: number, immediate?: boolean, fullItemPos?: unknown): void;
    getPos(item: unknown): unknown;
    getCenterPosition(item: unknown): unknown;
    getScrollPosition(): number;
    getScrollSize(): number;
    slideBy(delta: number, immediate?: boolean): void;
    to(location: string, item?: unknown, immediate?: boolean): void;
    toStart(item?: unknown, immediate?: boolean): void;
    toEnd(item?: unknown, immediate?: boolean): void;
    toCenter(item?: unknown, immediate?: boolean): void;
    options: unknown;
}
