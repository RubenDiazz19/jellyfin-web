import { describe, it, expect } from 'vitest';
import { ApiService, apiService } from '../ApiService';

describe('ApiService', () => {
    it('creates an instance with default services', () => {
        const customSession = { load: () => null } as any;
        const api = new ApiService(customSession);

        expect(api.session).toBe(customSession);
        expect(api.auth).toBeDefined();
        expect(api.catalog).toBeDefined();
    });

    it('exports a default apiService instance', () => {
        expect(apiService).toBeInstanceOf(ApiService);
        expect(apiService.session).toBeDefined();
    });
});
