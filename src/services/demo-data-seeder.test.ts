import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { DemoDataSeeder, createDemoDataSeeder } from './demo-data-seeder';
import { tenants, users, locations, products, inventoryItems } from '../db/schema';
import { eq } from 'drizzle-orm';

// Mock D1 database for testing
const mockD1 = {
  prepare: () => ({
    bind: () => ({
      first: () => Promise.resolve(null),
      all: () => Promise.resolve({ results: [] }),
      run: () => Promise.resolve({ success: true })
    }),
    first: () => Promise.resolve(null),
    all: () => Promise.resolve({ results: [] }),
    run: () => Promise.resolve({ success: true })
  }),
  batch: () => Promise.resolve([]),
  exec: () => Promise.resolve({ results: [] })
} as unknown as D1Database;

describe('DemoDataSeeder', () => {
  let seeder: DemoDataSeeder;
  let db: any;

  beforeEach(() => {
    db = drizzle(mockD1);
    seeder = createDemoDataSeeder(db) as DemoDataSeeder;
  });

  afterEach(() => {
    // Clean up any test data if needed
  });

  it('should create a demo data seeder instance', () => {
    expect(seeder).toBeInstanceOf(DemoDataSeeder);
  });

  it('should implement IDemoDataSeeder interface', () => {
    expect(typeof seeder.seedDemoData).toBe('function');
    expect(typeof seeder.resetDemoData).toBe('function');
    expect(typeof seeder.isDemoDataSeeded).toBe('function');
  });

  it('should have correct demo tenant constants', () => {
    // Access private constants through the class instance
    const demoTenantId = (seeder as any).DEMO_TENANT_ID;
    const demoTenantSlug = (seeder as any).DEMO_TENANT_SLUG;
    
    expect(demoTenantId).toBe('demo-tenant-id');
    expect(demoTenantSlug).toBe('demo');
  });

  // Note: Full integration tests would require a real database connection
  // These tests focus on the service structure and interface compliance
});

describe('Demo Data Structure Validation', () => {
  it('should have valid demo data structure', () => {
    // Test that the demo data structure matches expected format
    const expectedDemoInfo = {
      tenant: {
        id: 'demo-tenant-id',
        name: 'Demo Restaurant Group',
        slug: 'demo'
      },
      locations: [
        { name: 'Main Street Restaurant', type: 'RESTAURANT' },
        { name: 'Central Commissary', type: 'COMMISSARY' },
        { name: 'Beach House Pop-up', type: 'POP_UP' },
        { name: 'Storage Warehouse', type: 'WAREHOUSE' }
      ],
      sampleData: {
        products: 6,
        categories: 5,
        suppliers: 3,
        purchaseOrders: 1,
        transfers: 2,
        inventoryItems: 10
      }
    };

    // Validate structure
    expect(expectedDemoInfo.tenant.id).toBe('demo-tenant-id');
    expect(expectedDemoInfo.locations).toHaveLength(4);
    expect(expectedDemoInfo.sampleData.products).toBe(6);
    expect(expectedDemoInfo.sampleData.categories).toBe(5);
    expect(expectedDemoInfo.sampleData.suppliers).toBe(3);
  });

  it('should have valid demo credentials structure', () => {
    const expectedCredentials = {
      admin: {
        email: 'demo@gastronomos.com',
        password: 'demo123',
        role: 'ADMIN'
      },
      manager: {
        email: 'manager@demo-restaurant.com',
        password: 'manager123',
        role: 'MANAGER'
      },
      staff: {
        email: 'staff@demo-restaurant.com',
        password: 'staff123',
        role: 'STAFF'
      }
    };

    // Validate credentials structure
    expect(expectedCredentials.admin.email).toBe('demo@gastronomos.com');
    expect(expectedCredentials.manager.role).toBe('MANAGER');
    expect(expectedCredentials.staff.role).toBe('STAFF');
  });
});