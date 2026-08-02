// Lo que el servidor está procesando ahora mismo, en una sola lista.
//
// Junta las dos fuentes que Jellyfin publica por separado (ver data/api/tasks):
// las tareas programadas, que llegan como lista completa en cada empuje, y los
// refrescos de un item, que llegan de uno en uno. La vista solo lee `active`.
//
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { computed, signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import type { BackgroundTask } from '../../data/api/tasks';

/**
 * Cuánto se deja en la lista un refresco del que no llega el 100 %.
 *
 * El servidor no siempre manda el último tramo —si el item no necesitaba nada,
 * termina sin publicar progreso—, y una entrada encallada al 40 % es peor que
 * no enseñar nada: sugiere que algo se ha quedado colgado.
 */
const ITEM_TIMEOUT_MS = 5 * 60 * 1000;

export class TasksViewModel {
    private scheduled = signal<BackgroundTask[]>([]);
    private items = signal<BackgroundTask[]>([]);

    /** Todo lo que está en curso, para pintarlo tal cual. */
    active = computed<BackgroundTask[]>(() => [...this.scheduled.value, ...this.items.value]);

    private started = false;
    private timers = new Map<string, ReturnType<typeof setTimeout>>();

    constructor(private api: ApiService) {}

    /**
     * Engancha las dos fuentes. Idempotente: lo llama la vista global al
     * montar, y no hay cleanup porque esa vista dura lo que la sesión.
     */
    start(): void {
        if (this.started || typeof window === 'undefined') return;
        this.started = true;

        // Por si ya había algo corriendo antes de abrir la app.
        void this.api.tasks.getRunningTasks()
            .then((tasks) => { this.scheduled.value = tasks; })
            .catch(() => { /* sin tareas que enseñar, que es el caso normal */ });

        this.api.tasks.watchScheduledTasks((tasks) => { this.scheduled.value = tasks; });
        this.api.tasks.watchItemRefresh((itemId, percent) => {
            if (percent >= 100) this.dropItem(itemId);
            else this.updateItem(itemId, percent);
        });
    }

    /**
     * Anota un refresco que se acaba de pedir, para que aparezca YA.
     *
     * El primer `RefreshProgress` puede tardar unos segundos, y ese hueco entre
     * pulsar y ver algo es justo lo que hace dudar de si se ha pulsado bien.
     * Se entra sin porcentaje: la vista lo pinta como indeterminado.
     */
    expect(itemId: string, name: string): void {
        this.upsert({ id: itemId, name, progress: null });
        this.armTimeout(itemId);
    }

    private updateItem(itemId: string, percent: number): void {
        const known = this.items.peek().find((t) => t.id === itemId);
        // Un refresco que no ha pedido esta pantalla (otro cliente, o el
        // propio servidor) también se enseña; sin nombre, con su porcentaje.
        this.upsert({ id: itemId, name: known?.name ?? '', progress: percent });
        this.armTimeout(itemId);
    }

    private upsert(task: BackgroundTask): void {
        const rest = this.items.peek().filter((t) => t.id !== task.id);
        this.items.value = [...rest, task];
    }

    private dropItem(itemId: string): void {
        this.clearTimeout(itemId);
        this.items.value = this.items.peek().filter((t) => t.id !== itemId);
    }

    private armTimeout(itemId: string): void {
        this.clearTimeout(itemId);
        this.timers.set(itemId, setTimeout(() => this.dropItem(itemId), ITEM_TIMEOUT_MS));
    }

    private clearTimeout(itemId: string): void {
        const timer = this.timers.get(itemId);
        if (timer) clearTimeout(timer);
        this.timers.delete(itemId);
    }
}

export const tasksVM = new TasksViewModel(apiService);
