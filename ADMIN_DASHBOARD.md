# MS Coatings Admin Dashboard

## Overview

The MS Coatings Admin Dashboard provides comprehensive management tools for products, orders, and analytics. The dashboard is accessible via `/admin` and requires Firebase authentication.

## Accessing the Admin Dashboard

### URL
- **Admin Panel**: `http://localhost:3000/admin`
- **Admin Login**: `http://localhost:3000/admin/login`
- **Dashboard**: `http://localhost:3000/admin/dashboard`

### Auto-Redirect
Visiting `/admin` automatically redirects to `/admin/dashboard` if authenticated, or to `/admin/login` if not.

## Authentication

The admin dashboard uses Firebase Authentication. To access the dashboard:

1. Create an admin user in your Firebase project
2. Go to Firebase Console → Authentication → Users
3. Click "Add User" and create credentials
4. Use these credentials to log in at `/admin/login`

### Demo Credentials
The login screen displays demo credentials as a reference. To use these, you would need to create these users in Firebase:
- Email: `demo@mscoatings.com`
- Password: `demo123456`

## Dashboard Features

### 1. Navigation Tabs

The admin dashboard has three main sections accessible via tabs:

#### Products Tab
- View all products in your catalog
- See product details including name, category, price, and stock status
- Click "Edit" to modify product details
- Click "Add Product" to create new products
- Stock levels are color-coded:
  - Green: In stock (>0 units)
  - Red: Out of stock (0 units)

#### Orders Tab
- View all customer orders
- See order details including ID, customer name, email, total amount, and status
- Order statuses include:
  - **Pending** (Yellow): Order received, awaiting confirmation
  - **Confirmed** (Blue): Order confirmed
  - **Shipped** (Purple): Order sent to customer
  - **Completed** (Green): Order delivered/completed
- Click "View" to see full order details and update status

#### Analytics Tab ⭐ NEW
- Comprehensive business insights and metrics
- Real-time data updates

### 2. Dashboard Statistics (Always Visible)

#### Main Stats (4 Cards)
1. **Total Revenue** - Sum of all order totals
   - Includes number of orders
   - Green trending icon

2. **Average Order Value** - Total revenue divided by order count
   - Shows per-transaction average
   - Blue shopping bag icon

3. **Total Customers** - Count of unique customer emails
   - Tracks unique buyers
   - Purple users icon

4. **Total Products** - Count of products in catalog
   - Shows inventory size
   - Blue package icon

#### Secondary Stats (3 Cards)
1. **Pending Orders** (Orange)
   - Orders awaiting confirmation
   - Quick status indicator

2. **Completed Orders** (Green)
   - Successfully delivered orders
   - Performance indicator

3. **Low Stock Products** (Red/Green)
   - Products with stock < 5 units
   - Color changes based on count
   - Alerts you to restock needs

### 3. Analytics Tab Features

#### Revenue Overview
- **Total Revenue**: Lifetime sales
- **Average Order Value**: Mean transaction amount
- **Revenue per Customer**: Average customer lifetime value

#### Order Statistics
- **Total Orders**: Complete order count
- **Pending Orders**: Awaiting confirmation
- **Confirmed Orders**: Confirmed but not shipped
- **Completed Orders**: Delivered successfully

#### Product Insights
- **Total Products**: Catalog size
- **Low Stock Items**: Products needing restock (stock < 5)
- **Revenue/Product**: Average revenue per product

#### Customer Insights
- **Total Customers**: Unique buyers
- **Repeat Customers**: Total additional orders from repeat buyers

## Product Management

### Adding Products

1. Click "Add Product" button on Products tab
2. Enter product details:
   - Product name
   - Category
   - Price
   - Description
   - Stock quantity
   - Product image URL

3. Save to add to catalog

### Editing Products

1. On Products tab, find the product
2. Click "Edit" button
3. Modify details as needed
4. Save changes

### Deleting Products

Products can be deleted through the product edit page. Use with caution as this removes the product from inventory.

## Order Management

### Viewing Orders

1. Click "Orders" tab
2. See list of all orders with:
   - Order ID (first 8 characters)
   - Customer name and email
   - Order total
   - Current status

### Updating Order Status

