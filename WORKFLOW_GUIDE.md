# Complete Workflow Guide: Menu to Order Management

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GastronomOS Frontend                      │
│              (Cloudflare Pages - Next.js)                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │  Menu Manager    │  │  Waiter Panel    │                 │
│  │  /inventory/     │  │  /waiter-panel   │                 │
│  │  products        │  │                  │                 │
│  └────────┬─────────┘  └────────┬─────────┘                 │
│           │                     │                            │
│           └──────────┬──────────┘                            │
│                      │                                       │
│           ┌──────────▼──────────┐                           │
│           │   API Proxy Routes  │                           │
│           │  /api/menu/*        │                           │
│           │  /api/orders/*      │                           │
│           └──────────┬──────────┘                           │
│                      │                                       │
└──────────────────────┼───────────────────────────────────────┘
                       │ HTTPS
                       │
┌──────────────────────▼───────────────────────────────────────┐
│              GastronomOS Backend API                          │
│         (Cloudflare Workers + D1 Database)                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │  Menu Routes     │  │  Order Routes    │                 │
│  │  /menu           │  │  /orders         │                 │
│  │  - GET (list)    │  │  - GET (list)    │                 │
│  │  - POST (create) │  │  - POST (create) │                 │
│  │  - PUT (update)  │  │  - PUT (update)  │                 │
│  │  - DELETE        │  │  - POST /state   │                 │
│  │  - PATCH /avail  │  │                  │                 │
│  └────────┬─────────┘  └────────┬─────────┘                 │
│           │                     │                            │
│           └──────────┬──────────┘                            │
│                      │                                       │
│           ┌──────────▼──────────┐                           │
│           │   D1 Database       │                           │
│           │  - menu_items       │                           │
│           │  - orders           │                           │
│           │  - order_items      │                           │
│           │  - recipes          │                           │
│           │  - categories       │                           │
│           └─────────────────────┘                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## User Workflows

### Workflow 1: Restaurant Admin - Setting Up Menu

**Goal:** Create and manage restaurant menu items

**Steps:**

1. **Login**
   - Navigate to login page
   - Enter credentials (demo@gastronomos.com / demo123)
   - Get JWT token stored in localStorage

2. **Access Menu Manager**
   - Navigate to `/inventory/products`
   - See list of existing menu items (if any)

3. **Create Menu Item**
   - Click "Add Menu Item" button
   - Fill form:
     ```
     Name: "Pasta Carbonara"
     Price: "45.50"
     Description: "Classic Italian pasta with bacon and cream"
     Category: "Pasta"
     Prep Time: "15" minutes
     Image: "https://example.com/pasta.jpg"
     ```
   - Click "Create Item"
   - Item appears in grid

4. **Edit Menu Item**
   - Click "Edit" on any item
   - Modify fields
   - Click "Update Item"
   - Changes saved immediately

5. **Manage Availability**
   - Click "Hide" to remove from menu (out of stock)
   - Click "Show" to add back to menu
   - Changes broadcast to all clients

6. **Delete Menu Item**
   - Click "Delete" on item
   - Confirm deletion
   - Item soft-deleted (not shown in menu)

**Data Flow:**
```
Admin Form Input
    ↓
Frontend Validation
    ↓
POST /api/menu (with JWT token)
    ↓
Next.js API Route
    ↓
Backend /menu endpoint
    ↓
D1 Database (insert/update/delete)
    ↓
Response with created/updated item
    ↓
Frontend updates UI
    ↓
Toast notification
```

### Workflow 2: Waiter - Managing Orders

**Goal:** Track and manage customer orders

**Steps:**

1. **Login**
   - Same as admin

2. **Access Waiter Panel**
   - Navigate to `/waiter-panel`
   - See dashboard with stats

3. **View Active Orders**
   - See all orders in PLACED, PREPARING, READY states
   - Each order shows:
     - Table number
     - Number of items
     - Current status
     - Time since order placed
     - Total amount

4. **Select Order**
   - Click on order in list
   - Right panel shows:
     - Order items with quantities
     - Special instructions
     - Total price
     - Status buttons

5. **Manage Order Status**
   - **PLACED → PREPARING:** Click "Start Preparing"
     - Notifies kitchen to start cooking
   - **PREPARING → READY:** Click "Mark Ready"
     - Order ready for pickup
   - **READY → DELIVERED:** Click "Serve Order"
     - Waiter has delivered to table
   - **Any → CANCELLED:** Click "Cancel Order"
     - Order cancelled (e.g., customer changed mind)

6. **Monitor Commission**
   - See today's commission in header
   - Calculated as 10% of total sales
   - Updates in real-time as orders complete

7. **Refresh Orders**
   - Auto-refreshes every 5 seconds
   - Manual refresh with "Refresh" button
   - See new orders immediately

**Data Flow:**
```
Order Created (via API or QR menu)
    ↓
Backend stores in database
    ↓
Waiter Panel polls /api/orders
    ↓
Frontend displays in list
    ↓
Waiter clicks status button
    ↓
POST /api/orders/:id/state
    ↓
Backend updates order state
    ↓
Next poll shows updated status
    ↓
Commission recalculated
```

### Workflow 3: Customer - Ordering via QR Menu

**Goal:** Customer orders food via QR code menu

**Steps:**

1. **Scan QR Code**
   - Customer scans QR code at table
   - Opens QR menu page

2. **Browse Menu**
   - See all available menu items
   - Items marked unavailable are hidden

3. **Select Items**
   - Click items to add to cart
   - Specify quantity
   - Add special instructions

4. **Submit Order**
   - Click "Place Order"
   - Order sent to backend

5. **Track Order**
   - See order status in real-time
   - Notified when ready for pickup

**Data Flow:**
```
Customer selects items
    ↓
POST /api/orders (with menu item IDs)
    ↓
Backend creates order
    ↓
Order appears in Waiter Panel
    ↓
Kitchen Display shows order
    ↓
Waiter manages status
    ↓
Customer sees status update
```

## API Request/Response Examples

### Create Menu Item

**Request:**
```http
POST /api/menu
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "name": "Pasta Carbonara",
  "description": "Classic Italian pasta",
  "price": 4550,
  "categoryId": "cat-123",
  "preparationTime": 15,
  "imageUrl": "https://example.com/pasta.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "item": {
    "id": "item-456",
    "tenantId": "tenant-123",
    "name": "Pasta Carbonara",
    "description": "Classic Italian pasta",
    "price": 4550,
    "categoryId": "cat-123",
    "preparationTime": 15,
    "imageUrl": "https://example.com/pasta.jpg",
    "isAvailable": true,
    "active": true,
    "createdAt": 1704067200000,
    "updatedAt": 1704067200000
  }
}
```

### Get Orders

**Request:**
```http
GET /api/orders?state=PLACED,PREPARING,READY
Authorization: Bearer eyJhbGc...
```

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "id": "order-789",
      "tableNumber": "5",
      "items": [
        {
          "id": "oi-001",
          "menuItemId": "item-456",
          "quantity": 2,
          "specialInstructions": "No onions"
        }
      ],
      "totalAmount": 9100,
      "state": "PREPARING",
      "createdAt": 1704067200000,
      "updatedAt": 1704067260000,
      "version": 1
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1
  }
}
```

### Change Order State

**Request:**
```http
POST /api/orders/order-789/state
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "toState": "READY",
  "fromState": "PREPARING",
  "reason": "Order ready for pickup"
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "id": "order-789",
    "state": "READY",
    "updatedAt": 1704067320000,
    "version": 2
  }
}
```

## Error Handling

### Common Errors

**401 Unauthorized**
- JWT token missing or invalid
- Solution: Re-login to get new token

**403 Forbidden**
- User doesn't have permission (e.g., waiter trying to create menu item)
- Solution: Use admin account for menu management

**404 Not Found**
- Menu item or order doesn't exist
- Solution: Verify ID is correct

**400 Bad Request**
- Invalid data in request
- Solution: Check form validation

**500 Internal Server Error**
- Backend error
- Solution: Check server logs, retry request

## Performance Considerations

### Waiter Panel
- Auto-refresh every 5 seconds (configurable)
- Reduces server load while keeping data fresh
- Manual refresh for immediate updates

### Menu Manager
- Lazy loads menu items
- Pagination support (50 items per page)
- Caching of categories

### Database
- Indexes on frequently queried fields
- Tenant isolation for multi-tenancy
- Connection pooling

## Security

### Authentication
- JWT tokens stored in localStorage
- Tokens included in all API requests
- Tokens expire after set time

### Authorization
- Role-based access control (RBAC)
- Admin/Manager can manage menu
- Waiters can only view/manage orders
- Customers can only create orders

### Data Protection
- All data encrypted in transit (HTTPS)
- Tenant data isolated
- Soft deletes preserve data history

## Monitoring & Debugging

### Frontend Debugging
1. Open browser DevTools (F12)
2. Check Console tab for errors
3. Check Network tab for API calls
4. Check Application tab for localStorage

### Backend Debugging
1. Check Cloudflare Workers dashboard
2. View real-time logs
3. Check D1 database queries
4. Monitor error rates

## Future Enhancements

1. **Real-time Updates**
   - WebSocket for instant order updates
   - Push notifications to waiters

2. **Advanced Features**
   - Order history and analytics
   - Menu templates
   - Bulk operations
   - Advanced filtering

3. **Integration**
   - Payment processing
   - Kitchen display system
   - Customer notifications
   - Inventory management

4. **Performance**
   - Caching layer
   - CDN for images
   - Database optimization
   - API rate limiting
