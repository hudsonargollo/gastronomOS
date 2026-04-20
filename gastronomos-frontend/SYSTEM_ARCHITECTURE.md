# Pontal Stock - System Architecture

## Overview

Pontal Stock is a specialized inventory and payment management system built on a modern, scalable architecture with clear separation of concerns.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Dashboard (page-pontal.tsx)                             │   │
│  │  - Displays inventory value                              │   │
│  │  - Shows pending payments                                │   │
│  │  - Lists stock alerts                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Components                                              │   │
│  │  - PaymentScheduler                                      │   │
│  │  - StockAlertConfig                                      │   │
│  │  - MetricsCard                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  API Client (api.ts)                                     │   │
│  │  - Payment schedule methods                              │   │
│  │  - Stock alert config methods                            │   │
│  │  - Dashboard metrics methods                             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP/REST
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Cloudflare Worker)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  API Routes (index.ts)                                   │   │
│  │  - /api/v1/payment-schedules                             │   │
│  │  - /api/v1/stock-alert-configs                           │   │
│  │  - /api/v1/dashboard                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Route Handlers                                          │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ payment-schedules.ts (7 endpoints)                │  │   │
│  │  │ - POST /payment-schedules                         │  │   │
│  │  │ - GET /payment-schedules                          │  │   │
│  │  │ - GET /payment-schedules/:id                      │  │   │
│  │  │ - PUT /payment-schedules/:id                      │  │   │
│  │  │ - PUT /payment-schedules/:id/mark-paid            │  │   │
│  │  │ - PUT /payment-schedules/:id/send-reminder        │  │   │
│  │  │ - DELETE /payment-schedules/:id                   │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ stock-alert-configs.ts (5 endpoints)              │  │   │
│  │  │ - POST /stock-alert-configs                       │  │   │
│  │  │ - GET /stock-alert-configs                        │  │   │
│  │  │ - GET /stock-alert-configs/:id                    │  │   │
│  │  │ - PUT /stock-alert-configs/:id                    │  │   │
│  │  │ - DELETE /stock-alert-configs/:id                 │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ dashboard-metrics.ts (4 endpoints)                │  │   │
│  │  │ - GET /dashboard/metrics                          │  │   │
│  │  │ - GET /dashboard/payments-due                     │  │   │
│  │  │ - GET /dashboard/inventory-value                  │  │   │
│  │  │ - GET /dashboard/stock-alerts                     │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Middleware                                              │   │
│  │  - Authentication (JWT)                                 │   │
│  │  - Tenant context injection                             │   │
│  │  - Rate limiting                                        │   │
│  │  - Input validation (Zod)                               │   │
│  │  - Caching                                              │   │
│  │  - Error handling                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Database Access (Drizzle ORM)                           │   │
│  │  - Query builder                                        │   │
│  │  - Type safety                                          │   │
│  │  - Migration support                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓ SQL
┌─────────────────────────────────────────────────────────────────┐
│                    Database (D1 SQLite)                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Tables                                                  │   │
│  │  - payment_schedules                                     │   │
│  │  - stock_alert_configs                                   │   │
│  │  - stock_alerts                                          │   │
│  │  - inventory_items                                       │   │
│  │  - tenants (multi-tenancy)                               │   │
│  │  - users                                                 │   │
│  │  - products                                              │   │
│  │  - locations                                             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Payment Schedule Creation Flow

```
User Input (Frontend)
    ↓
PaymentScheduler Component
    ↓
apiClient.createPaymentSchedule(data)
    ↓
POST /api/v1/payment-schedules
    ↓
Middleware (Auth, Validation, Tenant)
    ↓
Route Handler (payment-schedules.ts)
    ↓
Drizzle ORM Insert
    ↓
D1 Database
    ↓
Response (201 Created)
    ↓
Frontend State Update
    ↓
UI Refresh
```

### Dashboard Metrics Flow

