# Kitchen Display System

The Kitchen Display System is a comprehensive kitchen-facing interface for managing order preparation and workflow. It integrates with the Order State Engine, Recipe Engine, and real-time WebSocket service to provide a complete kitchen management solution.

## Features

### Core Components (Task 12.1)

#### 1. **OrderQueue**
- Priority-based order sorting (state → priority → time)
- Vertical Status Ribbons for visual workflow tracking
- Compact order cards with key information
- Overdue order highlighting
- Special instructions display
- One-touch state transition controls

#### 2. **RecipeDisplay**
- Detailed order information with table assignment
- Item-level recipe details with ingredients
- Horizontal Insumos Bars for ingredient visualization
- Preparation instructions display
- Special instructions highlighting
- State transition controls

#### 3. **TimerManager**
- Real-time elapsed time tracking
- Progress bar with color-coded status
- Time remaining calculation
- Overdue alerts with visual indicators
- Item-level preparation time display
- Order state information

#### 4. **StateControls**
- One-touch state transitions (PLACED → PREPARING → READY)
- Context-aware button text and icons
- Compact and full-size variants
- Visual feedback for current state

### Workflow Features (Task 12.3)

#### 5. **OrderProgressTracker**
- Individual item completion tracking
- Overall order progress visualization
- Checkbox-based item status updates
- Expandable recipe details per item
- Quick actions (Start All, Complete All)
- Real-time progress percentage

#### 6. **BatchOrderProcessor**
- Multi-order selection with checkboxes
- State-based filtering (Placed, Preparing, Ready)
- Batch state transitions
- Selection management (Select All, Clear, By State)
- Validation for compatible state transitions
- Order count badges

#### 7. **StaffAssignment**
- Kitchen staff assignment to orders
- Staff workload visualization
- Active/inactive staff status
- Real-time order count per staff member
- Workload statistics (active staff, total orders, average load)
- Reassignment capability

## Architecture

### Data Flow

```
WebSocket Service
    ↓
Kitchen Dashboard
    ↓
├── OrderQueue (displays orders)
├── RecipeDisplay (shows selected order details)
├── TimerManager (tracks preparation time)
├── OrderProgressTracker (item-level tracking)
├── BatchOrderProcessor (multi-order operations)
└── StaffAssignment (staff management)
```

### State Management

- **Orders**: Fetched from `/api/orders?states=PLACED,PREPARING,READY`
- **Real-time Updates**: WebSocket events (`order:update`, `order:new`)
- **Priority Sorting**: State → Priority → Creation Time
- **Selected Order**: Maintained in dashboard state

### API Integration

#### Order State Transitions
```typescript
POST /api/orders/:orderId/transition
Body: { toState: 'PREPARING' | 'READY' }
```

#### Batch State Transitions
```typescript
POST /api/orders/batch-transition
Body: { orderIds: string[], toState: string }
```

#### Item Status Updates
```typescript
PATCH /api/order-items/:itemId/status
Body: { status: 'PENDING' | 'PREPARING' | 'READY' }
```

#### Staff Assignment
```typescript
POST /api/orders/:orderId/assign-staff
Body: { staffId: string }
```

## Design System Integration

### Adaptive Gastronomy Components Used

- **Vertical Status Ribbons**: Order workflow visualization (PLACED → PREPARING → READY)
- **Horizontal Insumos Bars**: Ingredient composition display
- **Sketch & Wire Icons**: Consistent iconography throughout
- **Theme-aware Components**: Full theming support via ThemeProvider and BrandingContext

### Layout Patterns

- **Bento Box**: Dashboard grid layout
- **Asymmetric Cards**: Order cards with varied content
- **Floating Stack**: Navigation and filtering

## Usage

### Basic Kitchen Display

```tsx
import { KitchenDashboard } from '@/components/kitchen-display';

export default function KitchenDisplayPage() {
  return <KitchenDashboard />;
}
```

### Enhanced Kitchen Display (Full Features)

```tsx
// Available at /kitchen-display/enhanced
// Includes all workflow features in tabbed interface
```

### Individual Components

```tsx
import {
  OrderQueue,
  RecipeDisplay,
  TimerManager,
  OrderProgressTracker,
  BatchOrderProcessor,
  StaffAssignment
} from '@/components/kitchen-display';

// Use components individually as needed
```

## Requirements Mapping

### Requirement 1.4: Kitchen Display System Integration
- ✅ Kitchen-facing interface showing order preparation status
- ✅ Real-time order updates via WebSocket
- ✅ Order details with items, quantities, and special instructions

### Requirement 11.1: Order Details Display
- ✅ Complete order information with items and quantities
- ✅ Special instructions highlighting
- ✅ Recipe details with ingredients and instructions

### Requirement 11.2: Priority Sorting
- ✅ Orders sorted by state, priority, and time
- ✅ Visual workflow tracking with Status Ribbons
- ✅ Overdue order highlighting

### Requirement 11.3: Order Progress Tracking
- ✅ Item-level completion marking
- ✅ Overall order progress visualization
- ✅ Batch order processing capabilities

### Requirement 11.4: Preparation Time Alerts
- ✅ Real-time timer with elapsed time
- ✅ Progress bar with color-coded status
- ✅ Overdue alerts and highlighting
- ✅ Kitchen staff assignment and tracking

### Requirement 11.5: One-Touch State Transitions
- ✅ Single-click state transitions
- ✅ Context-aware controls
- ✅ Visual feedback for current state

## Testing

### Component Testing
```bash
npm test src/components/kitchen-display
```

### Integration Testing
- Test WebSocket connectivity
- Verify state transitions
- Validate batch operations
- Check staff assignment

## Performance Considerations

- **Real-time Updates**: Efficient WebSocket message handling
- **Order Sorting**: Memoized sorting function
- **Component Rendering**: React.memo for expensive components
- **List Virtualization**: Consider for large order queues (100+ orders)

## Future Enhancements

- [ ] Order filtering by table/waiter
- [ ] Kitchen station-specific views
- [ ] Voice alerts for new orders
- [ ] Print integration for order tickets
- [ ] Analytics dashboard for kitchen performance
- [ ] Multi-language support
- [ ] Accessibility improvements (keyboard navigation, screen reader support)

## Related Documentation

- [Design System Documentation](../design-system/README.md)
- [Order State Engine](../../../../src/services/order-state-engine.ts)
- [Recipe Engine](../../../../src/services/recipe-engine.ts)
- [WebSocket Service](../../lib/websocket.ts)
