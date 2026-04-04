# GastronomOS - Restaurant Management System

Complete multi-tenant restaurant management system with inventory, purchasing, transfers, and allocation management. Built on Cloudflare Workers for global edge performance.

## 🚀 Live System

- **Backend API**: https://api.gastronomos.clubemkt.digital
- **Frontend**: https://gastronomos-frontend.pages.dev
- **Status**: ✅ Production (Last deployed: Jan 25, 2026)

## ✨ Key Features

### Core Systems
- **Multi-tenant architecture** with strict data isolation
- **Role-based access control** (ADMIN, MANAGER, STAFF)
- **Location-based access scoping** for multi-location restaurants
- **JWT-based authentication** using Web Crypto API
- **Comprehensive audit logging** for all operations

### Business Features
- **Inventory Management** - Product catalog, categories, stock tracking
- **Purchasing System** - PO management, supplier management, receipt processing with AI OCR
- **Transfer System** - Inter-location transfers with emergency workflows
- **Allocation System** - Inventory allocation with optimization
- **Analytics & Reporting** - Real-time dashboards and custom reports

### Technical Features
- **Edge-deployed** on Cloudflare Workers for global performance
- **AI-powered** receipt processing and transfer intelligence
- **API versioning** with backward compatibility
- **Advanced caching** and rate limiting
- **Webhook system** for integrations
- **Comprehensive monitoring** and health checks

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Cloudflare account with Workers and D1 enabled

### Installation

```bash
npm install
```

### Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Database Setup

```bash
# Generate database migrations
npm run db:generate

# Apply migrations
npm run db:migrate
```

### Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

## Environment Variables

Set these secrets using `wrangler secret put`:

- `JWT_SECRET` - Secret key for JWT signing
- `BCRYPT_ROUNDS` - Number of bcrypt rounds (optional, defaults to 12)

## 📚 Documentation

- **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** - Complete feature list and deployment status
- **[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)** - Project organization and directory structure
- **[CLEANUP_SUMMARY.md](./CLEANUP_SUMMARY.md)** - Recent cleanup and organization summary
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment guide for all environments
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - Production deployment checklist

## 🔌 API Overview

### Authentication
- POST /api/v1/auth/register - Register new user
- POST /api/v1/auth/login - User login
- GET /api/v1/auth/me - Get current user info

### Core Resources
- /api/v1/tenants - Tenant management
- /api/v1/users - User management
- /api/v1/locations - Location management
- /api/v1/categories - Category management
- /api/v1/products - Product catalog
- /api/v1/inventory - Inventory tracking

### Purchasing
- /api/v1/suppliers - Supplier management
- /api/v1/purchase-orders - PO management
- /api/v1/receipts - Receipt processing
- /api/v1/purchasing-analytics - Analytics

### Transfers & Allocations
- /api/v1/transfers - Transfer management
- /api/v1/emergency-transfers - Emergency workflows
- /api/v1/allocations - Allocation management
- /api/v1/allocation-optimizer - AI optimization

See [PROJECT_STATUS.md](./PROJECT_STATUS.md) for complete API documentation.

## Architecture

The system uses a layered architecture with:

- **Hono** for HTTP routing and middleware
- **Drizzle ORM** for type-safe database operations
- **D1** for SQLite-compatible database storage
- **Web Crypto API** for JWT operations
- **Zod** for request/response validation

## Security

- All database queries are automatically filtered by tenant_id
- JWT tokens include tenant and role claims
- Comprehensive audit logging for all security events
- Bcrypt password hashing with configurable rounds
- CORS protection and request validation

## Testing

The project includes both unit tests and property-based tests:

```bash
# Run all tests
npm test

# Run specific test file
npm test -- auth.test.ts
```

## License

MIT