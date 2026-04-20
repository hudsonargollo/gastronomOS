# Pontal Stock - Backend Implementation Summary

## Overview

This document summarizes the backend API implementation for Pontal Stock, a specialized stock management system for Pontal Carapitangui. The implementation includes payment scheduling, stock alert configurations, and dashboard metrics.

---

## Implemented Endpoints

### 1. Payment Schedules API (`/api/v1/payment-schedules`)

**File**: `src/routes/payment-schedules.ts`

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/payment-schedules` | Create a new payment schedule |
| GET | `/api/v1/payment-schedules` | List all payment schedules with pagination |
| GET | `/api/v1/payment-schedules/:id` | Get payment schedule details |
| PUT | `/api/v1/payment-schedules/:id` | Update payment schedule |
| PUT | `/api/v1/payment-schedules/:id/mark-paid` | Mark payment as paid |
| PUT | `/api/v1/payment-schedules/:id/send-reminder` | Send payment reminder |
| DELETE | `/api/v1/payment-schedules/:id` | Delete payment schedule |

#### Request/Response Examples

**Create Payment Schedule**
```bash
POST /api/v1/payment-schedules
Content-Type: application/json
X-Tenant-ID: tenant-123

{
  "purchaseOrderId": "po-123",
  "dueDate": "2026-04-30T00:00:00Z",
  "amountCents": 275000,
  "reminderDays": 3,
  "notes": "First installment"
}
```

**Response (201)**
```json
{
  "success": true,
  "data": {
    "id": "ps-001",
    "purchaseOrderId": "po-123",
    "dueDate": "2026-04-30T00:00:00Z",
    "amountCents": 275000,
    "status": "PENDING",
    "reminderDays": 3,
    "reminderSentAt": null,
    "reminderCount": 0,
    "notes": "First installment",
    "createdAt": 1713571200,
    "updatedAt": 1713571200
  }
}
```

---

### 2. Stock Alert Configurations API (`/api/v1/stock-alert-configs`)

**File**: `src/routes/stock-alert-configs.ts`

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/stock-alert-configs` | Create stock alert configuration |
| GET | `/api/v1/stock-alert-configs` | List all configurations with pagination |
| GET | `/api/v1/stock-alert-configs/:id` | Get configuration details |
| PUT | `/api/v1/stock-alert-configs/:id` | Update configuration |
| DELETE | `/api/v1/stock-alert-configs/:id` | Delete configuration |

#### Request/Response Examples

**Create Stock Alert Config**
```bash
POST /api/v1/stock-alert-configs
Content-Type: application/json
X-Tenant-ID: tenant-123

{
  "productId": "prod-vodka",
  "locationId": "loc-main",
  "alertThresholdPercent": 20,
  "alertThresholdQuantity": 20,
  "isActive": true
}
```

**Response (201)**
```json
{
  "success": true,
  "data": {
    "id": "sac-001",
    "productId": "prod-vodka",
    "locationId": "loc-main",
    "alertThresholdPercent": 20,
    "alertThresholdQuantity": 20,
    "isActive": true,
    "createdAt": 1713571200,
    "updatedAt": 1713571200
  }
}
```

---

### 3. Dashboard Metrics API (`/api/v1/dashboard`)

**File**: `src/routes/dashboard-metrics.ts`

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/dashboard/metrics` | Get all dashboard metrics |
| GET | `/api/v1/dashboard/payments-due` | Get payments due in next N days |
| GET | `/api/v1/dashboard/inventory-value` | Get total inventory value |
| GET | `/api/v1/dashboard/stock-alerts` | Get active stock alerts |

#### Request/Response Examples

**Get Dashboard Metrics**
```bash
GET /api/v1/dashboard/metrics?tenantId=tenant-123
X-Tenant-ID: tenant-123
```

**Response (200)**
```json
{
  "success": true,
  "data": {
    "inventoryValue": {
      "totalValueCents": 125000000,
      "productCount": 247,
      "lowStockCount": 12
    },
    "paymentsDue": [
      {
        "id": "ps-001",
        "purchaseOrderId": "po-123",
        "amountCents": 45000000,
        "dueDate": "2026-04-25T00:00:00Z",
        "daysUntilDue": 5,
        "status": "PENDING"
      }
    ],
    "stockAlerts": [
      {
        "id": "sa-001",
        "productId": "prod-vodka",
        "locationId": "loc-main",
        "currentQuantity": 8,
        "thresholdQuantity": 40,
        "severity": "CRITICAL",
        "status": "ACTIVE"
      }
    ],
    "totalPaymentsPendingCents": 57500000
  }
}
```

---

## Frontend Integration

### API Client Methods

**File**: `gastronomos-frontend/src/lib/api.ts`

New methods added to `ApiClient` class:

```typescript
// Payment Schedules
async createPaymentSchedule(data: any)
async getPaymentSchedules(params?: PaginationParams & { status?: string })
async getPaymentSchedule(id: string)
async updatePaymentSchedule(id: string, data: any)
async markPaymentAsPaid(id: string, data: any)
async sendPaymentReminder(id: string)
async deletePaymentSchedule(id: string)

