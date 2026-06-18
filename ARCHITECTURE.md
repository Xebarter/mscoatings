# MS Coatings - Architecture Documentation

## Overview

MS Coatings is a full-stack e-commerce platform built with Next.js 16, Firebase, and TypeScript. The architecture separates concerns into public-facing website, admin dashboard, API routes, and shared utilities.

## Directory Structure

```
ms-coatings/
├── app/
│   ├── page.tsx                           # Home page (redirects to catalog)
│   ├── layout.tsx                         # Root layout with metadata
│   ├── globals.css                        # Global styles
│   ├── admin/
│   │   ├── login/page.tsx                # Admin login
│   │   └── dashboard/page.tsx            # Admin dashboard
│   ├── (public)/                         # Public routes group
│   │   ├── layout.tsx                    # Public layout
│   │   ├── page.tsx                      # Product catalog
│   │   ├── product/[id]/page.tsx         # Product details
│   │   ├── cart/page.tsx                 # Shopping cart
│   │   ├── checkout/page.tsx             # Checkout page
│   │   └── order-confirmation/[id]/      # Order confirmation
│   ├── admin/
│   │   ├── products/[id]/page.tsx        # Edit/create products
│   │   └── orders/[id]/page.tsx          # Order details
│   └── api/
│       ├── products/route.ts             # Products API
│       └── orders/route.ts               # Orders API
├── lib/
│   ├── firebase.ts                       # Firebase initialization
│   ├── firestore.ts                      # Firestore operations
│   ├── cart-context.tsx                  # Cart state management
│   └── utils.ts                          # Utility functions
├── components/
│   ├── header.tsx                        # Navigation header
│   ├── product-card.tsx                  # Product card
│   ├── admin-nav.tsx                     # Admin navigation
│   ├── layout-client.tsx                 # Client wrapper
│   └── ui/                               # shadcn/ui components
├── public/
│   ├── icon.svg                          # App icon
│   └── ...                               # Static assets
├── scripts/
│   └── seed-products.ts                  # Database seed script
├── README.md                              # Main documentation
├── SETUP.md                               # Setup instructions
└── package.json                           # Dependencies
```

## Key Files Explained

### Frontend Pages

#### `app/page.tsx`
- Home page with product catalog
- Displays all products from Firestore
- Shopping cart integration
- Hero section with call-to-action

#### `app/(public)/product/[id]/page.tsx`
- Dynamic product detail page
- Shows full product information
- Quantity selector
- Add to cart button

#### `app/(public)/cart/page.tsx`
- Shopping cart display
- Manage quantities
- Remove items
- Order summary with tax calculation

#### `app/(public)/checkout/page.tsx`
- Customer information form
- Mock payment form
- Order creation via API
- Error handling and validation

#### `app/(public)/order-confirmation/[id]/page.tsx`
- Order confirmation page
- Order details display
- Next steps information

### Admin Pages

#### `app/admin/login/page.tsx`
- Firebase authentication
- Email/password form
- Redirect to dashboard on success

#### `app/admin/dashboard/page.tsx`
- Admin overview with stats
- Product and order lists
- Tab navigation
- Protected routes

#### `app/admin/products/[id]/page.tsx`
- Create new products (id='new')
- Edit existing products
- Delete products
- Form validation

#### `app/admin/orders/[id]/page.tsx`
- Order details view
- Customer information
- Order items table
- Status update controls

### API Routes

#### `app/api/products/route.ts`
- GET: Fetch all/specific products
- POST: Create product
- PUT: Update product
- DELETE: Delete product

#### `app/api/orders/route.ts`
- GET: Fetch all/specific orders
- POST: Create order
- PUT: Update order status

### Libraries & Utilities

#### `lib/firebase.ts`
- Firebase app initialization
- Authentication setup
- Firestore connection

#### `lib/firestore.ts`
- Type definitions (Product, Order, OrderItem)
- CRUD operations for products
- Order management functions
- Database queries

#### `lib/cart-context.tsx`
- React Context for cart state
- localStorage persistence
- Cart operations (add, remove, update)
- Total calculation

### Components

#### `components/header.tsx`
- Navigation bar
- Logo and branding
- Shopping cart badge
- Mobile menu
- Admin logout button

#### `components/product-card.tsx`
- Product display card
- Image, name, price
- Add to cart button
- Stock indicator

#### `components/admin-nav.tsx`
- Admin section navigation
- Products/Orders tabs
- Tab styling and activation

#### `components/layout-client.tsx`
- Client-side providers
- CartProvider wrapper
- Toaster notifications

## Data Models

### Product
```typescript
interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  image: string;
  createdAt: Timestamp;
}
```

### Order
```typescript
interface Order {
  id: string;
  items: OrderItem[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered';
  createdAt: Timestamp;
}

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}
```

### Cart Item
```typescript
interface CartItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  image: string;
}
```

## State Management

### Client-Side State
- **Cart**: React Context with localStorage persistence
- **Authentication**: Firebase Auth state (via onAuthStateChanged)
- **UI State**: Component-level state (loading, modal visibility)

### Server-Side State
- **Products**: Firestore collection
- **Orders**: Firestore collection
- **User Sessions**: Firebase Auth

## Authentication Flow

1. **Public Users**: No authentication required to browse and purchase
2. **Admin Users**: 
   - Login at `/admin/login`
   - Firebase Auth validates credentials
   - Redirect to dashboard on success
   - Logout button in header

## Data Flow

### Shopping Flow
```
User Browse → Product List → Product Details → Add to Cart → 
Cart Page → Checkout → Order Created → Confirmation
```

### Admin Flow
```
Login → Dashboard → [Products/Orders] → 
Edit/Create/Delete → Update Firestore → List Updates
```

## API Response Format

### Success Response
```json
{
  "id": "documentId",
  "name": "Product Name",
  "price": 99.99,
  ...
}
```

### Error Response
```json
{
  "error": "Description of error"
}
```

## Performance Considerations

- **Product Images**: External URLs (no storage overhead)
- **Cart State**: localStorage (no server requests)
- **Real-time Updates**: Firestore listeners (use getDocs for snapshots)
- **API Caching**: No caching implemented (can be added)

## Security Features

- Firebase Authentication for admin access
- Environment variables for sensitive keys
- Input validation on forms
- Type safety with TypeScript
- No sensitive data in client-side cart

## Scaling Considerations

### Current Limitations
- No user accounts system
- Orders not tied to specific users
- No inventory transactions
- Single admin role

### Future Improvements
- User registration and login
- Order history per user
- Inventory management
- Multiple admin roles
- Audit logging
- Analytics integration

## Dependencies

### Core
- `next@16.2.6` - React framework
- `react@19.2.0` - UI library
- `typescript` - Type safety

### Firebase
- `firebase@12.15.0` - Database and auth

### UI & UX
- `tailwindcss` - Styling
- `lucide-react` - Icons
- `react-hot-toast` - Notifications

### Development
- `eslint` - Code linting
- `typescript` - Type checking

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

---

Last Updated: 2024
