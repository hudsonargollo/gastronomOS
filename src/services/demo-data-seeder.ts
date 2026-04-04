import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import {
  tenants, users, locations, categories, products, suppliers, inventoryItems,
  purchaseOrders, poItems, transfers, allocations, receipts, receiptLineItems,
  receiptProcessingJobs,
  NewTenant, NewUser, NewLocation, NewCategory, NewProduct, NewSupplier,
  NewInventoryItem, NewPurchaseOrder, NewPOItem, NewTransfer, NewAllocation,
  NewReceipt, NewReceiptLineItem, NewReceiptProcessingJob,
  UserRole, LocationType, POStatus, TransferStatus, TransferPriority,
  AllocationStatus, ProductStatus, ReceiptProcessingStatus
} from '../db/schema';
import { generateId } from '../utils';

/**
 * Demo Data Seeder Service
 * 
 * Creates realistic sample data for the demo tenant to showcase GastronomOS functionality.
 * Implements requirements 8.4 and 8.5 for demo data creation and reset functionality.
 */
export interface IDemoDataSeeder {
  seedDemoData(): Promise<void>;
  resetDemoData(): Promise<void>;
  isDemoDataSeeded(): Promise<boolean>;
}

export class DemoDataSeeder implements IDemoDataSeeder {
  private readonly DEMO_TENANT_ID = 'demo-tenant-id';
  private readonly DEMO_TENANT_SLUG = 'demo';

  constructor(private db: DrizzleD1Database) {}

  /**
   * Seeds complete demo data for the demo tenant
   * Requirements: 8.4 - Create realistic sample data for demo tenant
   */
  async seedDemoData(): Promise<void> {
    console.log('Starting demo data seeding...');

    try {
      // Check if demo data already exists
      if (await this.isDemoDataSeeded()) {
        console.log('Demo data already exists, resetting first...');
        await this.resetDemoData();
      }

      // Seed data in dependency order
      await this.seedDemoTenant();
      await this.seedDemoUsers();
      await this.seedDemoLocations();
      await this.seedDemoCategories();
      await this.seedDemoSuppliers();
      await this.seedDemoProducts();
      await this.seedDemoInventory();
      await this.seedDemoPurchaseOrders();
      await this.seedDemoTransfers();
      await this.seedDemoAllocations();
      await this.seedDemoReceipts();

      console.log('Demo data seeding completed successfully');
    } catch (error) {
      console.error('Error seeding demo data:', error);
      throw new Error(`Failed to seed demo data: ${error.message}`);
    }
  }

  /**
   * Resets all demo data by deleting and recreating
   * Requirements: 8.5 - Implement demo data reset functionality
   */
  async resetDemoData(): Promise<void> {
    console.log('Resetting demo data...');

    try {
      // Delete all demo data in reverse dependency order
      await this.deleteDemoData();
      
      // Re-seed fresh demo data
      await this.seedDemoData();
      
      console.log('Demo data reset completed successfully');
    } catch (error) {
      console.error('Error resetting demo data:', error);
      throw new Error(`Failed to reset demo data: ${error.message}`);
    }
  }

