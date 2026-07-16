import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  query,
  orderBy,
  limit,
  where,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { ensureFirestoreAuthReady, getOfflineSession } from './admin-auth';
import { toFirestoreError } from './firestore';
import { getDocsHybrid } from './offline/firestore-reads';
import { logDesktopActivity } from './staff-activity';
import type {
  CreditCustomer,
  CreditCustomerStatus,
  CreditPurchase,
  CreditPurchaseItem,
  CreditPurchaseStatus,
  CreditTransaction,
  CreditTransactionType,
  SalePaymentMethod,
} from './types';

const creditCustomersCollection = collection(db, 'creditCustomers');
const creditPurchasesCollection = collection(db, 'creditPurchases');
const creditTransactionsCollection = collection(db, 'creditTransactions');

async function resolveEmail(): Promise<string> {
  if (auth.currentUser?.email) return auth.currentUser.email.toLowerCase();
  const session = await getOfflineSession();
  if (session?.email) return session.email.toLowerCase();
  throw new Error('You must be signed in to manage credit accounts.');
}

export interface CreditCustomerInput {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  idNumber?: string;
  notes?: string;
  creditLimit?: number;
}

export interface CreditPickItemInput {
  productId: string;
  quantity: number;
}

function validateCustomerInput(input: CreditCustomerInput) {
  if (!input.name.trim()) throw new Error('Name is required.');
  if (input.name.trim().length > 200) throw new Error('Name must be 200 characters or fewer.');
  if (!input.phone.trim()) throw new Error('Phone is required.');
  if (input.phone.trim().length > 40) throw new Error('Phone must be 40 characters or fewer.');
  if (input.email && input.email.length > 200) throw new Error('Email must be 200 characters or fewer.');
  if (input.address && input.address.length > 400) {
    throw new Error('Address must be 400 characters or fewer.');
  }
  if (input.idNumber && input.idNumber.length > 80) {
    throw new Error('ID number must be 80 characters or fewer.');
  }
  if (input.notes && input.notes.length > 1000) {
    throw new Error('Notes must be 1000 characters or fewer.');
  }
  if (
    input.creditLimit !== undefined &&
    (!Number.isFinite(input.creditLimit) || input.creditLimit < 0)
  ) {
    throw new Error('Credit limit must be zero or a positive number.');
  }
}

