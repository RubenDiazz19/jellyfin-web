import { describe, it, expect, vi } from 'vitest';
import { getRunningTasks, watchScheduledTasks, watchItemRefresh, watchLibraryChanged } from '../tasks';
import * as httpModule from '../http';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { OutboundWebSocketMessageType } from '@jellyfin/sdk/lib/websocket';

vi.mock('../http');
vi.mock('lib/jellyfin-apiclient', () => ({
    ServerConnections: {
        getApi: vi.fn()
    }
}));

describe('tasks API', () => {
    it('getRunningTasks filters and maps running tasks', async () => {
        vi.mocked(httpModule.apiFetch).mockResolvedValueOnce([
            { Id: 't1', State: 'Running', Name: 'Task 1', CurrentProgressPercentage: 50 },
            { Id: 't2', State: 'Running', Name: 'Task 2', CurrentProgressPercentage: 0 },
            { Id: 't3', State: 'Idle', Name: 'Task 3', CurrentProgressPercentage: 0 }
        ]);

        const tasks = await getRunningTasks();
        expect(tasks).toHaveLength(2);

        expect(tasks[0].id).toBe('t1');
        expect(tasks[0].progress).toBe(50);

        expect(tasks[1].id).toBe('t2');
        expect(tasks[1].progress).toBeNull(); // 0 -> null
    });

    it('watchScheduledTasks subscribes and maps tasks', () => {
        const subscribeMock = vi.fn().mockReturnValue(() => 'cleanup');
        vi.mocked(ServerConnections.getApi as any).mockReturnValue({ subscribe: subscribeMock });

        const callback = vi.fn();
        const cleanup = watchScheduledTasks(callback);

        expect(subscribeMock).toHaveBeenCalledWith(
            [OutboundWebSocketMessageType.ScheduledTasksInfo],
            expect.any(Function)
        );

        // trigger
        const handler = subscribeMock.mock.calls[0][1];
        handler({ Data: [{ Id: 't1', State: 'Running', CurrentProgressPercentage: 10 }] });

        expect(callback).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ id: 't1', progress: 10 })
        ]));

        expect(cleanup()).toBe('cleanup');
    });

    it('watchItemRefresh subscribes and parses progress', () => {
        const subscribeMock = vi.fn().mockReturnValue(() => 'cleanup');
        vi.mocked(ServerConnections.getApi as any).mockReturnValue({ subscribe: subscribeMock });

        const callback = vi.fn();
        const cleanup = watchItemRefresh(callback);

        expect(subscribeMock).toHaveBeenCalledWith(
            [OutboundWebSocketMessageType.RefreshProgress],
            expect.any(Function)
        );

        const handler = subscribeMock.mock.calls[0][1];
        handler({ Data: { ItemId: 'item1', Progress: '42.5' } });

        expect(callback).toHaveBeenCalledWith('item1', 42.5);
        expect(cleanup()).toBe('cleanup');
    });

    it('watchLibraryChanged subscribes', () => {
        const subscribeMock = vi.fn().mockReturnValue(() => 'cleanup');
        vi.mocked(ServerConnections.getApi as any).mockReturnValue({ subscribe: subscribeMock });

        const callback = vi.fn();
        const cleanup = watchLibraryChanged(callback);

        expect(subscribeMock).toHaveBeenCalledWith(
            [OutboundWebSocketMessageType.LibraryChanged],
            expect.any(Function)
        );

        const handler = subscribeMock.mock.calls[0][1];
        handler({});

        expect(callback).toHaveBeenCalled();
        expect(cleanup()).toBe('cleanup');
    });
});