// Stock Alert Configs
async createStockAlertConfig(data: any)
async getStockAlertConfigs(params?: PaginationParams & { productId?: string; locationId?: string; isActive?: boolean })
async getStockAlertConfig(id: string)
async updateStockAlertConfig(id: string, data: any)
async deleteStockAlertConfig(id: string)

// Dashboard Metrics
async getDashboardMetrics(params?: { locationId?: string })
async getPaymentsDue(params?: { daysAhead?: number })
async getInventoryValue(params?: { locationId?: string })
async getStockAlerts(params?: PaginationParams & { status?: string; severity?: string })
```

### Dashboard Integration

**File**: `gastronomos-frontend/src/app/dashboard/page-pontal.tsx`

The dashboard now:
- Calls `apiClient.getDashboardMetrics()` to fetch real data
- Displays inventory value in reais (R$)
- Shows pending payments with due dates
- Lists active stock alerts with severity levels
- Falls back to mock data if API is unavailable

---

## Database Schema

### Payment Schedules Table

```sql
CREATE TABLE payment_schedules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  purchase_order_id TEXT NOT NULL,
  due_date INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  reminder_days INTEGER DEFAULT 3,
  reminder_sent_at INTEGER,
  reminder_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

### Stock Alert Configs Table

```sql
CREATE TABLE stock_alert_configs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  alert_threshold_percent INTEGER NOT NULL,
  alert_threshold_quantity INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  UNIQUE (tenant_id, product_id, location_id)
);
```

### Stock Alerts Table

```sql
CREATE TABLE stock_alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  current_quantity INTEGER NOT NULL,
  threshold_quantity INTEGER NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  acknowledged_by TEXT,
  acknowledged_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

---

## Route Registration

**File**: `src/index.ts`

Routes are registered as follows:

```typescript
app.route('/api/v1/payment-schedules', paymentSchedulesRoutes);
app.route('/api/v1/stock-alert-configs', stockAlertConfigsRoutes);
app.route('/api/v1/dashboard', dashboardMetricsRoutes);
```

---

## Authentication & Authorization

All endpoints require:
- **Tenant ID**: Passed via `X-Tenant-ID` header or `tenantId` query parameter
- **Authentication**: Bearer token in `Authorization` header (inherited from main app middleware)

---

## Error Handling

All endpoints return standardized error responses:

```json
{
  "error": "Error message",
  "errorCode": "ERROR_CODE"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `404`: Not Found
- `500`: Internal Server Error

---

## Testing

### Manual Testing with cURL

**Create Payment Schedule**
```bash
curl -X POST http://localhost:8787/api/v1/payment-schedules \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant-123" \
  -d '{
    "purchaseOrderId": "po-123",
    "dueDate": "2026-04-30T00:00:00Z",
    "amountCents": 275000,
    "reminderDays": 3,
    "notes": "First installment"
  }'
```

**List Payment Schedules**
```bash
curl -X GET "http://localhost:8787/api/v1/payment-schedules?tenantId=tenant-123&page=1&limit=20" \
  -H "X-Tenant-ID: tenant-123"
```

**Get Dashboard Metrics**
```bash
curl -X GET "http://localhost:8787/api/v1/dashboard/metrics?tenantId=tenant-123" \
  -H "X-Tenant-ID: tenant-123"
```

---

## Next Steps

### Immediate Tasks
1. ✅ Create payment schedule endpoints
2. ✅ Create stock alert config endpoints
3. ✅ Create dashboard metrics endpoints
4. ✅ Integrate with frontend API client
5. ✅ Update dashboard to use real API

### Future Enhancements
1. Implement automatic reminder notifications
2. Add webhook support for payment status updates
3. Create background jobs for alert generation
4. Add real-time WebSocket updates for dashboard
5. Implement audit logging for all operations
6. Add advanced filtering and search capabilities
7. Create analytics reports for payments and inventory

---

## Performance Considerations

- All list endpoints support pagination (default: 20 items per page)
- Indexes are created on frequently queried columns
- Tenant ID is always included in queries for data isolation
- Caching middleware is applied to GET requests

---

## Security

- All endpoints validate tenant ID
- Input validation using Zod schemas
- SQL injection prevention via Drizzle ORM
- Rate limiting applied to all API routes
- CORS headers configured for cross-origin requests

---

## Deployment

The backend is deployed as a Cloudflare Worker:

```bash
npm run deploy
```

Environment variables required:
- `JWT_SECRET`: Secret key for JWT tokens
- `DATABASE_URL`: D1 database connection string

---

**Version**: 1.0.0  
**Date**: April 2026  
**Status**: Ready for Testing

