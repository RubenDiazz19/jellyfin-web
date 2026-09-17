import { describe, it, expect, beforeEach } from 'vitest';
import { QUEUE, QueueEntry } from '../queueStore';

describe('QUEUE store', () => {
    beforeEach(() => {
        QUEUE.clear();
    });

    const mockItem1: QueueEntry = { itemId: '1', title: 'Item 1' };
    const mockItem2: QueueEntry = { itemId: '2', title: 'Item 2', subtitle: 'Sub 2' };
    const mockItem3: QueueEntry = { itemId: '3', title: 'Item 3' };

    it('enqueues items to the end without duplicating', () => {
        QUEUE.enqueue(mockItem1);
        QUEUE.enqueue(mockItem2);
        expect(QUEUE.all()).toEqual([mockItem1, mockItem2]);

        // Re-enqueueing mockItem1 moves it to the end
        QUEUE.enqueue(mockItem1);
        expect(QUEUE.all()).toEqual([mockItem2, mockItem1]);
    });

    it('adds items to the beginning with playNext', () => {
        QUEUE.enqueue(mockItem1);
        QUEUE.playNext(mockItem2);

        expect(QUEUE.all()).toEqual([mockItem2, mockItem1]);

        // Moving mockItem1 to next
        QUEUE.playNext(mockItem1);
        expect(QUEUE.all()).toEqual([mockItem1, mockItem2]);
    });

    it('checks if item exists', () => {
        expect(QUEUE.has('1')).toBe(false);
        QUEUE.enqueue(mockItem1);
        expect(QUEUE.has('1')).toBe(true);
    });

    it('removes an item', () => {
        QUEUE.enqueue(mockItem1);
        QUEUE.enqueue(mockItem2);

        QUEUE.remove('1');
        expect(QUEUE.all()).toEqual([mockItem2]);
    });

    it('takes the next item and removes it from the queue', () => {
        QUEUE.enqueue(mockItem1);
        QUEUE.enqueue(mockItem2);

        const next = QUEUE.takeNext();
        expect(next).toEqual(mockItem1);
        expect(QUEUE.all()).toEqual([mockItem2]);

        const next2 = QUEUE.takeNext();
        expect(next2).toEqual(mockItem2);
        expect(QUEUE.all()).toEqual([]);

        expect(QUEUE.takeNext()).toBeNull();
    });

    it('moves an item to a new position', () => {
        QUEUE.enqueue(mockItem1);
        QUEUE.enqueue(mockItem2);
        QUEUE.enqueue(mockItem3);

        // Move item2 from index 1 to index 0
        QUEUE.move(1, 0);
        expect(QUEUE.all()).toEqual([mockItem2, mockItem1, mockItem3]);

        // Move item3 from index 2 to index 1
        QUEUE.move(2, 1);
        expect(QUEUE.all()).toEqual([mockItem2, mockItem3, mockItem1]);

        // Invalid moves do nothing
        QUEUE.move(-1, 0);
        QUEUE.move(0, 10);
        expect(QUEUE.all()).toEqual([mockItem2, mockItem3, mockItem1]);
    });

    it('clears the queue', () => {
        QUEUE.enqueue(mockItem1);
        QUEUE.clear();
        expect(QUEUE.all()).toEqual([]);
    });
});
