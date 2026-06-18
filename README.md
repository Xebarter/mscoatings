# MS Coatings - E-Commerce Platform & Admin Dashboard

A complete e-commerce website and admin dashboard for MS Coatings, a premium car paint coatings company. Built with Next.js 16, Firebase, and Node.js.

## Features

### Public Website
- **Product Catalog**: Browse all car paint coating products with images, descriptions, and pricing
- **Product Details**: View detailed information about each product including stock availability
- **Shopping Cart**: Add/remove items, adjust quantities, with persistent cart storage
- **Checkout**: Mock checkout flow with customer information collection
- **Order Confirmation**: Confirmation page with order details

### Admin Dashboard
- **Admin Authentication**: Secure login with Firebase Auth
- **Product Management**: Create, edit, delete products with image URLs
- **Order Management**: View all orders with customer details
- **Order Status Updates**: Track orders through pending → confirmed → shipped → delivered
- **Dashboard Stats**: Real-time metrics for total products, orders, and revenue
- **Inventory Tracking**: Monitor product stock levels

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **UI Components**: Lucide Icons, React Hot Toast notifications
- **Deployment**: Vercel-ready

## Project Structure

```
app/
├── page.tsx                    # Home/catalog page
├── admin/
│   ├── login/page.tsx         # Admin login page
│   └── dashboard/page.tsx     # Admin dashboard
├── (public)/
│   ├── product/[id]/page.tsx  # Product detail page
│   ├── cart/page.tsx          # Shopping cart
│   ├── checkout/page.tsx      # Checkout page
│   └── order-confirmation/    # Order confirmation
├── api/
│   ├── products/route.ts      # Products API
│   └── orders/route.ts        # Orders API
└── layout.tsx

lib/
├── firebase.ts                # Firebase config
├── firestore.ts               # Firestore utilities
└── cart-context.tsx           # Cart state management

components/
├── header.tsx                 # Navigation header
├── product-card.tsx           # Product card component
├── admin-nav.tsx              # Admin navigation
└── layout-client.tsx          # Client-side layout wrapper
```

## Getting Started

### Prerequisites
- Firebase project with Firestore and Authentication enabled
- Node.js 18+ and pnpm

### Installation

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Set up environment variables**:
   Add your Firebase credentials to `.env.local`:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   FIREBASE_PRIVATE_KEY=your_private_key
   FIREBASE_CLIENT_EMAIL=your_client_email
   ```

3. **Run the development server**:
   ```bash
   pnpm dev
   ```

   The app will be available at `http://localhost:3000`

## Firebase Setup

### Required Collections

The app automatically uses these Firestore collections:

#### `products` Collection
```javascript
{
  name: string,
  description: string,
  price: number,
  category: string,
  stock: number,
  image: string (URL),
  createdAt: Timestamp
}
```

#### `orders` Collection
```javascript
{
  items: Array<{
    productId: string,
    productName: string,
    quantity: number,
    price: number
  }>,
  customerName: string,
  customerEmail: string,
  customerPhone: string,
  totalPrice: number,
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered',
  createdAt: Timestamp
}
```

### Firebase Authentication

1. Enable Email/Password authentication in Firebase Console
2. Create an admin user for dashboard access
3. (Optional) Add custom claims for role-based access

## Usage

### For Customers

1. Visit the homepage to browse products
2. Click on a product to view details
3. Click "Add to Cart" to add items
4. View your cart and proceed to checkout
5. Enter shipping information and complete the mock payment
6. Receive order confirmation

### For Admins

1. Navigate to `/admin/login`
2. Sign in with your Firebase credentials
3. View dashboard with stats and product/order lists
4. Click "Add Product" to create new products
5. Edit existing products by clicking the "Edit" button
6. Manage orders by viewing details and updating status

## API Routes

### GET `/api/products`
Get all products or a specific product by ID
```bash
GET /api/products
GET /api/products?id=productId
```

### POST `/api/products`
Create a new product
```bash
POST /api/products
Content-Type: application/json

{
  "name": "Product Name",
  "description": "Description",
  "price": 99.99,
  "category": "Category",
  "stock": 50,
  "image": "https://example.com/image.jpg"
}
```

### PUT `/api/products`
Update a product
```bash
PUT /api/products
Content-Type: application/json

{
  "id": "productId",
  "name": "Updated Name",
  "price": 109.99
}
```

### DELETE `/api/products`
Delete a product
```bash
DELETE /api/products?id=productId
```

### GET `/api/orders`
Get all orders or a specific order by ID
```bash
GET /api/orders
GET /api/orders?id=orderId
```

### POST `/api/orders`
Create a new order
```bash
POST /api/orders
Content-Type: application/json

{
  "items": [...],
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "customerPhone": "555-0000",
  "totalPrice": 299.99
}
```

### PUT `/api/orders`
Update order status
```bash
PUT /api/orders
Content-Type: application/json

{
  "id": "orderId",
  "status": "shipped"
}
```

## Customization

### Adding Products
You can add sample products by:
1. Using the admin dashboard to create products manually
2. Running the seed script (when implemented)
3. Adding directly to Firestore

### Modifying Styling
- Update Tailwind classes in components
- Modify color scheme in `globals.css`
- Adjust spacing and layout in component files

### Extending Features
- Add product search/filtering
- Implement real payment processing with Stripe
- Add user accounts and order history
- Create email notifications
- Add product reviews and ratings

## Security Considerations

- Firebase security rules should restrict database access
- Admin routes require authentication
- API routes validate input data
- Sensitive credentials stored in environment variables
- Client-side cart data stored locally (no sensitive info)

## Deployment

The project is configured for Vercel deployment:

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel settings
4. Deploy with automatic git integration

## Support

For issues or questions about the implementation, refer to:
- [Next.js Documentation](https://nextjs.org)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com)

---

Built with Next.js 16 and Firebase. Ready for production deployment.
