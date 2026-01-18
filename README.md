# GastronomOS Authentication & Authorization

Multi-tenant authentication and authorization system for GastronomOS, built on Cloudflare Workers.

## Features

- **Multi-tenant architecture** with strict data isolation
- **Role-based access control** (ADMIN, MANAGER, STAFF)
- **Location-based access scoping** for multi-location restaurants
- **JWT-based authentication** using Web Crypto API
- **Comprehensive audit logging** for security events
- **Edge-deployed** on Cloudflare Workers for global performance

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

## API Documentation

### Authentication Endpoints

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/me` - Get current user info

### Tenant Management

- `POST /api/v1/tenants` - Create new tenant (admin only)
- `GET /api/v1/tenants/:id` - Get tenant info

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