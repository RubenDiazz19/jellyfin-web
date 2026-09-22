
export class LazyLoader {
    options: any;
    observer: IntersectionObserver | null = null;

    constructor(options: any) {
        this.options = options;
    }

    createObserver() {
        const callback = this.options.callback;

        const newObserver = new IntersectionObserver(
            (entries, observer) => {
                entries.forEach(entry => {
                    callback(entry, observer);
                });
            },
            {
                rootMargin: '50%',
                threshold: 0
            });

        this.observer = newObserver;
    }

    addElements(elements: any) {
        let observer = this.observer;

        if (!observer) {
            this.createObserver();
            observer = this.observer;
        }

        Array.from(elements).forEach((element: any) => {
            observer!.observe(element);
        });
    }

    destroyObserver() {
        const observer = this.observer;

        if (observer) {
            observer.disconnect();
            this.observer = null;
        }
    }

    destroy() {
        this.destroyObserver();
        this.options = null;
    }
}

function unveilElements(elements: any, root: any, callback: any) {
    if (!elements.length) {
        return;
    }
    const lazyLoader = new LazyLoader({
        callback: callback
    });
    lazyLoader.addElements(elements);
}

export function lazyChildren(elem: any, callback: any) {
    unveilElements(elem.getElementsByClassName('lazy'), elem, callback);
}

export default {
    LazyLoader: LazyLoader,
    lazyChildren: lazyChildren
};
