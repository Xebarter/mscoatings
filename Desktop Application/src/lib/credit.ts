import { collection, doc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { ensureFirestoreAuthReady, getOfflineSession } from './admin-auth';
import {
  creditCustomersCollection,
  creditPurchasesCollection,
  creditTransactionsCollection,
  getCreditCustomers,
  getCreditPurchases,
  getCreditTransactions,
  getProductById,
  toFirestoreError,
} from './firestore';
import { isOnline } from './offline/connectivity';
import { getDocHybrid, withTimeout } from './offline/firestore-reads';
import { localGet, localSet } from './offline/local-store';
import {
  LOCAL_CREDIT_CUSTOMERS_RETENTION,
  LOCAL_CREDIT_PURCHASES_RETENTION,
  LOCAL_CREDIT_TRANSACTIONS_RETENTION,
  LOCAL_MOVEMENTS_RETENTION,
} from './offline/limits';
import { syncDocOps } from './offline/flush-queue';
import {
  serializeDeep,
  stampTimestamp,
  type PendingDocOp,
} from './offline/pending-writes';
import { logDesktopActivity } from './staff-activity';
import type {
  CreditCustomer,
  CreditCustomerStatus,
  CreditPurchase,
  CreditPurchaseItem,
  CreditPurchaseStatus,
  CreditTransaction,
  CreditTransactionType,
  Product,
  SalePaymentMethod,
  StockMovement,
} from './types';

async function resolveEmail(): Promise<string> {
  if (auth.currentUser?.email) return auth.currentUser.email.toLowerCase();
  const session = await getOfflineSession();
  if (session?.email) return session.email.toLowerCase();
  throw new Error('You must be signed in to manage credit accounts.');
}

async function maybeEnsureAuth() {
  if (!isOnline()) return;
  try {
    await withTimeout(ensureFirestoreAuthReady(), 2_000);
  } catch {
    /* continue with cached session */
  }
}

async function loadProduct(productId: string): Promise<Product> {
  const mirrored = await localGet<{ items: Product[] }>('products');
  const fromMirror = mirrored?.items?.find((p) => p.id === productId);
  if (fromMirror) return fromMirror;

  if (!isOnline()) {
    throw new Error(`Product not available offline: ${productId}`);
  }

  const product = await getProductById(productId);
  if (!product) throw new Error(`Product not found: ${productId}`);
  return product;
}

async function loadCreditCustomer(customerId: string): Promise<CreditCustomer | null> {
  const cached = await localGet<{ items: CreditCustomer[] }>('creditCustomers');
  const fromMirror = cached?.items?.find((c) => c.id === customerId);
  if (fromMirror) return fromMirror;

  try {
    const snap = await getDocHybrid(doc(creditCustomersCollection, customerId));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as CreditCustomer;
    }
  } catch {
    /* fall through */
  }
  return null;
}

async function loadCreditPurchase(purchaseId: string): Promise<CreditPurchase | null> {
  const cached = await localGet<{ items: CreditPurchase[] }>('creditPurchases');
  const fromMirror = cached?.items?.find((p) => p.id === purchaseId);
  if (fromMirror) return fromMirror;

  try {
    const snap = await getDocHybrid(doc(creditPurchasesCollection, purchaseId));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as CreditPurchase;
    }
  } catch {
    /* fall through */
  }
  return null;
}

async function patchLocalCreditCustomers(
  mutator: (items: CreditCustomer[]) => CreditCustomer[]
) {
  const cached = await localGet<{ items: CreditCustomer[]; savedAt: number }>(
    'creditCustomers'
  );
  const items = mutator(cached?.items ?? []).slice(0, LOCAL_CREDIT_CUSTOMERS_RETENTION);
  await localSet('creditCustomers', { items, savedAt: Date.now() });
}

