# Development Guide

## Setup

### 1. Clone Repository
```bash
git clone https://github.com/hudsonargollo/gastronomOS.git
cd gastronomOS
```

### 2. Install Dependencies
```bash
npm install
cd gastronomos-frontend
npm install
cd ..
```

### 3. Environment Configuration
```bash
cp .env.development .env.local
```

### 4. Database Setup
```bash
npm run db:migrate
```

## Running Development Server

### Terminal 1 - Backend (Wrangler)
```bash
wrangler dev
# Runs on http://localhost:8787
```

### Terminal 2 - Frontend (Next.js)
```bash
cd gastronomos-frontend
npm run dev
# Runs on http://localhost:3000
```

## Project Structure

### Backend (`src/`)
```
src/
├── routes/              # API endpoints
│   ├── orders.ts
│   ├── menu.ts
│   ├── payments.ts
│   └── ...
├── services/            # Business logic
│   ├── order-service.ts
│   ├── payment-service.ts
│   └── ...
├── middleware/          # Auth, logging, etc
├── types/               # TypeScript types
├── db/                  # Database schema
└── index.ts             # Worker entry point
```

### Frontend (`gastronomos-frontend/src/`)
```
src/
├── app/                 # Pages and layouts
│   ├── dashboard/
│   ├── qr-menu/
│   ├── waiter-panel/
│   ├── kitchen-display/
│   ├── cashier-panel/
│   └── ...
├── components/          # React components
│   ├── layout/
│   ├── dashboard/
│   ├── ui/
│   └── ...
├── hooks/               # Custom hooks
├── lib/                 # Utilities
├── contexts/            # React contexts
└── types/               # TypeScript types
```

## Common Tasks

### Add a New API Endpoint

1. Create route file in `src/routes/`
```typescript
export async function handleRequest(request: Request, env: Env) {
  if (request.method === 'GET') {
    return new Response(JSON.stringify({ data: [] }));
  }
  return new Response('Not Found', { status: 404 });
}
```

2. Register in `src/index.ts`
```typescript
import { handleRequest as handleNewRoute } from './routes/new-route';

router.post('/api/new-route', handleNewRoute);
```

### Add a New Page

1. Create directory in `gastronomos-frontend/src/app/new-page/`
2. Create `page.tsx`:
```typescript
export default function NewPage() {
  return <div>New Page</div>;
}
```

### Add a New Component

1. Create file in `gastronomos-frontend/src/components/`
2. Export component:
```typescript
export function MyComponent() {
  return <div>Component</div>;
}
```

## Testing

### Run Tests
```bash
npm run test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Specific Test
```bash
npm run test -- src/services/order-service.test.ts
```

### Property-Based Tests
```bash
npm run test:property
```

### Accessibility Tests
```bash
npm run test:accessibility
```

## Code Style

### Formatting
```bash
npm run format
```

### Linting
```bash
npm run lint
```

### Type Checking
```bash
npm run type-check
```

## Database

### Generate Migration
```bash
npm run db:generate
```

### Apply Migrations
```bash
npm run db:migrate
```

### Reset Database (Development Only)
```bash
npm run db:reset
```

### View Database
```bash
wrangler d1 execute gastronomos-dev --remote --command "SELECT * FROM orders;"
```

## Debugging

### Backend Logs
```bash
wrangler tail --config wrangler.toml
```

### Frontend Console
Open browser DevTools (F12) and check Console tab

### Database Queries
Enable query logging in `.env.local`:
```
DEBUG=drizzle:*
```

## Git Workflow

### Create Feature Branch
```bash
git checkout -b feature/my-feature
```

### Commit Changes
```bash
git add .
git commit -m "feat: add my feature"
```

### Push to Remote
```bash
git push origin feature/my-feature
```

### Create Pull Request
Go to GitHub and create PR

## Performance Tips

### Frontend
- Use React.memo for expensive components
- Implement code splitting with dynamic imports
- Optimize images with next/image
- Use CSS modules for scoped styles

### Backend
- Cache frequently accessed data
- Use database indexes
- Implement pagination for large datasets
- Monitor query performance

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 8787
lsof -ti:8787 | xargs kill -9
```

### Database Connection Issues
1. Check `.env.local` configuration
2. Verify database exists
3. Run migrations: `npm run db:migrate`

### Build Errors
1. Clear cache: `rm -rf .next dist`
2. Reinstall: `npm install`
3. Rebuild: `npm run build`

### TypeScript Errors
```bash
npm run type-check
```

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [TypeScript](https://www.typescriptlang.org/)

## Getting Help

1. Check existing issues on GitHub
2. Review specification documents
3. Check development logs
4. Ask team members
