# GastronomOS - Project Structure

## 📁 Directory Organization

```
gastronomOS/
├── 📄 Documentation
│   ├── README.md                      # Project overview and quick start
│   ├── PROJECT_STATUS.md              # Current features and deployment status
│   ├── PROJECT_STRUCTURE.md           # This file - project organization
│   ├── DEPLOYMENT.md                  # Deployment guide for all environments
│   └── DEPLOYMENT_CHECKLIST.md        # Production deployment checklist
│
├── 🔧 Configuration
│   ├── package.json                   # Backend dependencies and scripts
│   ├── tsconfig.json                  # TypeScript configuration
│   ├── wrangler.toml                  # Cloudflare Workers configuration
│   ├── wrangler-frontend.toml         # Frontend worker configuration
│   ├── drizzle.config.ts              # Database ORM configuration
│   └── vitest.config.ts               # Test configuration
│
├── 🗄️ Database
│   └── migrations/                    # D1 database migrations
│
├── 💻 Backend Source (src/)
│   ├── index.ts                       # Main application entry point
│   ├── config/                        # Configuration modules
│   ├── db/                            # Database schema and utilities
│   ├── middleware/                    # Express-like middleware
│   ├── routes/                        # API route handlers (40+ files)
│   ├── schemas/                       # Zod validation schemas
│   ├── services/                      # Business logic services
│   ├── types/                         # TypeScript type definitions
│   └── utils/                         # Utility functions
│
├── 🧪 Tests (test/)
│   └── *.test.ts                      # Unit and integration tests
│
├── 🚀 Scripts (scripts/)
│   ├── clean.js                       # Project cleanup script
│   ├── deploy.js                      # Multi-environment deployment
│   ├── deploy-production.ps1          # Windows production deployment
│   ├── deploy-production.sh           # Unix production deployment
│   ├── deploy-migrations.js           # Database migration deployment
│   └── setup-secrets.js               # Secret configuration helper
│
├── 🎨 Frontend (gastronomos-frontend/)
│   ├── package.json                   # Frontend dependencies
│   ├── next.config.ts                 # Next.js configuration
│   ├── tailwind.config.js             # Tailwind CSS configuration
│   ├── components.json                # shadcn/ui configuration
│   ├── public/                        # Static assets
│   └── src/
│       ├── app/                       # Next.js 13+ app directory
│       │   ├── layout.tsx             # Root layout
│       │   ├── page.tsx               # Home page
│       │   ├── dashboard/             # Dashboard pages
│       │   ├── inventory/             # Inventory management
│       │   ├── purchasing/            # Purchasing system
│       │   ├── transfers/             # Transfer management
│       │   ├── allocations/           # Allocation system
│       │   ├── analytics/             # Analytics dashboard
│       │   ├── locations/             # Location management
│       │   ├── users/                 # User management
│       │   └── settings/              # Settings pages
│       └── components/
│           ├── ui/                    # Reusable UI components
│           ├── layout/                # Layout components
│           ├── dashboard/             # Dashboard-specific components
│           ├── icons/                 # Icon components
│           └── examples/              # Example implementations
│
├── 🔨 Build Output (gitignored)
│   ├── dist/                          # Compiled backend TypeScript
│   ├── .wrangler/                     # Wrangler temporary files
│   ├── gastronomos-frontend/.next/    # Next.js build cache
│   └── gastronomos-frontend/out/      # Next.js static export
│
└── 🔐 IDE & Git
    ├── .git/                          # Git repository
    ├── .gitignore                     # Git ignore rules
    ├── .vscode/                       # VS Code settings
    └── .kiro/                         # Kiro AI settings
```

## 🗂️ Key Directories Explained

### Backend Routes (`src/routes/`)
The routes directory contains 40+ API endpoint handlers organized by feature:

**Core Resources**
- `auth.ts` - Authentication endpoints
- `tenants.ts` - Multi-tenant management
- `users.ts` - User management
- `locations.ts` - Location management
- `categories.ts` - Product categories
- `products.ts` - Product catalog
- `inventory.ts` - Inventory tracking

**Purchasing System**
- `suppliers.ts` - Supplier management
- `purchase-orders.ts` - PO creation and management
- `receipts.ts` - Receipt processing
- `secure-receipts.ts` - Secure receipt handling
- `quality-control.ts` - Quality control workflows
- `price-history.ts` - Price tracking
- `purchasing-analytics.ts` - Purchasing insights
- `variance-reports.ts` - Variance analysis
- `po-integration.ts` - PO system integration
- `po-allocation-integration.ts` - PO-Allocation bridge

**Transfer System**
- `transfers.ts` - Transfer management
- `transfer-notifications.ts` - Transfer alerts
- `emergency-transfers.ts` - Emergency workflows
- `transfer-analytics.ts` - Transfer insights
- `transfer-optimization.ts` - Transfer optimization
- `transfer-intelligence.ts` - AI-powered suggestions

