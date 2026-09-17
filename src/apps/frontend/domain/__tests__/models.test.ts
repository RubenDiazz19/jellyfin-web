import { describe, it, expect } from 'vitest';
import * as modelsFacade from '../models';
import { findSeason } from '../../data/models';

describe('models facade', () => {
    it('re-exports model utilities', () => {
        expect(modelsFacade.findSeason).toBe(findSeason);
        expect(modelsFacade.PROTO_DATA).toBeDefined();
    });
});