export async function registerCreditCustomer(
  input: CreditCustomerInput
): Promise<CreditCustomer> {
  validateCustomerInput(input);
  await ensureFirestoreAuthReady();
  const email = await resolveEmail();

  try {
    const createdAt = Timestamp.now();
    const data = {
      name: input.name.trim(),
      phone: input.phone.trim(),
      ...(input.email?.trim() ? { email: input.email.trim() } : {}),
      ...(input.address?.trim() ? { address: input.address.trim() } : {}),
      ...(input.idNumber?.trim() ? { idNumber: input.idNumber.trim() } : {}),
      ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
      ...(input.creditLimit !== undefined ? { creditLimit: input.creditLimit } : {}),
      walletBalance: 0,
      outstandingBalance: 0,
      totalPurchased: 0,
      totalPaid: 0,
      status: 'active' as const,
      createdAt,
      createdBy: email,
    };

    const docRef = await addDoc(creditCustomersCollection, data);

    logDesktopActivity({
      action: 'credit.customer_create',
      summary: `Credit customer registered · ${data.name}`,
      resourceType: 'creditCustomer',
      resourceId: docRef.id,
      metrics: { phone: data.phone },
    });

    return { id: docRef.id, ...data } as CreditCustomer;
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function updateCreditCustomer(
  customerId: string,
  input: CreditCustomerInput
): Promise<void> {
  validateCustomerInput(input);
  await ensureFirestoreAuthReady();

  try {
    const updates: Record<string, unknown> = {
      name: input.name.trim(),
      phone: input.phone.trim(),
    };
    if (input.email?.trim()) updates.email = input.email.trim();
    if (input.address?.trim()) updates.address = input.address.trim();
    if (input.idNumber?.trim()) updates.idNumber = input.idNumber.trim();
    if (input.notes?.trim()) updates.notes = input.notes.trim();
    if (input.creditLimit !== undefined) updates.creditLimit = input.creditLimit;

    await updateDoc(doc(creditCustomersCollection, customerId), updates);

    logDesktopActivity({
      action: 'credit.customer_update',
      summary: `Credit customer updated · ${input.name.trim()}`,
      resourceType: 'creditCustomer',
      resourceId: customerId,
    });
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function setCreditCustomerStatus(
  customerId: string,
  status: CreditCustomerStatus
): Promise<void> {
  await ensureFirestoreAuthReady();
  try {
    await updateDoc(doc(creditCustomersCollection, customerId), { status });
    logDesktopActivity({
      action: 'credit.customer_update',
      summary: `Credit customer marked ${status}`,
      resourceType: 'creditCustomer',
      resourceId: customerId,
      metrics: { status },
    });
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function getCreditCustomer(
  customerId: string
): Promise<CreditCustomer | null> {
  try {
    await ensureFirestoreAuthReady();
    const snap = await getDoc(doc(creditCustomersCollection, customerId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as CreditCustomer;
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function listCreditCustomers(options?: {
  status?: CreditCustomerStatus | 'all';
  limit?: number;
}): Promise<CreditCustomer[]> {
  try {
    await ensureFirestoreAuthReady();
    const max = options?.limit ?? 1000;
    const constraints = [] as ReturnType<typeof where>[];
    if (options?.status && options.status !== 'all') {
      constraints.push(where('status', '==', options.status));
    }

    const q = query(
      creditCustomersCollection,
      ...constraints,
      orderBy('createdAt', 'desc'),
      limit(max)
    );
    const snapshot = await getDocsHybrid(q);
    return snapshot.docs.map(
      (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as CreditCustomer
    );
  } catch (error) {
    console.error('Error listing credit customers:', error);
    throw toFirestoreError(error);
  }
}

export async function pickProductsForCustomer(
  customerId: string,
  items: CreditPickItemInput[],
  options?: { dueDate?: Date; notes?: string }
): Promise<CreditPurchase> {
  if (!items.length) throw new Error('Select at least one product.');
  for (const item of items) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new Error('Each product quantity must be a positive number.');
    }
  }
  if (options?.notes && options.notes.length > 1000) {
    throw new Error('Notes must be 1000 characters or fewer.');
  }

  await ensureFirestoreAuthReady();
  const email = await resolveEmail();

  try {
    const purchase = await runTransaction(db, async (transaction) => {
      const customerRef = doc(creditCustomersCollection, customerId);
      const customerSnap = await transaction.get(customerRef);
      if (!customerSnap.exists()) throw new Error('Credit customer not found.');

      const customer = customerSnap.data();
      if (customer.status !== 'active') {
        throw new Error('This credit account is inactive.');
      }

      const productRefs = items.map((item) => doc(db, 'products', item.productId));
      const productSnaps = await Promise.all(
        productRefs.map((ref) => transaction.get(ref))
      );

      const purchaseItems: CreditPurchaseItem[] = [];
      let totalAmount = 0;
      const stockUpdates: Array<{
        ref: ReturnType<typeof doc>;
        productId: string;
        productName: string;
        quantity: number;
        newStock: number;
      }> = [];

      for (let i = 0; i < items.length; i++) {
        const cartItem = items[i];
        const productSnap = productSnaps[i];
        if (!productSnap.exists()) {
          throw new Error(`Product ${cartItem.productId} not found.`);
        }
        const product = productSnap.data();
        const currentStock = product.stock ?? 0;
        if (currentStock < cartItem.quantity) {
          throw new Error(
            `Insufficient stock for ${product.name}. Available: ${currentStock}`
          );
        }

        const unitPrice = Number(product.price ?? 0);
        const costPrice = Number(product.costPrice ?? 0);
        const lineTotal = unitPrice * cartItem.quantity;
        totalAmount += lineTotal;

        purchaseItems.push({
          productId: cartItem.productId,
          productName: String(product.name ?? 'Product'),
          barcode: product.barcode ? String(product.barcode) : undefined,
          quantity: cartItem.quantity,
          unitPrice,
          costPrice,
          lineTotal,
        });

        stockUpdates.push({
          ref: productRefs[i],
          productId: cartItem.productId,
          productName: String(product.name ?? 'Product'),
          quantity: cartItem.quantity,
          newStock: currentStock - cartItem.quantity,
        });
      }

      const outstanding = Number(customer.outstandingBalance ?? 0);
      const creditLimit =
        customer.creditLimit !== undefined && customer.creditLimit !== null
          ? Number(customer.creditLimit)
          : undefined;
      if (creditLimit !== undefined && outstanding + totalAmount > creditLimit) {
        throw new Error(
          `This purchase would exceed the credit limit of ${creditLimit.toLocaleString()}.`
        );
      }

      const createdAt = Timestamp.now();
      const purchaseRef = doc(creditPurchasesCollection);
      const purchaseData = {
        customerId,
        customerName: String(customer.name ?? ''),
        items: purchaseItems,
        totalAmount,
        amountPaid: 0,
        balanceRemaining: totalAmount,
        status: 'open' as const,
        ...(options?.dueDate ? { dueDate: Timestamp.fromDate(options.dueDate) } : {}),
        ...(options?.notes?.trim() ? { notes: options.notes.trim() } : {}),
        createdAt,
        createdBy: email,
      };

      for (const update of stockUpdates) {
        transaction.update(update.ref, { stock: update.newStock });
        const movementRef = doc(collection(db, 'stockMovements'));
        transaction.set(movementRef, {
          productId: update.productId,
          productName: update.productName,
          type: 'sale',
          quantityChange: -update.quantity,
          resultingStock: update.newStock,
          referenceType: 'credit_purchase',
          referenceId: purchaseRef.id,
          performedBy: email,
          createdAt,
        });
      }

      transaction.set(purchaseRef, purchaseData);

      const newOutstanding = outstanding + totalAmount;
      const newTotalPurchased = Number(customer.totalPurchased ?? 0) + totalAmount;
      const walletBalance = Number(customer.walletBalance ?? 0);

      transaction.update(customerRef, {
        outstandingBalance: newOutstanding,
        totalPurchased: newTotalPurchased,
      });

      const txRef = doc(creditTransactionsCollection);
      transaction.set(txRef, {
        customerId,
        customerName: String(customer.name ?? ''),
        type: 'purchase' as const,
        amount: totalAmount,
        purchaseId: purchaseRef.id,
        walletBalanceAfter: walletBalance,
        outstandingBalanceAfter: newOutstanding,
        recordedBy: email,
        createdAt,
      });

      return { id: purchaseRef.id, ...purchaseData } as CreditPurchase;
    });

    logDesktopActivity({
      action: 'credit.purchase_create',
      summary: `Credit purchase · ${purchase.customerName} · UGX ${purchase.totalAmount.toLocaleString()}`,
      resourceType: 'creditPurchase',
      resourceId: purchase.id,
      metrics: {
        customerId,
        totalAmount: purchase.totalAmount,
        itemCount: purchase.items.length,
      },
    });

    return purchase;
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function recordInstallmentPayment(
  customerId: string,
  purchaseId: string,
  amount: number,
  paymentMethod: SalePaymentMethod,
  notes?: string
): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }
  if (notes && notes.length > 1000) {
    throw new Error('Notes must be 1000 characters or fewer.');
  }

  await ensureFirestoreAuthReady();
  const email = await resolveEmail();

  try {
    await runTransaction(db, async (transaction) => {
      const customerRef = doc(creditCustomersCollection, customerId);
      const purchaseRef = doc(creditPurchasesCollection, purchaseId);
      const customerSnap = await transaction.get(customerRef);
      const purchaseSnap = await transaction.get(purchaseRef);

      if (!customerSnap.exists()) throw new Error('Credit customer not found.');
      if (!purchaseSnap.exists()) throw new Error('Credit purchase not found.');

      const customer = customerSnap.data();
      const purchase = purchaseSnap.data();

      if (purchase.customerId !== customerId) {
        throw new Error('Purchase does not belong to this customer.');
      }
      if (purchase.status !== 'open') {
        throw new Error('This purchase is already closed.');
      }

      const balanceRemaining = Number(purchase.balanceRemaining ?? 0);
      if (amount > balanceRemaining) {
        throw new Error(
          `Payment exceeds remaining balance of ${balanceRemaining.toLocaleString()}.`
        );
      }

      const amountPaid = Number(purchase.amountPaid ?? 0) + amount;
      const newBalance = balanceRemaining - amount;
      const createdAt = Timestamp.now();
      const purchaseUpdate: Record<string, unknown> = {
        amountPaid,
        balanceRemaining: newBalance,
      };
      if (newBalance === 0) {
        purchaseUpdate.status = 'completed';
        purchaseUpdate.closedAt = createdAt;
      }
      transaction.update(purchaseRef, purchaseUpdate);

      const newOutstanding = Math.max(
        0,
        Number(customer.outstandingBalance ?? 0) - amount
      );
      const newTotalPaid = Number(customer.totalPaid ?? 0) + amount;
      const walletBalance = Number(customer.walletBalance ?? 0);

      transaction.update(customerRef, {
        outstandingBalance: newOutstanding,
        totalPaid: newTotalPaid,
      });

      const txRef = doc(creditTransactionsCollection);
      transaction.set(txRef, {
        customerId,
        customerName: String(customer.name ?? ''),
        type: 'installment' as const,
        amount,
        purchaseId,
        paymentMethod,
        ...(notes?.trim() ? { notes: notes.trim() } : {}),
        walletBalanceAfter: walletBalance,
        outstandingBalanceAfter: newOutstanding,
        recordedBy: email,
        createdAt,
      });
    });

    logDesktopActivity({
      action: 'credit.payment_record',
      summary: `Installment payment · UGX ${amount.toLocaleString()}`,
      resourceType: 'creditPurchase',
      resourceId: purchaseId,
      metrics: { customerId, amount, paymentMethod },
    });
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function recordAccountDeposit(
  customerId: string,
  amount: number,
  paymentMethod: SalePaymentMethod,
  notes?: string
): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Deposit amount must be greater than zero.');
  }
  if (notes && notes.length > 1000) {
    throw new Error('Notes must be 1000 characters or fewer.');
  }

  await ensureFirestoreAuthReady();
  const email = await resolveEmail();

  try {
    await runTransaction(db, async (transaction) => {
      const customerRef = doc(creditCustomersCollection, customerId);
      const customerSnap = await transaction.get(customerRef);
      if (!customerSnap.exists()) throw new Error('Credit customer not found.');

      const customer = customerSnap.data();
      const walletBalance = Number(customer.walletBalance ?? 0) + amount;
      const outstanding = Number(customer.outstandingBalance ?? 0);
      const createdAt = Timestamp.now();

      transaction.update(customerRef, { walletBalance });

      const txRef = doc(creditTransactionsCollection);
      transaction.set(txRef, {
        customerId,
        customerName: String(customer.name ?? ''),
        type: 'deposit' as const,
        amount,
        paymentMethod,
        ...(notes?.trim() ? { notes: notes.trim() } : {}),
        walletBalanceAfter: walletBalance,
        outstandingBalanceAfter: outstanding,
        recordedBy: email,
        createdAt,
      });
    });

    logDesktopActivity({
      action: 'credit.deposit_record',
      summary: `Account deposit · UGX ${amount.toLocaleString()}`,
      resourceType: 'creditCustomer',
      resourceId: customerId,
      metrics: { amount, paymentMethod },
    });
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function applyWalletToPurchase(
  customerId: string,
  purchaseId: string,
  amount: number
): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be greater than zero.');
  }

  await ensureFirestoreAuthReady();
  const email = await resolveEmail();

  try {
    await runTransaction(db, async (transaction) => {
      const customerRef = doc(creditCustomersCollection, customerId);
      const purchaseRef = doc(creditPurchasesCollection, purchaseId);
      const customerSnap = await transaction.get(customerRef);
      const purchaseSnap = await transaction.get(purchaseRef);

      if (!customerSnap.exists()) throw new Error('Credit customer not found.');
      if (!purchaseSnap.exists()) throw new Error('Credit purchase not found.');

      const customer = customerSnap.data();
      const purchase = purchaseSnap.data();

      if (purchase.customerId !== customerId) {
        throw new Error('Purchase does not belong to this customer.');
      }
      if (purchase.status !== 'open') {
        throw new Error('This purchase is already closed.');
      }

      const walletBalance = Number(customer.walletBalance ?? 0);
      if (amount > walletBalance) {
        throw new Error(
          `Wallet balance is only ${walletBalance.toLocaleString()}.`
        );
      }

      const balanceRemaining = Number(purchase.balanceRemaining ?? 0);
      if (amount > balanceRemaining) {
        throw new Error(
          `Amount exceeds remaining balance of ${balanceRemaining.toLocaleString()}.`
        );
      }

      const amountPaid = Number(purchase.amountPaid ?? 0) + amount;
      const newBalance = balanceRemaining - amount;
      const createdAt = Timestamp.now();
      const purchaseUpdate: Record<string, unknown> = {
        amountPaid,
        balanceRemaining: newBalance,
      };
      if (newBalance === 0) {
        purchaseUpdate.status = 'completed';
        purchaseUpdate.closedAt = createdAt;
      }
      transaction.update(purchaseRef, purchaseUpdate);

      const newWallet = walletBalance - amount;
      const newOutstanding = Math.max(
        0,
        Number(customer.outstandingBalance ?? 0) - amount
      );
      const newTotalPaid = Number(customer.totalPaid ?? 0) + amount;

      transaction.update(customerRef, {
        walletBalance: newWallet,
        outstandingBalance: newOutstanding,
        totalPaid: newTotalPaid,
      });

      const txRef = doc(creditTransactionsCollection);
      transaction.set(txRef, {
        customerId,
        customerName: String(customer.name ?? ''),
        type: 'wallet_applied' as const,
        amount,
        purchaseId,
        walletBalanceAfter: newWallet,
        outstandingBalanceAfter: newOutstanding,
        recordedBy: email,
        createdAt,
      });
    });

    logDesktopActivity({
      action: 'credit.wallet_apply',
      summary: `Wallet applied to purchase · UGX ${amount.toLocaleString()}`,
      resourceType: 'creditPurchase',
      resourceId: purchaseId,
      metrics: { customerId, amount },
    });
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function listCreditPurchases(options?: {
  customerId?: string;
  status?: CreditPurchaseStatus | 'all';
  limit?: number;
}): Promise<CreditPurchase[]> {
  try {
    await ensureFirestoreAuthReady();
    const max = options?.limit ?? 1000;
    const constraints = [] as ReturnType<typeof where>[];

    if (options?.customerId) {
      constraints.push(where('customerId', '==', options.customerId));
    }
    if (options?.status && options.status !== 'all') {
      constraints.push(where('status', '==', options.status));
    }

    const q = query(
      creditPurchasesCollection,
      ...constraints,
      orderBy('createdAt', 'desc'),
      limit(max)
    );
    const snapshot = await getDocsHybrid(q);
    return snapshot.docs.map(
      (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as CreditPurchase
    );
  } catch (error) {
    console.error('Error listing credit purchases:', error);
    throw toFirestoreError(error);
  }
}

export async function listCreditTransactions(options?: {
  customerId?: string;
  type?: CreditTransactionType | 'all';
  from?: Date;
  to?: Date;
  limit?: number;
}): Promise<CreditTransaction[]> {
  try {
    await ensureFirestoreAuthReady();
    const max = options?.limit ?? 1000;
    const constraints = [] as ReturnType<typeof where>[];

    if (options?.customerId) {
      constraints.push(where('customerId', '==', options.customerId));
    }
    if (options?.type && options.type !== 'all') {
      constraints.push(where('type', '==', options.type));
    }
    if (options?.from) {
      constraints.push(where('createdAt', '>=', Timestamp.fromDate(options.from)));
    }
    if (options?.to) {
      constraints.push(where('createdAt', '<=', Timestamp.fromDate(options.to)));
    }

    const q = query(
      creditTransactionsCollection,
      ...constraints,
      orderBy('createdAt', 'desc'),
      limit(max)
    );
    const snapshot = await getDocsHybrid(q);
    return snapshot.docs.map(
      (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as CreditTransaction
    );
  } catch (error) {
    console.error('Error listing credit transactions:', error);
    throw toFirestoreError(error);
  }
}
