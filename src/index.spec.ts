import { VERSION } from './index';

describe('nesthub', () => {
  describe('VERSION', () => {
    it('should be a semver string', () => {
      expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });
});