async function patchLocalCreditPurchases(
  mutator: (items: CreditPurchase[]) => CreditPurchase[]
) {
  const cached = await localGet<{ items: CreditPurchase[]; savedAt: number }>(
    'creditPurchases'
  );
  const items = mutator(cached?.items ?? []).slice(0, LOCAL_CREDIT_PURCHASES_RETENTION);
  await localSet('creditPurchases', { items, savedAt: Date.now() });
}

async function patchLocalCreditTransactions(
  mutator: (items: CreditTransaction[]) => CreditTransaction[]
) {
  const cached = await localGet<{ items: CreditTransaction[]; savedAt: number }>(
    'creditTransactions'
  );
  const items = mutator(cached?.items ?? []).slice(
    0,
    LOCAL_CREDIT_TRANSACTIONS_RETENTION
  );
  await localSet('creditTransactions', { items, savedAt: Date.now() });
}

async function patchLocalProductStock(
  updates: Array<{ productId: string; stock: number }>
) {
  const cached = await localGet<{ items: Product[]; savedAt: number }>('products');
  const next = (cached?.items ?? []).map((p) => {
    const match = updates.find((u) => u.productId === p.id);
    return match ? { ...p, stock: match.stock } : p;
  });
  await localSet('products', { items: next, savedAt: Date.now() });
}

