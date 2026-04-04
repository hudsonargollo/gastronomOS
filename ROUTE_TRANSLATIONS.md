# GastronomOS - Route Translations (English → Portuguese)

## Overview
All application routes have been translated to Portuguese. Old English routes automatically redirect to the new Portuguese routes.

## Route Mapping

### Main Navigation Routes

| English Route | Portuguese Route | Description |
|---|---|---|
| `/dashboard` | `/painel` | Main dashboard |
| `/inventory` | `/estoque` | Inventory management |
| `/inventory/products` | `/estoque/produtos` | Product management |
| `/inventory/categories` | `/estoque/categorias` | Category management |
| `/inventory/stock` | `/estoque/niveis` | Stock levels |
| `/purchasing` | `/compras` | Purchasing management |
| `/purchasing/orders` | `/compras/pedidos` | Purchase orders |
| `/purchasing/suppliers` | `/compras/fornecedores` | Supplier management |
| `/purchasing/receipts` | `/compras/recibos` | Receipt processing |
| `/transfers` | `/transferencias` | Transfer management |
| `/transfers/active` | `/transferencias/ativas` | Active transfers |
| `/transfers/history` | `/transferencias/historico` | Transfer history |
| `/transfers/emergency` | `/transferencias/emergencia` | Emergency transfers |
| `/allocations` | `/alocacoes` | Resource allocation |
| `/allocations/current` | `/alocacoes/atuais` | Current allocations |
| `/allocations/templates` | `/alocacoes/modelos` | Allocation templates |
| `/allocations/unallocated` | `/alocacoes/nao-alocados` | Unallocated items |
| `/analytics` | `/analises` | Analytics & reports |
| `/analytics/performance` | `/analises/desempenho` | Performance metrics |
| `/analytics/costs` | `/analises/custos` | Cost analysis |
| `/analytics/variance` | `/analises/variacao` | Variance reports |
| `/locations` | `/locais` | Location management |
| `/users` | `/usuarios` | User management |
| `/settings` | `/configuracoes` | System settings |

### Specialized Interface Routes

| English Route | Portuguese Route | Description |
|---|---|---|
| `/waiter-panel` | `/painel-garcom` | Waiter interface |
| `/kitchen-display` | `/painel-cozinha` | Kitchen display system |
| `/kitchen-display/enhanced` | `/painel-cozinha/avancado` | Advanced kitchen display |
| `/cashier-panel` | `/painel-caixa` | Cashier interface |
| `/qr-menu` | `/menu-qr` | QR code menu |

## Redirect Behavior

All old English routes automatically redirect (HTTP 301 permanent redirect) to their Portuguese equivalents:
- `/dashboard` → `/painel`
- `/inventory/products` → `/estoque/produtos`
- etc.

This ensures backward compatibility and prevents broken links.

## Navigation Updates

The sidebar navigation component has been updated to use the new Portuguese routes. All navigation links now point to the Portuguese URLs.

## API Routes

API routes remain unchanged:
- `/api/menu` - Menu management
- `/api/orders` - Order management
- `/api/menu/[itemId]` - Individual menu items
- `/api/orders/[orderId]` - Individual orders
- `/api/orders/[orderId]/state` - Order state transitions

## Implementation Details

- All page files have been copied to new Portuguese route directories
- Sidebar navigation updated with Portuguese route paths
- Next.js redirects configured in `next.config.js`
- All pages use Portuguese translations via `useTranslations()` hook
- Theme system (`useTheme()`) applied consistently across all pages

## Build Status

✅ Build successful with 69 static pages (both English and Portuguese routes)
✅ All redirects configured and working
✅ No TypeScript or linting errors
✅ Ready for deployment
