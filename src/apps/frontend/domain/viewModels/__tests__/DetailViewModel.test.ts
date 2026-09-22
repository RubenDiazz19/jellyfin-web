import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DetailViewModel } from '../DetailViewModel';
import type { ApiService } from '../../../data/api/ApiService';
import * as mutationSub from '../utils/mutationSubscription';

vi.mock('../utils/mutationSubscription', () => ({
    mutationOnLoad: vi.fn(() => vi.fn())
}));

type TestEntity = { id: string, name: string };

class TestDetailViewModel extends DetailViewModel<TestEntity> {
    fetchItemMock = vi.fn();
    belongsMock = vi.fn();
    protoMock = vi.fn();
    reuseMock = vi.fn();

    protected fetchItem(id: string): Promise<TestEntity> {
        return this.fetchItemMock(id);
    }
    protected belongsToItem(current: TestEntity, itemId: string): boolean {
        return this.belongsMock(current, itemId);
    }
    protected getInitialProto(id: string): TestEntity | undefined {
        return this.protoMock(id);
    }
    protected canReuseCached(cached: TestEntity, id: string, force: boolean): boolean {
        return this.reuseMock(cached, id, force);
    }
}

describe('DetailViewModel', () => {
    let vm: TestDetailViewModel;
    let mockApi: ApiService;
    let onMutatedCallback: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockApi = {} as ApiService;

        vi.mocked(mutationSub.mutationOnLoad).mockImplementation((cb) => {
            onMutatedCallback = cb;
            return vi.fn();
        });

        vm = new TestDetailViewModel(mockApi);
    });

    it('loads item and updates state', async () => {
        vm.fetchItemMock.mockResolvedValue({ id: '1', name: 'Test' });

        const loadPromise = vm.load('1');
        expect(vm.loading.value).toBe(true);

        await loadPromise;
        expect(vm.item.value).toEqual({ id: '1', name: 'Test' });
        expect(vm.loading.value).toBe(false);
    });

    it('uses proto if available and prevents flashing loading state', async () => {
        vm.protoMock.mockReturnValue({ id: '1', name: 'Proto' });
        vm.fetchItemMock.mockResolvedValue({ id: '1', name: 'Full' });

        const loadPromise = vm.load('1');
        // Initial state sets it to proto
        expect(vm.item.value).toEqual({ id: '1', name: 'Proto' });
        expect(vm.loading.value).toBe(false); // Proto means no loading spinner flash

        await loadPromise;
        expect(vm.item.value).toEqual({ id: '1', name: 'Full' });
    });

    it('handles errors', async () => {
        vm.fetchItemMock.mockRejectedValue(new Error('Network error'));

        await vm.load('1');
        expect(vm.error.value).toBe('Network error');
    });

    it('reacts to delete mutations', async () => {
        vm.fetchItemMock.mockResolvedValue({ id: '1', name: 'Test' });
        await vm.load('1');

        expect(vm.item.value).toBeTruthy();

        vm.belongsMock.mockReturnValue(true);

        // Trigger delete
        onMutatedCallback({ itemId: '1', deleted: true });

        expect(vm.item.value).toBeNull();
        expect(vm.gone.value).toBe('1');
    });

    it('re-fetches on general item mutation', async () => {
        vm.fetchItemMock.mockResolvedValue({ id: '1', name: 'Test' });
        await vm.load('1');

        vm.belongsMock.mockReturnValue(true);
        vm.fetchItemMock.mockResolvedValue({ id: '1', name: 'Updated' });

        // Trigger update
        onMutatedCallback({ itemId: 'sub-item-2', deleted: false });

        // Wait for the triggered load to resolve
        await new Promise(process.nextTick);
        await new Promise(process.nextTick);

        expect(vm.item.value).toEqual({ id: '1', name: 'Updated' });
    });
});
