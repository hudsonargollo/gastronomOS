# Waiter Panel Components

Comprehensive waiter interface components for the Digital Menu, Kitchen Orchestration & Payment System.

## Components

### OrderDashboard
Main dashboard displaying active and delivered orders using Bento Box layout.

**Features:**
- Real-time order updates via WebSocket
- Active orders with full details
- Recently delivered orders summary
- Today's statistics
- Order selection for detailed view

**Props:**
- `waiterId`: string - Waiter's user ID
- `tenantId`: string - Tenant ID for multi-tenant isolation
- `onOrderSelect`: (order) => void - Callback when order is selected

### LiveCommissionTicker
Horizontal scrolling ticker showing real-time commission earnings.

**Features:**
- Real-time commission updates via WebSocket
- Today's total commission
- Order count
- Average commission per order
- Recent commission highlights

**Props:**
- `waiterId`: string - Waiter's user ID
- `tenantId`: string - Tenant ID

### TableManager
Table assignment and status management interface.

**Features:**
- View assigned tables
- See available tables
- Assign tables to waiter
- Table status indicators (Available, Occupied, Reserved)
- Guest count display

**Props:**
- `waiterId`: string - Waiter's user ID
- `tenantId`: string - Tenant ID
- `locationId`: string - Location ID for table filtering
- `onTableSelect`: (table) => void - Callback when table is selected

### OrderDetails
Detailed order view with modification capabilities.

**Features:**
- Full order information display
- Edit special instructions (order-level and item-level)
- Order state visualization with Status Ribbon
- Price breakdown (subtotal, tax, total)
- Order timeline information

**Props:**
- `order`: Order - Order object with full details
- `waiterId`: string - Waiter's user ID
- `tenantId`: string - Tenant ID
- `onUpdate`: () => void - Callback after successful update
- `onClose`: () => void - Callback to close detail view

### CustomerService
Customer service request management interface.

**Features:**
- Create service requests (Assistance, Bill, Complaint, Modification, Other)
- Priority levels (Low, Medium, High)
- Pending requests display
- Resolve requests
- Recently resolved history

**Props:**
- `waiterId`: string - Waiter's user ID
- `tenantId`: string - Tenant ID
- `locationId`: string - Location ID

## Design System Integration

All components use the Adaptive Gastronomy design system:

- **BentoBox**: Dashboard layout for OrderDashboard
- **AsymmetricCard**: Order and table display cards
- **StatusRibbon**: Order state visualization
- **CommissionTicker**: Live earnings display
- **Theme Integration**: Automatic tenant-specific theming

## Real-Time Features

Components integrate with WebSocket service for real-time updates:

- Order state changes
- Commission calculations
- Table status updates
- Customer service requests

## API Integration

Components interact with backend APIs:

- `/api/orders` - Order management
- `/api/commission-reports/live/:waiterId` - Live commission data
- `/api/tables` - Table management
- `/api/customer-requests` - Service requests

## Usage Example

```tsx
import {
  OrderDashboard,
  LiveCommissionTicker,
  TableManager,
  OrderDetails,
  CustomerService
} from '@/components/waiter-panel';

function WaiterPanelPage() {
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  return (
    <div>
      <LiveCommissionTicker
        waiterId="waiter-1"
        tenantId="tenant-1"
      />
      
      <OrderDashboard
        waiterId="waiter-1"
        tenantId="tenant-1"
        onOrderSelect={setSelectedOrder}
      />
      
      {selectedOrder && (
        <OrderDetails
          order={selectedOrder}
          waiterId="waiter-1"
          tenantId="tenant-1"
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
```

## Requirements Validation

### Requirement 1.3
✓ Waiter_Panel displays all orders assigned to waiter with current status

### Requirement 4.4
✓ Commission reports by waiter and time period via LiveCommissionTicker

### Requirement 13.1
✓ Real-time order state change broadcasts to all interfaces

### Requirement 13.3
✓ Payment status updates synchronized to Waiter_Panel

## Testing

Components support:
- Unit testing with React Testing Library
- Integration testing with mock WebSocket
- E2E testing with real backend

## Accessibility

All components follow WCAG guidelines:
- Keyboard navigation support
- Screen reader compatibility
- Color contrast compliance
- Focus management
