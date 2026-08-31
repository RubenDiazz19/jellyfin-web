export interface Event {
    type: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Callback = (e: Event, ...args: any[]) => void;

interface EventObject {
    _callbacks?: Record<string, Callback[]>;
}

function getCallbacks(obj: unknown, type: string): Callback[] {
    if (!obj || typeof obj !== 'object') {
        throw new Error('obj cannot be null!');
    }

    const eventObj = obj as EventObject;
    eventObj._callbacks = eventObj._callbacks || {};

    let callbacks = eventObj._callbacks[type];

    if (!callbacks) {
        callbacks = [];
        eventObj._callbacks[type] = callbacks;
    }

    return callbacks;
}

export default {
    on(obj: unknown, type: string, fn: Callback): void {
        const callbacks = getCallbacks(obj, type);

        callbacks.push(fn);
    },

    off(obj: unknown, type: string, fn: Callback): void {
        const callbacks = getCallbacks(obj, type);

        const i = callbacks.indexOf(fn);
        if (i !== -1) {
            callbacks.splice(i, 1);
        }
    },

    trigger(obj: unknown, type: string, args: unknown[] = []): void {
        const eventArgs: [Event, ...unknown[]] = [{ type }, ...args];

        getCallbacks(obj, type).slice(0)
            .forEach(callback => {
                callback.apply(obj, eventArgs);
            });
    }
};