1. Click "View" on the order
2. Change status from dropdown:
   - Pending → Confirmed → Shipped → Completed
3. Save changes
4. Status updates in real-time

### Order Details

Each order shows:
- Order ID
- Customer information
- Items ordered with quantities and prices
- Order total
- Shipping address
- Order date
- Current status with history

## Analytics Features

### Key Metrics Explained

#### Revenue Metrics
- **Total Revenue**: Sum of all order totals in currency
- **Average Order Value**: Total revenue ÷ number of orders
- **Revenue per Customer**: Total revenue ÷ unique customers

#### Order Metrics
- **Order Count**: Total orders received
- **Pending**: Orders not yet confirmed
- **Confirmed**: Orders approved, awaiting shipment
- **Shipped**: Orders en route to customers
- **Completed**: Orders delivered

#### Inventory Metrics
- **Product Count**: Total products available
- **Low Stock**: Products with stock < 5 units
- **Revenue/Product**: Total revenue ÷ number of products

#### Customer Metrics
- **Total Customers**: Unique email addresses in orders
- **Repeat Customers**: Additional orders from returning customers

## Design & Layout

### Color Scheme
- **Blue**: Primary action, products, main stats
- **Green**: Revenue, completed orders, success indicators
- **Orange/Yellow**: Pending items, warnings
- **Purple**: Confirmed orders, alternative metrics
- **Red**: Low stock alerts, urgent items

### Responsive Design
- Works on desktop, tablet, and mobile
- Touch-friendly buttons and controls
- Tables scroll horizontally on small screens

## Features in Detail

### Real-Time Updates
- All data refreshes when you navigate between tabs
- Statistics update automatically
- No manual refresh needed

### Data Calculation
Analytics are calculated in real-time from Firestore:
- Total Revenue: Sum of all `order.totalPrice`
- Unique Customers: Count of distinct `order.customerEmail`
- Low Stock: Count of products where `stock < 5`
- Order Statuses: Filtered by `order.status` field

### Error Handling
- Failed data loads show error toast notifications
- Graceful fallbacks for missing data
- Authentication errors redirect to login

## Security Features

### Authentication
- Firebase Authentication required
- Session-based access control
- Automatic logout on session expiration
- Protected routes redirect to login

### Data Protection
- No passwords visible in URLs
- HTTPS required for production
- Firebase security rules (configured in Firestore)

## Troubleshooting

### Can't Access Dashboard
1. Verify you're authenticated in Firebase
2. Check your Firebase credentials
3. Ensure user account exists in Firebase Console
4. Clear browser cache and try again

### Data Not Updating
1. Refresh the page
2. Check Firestore connection
3. Verify internet connection
4. Check browser console for errors

### Images Not Showing in Products
1. Verify image URLs are valid
2. Check CORS settings if using external images
3. Use proper image hosting service

### Orders Not Appearing
1. Verify orders exist in Firestore
2. Check order data structure matches expected format
3. Review Firestore collections

## Data Structure

### Products Collection
```typescript
{
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  image: string;
  stock: number;
  createdAt: Timestamp;
}
```

### Orders Collection
```typescript
{
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'completed';
  createdAt: Timestamp;
}
```

## Best Practices

1. **Regular Monitoring**
   - Check dashboard daily for new orders
   - Monitor low stock alerts
   - Review analytics weekly

2. **Inventory Management**
   - Keep stock levels above 5 units
   - Update stock immediately after sales
   - Remove out-of-stock items

3. **Order Management**
   - Process orders within 24 hours
   - Update status promptly
   - Communicate with customers

4. **Data Accuracy**
   - Verify product information is current
   - Keep customer data confidential
   - Backup important data regularly

## Support

For issues or questions:
1. Check this documentation
2. Review Firestore logs
3. Check Firebase Console for errors
4. Contact MS Coatings support

## Future Enhancements

Potential features to add:
- Inventory forecasting
- Customer segmentation
- Email notifications for orders
- Bulk product import/export
- Advanced filtering and search
- Export reports to CSV/PDF
- Sales graphs and charts
- Customer communication tools
- Automated low stock alerts

---

Last Updated: 2024
MS Coatings Admin Dashboard v1.0
