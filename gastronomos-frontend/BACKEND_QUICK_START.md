# Pontal Stock Backend - Quick Start Guide

## What Was Implemented

Three new API route modules have been created to support Pontal Stock's core functionality:

### 1. Payment Schedules (`/api/v1/payment-schedules`)
- Create, read, update, delete payment schedules
- Mark payments as paid
- Send payment reminders
- Track payment status (PENDING, PAID, OVERDUE, CANCELLED)

### 2. Stock Alert Configurations (`/api/v1/stock-alert-configs`)
- Configure per-product stock alert thresholds
- Set thresholds as percentage or absolute quantity
- Enable/disable alerts per product
- Support for multiple locations

### 3. Dashboard Metrics (`/api/v1/dashboard`)
- Get total inventory value in reais
- List pending payments with due dates
- Get active stock alerts
- Calculate low stock counts

---

## Quick API Examples

### Create a Payment Schedule

```bash
curl -X POST http://localhost:8787/api/v1/payment-schedules \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: pontal-carapitangui" \
  -d '{
    "purchaseOrderId": "po-001",
    "dueDate": "2026-05-15T00:00:00Z",
    "amountCents": 500000,
    "reminderDays": 3,
    "notes": "Payment for vodka shipment"
  }'
```

### Configure Stock Alert

```bash
curl -X POST http://localhost:8787/api/v1/stock-alert-configs \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: pontal-carapitangui" \
  -d '{
    "productId": "prod-vodka",
    "locationId": "loc-main",
    "alertThresholdPercent": 20,
    "alertThresholdQuantity": 20,
    "isActive": true
  }'
```

### Get Dashboard Metrics

```bash
curl -X GET "http://localhost:8787/api/v1/dashboard/metrics?tenantId=pontal-carapitangui" \
  -H "X-Tenant-ID: pontal-carapitangui"
```

---

## Frontend Integration

The frontend API client has been extended with new methods:

```typescript
import { apiClient } from '@/lib/api';

// Payment Schedules
await apiClient.createPaymentSchedule(data);
await apiClient.getPaymentSchedules({ status: 'PENDING' });
await apiClient.markPaymentAsPaid(id, { paidAt: Date.now() });
await apiClient.sendPaymentReminder(id);

// Stock Alert Configs
await apiClient.createStockAlertConfig(data);
await apiClient.getStockAlertConfigs({ productId: 'prod-vodka' });
await apiClient.updateStockAlertConfig(id, { alertThresholdPercent: 25 });

// Dashboard
await apiClient.getDashboardMetrics();
await apiClient.getPaymentsDue({ daysAhead: 30 });
await apiClient.getInventoryValue();
await apiClient.getStockAlerts({ status: 'ACTIVE' });
```

---

## Files Modified/Created

### Backend
- ✅ `src/routes/payment-schedules.ts` - NEW
- ✅ `src/routes/stock-alert-configs.ts` - NEW
- ✅ `src/routes/dashboard-metrics.ts` - NEW
- ✅ `src/index.ts` - MODIFIED (added route registrations)

### Frontend
- ✅ `gastronomos-frontend/src/lib/api.ts` - MODIFIED (added API methods)
- ✅ `gastronomos-frontend/src/app/dashboard/page-pontal.tsx` - MODIFIED (integrated API calls)

### Documentation
- ✅ `gastronomos-frontend/PONTAL_STOCK_BACKEND_IMPLEMENTATION.md` - NEW
- ✅ `gastronomos-frontend/BACKEND_QUICK_START.md` - NEW (this file)

---

## Database Tables

The following tables are used (already defined in schema):

- `payment_schedules` - Stores payment schedule records
- `stock_alert_configs` - Stores alert configuration per product
- `stock_alerts` - Stores active alerts

---

## Testing the Implementation

### 1. Start the backend
```bash
npm run dev
```

### 2. Test payment schedules endpoint
```bash
# Create
curl -X POST http://localhost:8787/api/v1/payment-schedules \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: test-tenant" \
  -d '{"purchaseOrderId":"po-1","dueDate":"2026-05-15T00:00:00Z","amountCents":100000}'

# List
curl -X GET "http://localhost:8787/api/v1/payment-schedules?tenantId=test-tenant"
```

### 3. Test stock alert configs endpoint
```bash
# Create
curl -X POST http://localhost:8787/api/v1/stock-alert-configs \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: test-tenant" \
  -d '{"productId":"prod-1","locationId":"loc-1","alertThresholdPercent":20}'

# List
curl -X GET "http://localhost:8787/api/v1/stock-alert-configs?tenantId=test-tenant"
```

### 4. Test dashboard metrics endpoint
```bash
curl -X GET "http://localhost:8787/api/v1/dashboard/metrics?tenantId=test-tenant"
```

---

## Common Issues & Solutions

### Issue: "Tenant ID is required"
**Solution**: Make sure to include either:
- `X-Tenant-ID` header, OR
- `tenantId` query parameter

### Issue: "Payment schedule not found"
**Solution**: Verify the ID exists and belongs to your tenant

### Issue: API returns 500 error
**Solution**: Check the server logs for detailed error messages

---

## Next Steps

1. **Test the endpoints** using the examples above
2. **Integrate with frontend components** (PaymentScheduler, StockAlertConfig)
3. **Add notification system** for payment reminders
4. **Implement background jobs** for automatic alert generation
5. **Add WebSocket support** for real-time dashboard updates

---

## Support

For issues or questions:
1. Check the detailed documentation in `PONTAL_STOCK_BACKEND_IMPLEMENTATION.md`
2. Review the API specification in `PONTAL_STOCK_API_SPEC.md`
3. Check server logs for error details

---

**Last Updated**: April 2026  
**Version**: 1.0.0

