import { describe, it, expect, beforeEach } from 'vitest';
import { LIST_COVERS } from '../listCoversStore';

describe('LIST_COVERS', () => {
    beforeEach(() => {
        LIST_COVERS._reset();
    });

    it('returns false by default for an unknown list', () => {
        expect(LIST_COVERS.has('list-123')).toBe(false);
    });

    it('returns true after marking a list', () => {
        LIST_COVERS.mark('list-123');
        expect(LIST_COVERS.has('list-123')).toBe(true);
    });

    it('returns false after unmarking a list', () => {
        LIST_COVERS.mark('list-123');
        LIST_COVERS.unmark('list-123');
        expect(LIST_COVERS.has('list-123')).toBe(false);
    });

    it('supports multiple lists independently', () => {
        LIST_COVERS.mark('list-a');
        expect(LIST_COVERS.has('list-a')).toBe(true);
        expect(LIST_COVERS.has('list-b')).toBe(false);

        LIST_COVERS.mark('list-b');
        expect(LIST_COVERS.has('list-b')).toBe(true);
    });
});
