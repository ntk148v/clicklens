import {
  DEFAULT_ROW_HEIGHT,
  DEFAULT_OVERSCAN,
  createVirtualConfig,
  buildVirtualizerOptions,
  defaultVirtualConfig,
} from '@/lib/virtual/virtual.config';

describe('virtual.config', () => {
  describe('DEFAULT_ROW_HEIGHT', () => {
    it('should be 34', () => {
      expect(DEFAULT_ROW_HEIGHT).toBe(34);
    });
  });

  describe('DEFAULT_OVERSCAN', () => {
    it('should be 5', () => {
      expect(DEFAULT_OVERSCAN).toBe(5);
    });
  });

  describe('createVirtualConfig', () => {
    it('should return default config when no options provided', () => {
      const config = createVirtualConfig();
      expect(config.rowHeight).toBe(DEFAULT_ROW_HEIGHT);
      expect(config.overscan).toBe(DEFAULT_OVERSCAN);
    });

    it('should allow overriding rowHeight', () => {
      const config = createVirtualConfig({ rowHeight: 40 });
      expect(config.rowHeight).toBe(40);
      expect(config.overscan).toBe(DEFAULT_OVERSCAN);
    });

    it('should allow overriding overscan', () => {
      const config = createVirtualConfig({ overscan: 10 });
      expect(config.rowHeight).toBe(DEFAULT_ROW_HEIGHT);
      expect(config.overscan).toBe(10);
    });

    it('should allow overriding both options', () => {
      const config = createVirtualConfig({ rowHeight: 50, overscan: 3 });
      expect(config.rowHeight).toBe(50);
      expect(config.overscan).toBe(3);
    });
  });

  describe('buildVirtualizerOptions', () => {
    it('should return correct options structure', () => {
      const config = createVirtualConfig({ rowHeight: 34, overscan: 5 });
      const options = buildVirtualizerOptions(100, config);

      expect(options.count).toBe(100);
      expect(typeof options.estimateSize).toBe('function');
      expect(options.overscan).toBe(5);
    });

    it('should use config rowHeight in estimateSize', () => {
      const config = createVirtualConfig({ rowHeight: 40 });
      const options = buildVirtualizerOptions(50, config);

      expect(options.estimateSize()).toBe(40);
    });
  });

  describe('defaultVirtualConfig', () => {
    it('should have correct default values', () => {
      expect(defaultVirtualConfig.rowHeight).toBe(34);
      expect(defaultVirtualConfig.overscan).toBe(5);
    });
  });
});