  /**
   * Checks if demo data has been seeded
   */
  async isDemoDataSeeded(): Promise<boolean> {
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, this.DEMO_TENANT_ID))
      .limit(1);

    return !!tenant;
  }

  /**
   * Deletes all demo data from the database
   */
  private async deleteDemoData(): Promise<void> {
    // Delete in reverse dependency order to avoid foreign key constraints
    await this.db.delete(receiptLineItems)
      .where(eq(receiptLineItems.receiptId, 'demo-receipt-1'));
    
    await this.db.delete(receipts)
      .where(eq(receipts.tenantId, this.DEMO_TENANT_ID));
    
    await this.db.delete(receiptProcessingJobs)
      .where(eq(receiptProcessingJobs.tenantId, this.DEMO_TENANT_ID));
    
    await this.db.delete(allocations)
      .where(eq(allocations.tenantId, this.DEMO_TENANT_ID));
    
    await this.db.delete(transfers)
      .where(eq(transfers.tenantId, this.DEMO_TENANT_ID));
    
    await this.db.delete(poItems)
      .where(eq(poItems.poId, 'demo-po-1'));
    
    await this.db.delete(purchaseOrders)
      .where(eq(purchaseOrders.tenantId, this.DEMO_TENANT_ID));
    
    await this.db.delete(inventoryItems)
      .where(eq(inventoryItems.tenantId, this.DEMO_TENANT_ID));
    
    await this.db.delete(products)
      .where(eq(products.tenantId, this.DEMO_TENANT_ID));
    
    await this.db.delete(suppliers)
      .where(eq(suppliers.tenantId, this.DEMO_TENANT_ID));
    
    await this.db.delete(categories)
      .where(eq(categories.tenantId, this.DEMO_TENANT_ID));
    
    await this.db.delete(locations)
      .where(eq(locations.tenantId, this.DEMO_TENANT_ID));
    
    await this.db.delete(users)
      .where(eq(users.tenantId, this.DEMO_TENANT_ID));
    
    await this.db.delete(tenants)
      .where(eq(tenants.id, this.DEMO_TENANT_ID));
  }

  /**
   * Seeds the demo tenant
   */
  private async seedDemoTenant(): Promise<void> {
    const demoTenant: NewTenant = {
      id: this.DEMO_TENANT_ID,
      name: 'Demo Restaurant Group',
      slug: this.DEMO_TENANT_SLUG,
      createdAt: Date.now(),
      settings: JSON.stringify({
        timezone: 'America/New_York',
        currency: 'USD',
        features: ['inventory', 'purchasing', 'transfers', 'analytics']
      })
    };

    await this.db.insert(tenants).values(demoTenant);
    console.log('✓ Demo tenant created');
  }

  /**
   * Seeds demo users with different roles
   */
  private async seedDemoUsers(): Promise<void> {
    const now = Date.now();
    const demoUsers: NewUser[] = [
      {
        id: 'demo-user-id',
        tenantId: this.DEMO_TENANT_ID,
        email: 'demo@gastronomos.com',
        passwordHash: '$2a$10$demo.hash.for.demo123.password', // bcrypt hash for 'demo123'
        role: UserRole.ADMIN,
        firstName: 'Demo',
        lastName: 'Administrator',
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'demo-manager-id',
        tenantId: this.DEMO_TENANT_ID,
        email: 'manager@demo-restaurant.com',
        passwordHash: '$2a$10$demo.hash.for.manager123.password',
        role: UserRole.MANAGER,
        locationId: 'demo-location-main',
        firstName: 'Sarah',
        lastName: 'Johnson',
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'demo-staff-id',
        tenantId: this.DEMO_TENANT_ID,
        email: 'staff@demo-restaurant.com',
        passwordHash: '$2a$10$demo.hash.for.staff123.password',
        role: UserRole.STAFF,
        locationId: 'demo-location-main',
        firstName: 'Mike',
        lastName: 'Chen',
        active: true,
        createdAt: now,
        updatedAt: now
      }
    ];

    await this.db.insert(users).values(demoUsers);
    console.log('✓ Demo users created');
  }

  /**
   * Seeds demo locations representing different restaurant types
   */
  private async seedDemoLocations(): Promise<void> {
    const now = Date.now();
    const demoLocations: NewLocation[] = [
      {
        id: 'demo-location-main',
        tenantId: this.DEMO_TENANT_ID,
        name: 'Main Street Restaurant',
        type: LocationType.RESTAURANT,
        address: '123 Main Street, Downtown, NY 10001',
        managerId: 'demo-manager-id',
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'demo-location-commissary',
        tenantId: this.DEMO_TENANT_ID,
        name: 'Central Commissary',
        type: LocationType.COMMISSARY,
        address: '456 Industrial Blvd, Queens, NY 11101',
        managerId: 'demo-user-id',
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'demo-location-popup',
        tenantId: this.DEMO_TENANT_ID,
        name: 'Beach House Pop-up',
        type: LocationType.POP_UP,
        address: '789 Ocean Drive, Hamptons, NY 11968',
        managerId: 'demo-manager-id',
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'demo-location-warehouse',
        tenantId: this.DEMO_TENANT_ID,
        name: 'Storage Warehouse',
        type: LocationType.WAREHOUSE,
        address: '321 Storage Way, Brooklyn, NY 11201',
        managerId: 'demo-user-id',
        active: true,
        createdAt: now,
        updatedAt: now
      }
    ];

    await this.db.insert(locations).values(demoLocations);
    console.log('✓ Demo locations created');
  }

  /**
   * Seeds demo product categories
   */
  private async seedDemoCategories(): Promise<void> {
    const now = Date.now();
    const demoCategories: NewCategory[] = [
      {
        id: 'demo-cat-proteins',
        tenantId: this.DEMO_TENANT_ID,
        name: 'Proteins',
        description: 'Meat, poultry, seafood, and plant-based proteins',
        sortOrder: 1,
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'demo-cat-produce',
        tenantId: this.DEMO_TENANT_ID,
        name: 'Fresh Produce',
        description: 'Fruits, vegetables, and herbs',
        sortOrder: 2,
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'demo-cat-dairy',
        tenantId: this.DEMO_TENANT_ID,
        name: 'Dairy & Eggs',
        description: 'Milk, cheese, yogurt, and eggs',
        sortOrder: 3,
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'demo-cat-pantry',
        tenantId: this.DEMO_TENANT_ID,
        name: 'Pantry Staples',
        description: 'Grains, spices, oils, and dry goods',
        sortOrder: 4,
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'demo-cat-beverages',
        tenantId: this.DEMO_TENANT_ID,
        name: 'Beverages',
        description: 'Non-alcoholic drinks and mixers',
        sortOrder: 5,
        active: true,
        createdAt: now,
        updatedAt: now
      }
    ];

    await this.db.insert(categories).values(demoCategories);
    console.log('✓ Demo categories created');
  }

  /**
   * Seeds demo suppliers
   */
  private async seedDemoSuppliers(): Promise<void> {
    const now = Date.now();
    const demoSuppliers: NewSupplier[] = [
      {
        id: 'demo-supplier-sysco',
        tenantId: this.DEMO_TENANT_ID,
        name: 'Sysco Food Services',
        contactEmail: 'orders@sysco.com',
        contactPhone: '(555) 123-4567',
        address: '1000 Distribution Center Dr, Houston, TX 77032',
        paymentTerms: 'Net 30',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'demo-supplier-local-farm',
        tenantId: this.DEMO_TENANT_ID,
        name: 'Hudson Valley Farms',
        contactEmail: 'sales@hudsonvalleyfarms.com',
        contactPhone: '(555) 987-6543',
        address: '250 Farm Road, Hudson, NY 12534',
        paymentTerms: 'Net 15',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'demo-supplier-specialty',
        tenantId: this.DEMO_TENANT_ID,
        name: 'Artisan Specialty Foods',
        contactEmail: 'info@artisanspecialty.com',
        contactPhone: '(555) 456-7890',
        address: '789 Gourmet Ave, Brooklyn, NY 11215',
        paymentTerms: 'Net 21',
        createdAt: now,
        updatedAt: now
      }
    ];

    await this.db.insert(suppliers).values(demoSuppliers);
    console.log('✓ Demo suppliers created');
  }

  /**
   * Seeds demo products across different categories
   */
  private async seedDemoProducts(): Promise<void> {
    const now = Date.now();
    const demoProducts: NewProduct[] = [
      // Proteins
      {
        id: 'demo-product-chicken-breast',
        tenantId: this.DEMO_TENANT_ID,
        name: 'Organic Chicken Breast',
        description: 'Free-range organic chicken breast, boneless and skinless',
        categoryId: 'demo-cat-proteins',
        unit: 'lb',
        price: 899, // $8.99 per lb
        sku: 'CHKN-BRST-ORG',
        barcode: '1234567890123',
        status: ProductStatus.ACTIVE,
        minStock: 20,
        maxStock: 100,
        reorderPoint: 30,
        costCents: 650, // $6.50 cost
        marginPercent: 38.3,
        weight: 1.0,
        allergens: JSON.stringify([]),
        tags: JSON.stringify(['organic', 'protein', 'chicken']),
        createdBy: 'demo-user-id',
        updatedBy: 'demo-user-id',
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'demo-product-salmon-fillet',
        tenantId: this.DEMO_TENANT_ID,
        name: 'Atlantic Salmon Fillet',
        description: 'Fresh Atlantic salmon fillet, skin-on',
        categoryId: 'demo-cat-proteins',
        unit: 'lb',
        price: 1599, // $15.99 per lb
        sku: 'SLMN-FLLT-ATL',
        barcode: '1234567890124',
        status: ProductStatus.ACTIVE,
        minStock: 10,
        maxStock: 50,
        reorderPoint: 15,
        costCents: 1200, // $12.00 cost
        marginPercent: 33.3,
        weight: 1.0,
        allergens: JSON.stringify(['fish']),
        tags: JSON.stringify(['seafood', 'protein', 'salmon']),
        createdBy: 'demo-user-id',
        updatedBy: 'demo-user-id',
        active: true,
        createdAt: now,
        updatedAt: now
      },
      // Produce
      {
        id: 'demo-product-tomatoes',
        tenantId: this.DEMO_TENANT_ID,
        name: 'Roma Tomatoes',
        description: 'Fresh Roma tomatoes, perfect for sauces and salads',
        categoryId: 'demo-cat-produce',
        unit: 'lb',
        price: 299, // $2.99 per lb
        sku: 'TOM-ROMA-FRSH',
        barcode: '1234567890125',
        status: ProductStatus.ACTIVE,
        minStock: 25,
        maxStock: 100,
        reorderPoint: 40,
        costCents: 180, // $1.80 cost
        marginPercent: 66.1,
        weight: 1.0,
        allergens: JSON.stringify([]),
        tags: JSON.stringify(['produce', 'tomatoes', 'fresh']),
        createdBy: 'demo-user-id',
        updatedBy: 'demo-user-id',
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'demo-product-lettuce',
        tenantId: this.DEMO_TENANT_ID,
        name: 'Romaine Lettuce',
        description: 'Fresh romaine lettuce heads',
        categoryId: 'demo-cat-produce',
        unit: 'head',
        price: 249, // $2.49 per head
        sku: 'LET-ROM-HEAD',
        barcode: '1234567890126',
        status: ProductStatus.ACTIVE,
        minStock: 20,
        maxStock: 80,
        reorderPoint: 30,
        costCents: 150, // $1.50 cost
        marginPercent: 66.0,
        weight: 0.75,
        allergens: JSON.stringify([]),
        tags: JSON.stringify(['produce', 'lettuce', 'fresh', 'salad']),
        createdBy: 'demo-user-id',
        updatedBy: 'demo-user-id',
        active: true,
        createdAt: now,
        updatedAt: now
      },
      // Dairy
      {
        id: 'demo-product-mozzarella',
        tenantId: this.DEMO_TENANT_ID,
        name: 'Fresh Mozzarella',
        description: 'Artisan fresh mozzarella cheese',
        categoryId: 'demo-cat-dairy',
        unit: 'lb',
        price: 799, // $7.99 per lb
        sku: 'CHZ-MOZ-FRSH',
        barcode: '1234567890127',
        status: ProductStatus.ACTIVE,
        minStock: 15,
        maxStock: 60,
        reorderPoint: 25,
        costCents: 550, // $5.50 cost
        marginPercent: 45.3,
        weight: 1.0,
        allergens: JSON.stringify(['milk']),
        tags: JSON.stringify(['dairy', 'cheese', 'mozzarella']),
        createdBy: 'demo-user-id',
        updatedBy: 'demo-user-id',
        active: true,
        createdAt: now,
        updatedAt: now
      },
      // Pantry
      {
        id: 'demo-product-olive-oil',
        tenantId: this.DEMO_TENANT_ID,
        name: 'Extra Virgin Olive Oil',
        description: 'Premium extra virgin olive oil, cold-pressed',
        categoryId: 'demo-cat-pantry',
        unit: 'bottle',
        price: 1299, // $12.99 per bottle
        sku: 'OIL-OLIV-EVOO',
        barcode: '1234567890128',
        status: ProductStatus.ACTIVE,
        minStock: 12,
        maxStock: 48,
        reorderPoint: 18,
        costCents: 850, // $8.50 cost
        marginPercent: 52.8,
        weight: 1.1,
        allergens: JSON.stringify([]),
        tags: JSON.stringify(['pantry', 'oil', 'olive', 'premium']),
        createdBy: 'demo-user-id',
        updatedBy: 'demo-user-id',
        active: true,
        createdAt: now,
        updatedAt: now
      }
    ];

    await this.db.insert(products).values(demoProducts);
    console.log('✓ Demo products created');
  }

  /**
   * Seeds demo inventory across locations
   */
  private async seedDemoInventory(): Promise<void> {
    const now = Date.now();
    const demoInventory: NewInventoryItem[] = [
      // Main Restaurant inventory
      {
        id: 'demo-inv-main-chicken',
        tenantId: this.DEMO_TENANT_ID,
        productId: 'demo-product-chicken-breast',
        locationId: 'demo-location-main',
        quantity: 45,
        unitCost: 650,
        lastUpdated: now,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'demo-inv-main-salmon',
        tenantId: this.DEMO_TENANT_ID,
        productId: 'demo-product-salmon-fillet',
        locationId: 'demo-location-main',
        quantity: 22,
        unitCost: 1200,
        lastUpdated: now,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'demo-inv-main-tomatoes',
        tenantId: this.DEMO_TENANT_ID,
        productId: 'demo-product-tomatoes',
        locationId: 'demo-location-main',
        quantity: 65,
        unitCost: 180,
        lastUpdated: now,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'demo-inv-main-lettuce',
        tenantId: this.DEMO_TENANT_ID,
        productId: 'demo-product-lettuce',
        locationId: 'demo-location-main',
        quantity: 38,
        unitCost: 150,
        lastUpdated: now,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'demo-inv-main-mozzarella',
        tenantId: this.DEMO_TENANT_ID,
        productId: 'demo-product-mozzarella',
        locationId: 'demo-location-main',
        quantity: 28,
        unitCost: 550,
        lastUpdated: now,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'demo-inv-main-olive-oil',
        tenantId: this.DEMO_TENANT_ID,
        productId: 'demo-product-olive-oil',
        locationId: 'demo-location-main',
        quantity: 24,
        unitCost: 850,
        lastUpdated: now,
        createdAt: now,
        updatedAt: now
      },
      // Commissary inventory (higher quantities)
      {
        id: 'demo-inv-comm-chicken',
        tenantId: this.DEMO_TENANT_ID,
        productId: 'demo-product-chicken-breast',
        locationId: 'demo-location-commissary',
        quantity: 120,
        unitCost: 650,
        lastUpdated: now,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'demo-inv-comm-tomatoes',
        tenantId: this.DEMO_TENANT_ID,
        productId: 'demo-product-tomatoes',
        locationId: 'demo-location-commissary',
        quantity: 200,
        unitCost: 180,
        lastUpdated: now,
        createdAt: now,
        updatedAt: now
      },
      // Pop-up location (limited inventory)
      {
        id: 'demo-inv-popup-salmon',
        tenantId: this.DEMO_TENANT_ID,
        productId: 'demo-product-salmon-fillet',
        locationId: 'demo-location-popup',
        quantity: 15,
        unitCost: 1200,
        lastUpdated: now,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'demo-inv-popup-lettuce',
        tenantId: this.DEMO_TENANT_ID,
        productId: 'demo-product-lettuce',
        locationId: 'demo-location-popup',
        quantity: 20,
        unitCost: 150,
        lastUpdated: now,
        createdAt: now,
        updatedAt: now
      }
    ];

    await this.db.insert(inventoryItems).values(demoInventory);
    console.log('✓ Demo inventory created');
  }

  /**
   * Seeds demo purchase orders with realistic data
   */
  private async seedDemoPurchaseOrders(): Promise<void> {
    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);

    // Create purchase order
    const demoPO: NewPurchaseOrder = {
      id: 'demo-po-1',
      tenantId: this.DEMO_TENANT_ID,
      supplierId: 'demo-supplier-sysco',
      poNumber: 'PO-2024-001',
      status: POStatus.RECEIVED,
      totalCostCents: 245000, // $2,450.00
      createdBy: 'demo-manager-id',
      approvedBy: 'demo-user-id',
      approvedAt: weekAgo + (2 * 60 * 60 * 1000), // 2 hours after creation
      receivedBy: 'demo-staff-id',
      receivedAt: weekAgo + (3 * 24 * 60 * 60 * 1000), // 3 days after creation
      notes: 'Weekly protein and produce order for main restaurant',
      createdAt: weekAgo,
      updatedAt: weekAgo + (3 * 24 * 60 * 60 * 1000)
    };

    await this.db.insert(purchaseOrders).values(demoPO);

    // Create PO items
    const demoPOItems: NewPOItem[] = [
      {
        id: 'demo-po-item-1',
        poId: 'demo-po-1',
        productId: 'demo-product-chicken-breast',
        quantityOrdered: 50,
        unitPriceCents: 650,
        quantityReceived: 50,
        lineTotalCents: 32500, // 50 * $6.50
        notes: 'Fresh organic chicken breast',
        createdAt: weekAgo,
        updatedAt: weekAgo + (3 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'demo-po-item-2',
        poId: 'demo-po-1',
        productId: 'demo-product-salmon-fillet',
        quantityOrdered: 25,
        unitPriceCents: 1200,
        quantityReceived: 25,
        lineTotalCents: 30000, // 25 * $12.00
        notes: 'Atlantic salmon fillets',
        createdAt: weekAgo,
        updatedAt: weekAgo + (3 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'demo-po-item-3',
        poId: 'demo-po-1',
        productId: 'demo-product-tomatoes',
        quantityOrdered: 100,
        unitPriceCents: 180,
        quantityReceived: 100,
        lineTotalCents: 18000, // 100 * $1.80
        notes: 'Roma tomatoes for sauces',
        createdAt: weekAgo,
        updatedAt: weekAgo + (3 * 24 * 60 * 60 * 1000)
      }
    ];

    await this.db.insert(poItems).values(demoPOItems);
    console.log('✓ Demo purchase orders created');
  }

  /**
   * Seeds demo transfers between locations
   */
  private async seedDemoTransfers(): Promise<void> {
    const now = Date.now();
    const twoDaysAgo = now - (2 * 24 * 60 * 60 * 1000);

    const demoTransfers: NewTransfer[] = [
      {
        id: 'demo-transfer-1',
        tenantId: this.DEMO_TENANT_ID,
        productId: 'demo-product-chicken-breast',
        sourceLocationId: 'demo-location-commissary',
        destinationLocationId: 'demo-location-main',
        quantityRequested: 30,
        quantityShipped: 30,
        quantityReceived: 30,
        status: TransferStatus.RECEIVED,
        priority: TransferPriority.NORMAL,
        requestedBy: 'demo-manager-id',
        approvedBy: 'demo-user-id',
        approvedAt: twoDaysAgo + (1 * 60 * 60 * 1000), // 1 hour after request
        shippedBy: 'demo-staff-id',
        shippedAt: twoDaysAgo + (4 * 60 * 60 * 1000), // 4 hours after request
        receivedBy: 'demo-manager-id',
        receivedAt: twoDaysAgo + (6 * 60 * 60 * 1000), // 6 hours after request
        notes: 'Restocking main restaurant for weekend rush',
        createdAt: twoDaysAgo,
        updatedAt: twoDaysAgo + (6 * 60 * 60 * 1000)
      },
      {
        id: 'demo-transfer-2',
        tenantId: this.DEMO_TENANT_ID,
        productId: 'demo-product-salmon-fillet',
        sourceLocationId: 'demo-location-main',
        destinationLocationId: 'demo-location-popup',
        quantityRequested: 10,
        quantityShipped: 10,
        quantityReceived: 0,
        status: TransferStatus.SHIPPED,
        priority: TransferPriority.HIGH,
        requestedBy: 'demo-manager-id',
        approvedBy: 'demo-user-id',
        approvedAt: now - (4 * 60 * 60 * 1000), // 4 hours ago
        shippedBy: 'demo-staff-id',
        shippedAt: now - (2 * 60 * 60 * 1000), // 2 hours ago
        notes: 'Special event at beach house location',
        createdAt: now - (5 * 60 * 60 * 1000),
        updatedAt: now - (2 * 60 * 60 * 1000)
      }
    ];

    await this.db.insert(transfers).values(demoTransfers);
    console.log('✓ Demo transfers created');
  }

  /**
   * Seeds demo allocations
   */
  private async seedDemoAllocations(): Promise<void> {
    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);

    const demoAllocations: NewAllocation[] = [
      {
        id: 'demo-allocation-1',
        tenantId: this.DEMO_TENANT_ID,
        poItemId: 'demo-po-item-1',
        targetLocationId: 'demo-location-main',
        quantityAllocated: 30,
        quantityReceived: 30,
        status: AllocationStatus.RECEIVED,
        notes: 'Allocated to main restaurant kitchen',
        createdBy: 'demo-manager-id',
        createdAt: weekAgo + (1 * 60 * 60 * 1000),
        updatedAt: weekAgo + (3 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'demo-allocation-2',
        tenantId: this.DEMO_TENANT_ID,
        poItemId: 'demo-po-item-1',
        targetLocationId: 'demo-location-commissary',
        quantityAllocated: 20,
        quantityReceived: 20,
        status: AllocationStatus.RECEIVED,
        notes: 'Allocated to commissary storage',
        createdBy: 'demo-manager-id',
        createdAt: weekAgo + (1 * 60 * 60 * 1000),
        updatedAt: weekAgo + (3 * 24 * 60 * 60 * 1000)
      }
    ];

    await this.db.insert(allocations).values(demoAllocations);
    console.log('✓ Demo allocations created');
  }

  /**
   * Seeds demo receipts for purchase order matching
   */
  private async seedDemoReceipts(): Promise<void> {
    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);

    // Create receipt processing job first
    const demoProcessingJob: NewReceiptProcessingJob = {
      id: 'demo-processing-job-1',
      tenantId: this.DEMO_TENANT_ID,
      userId: 'demo-staff-id',
      r2Key: 'demo-receipts/sysco-receipt-001.pdf',
      status: ReceiptProcessingStatus.COMPLETED,
      processingOptions: JSON.stringify({
        autoMatch: true,
        confidenceThreshold: 0.8,
        requireManualReview: false
      }),
      createdAt: weekAgo + (3 * 24 * 60 * 60 * 1000),
      startedAt: weekAgo + (3 * 24 * 60 * 60 * 1000) + (5 * 60 * 1000), // 5 minutes later
      completedAt: weekAgo + (3 * 24 * 60 * 60 * 1000) + (10 * 60 * 1000), // 10 minutes later
      retryCount: 0
    };

    await this.db.insert(receiptProcessingJobs).values(demoProcessingJob);

    // Create receipt
    const demoReceipt: NewReceipt = {
      id: 'demo-receipt-1',
      tenantId: this.DEMO_TENANT_ID,
      processingJobId: 'demo-processing-job-1',
      r2Key: 'demo-receipts/sysco-receipt-001.pdf',
      vendorName: 'Sysco Food Services',
      transactionDate: weekAgo + (3 * 24 * 60 * 60 * 1000),
      totalAmountCents: 245000, // $2,450.00
      subtotalCents: 225000, // $2,250.00
      taxCents: 20000, // $200.00
      currency: 'USD',
      confidenceScore: 0.95,
      requiresManualReview: 0,
      linkedPoId: 'demo-po-1',
      createdAt: weekAgo + (3 * 24 * 60 * 60 * 1000),
      updatedAt: weekAgo + (3 * 24 * 60 * 60 * 1000)
    };

    await this.db.insert(receipts).values(demoReceipt);

    // Create receipt line items
    const demoReceiptItems: NewReceiptLineItem[] = [
      {
        id: 'demo-receipt-item-1',
        receiptId: 'demo-receipt-1',
        description: 'Organic Chicken Breast - 50 lbs',
        quantity: 50,
        unitPriceCents: 650,
        totalPriceCents: 32500,
        matchedProductId: 'demo-product-chicken-breast',
        matchConfidence: 0.98,
        requiresManualReview: 0,
        rawText: 'CHKN BRST ORG 50LB @ $6.50/LB',
        createdAt: weekAgo + (3 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'demo-receipt-item-2',
        receiptId: 'demo-receipt-1',
        description: 'Atlantic Salmon Fillet - 25 lbs',
        quantity: 25,
        unitPriceCents: 1200,
        totalPriceCents: 30000,
        matchedProductId: 'demo-product-salmon-fillet',
        matchConfidence: 0.92,
        requiresManualReview: 0,
        rawText: 'SALMON FILLET ATL 25LB @ $12.00/LB',
        createdAt: weekAgo + (3 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'demo-receipt-item-3',
        receiptId: 'demo-receipt-1',
        description: 'Roma Tomatoes - 100 lbs',
        quantity: 100,
        unitPriceCents: 180,
        totalPriceCents: 18000,
        matchedProductId: 'demo-product-tomatoes',
        matchConfidence: 0.89,
        requiresManualReview: 0,
        rawText: 'TOMATOES ROMA 100LB @ $1.80/LB',
        createdAt: weekAgo + (3 * 24 * 60 * 60 * 1000)
      }
    ];

    await this.db.insert(receiptLineItems).values(demoReceiptItems);
    console.log('✓ Demo receipts created');
  }
}

/**
 * Factory function to create DemoDataSeeder instance
 */
export function createDemoDataSeeder(db: DrizzleD1Database): IDemoDataSeeder {
  return new DemoDataSeeder(db);
}