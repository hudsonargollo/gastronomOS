import { describe, it, expect } from 'vitest';
import productRoutes from './products';

describe('Product Routes', () => {
  it('should export a Hono app instance', () => {
    expect(productRoutes).toBeDefined();
    expect(typeof productRoutes).toBe('object');
    // Basic check that it's a Hono app
    expect(typeof productRoutes.get).toBe('function');
    expect(typeof productRoutes.post).toBe('function');
    expect(typeof productRoutes.put).toBe('function');
    expect(typeof productRoutes.delete).toBe('function');
  });
});