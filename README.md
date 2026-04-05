# GastronomOS - Digital Menu, Kitchen Orchestration & Payment System

A comprehensive restaurant management system built with Next.js, Cloudflare Workers, and D1 Database.

## 🎯 System Overview

GastronomOS is a complete restaurant operations platform featuring:

- **QR Menu** - Customer-facing digital menu with real-time availability
- **Waiter Panel** - Order management and commission tracking
- **Kitchen Display** - Order preparation and tracking
- **Cashier Panel** - Payment processing and receipts
- **Dashboard** - Operations overview and analytics
- **Inventory Management** - Stock tracking and alerts
- **Purchasing** - Purchase orders with receipt scanning
- **Multi-location Support** - Manage multiple restaurant locations
- **Real-time Synchronization** - WebSocket-based live updates

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Wrangler CLI for Cloudflare deployment

### Installation

```bash
# Install dependencies
npm install

# Frontend setup
cd gastronomos-frontend
npm install
cd ..

# Environment setup
cp .env.development .env.local
```

### Development

```bash
# Start backend (Wrangler)
wrangler dev

# Start frontend (in another terminal)
cd gastronomos-frontend
npm run dev
```

### Production Deployment

```bash
# Build frontend
cd gastronomos-frontend
npm run build
cd ..

# Deploy to Wrangler
wrangler deploy --config wrangler.toml --env production
wrangler deploy --config wrangler-frontend.toml
```

## 📁 Project Structure

```
gastronomos/
├── src/                          # Backend (Cloudflare Workers)
│   ├── routes/                   # API routes
│   ├── services/                 # Business logic
│   ├── middleware/               # Authentication, logging
│   └── index.ts                  # Worker entry point
├── gastronomos-frontend/         # Frontend (Next.js)
│   ├── src/
│   │   ├── app/                  # Pages and layouts
│   │   ├── components/           # React components
│   │   ├── hooks/                # Custom hooks
│   │   ├── lib/                  # Utilities
│   │   └── contexts/             # React contexts
│   └── package.json
├── migrations/                   # Database migrations
├── .kiro/specs/                  # Feature specifications
├── wrangler.toml                 # Backend config
├── wrangler-frontend.toml        # Frontend config
└── package.json
```

## 🔧 Configuration

### Environment Variables

**Backend (.env.production)**
```
ENVIRONMENT=production
LOG_LEVEL=warn
CACHE_TTL=900
JWT_EXPIRY=28800
BCRYPT_ROUNDS=14
RATE_LIMIT_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=90
```

**Frontend (.env.production)**
```
NEXT_PUBLIC_API_URL=https://api.gastronomos.clubemkt.digital
NEXT_PUBLIC_WS_URL=wss://api.gastronomos.clubemkt.digital
```

## 📊 Database

Uses Cloudflare D1 (SQLite) with Drizzle ORM.

### Migrations

```bash
# Create migration
npm run db:generate

# Apply migrations
npm run db:migrate
```

## 🔐 Security

- JWT-based authentication
- Role-based access control (RBAC)
- Multi-tenant data isolation
- Rate limiting
- Audit logging
- BCRYPT password hashing

## 📈 Features

### Order Management
- Real-time order state machine (PLACED → PREPARING → READY → DELIVERED)
- Split payments support
- Commission tracking
- Order history and analytics

### Inventory
- Real-time stock tracking
- Low stock alerts
- Recipe-driven consumption
- Multi-location transfers

### Payments
- Mercado Pago integration
- Pix support
- Split payment processing
- Receipt generation

### Analytics
- Sales reports
- Commission reports
- Inventory analytics
- Performance metrics

## 🌐 Deployment

### Live URLs
- **Frontend**: https://gastronomos.clubemkt.digital
- **API**: https://api.gastronomos.clubemkt.digital
- **Workers Dev**: https://gastronomos-production.hudsonargollo2.workers.dev

### Deployment Platforms
- **Frontend**: Cloudflare Pages / Wrangler
- **Backend**: Cloudflare Workers
- **Database**: Cloudflare D1

## 📝 API Documentation

API endpoints are documented in the spec files:
- `.kiro/specs/digital-menu-kitchen-payment-system/design.md`

## 🧪 Testing

```bash
# Run tests
npm run test

# Run property-based tests
npm run test:property

# Run accessibility tests
npm run test:accessibility
```

## 📚 Documentation

- **Specifications**: `.kiro/specs/digital-menu-kitchen-payment-system/`
- **Requirements**: `.kiro/specs/digital-menu-kitchen-payment-system/requirements.md`
- **Design**: `.kiro/specs/digital-menu-kitchen-payment-system/design.md`
- **Tasks**: `.kiro/specs/digital-menu-kitchen-payment-system/tasks.md`

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests
4. Submit a pull request

## 📄 License

Proprietary - All rights reserved

## 👥 Team

Hudson Argollo - Lead Developer

## 📞 Support

For issues and questions, please refer to the specification documents or contact the development team.
