import {
  collection,
  addDoc,
  Timestamp,
  initializeApp,
} from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

// Initialize Firebase (using environment variables)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const sampleProducts = [
  {
    name: 'Ceramic Pro Coating',
    description: 'Advanced ceramic coating with 9H hardness for ultimate protection and shine. Water repellent and self-cleaning properties.',
    price: 149.99,
    category: 'Ceramic Coatings',
    stock: 50,
    image: 'https://images.unsplash.com/photo-1487700492018-7d82b393e716?w=500&h=500&fit=crop',
  },
  {
    name: 'PPF Protective Film',
    description: 'Paint protection film with self-healing technology. Invisible protection against scratches and UV damage.',
    price: 199.99,
    category: 'Protection Films',
    stock: 35,
    image: 'https://images.unsplash.com/photo-1493195666900-b796ba18c6e1?w=500&h=500&fit=crop',
  },
  {
    name: 'Premium Wax Coating',
    description: 'Long-lasting carnauba wax coating. Provides deep gloss and water beading for up to 6 months.',
    price: 79.99,
    category: 'Wax Coatings',
    stock: 75,
    image: 'https://images.unsplash.com/photo-1552820728-8ac41f1ce891?w=500&h=500&fit=crop',
  },
  {
    name: 'Glass Sealant Pro',
    description: 'Hydrophobic glass sealant for windows and mirrors. Improves visibility and reduces water spots.',
    price: 59.99,
    category: 'Glass Products',
    stock: 100,
    image: 'https://images.unsplash.com/photo-1470770841625-f2b191f1e2d9?w=500&h=500&fit=crop',
  },
  {
    name: 'Interior Protection Spray',
    description: 'UV-protective spray for interior surfaces. Prevents fading and maintains appearance of dashboard and trim.',
    price: 39.99,
    category: 'Interior Care',
    stock: 120,
    image: 'https://images.unsplash.com/photo-1532521454835-bcb545c28f0e?w=500&h=500&fit=crop',
  },
  {
    name: 'Detailing Spray Bundle',
    description: 'Complete detailing kit with spray and microfiber cloth. Perfect for maintaining your coating.',
    price: 89.99,
    category: 'Bundles',
    stock: 60,
    image: 'https://images.unsplash.com/photo-1552053831-71594a27c62d?w=500&h=500&fit=crop',
  },
];

async function seedDatabase() {
  try {
    console.log('Starting to seed products...');
    const productsCollection = collection(db, 'products');

    for (const product of sampleProducts) {
      await addDoc(productsCollection, {
        ...product,
        createdAt: Timestamp.now(),
      });
      console.log(`✓ Added: ${product.name}`);
    }

    console.log('\n✓ All products added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
