import { describe, it, expect } from 'vitest';
import app from './index';

describe('Basic App Setup', () => {
  it('should have health endpoint', async () => {
    const req = new Request('http://localhost/health');
    const res = await app.fetch(req, {
      DB: {} as D1Database,
      JWT_SECRET: 'test-secret-that-is-long-enough-for-validation',
    });
    
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.status).toBe('healthy');
    expect(data.environment).toBe('development');
  });

  it('should have API v1 endpoint', async () => {
    const req = new Request('http://localhost/api/v1');
    const res = await app.fetch(req, {
      DB: {} as D1Database,
      JWT_SECRET: 'test-secret-that-is-long-enough-for-validation',
    });
    
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.message).toBe('GastronomOS Authentication API v1');
    expect(data.version).toBe('1.0.0');
  });

  it('should return 404 for unknown routes', async () => {
    const req = new Request('http://localhost/unknown');
    const res = await app.fetch(req, {
      DB: {} as D1Database,
      JWT_SECRET: 'test-secret-that-is-long-enough-for-validation',
    });
    
    expect(res.status).toBe(404);
    const data = await res.json() as any;
    expect(data.error).toBe('Not Found');
  });
});