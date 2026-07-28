// ViewModel de la cola de reproducción («reproducir después»). El estado
// vive en queueStore (localStorage); aquí se expone como signal y se
// centralizan las reglas de reordenado.
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { signal } from '@preact/signals-core';

import { QUEUE, type QueueEntry } from '../../data/stores/queueStore';

export type { QueueEntry };

export class QueueViewModel {
    items = signal<QueueEntry[]>(QUEUE.all());

    /**
     * Sincroniza con el store y se mantiene al día. Devuelve el cleanup: la
     * cola cambia desde sitios que no son esta pantalla (menú de un item,
     * auto-avance del reproductor) e incluso desde otra pestaña.
     */
    start(): () => void {
        const sync = () => { this.items.value = QUEUE.all(); };
        sync();
        window.addEventListener(QUEUE.event, sync);
        // 'storage' solo dispara en las OTRAS pestañas, que es justo lo que
        // el evento propio no cubre.
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener(QUEUE.event, sync);
            window.removeEventListener('storage', sync);
        };
    }

    enqueue = (entry: QueueEntry) => { QUEUE.enqueue(entry); };
    playNext = (entry: QueueEntry) => { QUEUE.playNext(entry); };
    remove = (itemId: string) => { QUEUE.remove(itemId); };
    clear = () => { QUEUE.clear(); };
    takeNext = (): QueueEntry | null => QUEUE.takeNext();

    /** Sube una entrada una posición. En la primera no hace nada. */
    moveUp = (itemId: string) => {
        const index = this.indexOf(itemId);
        if (index > 0) QUEUE.move(index, index - 1);
    };

    /** Baja una entrada una posición. En la última no hace nada. */
    moveDown = (itemId: string) => {
        const index = this.indexOf(itemId);
        if (index >= 0 && index < this.items.value.length - 1) QUEUE.move(index, index + 1);
    };

    /**
     * Saca la entrada de la cola y la devuelve para reproducirla ya. Las
     * anteriores se quedan donde estaban: el usuario ha elegido saltar, no
     * descartar.
     */
    takeFor = (itemId: string): QueueEntry | null => {
        const entry = this.items.value.find((e) => e.itemId === itemId) ?? null;
        if (entry) QUEUE.remove(itemId);
        return entry;
    };

    private indexOf(itemId: string): number {
        return this.items.value.findIndex((e) => e.itemId === itemId);
    }
}

export const queueVM = new QueueViewModel();