**Allocation System**
- `allocations.ts` - Allocation management
- `allocation-audit.ts` - Allocation audit trails
- `allocation-analytics.ts` - Allocation insights
- `allocation-optimizer.ts` - AI optimization
- `allocation-transfer-integration.ts` - Allocation-Transfer bridge
- `unallocated-inventory.ts` - Unallocated tracking

**Analytics**
- `receipt-analytics.ts` - Receipt insights
- `audit.ts` - System audit logs

### Backend Services (`src/services/`)
Business logic and system services:
- `jwt.ts` - JWT authentication
- `api-versioning.ts` - API version management
- `api-monitoring.ts` - Performance monitoring
- `caching.ts` - Multi-tier caching
- `comprehensive-audit.ts` - Audit logging
- `data-sanitization.ts` - Input validation
- `receipt-processor.ts` - Receipt OCR processing
- `scheduled-jobs.ts` - Background jobs
- `webhook-system.ts` - Webhook management

### Frontend Pages (`gastronomos-frontend/src/app/`)
Next.js 13+ app directory structure:
- Each directory represents a route
- `page.tsx` files are the route components
- Nested directories create nested routes
- `layout.tsx` provides shared layouts

### Frontend Components (`gastronomos-frontend/src/components/`)
Reusable React components:
- `ui/` - Base UI components (buttons, inputs, dialogs, etc.)
- `layout/` - Layout components (sidebar, header, etc.)
- `dashboard/` - Dashboard-specific widgets
- `icons/` - Custom icon components
- `examples/` - Implementation examples

## 🔄 Build Artifacts (Gitignored)

These directories are generated during build and should not be committed:

- `dist/` - Compiled TypeScript output for backend
- `.wrangler/` - Wrangler CLI temporary files and state
- `gastronomos-frontend/.next/` - Next.js build cache
- `gastronomos-frontend/out/` - Next.js static export
- `node_modules/` - NPM dependencies
- `coverage/` - Test coverage reports
- `*.tsbuildinfo` - TypeScript incremental build info

**Clean build artifacts**: `npm run clean`

## 📦 Package Management

### Backend (`package.json`)
- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Database**: Drizzle ORM + D1
- **Testing**: Vitest + fast-check

### Frontend (`gastronomos-frontend/package.json`)
- **Framework**: Next.js 16
- **UI**: Radix UI + Tailwind CSS
- **Forms**: React Hook Form + Zod
- **Data**: SWR

## 🚀 Common Commands

### Development
```bash
# Backend
npm run dev              # Start backend dev server
npm run build            # Build backend
npm test                 # Run tests

# Frontend
cd gastronomos-frontend
npm run dev              # Start frontend dev server
npm run build            # Build frontend
```

### Deployment
```bash
npm run deploy:dev       # Deploy to development
npm run deploy:staging   # Deploy to staging
npm run deploy:prod      # Deploy to production
```

### Database
```bash
npm run db:generate      # Generate migrations
npm run db:migrate:prod  # Apply migrations to production
npm run db:studio        # Open Drizzle Studio
```

### Maintenance
```bash
npm run clean            # Clean build artifacts
npm run generate:jwt-secret  # Generate JWT secret
```

## 🔐 Environment Files

Environment-specific configuration:
- `.env` - Local development (gitignored)
- `wrangler.toml` - Cloudflare Workers config (committed)
- Secrets managed via `wrangler secret put`

## 📝 Documentation Files

- `README.md` - Quick start and overview
- `PROJECT_STATUS.md` - Current features and deployment status
- `PROJECT_STRUCTURE.md` - This file
- `DEPLOYMENT.md` - Comprehensive deployment guide
- `DEPLOYMENT_CHECKLIST.md` - Production deployment checklist

## 🎯 Best Practices

1. **Keep build artifacts out of git** - Use `.gitignore`
2. **Run `npm run clean` before major builds** - Prevents stale artifacts
3. **Use TypeScript strictly** - All source files should be `.ts` or `.tsx`
4. **Follow the route organization** - Keep related endpoints together
5. **Test before deploying** - Run `npm test` before production deploys
6. **Document new features** - Update PROJECT_STATUS.md
7. **Use the deployment scripts** - Don't deploy manually

## 🔍 Finding Files

### Backend API Endpoints
All in `src/routes/` - file name matches the resource

### Frontend Pages
All in `gastronomos-frontend/src/app/` - directory structure matches URL

### UI Components
All in `gastronomos-frontend/src/components/ui/`

### Business Logic
All in `src/services/`

### Database Schema
All in `src/db/schema.ts`

### Tests
Co-located with source files or in `test/` directory
