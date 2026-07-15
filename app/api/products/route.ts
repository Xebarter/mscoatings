import { NextRequest, NextResponse } from 'next/server';
import { revalidateCatalog } from '@/lib/revalidate-catalog';
import {
  collection,
  addDoc,
  Timestamp,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const productsCollection = collection(db, 'products');

// GET all products or a specific product
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');

    if (productId) {
      const docRef = doc(db, 'products', productId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return NextResponse.json({
          id: docSnap.id,
          ...docSnap.data(),
        });
      } else {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        );
      }
    }

    // Get all products
    const querySnapshot = await getDocs(productsCollection);
    const products = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// POST - Create a new product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, price, category, stock, image } = body;

    // Validation
    if (!name || price === undefined || !image) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const docRef = await addDoc(productsCollection, {
      name,
      description: description || '',
      price: parseFloat(price),
      category: category || 'Uncategorized',
      stock: parseInt(stock) || 0,
      image,
      createdAt: Timestamp.now(),
    });

    revalidateCatalog(docRef.id);

    return NextResponse.json(
      {
        id: docRef.id,
        name,
        description,
        price,
        category,
        stock,
        image,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}

// PUT - Update a product
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const docRef = doc(db, 'products', id);
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updateData as Record<string, unknown>)) {
      if (value !== undefined) clean[key] = value;
    }
    await updateDoc(docRef, clean);

    revalidateCatalog(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a product
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const docRef = doc(db, 'products', productId);
    await deleteDoc(docRef);

    revalidateCatalog(productId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
