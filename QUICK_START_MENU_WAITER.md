# Quick Start: Menu Manager & Waiter Panel

## 1. Access the Menu Manager

**URL:** `https://gastronomos-frontend.pages.dev/inventory/products`

**What you can do:**
- View all menu items
- Create new items (click "Add Menu Item")
- Edit existing items (click "Edit")
- Delete items (click "Delete")
- Show/hide items from menu (click "Show"/"Hide")

**To Create a Menu Item:**
1. Click "Add Menu Item" button
2. Fill in the form:
   - **Item Name** (required): e.g., "Pasta Carbonara"
   - **Price** (required): e.g., "45.50"
   - **Description**: Optional details about the item
   - **Category**: Select from available categories
   - **Preparation Time**: How long it takes to prepare (minutes)
   - **Image URL**: Link to item image
3. Click "Create Item"
4. Item appears in the grid below

## 2. Access the Waiter Panel

**URL:** `https://gastronomos-frontend.pages.dev/waiter-panel`

**What you see:**
- **Header:** Your name and today's commission (10% of sales)
- **Stats:** Active orders, ready to serve, in preparation, total sales
- **Orders List:** All active orders with status
- **Order Details:** Click an order to see full details and manage it

**To Manage an Order:**
1. Click on an order in the list
2. See order details on the right panel
3. Click status buttons to move order through workflow:
   - "Start Preparing" (PLACED → PREPARING)
   - "Mark Ready" (PREPARING → READY)
   - "Serve Order" (READY → DELIVERED)
   - "Cancel Order" (any state → CANCELLED)

**Auto-Refresh:**
- Orders refresh automatically every 5 seconds
- Click "Refresh" button to manually refresh

## 3. Create Test Orders (via API)

To test the waiter panel, you need orders. Use curl or Postman:

```bash
curl -X POST https://gastronomos.hudsonargollo2.workers.dev/orders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "your-location-id",
    "tableNumber": "5",
    "items": [
      {
        "menuItemId": "menu-item-id",
        "quantity": 2,
        "specialInstructions": "No onions"
      }
    ]
  }'
```

## 4. Troubleshooting

### Menu items not loading?
- Check browser console for errors
- Verify you're logged in (token in localStorage)
- Check network tab to see API responses

### Waiter panel showing "No active orders"?
- Create test orders via API (see above)
- Check that orders have state: PLACED, PREPARING, or READY
- Refresh the page

### API errors?
- Make sure `NEXT_PUBLIC_API_URL` is set correctly
- Verify JWT token is valid
- Check that you have proper permissions (Admin/Manager for menu)

## 5. Key Features

### Menu Manager
✅ Full CRUD operations
✅ Category management
✅ Availability toggle
✅ Real-time updates
✅ Image support
✅ Preparation time tracking

### Waiter Panel
✅ Real-time order tracking
✅ Order status management
✅ Commission calculation
✅ Auto-refresh
✅ Order details view
✅ Quick actions

## 6. Next Steps

1. **Create your menu items** in the Menu Manager
2. **Create test orders** via API
3. **Test the waiter panel** by managing orders
4. **Integrate with kitchen display** system
5. **Add payment processing** for orders

## 7. API Documentation

See `MENU_WAITER_IMPLEMENTATION.md` for full API documentation.

## 8. Support

If you encounter issues:
1. Check browser console for errors
2. Verify authentication token
3. Check network requests in DevTools
4. Review API response status codes
5. Check backend logs at Cloudflare Workers dashboard
