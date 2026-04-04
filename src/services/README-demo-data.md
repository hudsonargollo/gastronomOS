# Demo Data Seeding System

This document describes the demo data seeding system for GastronomOS, which provides realistic sample data for demonstration and evaluation purposes.

## Overview

The demo data seeding system creates a complete, realistic restaurant environment with:

- **Demo Tenant**: "Demo Restaurant Group" with multiple locations
- **Sample Users**: Admin, Manager, and Staff roles with different permissions
- **Realistic Locations**: Restaurant, Commissary, Pop-up, and Warehouse
- **Product Catalog**: 6 products across 5 categories (proteins, produce, dairy, pantry, beverages)
- **Inventory Data**: Stock levels across all locations
- **Transaction History**: Purchase orders, transfers, receipts, and allocations
- **Supplier Relationships**: 3 suppliers with different payment terms

## Components

### 1. DemoDataSeeder (`demo-data-seeder.ts`)

Core service that handles the creation and management of demo data.

**Key Methods:**
- `seedDemoData()`: Creates all demo data from scratch
- `resetDemoData()`: Deletes and recreates all demo data
- `isDemoDataSeeded()`: Checks if demo data exists

**Features:**
- Maintains referential integrity during creation and deletion
- Creates realistic timestamps and relationships
- Handles complex data dependencies (POs → Items → Allocations → Receipts)

### 2. DemoInitializationService (`demo-initialization.ts`)

High-level service for managing demo data lifecycle.

**Key Methods:**
- `initializeDemoData()`: Initializes demo data if it doesn't exist (idempotent)
- `resetDemoData()`: Resets demo data to initial state
- `scheduleDemoReset()`: Configures automatic reset scheduling

### 3. Demo API Routes (`routes/demo.ts`)

REST endpoints for demo data management:

- `GET /api/v1/demo/status` - Check demo data status
- `POST /api/v1/demo/initialize` - Initialize demo data
- `POST /api/v1/demo/reset` - Reset demo data
- `GET /api/v1/demo/info` - Get demo environment information

## Demo Data Structure

### Tenant
- **ID**: `demo-tenant-id`
- **Name**: "Demo Restaurant Group"
- **Slug**: `demo`

### Users
1. **Admin User**
   - Email: `demo@gastronomos.com`
   - Password: `demo123`
   - Role: ADMIN
   - Access: All locations

2. **Manager User**
   - Email: `manager@demo-restaurant.com`
   - Password: `manager123`
   - Role: MANAGER
   - Access: Main Street Restaurant

3. **Staff User**
   - Email: `staff@demo-restaurant.com`
   - Password: `staff123`
   - Role: STAFF
   - Access: Main Street Restaurant

### Locations
1. **Main Street Restaurant** (RESTAURANT)
2. **Central Commissary** (COMMISSARY)
3. **Beach House Pop-up** (POP_UP)
4. **Storage Warehouse** (WAREHOUSE)

### Sample Products
1. **Organic Chicken Breast** - $8.99/lb (Proteins)
2. **Atlantic Salmon Fillet** - $15.99/lb (Proteins)
3. **Roma Tomatoes** - $2.99/lb (Produce)
4. **Romaine Lettuce** - $2.49/head (Produce)
5. **Fresh Mozzarella** - $7.99/lb (Dairy)
6. **Extra Virgin Olive Oil** - $12.99/bottle (Pantry)

### Sample Transactions
- **Purchase Order**: PO-2024-001 from Sysco ($2,450.00)
- **Transfers**: Commissary → Main Restaurant, Main → Pop-up
- **Allocations**: PO items distributed to locations
- **Receipt**: Matched receipt with 95% confidence

## Usage Examples

### Initialize Demo Data on Startup
```typescript
import { initializeDemoDataOnStartup } from './services/demo-initialization';

// During application startup
await initializeDemoDataOnStartup(db);
```

### Manual Demo Data Reset
```typescript
import { resetDemoDataManually } from './services/demo-initialization';

// For maintenance or testing
await resetDemoDataManually(db);
```

### API Usage
```bash
# Check demo data status
curl GET /api/v1/demo/status

# Initialize demo data
curl -X POST /api/v1/demo/initialize

# Reset demo data
curl -X POST /api/v1/demo/reset

# Get demo information
curl GET /api/v1/demo/info
```

## Requirements Compliance

This implementation satisfies the following requirements:

- **8.1**: Create demo tenant with sample data during system initialization
- **8.2**: Provide demo credentials for easy access
- **8.3**: Authenticate demo users with valid JWT tokens
- **8.4**: Create realistic sample data for demo tenant
- **8.5**: Implement demo data reset functionality

## Automatic Reset Scheduling

The system supports automatic demo data reset scheduling through Cloudflare Cron Triggers. To enable:

1. Add cron configuration to `wrangler.toml`:
```toml
[triggers]
crons = ["0 2 * * *"] # Reset daily at 2 AM UTC
```

2. Handle the scheduled event in your worker:
```typescript
export default {
  async scheduled(event, env, ctx) {
    if (event.cron === "0 2 * * *") {
      await resetDemoDataManually(drizzle(env.DB));
    }
  }
}
```

## Security Considerations

- Demo credentials are hardcoded for ease of use but should be rotated periodically
- Demo data is completely isolated from production tenants
- Demo sessions can have shorter expiration times for security
- All demo operations are logged for audit purposes

## Testing

The demo data seeding system includes comprehensive tests:

```bash
npm test src/services/demo-data-seeder.test.ts --run
```

Tests cover:
- Service instantiation and interface compliance
- Demo data structure validation
- Credential format verification
- Error handling scenarios

## Maintenance

### Adding New Demo Data
1. Update the seeding methods in `DemoDataSeeder`
2. Update the deletion order in `deleteDemoData()`
3. Update the demo info endpoint with new counts
4. Add tests for new data structures

### Modifying Demo Credentials
1. Update credentials in `seedDemoUsers()`
2. Update the auth route demo login handler
3. Update the demo info endpoint
4. Update documentation

### Performance Considerations
- Demo data seeding is designed to be fast (< 5 seconds)
- Uses batch operations where possible
- Maintains referential integrity without complex transactions
- Suitable for frequent resets without performance impact