async function prependLocalMovements(movements: StockMovement[]) {
  if (!movements.length) return;
  const cached = await localGet<{ items: StockMovement[]; savedAt: number }>(
    'stockMovements'
  );
  await localSet('stockMovements', {
    items: [...movements, ...(cached?.items ?? [])].slice(
      0,
      LOCAL_MOVEMENTS_RETENTION
    ),
    savedAt: Date.now(),
  });
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
  await maybeEnsureAuth();
  const email = await resolveEmail();

  try {
    const createdAt = Timestamp.now();
    const customerRef = doc(creditCustomersCollection);
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

    const customer: CreditCustomer = { id: customerRef.id, ...data };

    await patchLocalCreditCustomers((items) => [
      {
        ...customer,
        createdAt: stampTimestamp(createdAt) as unknown as CreditCustomer['createdAt'],
      },
      ...items,
    ]);

    await syncDocOps({
      id: `credit-customer-create-${customerRef.id}`,
      kind: 'credit.customer.upsert',
      ops: [
        {
          op: 'set',
          collection: 'creditCustomers',
          docId: customerRef.id,
          data: serializeDeep(data) as Record<string, unknown>,
        },
      ],
    });

    logDesktopActivity({
      action: 'credit.customer_create',
      summary: `Credit customer registered · ${data.name}`,
      resourceType: 'creditCustomer',
      resourceId: customerRef.id,
      metrics: { phone: data.phone, offline: !isOnline() },
    });

    return customer;
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function updateCreditCustomer(
  customerId: string,
  input: CreditCustomerInput
): Promise<void> {
  validateCustomerInput(input);
  await maybeEnsureAuth();

  try {
    const existing = await loadCreditCustomer(customerId);
    if (!existing) {
      throw new Error('Credit customer not found offline. Sync online once to refresh.');
    }

    const updates: Record<string, unknown> = {
      name: input.name.trim(),
      phone: input.phone.trim(),
    };
    if (input.email?.trim()) updates.email = input.email.trim();
    if (input.address?.trim()) updates.address = input.address.trim();
    if (input.idNumber?.trim()) updates.idNumber = input.idNumber.trim();
    if (input.notes?.trim()) updates.notes = input.notes.trim();
    if (input.creditLimit !== undefined) updates.creditLimit = input.creditLimit;

    await patchLocalCreditCustomers((items) =>
      items.map((c) => (c.id === customerId ? { ...c, ...updates } : c))
    );

    await syncDocOps({
      id: `credit-customer-update-${customerId}`,
      kind: 'credit.customer.upsert',
      ops: [
        {
          op: 'set',
          collection: 'creditCustomers',
          docId: customerId,
          data: serializeDeep(updates) as Record<string, unknown>,
          merge: true,
        },
      ],
    });

    logDesktopActivity({
      action: 'credit.customer_update',
      summary: `Credit customer updated · ${input.name.trim()}`,
      resourceType: 'creditCustomer',
      resourceId: customerId,
      metrics: { offline: !isOnline() },
    });
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function setCreditCustomerStatus(
  customerId: string,
  status: CreditCustomerStatus
): Promise<void> {
  await maybeEnsureAuth();
  try {
    await patchLocalCreditCustomers((items) =>
      items.map((c) => (c.id === customerId ? { ...c, status } : c))
    );

    await syncDocOps({
      id: `credit-customer-status-${customerId}-${status}`,
      kind: 'credit.customer.upsert',
      ops: [
        {
          op: 'set',
          collection: 'creditCustomers',
          docId: customerId,
          data: { status },
          merge: true,
        },
      ],
    });

    logDesktopActivity({
      action: 'credit.customer_update',
      summary: `Credit customer marked ${status}`,
      resourceType: 'creditCustomer',
      resourceId: customerId,
      metrics: { status, offline: !isOnline() },
    });
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function getCreditCustomer(
  customerId: string
): Promise<CreditCustomer | null> {
  try {
    await maybeEnsureAuth();
    return await loadCreditCustomer(customerId);
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function listCreditCustomers(options?: {
  status?: CreditCustomerStatus | 'all';
  limit?: number;
}): Promise<CreditCustomer[]> {
  try {
    await maybeEnsureAuth();
    const max = options?.limit ?? 1000;
    let customers = await getCreditCustomers();
    if (options?.status && options.status !== 'all') {
      customers = customers.filter((c) => c.status === options.status);
    }
    return customers.slice(0, max);
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

  await maybeEnsureAuth();
  const email = await resolveEmail();

  try {
    const customer = await loadCreditCustomer(customerId);
    if (!customer) throw new Error('Credit customer not found.');
    if (customer.status !== 'active') {
      throw new Error('This credit account is inactive.');
    }

    const products = await Promise.all(
      items.map((item) => loadProduct(item.productId))
    );

    const purchaseItems: CreditPurchaseItem[] = [];
    let totalAmount = 0;
    const stockUpdates: Array<{
      productId: string;
      productName: string;
      quantity: number;
      newStock: number;
    }> = [];

    for (let i = 0; i < items.length; i++) {
      const cartItem = items[i];
      const product = products[i];
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
        productName: product.name,
        barcode: product.barcode,
        quantity: cartItem.quantity,
        unitPrice,
        costPrice,
        lineTotal,
      });

      stockUpdates.push({
        productId: cartItem.productId,
        productName: product.name,
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
      customerName: customer.name,
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

    const newOutstanding = outstanding + totalAmount;
    const newTotalPurchased = Number(customer.totalPurchased ?? 0) + totalAmount;
    const walletBalance = Number(customer.walletBalance ?? 0);

    const txRef = doc(creditTransactionsCollection);
    const txData = {
      customerId,
      customerName: customer.name,
      type: 'purchase' as const,
      amount: totalAmount,
      purchaseId: purchaseRef.id,
      walletBalanceAfter: walletBalance,
      outstandingBalanceAfter: newOutstanding,
      recordedBy: email,
      createdAt,
    };

    const ops: PendingDocOp[] = [];
    const localMovements: StockMovement[] = [];

    for (const update of stockUpdates) {
      ops.push({
        op: 'set',
        collection: 'products',
        docId: update.productId,
        data: { stock: update.newStock },
        merge: true,
      });

      const movementRef = doc(collection(db, 'stockMovements'));
      const movement: StockMovement = {
        id: movementRef.id,
        productId: update.productId,
        productName: update.productName,
        type: 'sale',
        quantityChange: -update.quantity,
        resultingStock: update.newStock,
        referenceType: 'credit_purchase',
        referenceId: purchaseRef.id,
        performedBy: email,
        createdAt,
      };
      localMovements.push(movement);
      ops.push({
        op: 'set',
        collection: 'stockMovements',
        docId: movementRef.id,
        data: serializeDeep({
          productId: movement.productId,
          productName: movement.productName,
          type: movement.type,
          quantityChange: movement.quantityChange,
          resultingStock: movement.resultingStock,
          referenceType: movement.referenceType,
          referenceId: movement.referenceId,
          performedBy: movement.performedBy,
          createdAt: stampTimestamp(createdAt),
        }) as Record<string, unknown>,
      });
    }

    ops.push({
      op: 'set',
      collection: 'creditPurchases',
      docId: purchaseRef.id,
      data: serializeDeep(purchaseData) as Record<string, unknown>,
    });
    ops.push({
      op: 'set',
      collection: 'creditCustomers',
      docId: customerId,
      data: {
        outstandingBalance: newOutstanding,
        totalPurchased: newTotalPurchased,
      },
      merge: true,
    });
    ops.push({
      op: 'set',
      collection: 'creditTransactions',
      docId: txRef.id,
      data: serializeDeep(txData) as Record<string, unknown>,
    });

    const purchase: CreditPurchase = { id: purchaseRef.id, ...purchaseData };

    await patchLocalProductStock(
      stockUpdates.map((u) => ({ productId: u.productId, stock: u.newStock }))
    );
    await prependLocalMovements(
      localMovements.map((m) => ({
        ...m,
        createdAt: stampTimestamp(createdAt) as unknown as StockMovement['createdAt'],
      }))
    );
    await patchLocalCreditPurchases((list) => [
      {
        ...purchase,
        createdAt: stampTimestamp(createdAt) as unknown as CreditPurchase['createdAt'],
        dueDate: options?.dueDate
          ? (stampTimestamp(Timestamp.fromDate(options.dueDate)) as unknown as CreditPurchase['dueDate'])
          : undefined,
      },
      ...list,
    ]);
    await patchLocalCreditCustomers((list) =>
      list.map((c) =>
        c.id === customerId
          ? {
              ...c,
              outstandingBalance: newOutstanding,
              totalPurchased: newTotalPurchased,
            }
          : c
      )
    );
    await patchLocalCreditTransactions((list) => [
      {
        id: txRef.id,
        ...txData,
        createdAt: stampTimestamp(createdAt) as unknown as CreditTransaction['createdAt'],
      },
      ...list,
    ]);

    await syncDocOps({
      id: `credit-purchase-${purchaseRef.id}`,
      kind: 'credit.purchase',
      ops,
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
        offline: !isOnline(),
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

  await maybeEnsureAuth();
  const email = await resolveEmail();

  try {
    const customer = await loadCreditCustomer(customerId);
    const purchase = await loadCreditPurchase(purchaseId);
    if (!customer) throw new Error('Credit customer not found.');
    if (!purchase) throw new Error('Credit purchase not found.');
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

    const newOutstanding = Math.max(0, Number(customer.outstandingBalance ?? 0) - amount);
    const newTotalPaid = Number(customer.totalPaid ?? 0) + amount;
    const walletBalance = Number(customer.walletBalance ?? 0);

    const txRef = doc(creditTransactionsCollection);
    const txData = {
      customerId,
      customerName: customer.name,
      type: 'installment' as const,
      amount,
      purchaseId,
      paymentMethod,
      ...(notes?.trim() ? { notes: notes.trim() } : {}),
      walletBalanceAfter: walletBalance,
      outstandingBalanceAfter: newOutstanding,
      recordedBy: email,
      createdAt,
    };

    await patchLocalCreditPurchases((list) =>
      list.map((p) =>
        p.id === purchaseId ? { ...p, ...purchaseUpdate } : p
      )
    );
    await patchLocalCreditCustomers((list) =>
      list.map((c) =>
        c.id === customerId
          ? { ...c, outstandingBalance: newOutstanding, totalPaid: newTotalPaid }
          : c
      )
    );
    await patchLocalCreditTransactions((list) => [
      {
        id: txRef.id,
        ...txData,
        createdAt: stampTimestamp(createdAt) as unknown as CreditTransaction['createdAt'],
      },
      ...list,
    ]);

    await syncDocOps({
      id: `credit-payment-${txRef.id}`,
      kind: 'credit.payment',
      ops: [
        {
          op: 'set',
          collection: 'creditPurchases',
          docId: purchaseId,
          data: serializeDeep(purchaseUpdate) as Record<string, unknown>,
          merge: true,
        },
        {
          op: 'set',
          collection: 'creditCustomers',
          docId: customerId,
          data: {
            outstandingBalance: newOutstanding,
            totalPaid: newTotalPaid,
          },
          merge: true,
        },
        {
          op: 'set',
          collection: 'creditTransactions',
          docId: txRef.id,
          data: serializeDeep(txData) as Record<string, unknown>,
        },
      ],
    });

    logDesktopActivity({
      action: 'credit.payment_record',
      summary: `Installment payment · UGX ${amount.toLocaleString()}`,
      resourceType: 'creditPurchase',
      resourceId: purchaseId,
      metrics: { customerId, amount, paymentMethod, offline: !isOnline() },
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

  await maybeEnsureAuth();
  const email = await resolveEmail();

  try {
    const customer = await loadCreditCustomer(customerId);
    if (!customer) throw new Error('Credit customer not found.');

    const walletBalance = Number(customer.walletBalance ?? 0) + amount;
    const outstanding = Number(customer.outstandingBalance ?? 0);
    const createdAt = Timestamp.now();
    const txRef = doc(creditTransactionsCollection);
    const txData = {
      customerId,
      customerName: customer.name,
      type: 'deposit' as const,
      amount,
      paymentMethod,
      ...(notes?.trim() ? { notes: notes.trim() } : {}),
      walletBalanceAfter: walletBalance,
      outstandingBalanceAfter: outstanding,
      recordedBy: email,
      createdAt,
    };

    await patchLocalCreditCustomers((list) =>
      list.map((c) => (c.id === customerId ? { ...c, walletBalance } : c))
    );
    await patchLocalCreditTransactions((list) => [
      {
        id: txRef.id,
        ...txData,
        createdAt: stampTimestamp(createdAt) as unknown as CreditTransaction['createdAt'],
      },
      ...list,
    ]);

    await syncDocOps({
      id: `credit-deposit-${txRef.id}`,
      kind: 'credit.deposit',
      ops: [
        {
          op: 'set',
          collection: 'creditCustomers',
          docId: customerId,
          data: { walletBalance },
          merge: true,
        },
        {
          op: 'set',
          collection: 'creditTransactions',
          docId: txRef.id,
          data: serializeDeep(txData) as Record<string, unknown>,
        },
      ],
    });

    logDesktopActivity({
      action: 'credit.deposit_record',
      summary: `Account deposit · UGX ${amount.toLocaleString()}`,
      resourceType: 'creditCustomer',
      resourceId: customerId,
      metrics: { amount, paymentMethod, offline: !isOnline() },
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

  await maybeEnsureAuth();
  const email = await resolveEmail();

  try {
    const customer = await loadCreditCustomer(customerId);
    const purchase = await loadCreditPurchase(purchaseId);
    if (!customer) throw new Error('Credit customer not found.');
    if (!purchase) throw new Error('Credit purchase not found.');
    if (purchase.customerId !== customerId) {
      throw new Error('Purchase does not belong to this customer.');
    }
    if (purchase.status !== 'open') {
      throw new Error('This purchase is already closed.');
    }

    const walletBalance = Number(customer.walletBalance ?? 0);
    if (amount > walletBalance) {
      throw new Error(`Wallet balance is only ${walletBalance.toLocaleString()}.`);
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

    const newWallet = walletBalance - amount;
    const newOutstanding = Math.max(0, Number(customer.outstandingBalance ?? 0) - amount);
    const newTotalPaid = Number(customer.totalPaid ?? 0) + amount;

    const txRef = doc(creditTransactionsCollection);
    const txData = {
      customerId,
      customerName: customer.name,
      type: 'wallet_applied' as const,
      amount,
      purchaseId,
      walletBalanceAfter: newWallet,
      outstandingBalanceAfter: newOutstanding,
      recordedBy: email,
      createdAt,
    };

    await patchLocalCreditPurchases((list) =>
      list.map((p) => (p.id === purchaseId ? { ...p, ...purchaseUpdate } : p))
    );
    await patchLocalCreditCustomers((list) =>
      list.map((c) =>
        c.id === customerId
          ? {
              ...c,
              walletBalance: newWallet,
              outstandingBalance: newOutstanding,
              totalPaid: newTotalPaid,
            }
          : c
      )
    );
    await patchLocalCreditTransactions((list) => [
      {
        id: txRef.id,
        ...txData,
        createdAt: stampTimestamp(createdAt) as unknown as CreditTransaction['createdAt'],
      },
      ...list,
    ]);

    await syncDocOps({
      id: `credit-wallet-${txRef.id}`,
      kind: 'credit.wallet_apply',
      ops: [
        {
          op: 'set',
          collection: 'creditPurchases',
          docId: purchaseId,
          data: serializeDeep(purchaseUpdate) as Record<string, unknown>,
          merge: true,
        },
        {
          op: 'set',
          collection: 'creditCustomers',
          docId: customerId,
          data: {
            walletBalance: newWallet,
            outstandingBalance: newOutstanding,
            totalPaid: newTotalPaid,
          },
          merge: true,
        },
        {
          op: 'set',
          collection: 'creditTransactions',
          docId: txRef.id,
          data: serializeDeep(txData) as Record<string, unknown>,
        },
      ],
    });

    logDesktopActivity({
      action: 'credit.wallet_apply',
      summary: `Wallet applied to purchase · UGX ${amount.toLocaleString()}`,
      resourceType: 'creditPurchase',
      resourceId: purchaseId,
      metrics: { customerId, amount, offline: !isOnline() },
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
    await maybeEnsureAuth();
    const max = options?.limit ?? 1000;
    let purchases = await getCreditPurchases();
    if (options?.customerId) {
      purchases = purchases.filter((p) => p.customerId === options.customerId);
    }
    if (options?.status && options.status !== 'all') {
      purchases = purchases.filter((p) => p.status === options.status);
    }
    return purchases.slice(0, max);
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
    await maybeEnsureAuth();
    const max = options?.limit ?? 1000;
    let transactions = await getCreditTransactions();

    if (options?.customerId) {
      transactions = transactions.filter((t) => t.customerId === options.customerId);
    }
    if (options?.type && options.type !== 'all') {
      transactions = transactions.filter((t) => t.type === options.type);
    }
    if (options?.from) {
      const fromMs = options.from.getTime();
      transactions = transactions.filter((t) => {
        const d =
          t.createdAt && typeof t.createdAt === 'object' && 'toDate' in t.createdAt
            ? t.createdAt.toDate()
            : new Date(String(t.createdAt));
        return d.getTime() >= fromMs;
      });
    }
    if (options?.to) {
      const toMs = options.to.getTime();
      transactions = transactions.filter((t) => {
        const d =
          t.createdAt && typeof t.createdAt === 'object' && 'toDate' in t.createdAt
            ? t.createdAt.toDate()
            : new Date(String(t.createdAt));
        return d.getTime() <= toMs;
      });
    }

    return transactions.slice(0, max);
  } catch (error) {
    console.error('Error listing credit transactions:', error);
    throw toFirestoreError(error);
  }
}
