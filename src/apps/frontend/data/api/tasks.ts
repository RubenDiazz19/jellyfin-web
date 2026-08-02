// Lo que el servidor está haciendo en segundo plano.
//
// Escanear una biblioteca o refrescar metadatos son peticiones que contestan al
// instante y luego tardan minutos en hacerse de verdad. Sin nada que lo cuente,
// el usuario pulsa, ve un aviso de «empezado» y se queda sin saber si aquello
// sigue vivo — que es justo cuando vuelve a pulsar.
//
// Jellyfin lo publica por dos vías distintas, y hacen falta las dos:
//
//   ScheduledTasksInfo  el estado de TODAS las tareas programadas, empujado
//                       periódicamente. Es lo que cubre «escanear todas las
//                       bibliotecas» (POST /Library/Refresh).
//   RefreshProgress     el porcentaje de UN item concreto que se está
//                       refrescando. Cubre el rescan de una biblioteca suelta
//                       y el de una película o serie.

import { OutboundWebSocketMessageType } from '@jellyfin/sdk/lib/websocket';

import { ServerConnections } from 'lib/jellyfin-apiclient';
import { apiFetch } from './http';

export type BackgroundTask = {
    /** Id de la tarea programada, o del item que se está refrescando. */
    id: string;
    name: string;
    /** 0..100, o null cuando aún no se sabe cuánto va a tardar. */
    progress: number | null;
};

type JFTaskInfo = {
    Id?: string;
    Name?: string;
    State?: string;
    CurrentProgressPercentage?: number | null;
};

function mapRunning(tasks: JFTaskInfo[]): BackgroundTask[] {
    return tasks
        .filter((t) => t.State === 'Running' && !!t.Id)
        .map((t) => ({
            id: t.Id as string,
            name: t.Name ?? '',
            progress: typeof t.CurrentProgressPercentage === 'number' ?
                t.CurrentProgressPercentage :
                null
        }));
}

/**
 * Las tareas programadas que corren ahora mismo.
 *
 * Se pide una vez al arrancar para no depender de que el primer empuje del
 * websocket llegue: si ya había un escaneo en marcha antes de abrir la app,
 * tiene que verse desde el primer momento.
 */
export async function getRunningTasks(): Promise<BackgroundTask[]> {
    return mapRunning(await apiFetch<JFTaskInfo[]>('/ScheduledTasks?isHidden=false'));
}

/**
 * Escucha el estado de las tareas programadas. Devuelve el cleanup.
 *
 * El SDK manda solo el mensaje de alta al suscribirse y vuelve a suscribir si
 * la conexión se cae, así que aquí no hay que gestionar nada de eso.
 */
export function watchScheduledTasks(onTasks: (tasks: BackgroundTask[]) => void): () => void {
    const api = ServerConnections.getApi();
    if (!api) return () => undefined;
    return api.subscribe(
        [OutboundWebSocketMessageType.ScheduledTasksInfo],
        ({ Data }) => onTasks(mapRunning((Data ?? []) as JFTaskInfo[]))
    ) ?? (() => undefined);
}

/**
 * Escucha el progreso de los items que se están refrescando. El porcentaje
 * llega como texto, y a 100 la tarea ha terminado.
 */
export function watchItemRefresh(
    onProgress: (itemId: string, percent: number) => void
): () => void {
    const api = ServerConnections.getApi();
    if (!api) return () => undefined;
    return api.subscribe(
        [OutboundWebSocketMessageType.RefreshProgress],
        ({ Data }) => {
            const itemId = Data?.ItemId;
            if (!itemId) return;
            onProgress(itemId, Number.parseFloat(Data?.Progress ?? '0') || 0);
        }
    ) ?? (() => undefined);
}