```
Dashboard Component Mounts
    ↓
useEffect Hook
    ↓
apiClient.getDashboardMetrics()
    ↓
GET /api/v1/dashboard/metrics
    ↓
Middleware (Auth, Tenant)
    ↓
Route Handler (dashboard-metrics.ts)
    ↓
Multiple Queries:
  - inventoryItems (sum values)
  - paymentSchedules (filter PENDING)
  - stockAlerts (filter ACTIVE)
    ↓
Aggregate Results
    ↓
Response (200 OK)
    ↓
Frontend State Update
    ↓
Dashboard Render
```

---

## Component Hierarchy

```
App
├── MainLayout
│   └── PontalDashboard
│       ├── Header
│       ├── MetricsCards
│       │   ├── InventoryValueCard
│       │   ├── PaymentsDueCard
│       │   └── StockAlertsCard
│       ├── PaymentsList
│       │   └── PaymentItem
│       ├── StockAlertsList
│       │   └── AlertItem
│       └── QuickActions
│           ├── NewPurchaseButton
│           ├── ConfigureAlertsButton
│           └── ViewPaymentsButton
```

---

## Database Schema

### Payment Schedules Table

```sql
payment_schedules {
  id: TEXT PRIMARY KEY
  tenant_id: TEXT (FK → tenants)
  purchase_order_id: TEXT
  due_date: INTEGER (Unix timestamp)
  amount_cents: INTEGER
  status: TEXT (PENDING|PAID|OVERDUE|CANCELLED)
  reminder_days: INTEGER (0-30)
  reminder_sent_at: INTEGER (nullable)
  reminder_count: INTEGER
  notes: TEXT (nullable)
  created_at: INTEGER
  updated_at: INTEGER
}

Indexes:
- tenant_id
- purchase_order_id
- status
- due_date
```

### Stock Alert Configs Table

```sql
stock_alert_configs {
  id: TEXT PRIMARY KEY
  tenant_id: TEXT (FK → tenants)
  product_id: TEXT (FK → products)
  location_id: TEXT (FK → locations)
  alert_threshold_percent: INTEGER (1-100)
  alert_threshold_quantity: INTEGER (nullable)
  is_active: INTEGER (boolean)
  created_at: INTEGER
  updated_at: INTEGER
}

Indexes:
- tenant_id
- product_id
- location_id
- (tenant_id, product_id, location_id) UNIQUE
```

### Stock Alerts Table

```sql
stock_alerts {
  id: TEXT PRIMARY KEY
  tenant_id: TEXT (FK → tenants)
  product_id: TEXT (FK → products)
  location_id: TEXT (FK → locations)
  current_quantity: INTEGER
  threshold_quantity: INTEGER
  severity: TEXT (LOW|MEDIUM|HIGH|CRITICAL)
  status: TEXT (ACTIVE|ACKNOWLEDGED|RESOLVED)
  acknowledged_by: TEXT (nullable)
  acknowledged_at: INTEGER (nullable)
  created_at: INTEGER
  updated_at: INTEGER
}

Indexes:
- tenant_id
- product_id
- location_id
- status
- severity
```

---

## API Request/Response Cycle

### Request

```
HTTP Request
├── Method: POST/GET/PUT/DELETE
├── Path: /api/v1/payment-schedules
├── Headers:
│   ├── Content-Type: application/json
│   ├── Authorization: Bearer <token>
│   └── X-Tenant-ID: <tenant-id>
└── Body: { /* JSON data */ }
```

### Processing

```
1. Global Error Handler
2. Service Initialization
3. API Versioning Detection
4. Request Monitoring
5. Input Validation & Sanitization
6. Caching Check (GET only)
7. Rate Limiting
8. JWT Authentication
9. Tenant Context Injection
10. Route Handler Execution
11. Database Query
12. Response Transformation
13. Caching (if applicable)
14. Security Headers
```

### Response

