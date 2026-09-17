import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadCastSender } from '../castSender';

describe('loadCastSender', () => {
    let scriptElements: HTMLScriptElement[] = [];

    beforeEach(() => {
        // Reset state and loader manually if possible (since it's a singleton promise we can't easily reset,
        // but we can test behavior on first call if isolated)
        vi.useFakeTimers();
        scriptElements = [];

        vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
            if (tagName === 'script') {
                const el = { src: '', async: false, onerror: null, onload: null } as unknown as HTMLScriptElement;
                scriptElements.push(el);
                return el;
            }
            return {} as any;
        });

        vi.spyOn(document.head, 'appendChild').mockImplementation(() => {
            return {} as any;
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        delete (window as any).chrome;
        delete (window as any).__onGCastApiAvailable;
    });

    it('injects script and resolves when window.__onGCastApiAvailable is called', async () => {
        // Run loadCastSender asynchronously
        const promise = loadCastSender(5000);

        // Verify script injection
        expect(scriptElements.length).toBeGreaterThan(0);
        expect(scriptElements[0].src).toBe('https://www.gstatic.com/cv/js/sender/v1/cast_sender.js');
        expect(scriptElements[0].async).toBe(true);

        // Simulate API being available
        (window as any).chrome = { cast: { isAvailable: true, ReceiverAvailability: { AVAILABLE: 'A' } } };

        // Trigger the callback
        (window as any).__onGCastApiAvailable(true);

        const result = await promise;
        expect(result).toBeTruthy();
        expect(result?.isAvailable).toBe(true);
    });
});
