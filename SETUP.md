# MS Coatings - Setup Guide

This guide walks you through setting up and deploying the MS Coatings e-commerce platform.

## Quick Start (5 minutes)

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Firebase
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project or select an existing one
3. Enable Firestore Database:
   - Go to Build → Firestore Database
   - Create database in test mode
4. Enable Authentication:
   - Go to Build → Authentication
   - Enable Email/Password provider
5. Get your Firebase config:
   - Go to Project Settings
   - Copy the config object

### 3. Set Environment Variables
Create `.env.local` in the project root:
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

### 4. Create Admin User
1. Open the app at `http://localhost:3000/admin/login`
2. Click "Sign In" to go to Firebase auth (you may need to set up auth first)
3. Create an account with email and password
4. This becomes your admin user

### 5. Add Sample Products
#### Option A: Via Admin Dashboard
1. Login to `/admin/login` with your admin credentials
2. Click "Add Product" button
3. Fill in product details with an image URL
4. Click "Save Product"

#### Option B: Via Firestore Console
1. Go to Firebase Console → Firestore Database
2. Create collection: `products`
3. Add sample documents with fields:
   ```
   {
     "name": "Ceramic Pro Coating",
     "description": "Advanced ceramic coating...",
     "price": 149.99,
     "category": "Ceramic Coatings",
     "stock": 50,
     "image": "https://images.unsplash.com/...",
     "createdAt": Timestamp.now()
   }
   ```

### 6. Run Development Server
```bash
pnpm dev
```

Visit `http://localhost:3000` to see the store!

## Admin URLs

- **Admin Login**: `http://localhost:3000/admin/login`
- **Admin Dashboard**: `http://localhost:3000/admin/dashboard`
- **Add Product**: `http://localhost:3000/admin/products/new`
- **Edit Product**: `http://localhost:3000/admin/products/[productId]`
- **View Order**: `http://localhost:3000/admin/orders/[orderId]`

## Customer Flow

1. **Home**: `http://localhost:3000/` - Browse all products
2. **Product Detail**: Click on any product for more info
3. **Cart**: `http://localhost:3000/cart` - View and manage cart
4. **Checkout**: `http://localhost:3000/checkout` - Enter shipping info
5. **Confirmation**: See order confirmation after mock checkout

## Firestore Security Rules

For production, add these security rules in Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public: anyone can read products
    match /products/{document=**} {
      allow read;
      allow write: if request.auth != null && request.auth.uid == 'ADMIN_UID';
    }
    
    // Orders: authenticated users can create, admins can read all
    match /orders/{document=**} {
      allow create: if request.auth != null;
      allow read: if request.auth != null && request.auth.uid == 'ADMIN_UID';
      allow update: if request.auth != null && request.auth.uid == 'ADMIN_UID';
    }
  }
}
```

Replace `ADMIN_UID` with your actual admin user ID.

## Deployment to Vercel

### 1. Connect to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push origin main
```

### 2. Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Select your GitHub repository
4. Add environment variables (same as `.env.local`)
5. Click "Deploy"

### 3. Custom Domain (Optional)
1. In Vercel dashboard, go to Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed

## Troubleshooting

### Products not showing?
- Check that products exist in Firestore
- Verify Firebase credentials are correct
- Check browser console for errors

### Can't login to admin?
- Make sure Firebase Auth is enabled
- Verify admin user exists in Firebase
- Check that email/password credentials are correct

### Cart not persisting?
- Cart is stored in localStorage
- Clear browser cache if needed
- Check browser dev tools console

### Orders not saving?
- Verify Firestore database is created
- Check that "orders" collection exists
- Verify Firebase credentials have write permissions

## Adding Real Payments

To add Stripe payments:

1. Install Stripe:
   ```bash
   pnpm add stripe @stripe/react-stripe-js @stripe/stripe-js
   ```

2. Add Stripe keys to environment:
   ```
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
   STRIPE_SECRET_KEY=sk_...
   ```

3. Create checkout session in API route
4. Update checkout page to use Stripe instead of mock payment

## Next Steps

- Add product search and filters
- Implement user accounts and order history
- Add email notifications
- Create inventory management
- Set up analytics
- Add product reviews
- Implement wishlist feature

## Support

For help:
1. Check README.md for detailed documentation
2. Review Firebase documentation
3. Check Next.js documentation
4. Check browser console for error messages

---

**Version**: 1.0.0  
**Last Updated**: 2024