```
HTTP Response
├── Status: 200/201/400/404/500
├── Headers:
│   ├── Content-Type: application/json
│   ├── X-RateLimit-Limit: 100
│   ├── X-RateLimit-Remaining: 95
│   └── X-Content-Type-Options: nosniff
└── Body: {
    "success": true/false,
    "data": { /* response data */ },
    "error": "error message" (if applicable)
  }
```

---

## Multi-Tenancy Architecture

```
Tenant A (pontal-carapitangui)
├── Users
├── Locations
├── Products
├── Payment Schedules
├── Stock Alert Configs
└── Stock Alerts

Tenant B (other-business)
├── Users
├── Locations
├── Products
├── Payment Schedules
├── Stock Alert Configs
└── Stock Alerts

Data Isolation:
- All queries filtered by tenant_id
- No cross-tenant data access
- Unique constraints per tenant
```

---

## Security Architecture

```
Request
  ↓
CORS Validation
  ↓
Rate Limiting
  ↓
JWT Authentication
  ↓
Tenant Validation
  ↓
Input Validation (Zod)
  ↓
SQL Injection Prevention (Drizzle ORM)
  ↓
Authorization Check
  ↓
Business Logic
  ↓
Database Query
  ↓
Response Sanitization
  ↓
Security Headers
  ↓
Response
```

---

## Scalability Considerations

### Horizontal Scaling
- Stateless API design
- Database connection pooling
- Caching layer (Redis-ready)
- Load balancing support

### Vertical Scaling
- Pagination for large datasets
- Database indexes for performance
- Query optimization
- Memory-efficient data structures

### Performance Optimization
- Response caching (5 minutes default)
- Database query optimization
- Lazy loading on frontend
- Pagination (default 20, max 100)

---

## Error Handling Strategy

```
Error Occurs
  ↓
Error Type Detection
  ├── Validation Error → 400 Bad Request
  ├── Authentication Error → 401 Unauthorized
  ├── Authorization Error → 403 Forbidden
  ├── Not Found Error → 404 Not Found
  ├── Conflict Error → 409 Conflict
  └── Server Error → 500 Internal Server Error
  ↓
Error Logging
  ↓
Error Response
  ↓
Frontend Error Handling
  ├── Display User-Friendly Message
  ├── Log to Console
  └── Retry Logic (if applicable)
```

---

## Deployment Architecture

```
Development
├── Local Backend (npm run dev)
├── Local Database (SQLite)
└── Local Frontend (npm run dev)

Production
├── Cloudflare Worker (Backend)
├── D1 Database (SQLite)
├── Vercel/Netlify (Frontend)
└── CDN (Static Assets)
```

---

## Technology Stack

### Frontend
- **Framework**: Next.js 14+
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **HTTP Client**: Fetch API
- **State Management**: React Hooks

### Backend
- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Language**: TypeScript
- **ORM**: Drizzle ORM
- **Validation**: Zod
- **Database**: D1 (SQLite)

### Infrastructure
- **Hosting**: Cloudflare
- **Database**: D1 (SQLite)
- **CDN**: Cloudflare CDN
- **Monitoring**: Built-in logging

---

## Future Architecture Enhancements

### Phase 2
- Message Queue (for async jobs)
- WebSocket Server (real-time updates)
- Cache Layer (Redis)
- Search Engine (Elasticsearch)

### Phase 3
- Microservices (if needed)
- Event Streaming (Kafka)
- Analytics Engine
- Machine Learning (forecasting)

---

## Monitoring & Observability

```
Metrics Collected:
├── Request Count
├── Response Time
├── Error Rate
├── Cache Hit Rate
├── Database Query Time
└── Rate Limit Usage

Logs:
├── Request/Response
├── Errors
├── Database Queries
├── Authentication Events
└── Business Events
```

---

## Version Information

- **Architecture Version**: 1.0.0
- **Last Updated**: April 2026
- **Status**: Production Ready

---

This architecture provides a solid foundation for Pontal Stock with room for growth and optimization as the system scales.

