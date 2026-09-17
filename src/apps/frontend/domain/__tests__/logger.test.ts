import { describe, it, expect } from 'vitest';
import * as loggerFacade from '../logger';
import { createLogger, logger } from '../../shared/logger';

describe('logger facade', () => {
    it('re-exports shared logger instances', () => {
        expect(loggerFacade.createLogger).toBe(createLogger);
        expect(loggerFacade.logger).toBe(logger);
    });
});
