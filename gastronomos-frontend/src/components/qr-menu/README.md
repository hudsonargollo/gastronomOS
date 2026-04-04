# QR Menu Interface

Customer-facing digital menu interface for the Digital Menu, Kitchen Orchestration & Payment System.

## Overview

The QR Menu interface provides a mobile-optimized, real-time menu browsing and ordering experience for restaurant customers. It integrates with the Adaptive Gastronomy design system and supports real-time inventory-based availability updates via WebSocket.

## Components

### MenuCatalog

Main menu display with category navigation using Floating Stack layout.

**Features:**
- Category-based navigation with Floating Stack
- Grid layout for menu items
- Real-time availability integration
- Empty state handling

**Usage:**
```tsx
<MenuCatalog
  categories={categories}
  items={menuItems}
  onItemSelect={handleItemSelect}
  availabilityMap={availabilityMap}
  isRealTimeConnected={isConnected}
/>
```

### MenuItem

Individual menu item display using Asymmetric Cards.

**Features:**
- Asymmetric card layout with optional image
- Real-time availability indicator
- Ingredient breakdown with Horizontal Insumos Bars
- Allergen display
- Quantity selector
- Add to cart functionality

**Usage:**
```tsx
<MenuItem
  item={menuItem}
  onSelect={handleSelect}
  realtimeAvailability={availability}
  isRealTimeConnected={true}
/>
```

### OrderCart

Shopping cart with real-time total calculation.

**Features:**
- Item list with quantity controls
- Real-time total calculation
- Item removal
- Empty state
- Checkout button

**Usage:**
```tsx
<OrderCart
  items={cartItems}
  onUpdateQuantity={handleUpdateQuantity}
  onRemoveItem={handleRemoveItem}
  onCheckout={handleCheckout}
/>
```

### OrderSubmission

Order confirmation and submission interface.

**Features:**
- Order summary display
- Customer information form (name, table number)
- Special instructions textarea
- Order submission with loading state
- Error handling

**Usage:**
```tsx
<OrderSubmission
  items={cartItems}
  totalAmount={total}
  onSubmit={handleSubmit}
  onCancel={handleCancel}
/>
```

### AvailabilityIndicator

Real-time availability status display.

**Features:**
- Availability badge (Available/Unavailable)
- Live connection indicator
- Reason display (out of stock, manual override, etc.)
- Preparation time or estimated availability time
- Real-time updates via WebSocket

**Usage:**
```tsx
<AvailabilityIndicator
  isAvailable={true}
  preparationTime={15}
  reason="OUT_OF_STOCK"
  estimatedAvailableAt={timestamp}
  isRealTimeConnected={true}
/>
```

## Real-Time Features

### WebSocket Integration

The QR Menu uses WebSocket for real-time updates:

**Connection:**
```typescript
import { getWebSocketService } from '@/lib/websocket';

const ws = getWebSocketService();
ws.connect();
```

**Message Types:**
- `menu:availability:update` - Single item availability update
- `menu:availability:bulk` - Bulk availability updates
- `menu:availability:request` - Request current availability status

### useMenuAvailability Hook

Custom hook for managing real-time menu availability:

```typescript
import { useMenuAvailability } from '@/hooks/use-menu-availability';

const {
  availabilityMap,
  getAvailability,
  isMenuItemAvailable,
  isConnected
} = useMenuAvailability();
```

**Features:**
- Automatic WebSocket connection
- Real-time availability updates
- Connection status tracking
- Availability lookup by menu item ID

## Design System Integration

### Layouts Used

- **Floating Stack**: Category navigation
- **Asymmetric Cards**: Menu item display
- **Horizontal Insumos Bars**: Ingredient breakdown

### Theme Integration

All components use semantic tokens from the Adaptive Gastronomy design system:

- `--token-surface-base` - Background
- `--token-surface-elevated` - Cards and elevated surfaces
- `--token-text-primary` - Primary text
- `--token-text-secondary` - Secondary text
- `--token-action-primary` - Primary actions
- `--token-border-subtle` - Borders

## API Integration

### Menu Items

```typescript
// Get menu items
const response = await apiClient.getMenuItems({
  isAvailable: true,
  categoryId: 'category-id'
});

// Get single menu item
const item = await apiClient.getMenuItem('item-id');
```

### Orders

```typescript
// Create order
const response = await apiClient.createOrder({
  tableNumber: '12',
  specialInstructions: 'No onions',
  items: [
    {
      menuItemId: 'item-id',
      quantity: 2,
      specialInstructions: 'Extra cheese'
    }
  ]
});
```

## Mobile Optimization

The QR Menu is fully optimized for mobile devices:

- Responsive grid layout (1 column on mobile, 2 on desktop)
- Touch-friendly controls
- Sticky header and cart
- Optimized image loading
- Mobile-first design approach

## Accessibility

- Semantic HTML structure
- ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader friendly
- High contrast support via design tokens

## Error Handling

- Network error handling with toast notifications
- Graceful degradation when WebSocket is unavailable
- Loading states for async operations
- Form validation with error messages

## Future Enhancements

- [ ] QR code generation for table-specific menus
- [ ] Order tracking page
- [ ] Push notifications for order status
- [ ] Multi-language support
- [ ] Dietary filter options
- [ ] Search functionality
- [ ] Favorites/saved items
- [ ] Order history for returning customers
