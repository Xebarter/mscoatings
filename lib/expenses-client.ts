import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { ensureFirestoreAuthReady } from '@/lib/admin-auth';
import { toFirestoreError } from '@/lib/firestore';
import { logClientActivity } from '@/lib/staff-activity-client';
import type { Expense, ExpenseCategory, SalePaymentMethod } from '@/lib/erp-types';

const expensesCollection = collection(db, 'expenses');

async function ensureAdminFirestoreAccess() {
  await ensureFirestoreAuthReady();
}

async function resolveEmail(): Promise<string> {
  const user = auth.currentUser;
  if (!user?.email) {
    await ensureFirestoreAuthReady();
  }
  const email = auth.currentUser?.email;
  if (!email) {
    throw new Error('You must be signed in to manage expenses.');
  }
  return email.toLowerCase();
}

export interface ExpenseInput {
  date: Date;
  category: ExpenseCategory;
  purpose: string;
  amount: number;
  paymentMethod: SalePaymentMethod;
  payee?: string;
  notes?: string;
}

function validateExpenseInput(input: ExpenseInput) {
  if (!input.purpose.trim()) {
    throw new Error('Purpose is required.');
  }
  if (input.purpose.trim().length > 300) {
    throw new Error('Purpose must be 300 characters or fewer.');
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Amount must be a positive number.');
  }
  if (input.payee && input.payee.length > 200) {
    throw new Error('Payee must be 200 characters or fewer.');
  }
  if (input.notes && input.notes.length > 1000) {
    throw new Error('Notes must be 1000 characters or fewer.');
  }
}

export async function addExpenseClient(input: ExpenseInput): Promise<Expense> {
  validateExpenseInput(input);
  const email = await resolveEmail();

  try {
    const createdAt = Timestamp.now();
    const data = {
      date: Timestamp.fromDate(input.date),
      category: input.category,
      purpose: input.purpose.trim(),
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      ...(input.payee?.trim() ? { payee: input.payee.trim() } : {}),
      ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
      recordedBy: email,
      createdAt,
    };

    const docRef = await addDoc(expensesCollection, data);

    logClientActivity({
      action: 'expense.create',
      summary: `Expense recorded · ${input.category} · UGX ${input.amount.toLocaleString()}`,
      resourceType: 'expense',
      resourceId: docRef.id,
      channel: 'web_admin',
      metrics: {
        category: input.category,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
      },
    });

    return { id: docRef.id, ...data } as Expense;
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function updateExpenseClient(
  expenseId: string,
  input: ExpenseInput
): Promise<void> {
  validateExpenseInput(input);
  await ensureAdminFirestoreAccess();

  try {
    const expenseRef = doc(expensesCollection, expenseId);
    await updateDoc(expenseRef, {
      date: Timestamp.fromDate(input.date),
      category: input.category,
      purpose: input.purpose.trim(),
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      ...(input.payee?.trim() ? { payee: input.payee.trim() } : {}),
      ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    });

    logClientActivity({
      action: 'expense.update',
      summary: `Expense updated · ${input.category} · UGX ${input.amount.toLocaleString()}`,
      resourceType: 'expense',
      resourceId: expenseId,
      channel: 'web_admin',
      metrics: {
        category: input.category,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
      },
    });
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function deleteExpenseClient(
  expenseId: string,
  meta?: { category?: string; amount?: number }
): Promise<void> {
  await ensureAdminFirestoreAccess();

  try {
    await deleteDoc(doc(expensesCollection, expenseId));

    logClientActivity({
      action: 'expense.delete',
      summary: `Expense deleted${meta?.category ? ` · ${meta.category}` : ''}`,
      resourceType: 'expense',
      resourceId: expenseId,
      channel: 'web_admin',
      metrics: {
        ...(meta?.category ? { category: meta.category } : {}),
        ...(meta?.amount !== undefined ? { amount: meta.amount } : {}),
      },
    });
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function listExpensesClient(options?: {
  from?: Date;
  to?: Date;
  limit?: number;
}): Promise<Expense[]> {
  try {
    await ensureAdminFirestoreAccess();
    const max = options?.limit ?? 1000;

    const constraints = [] as ReturnType<typeof where>[];
    if (options?.from) {
      constraints.push(where('date', '>=', Timestamp.fromDate(options.from)));
    }
    if (options?.to) {
      constraints.push(where('date', '<=', Timestamp.fromDate(options.to)));
    }

    const q = query(
      expensesCollection,
      ...constraints,
      orderBy('date', 'desc'),
      limit(max)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(
      (docSnap) =>
        ({
          id: docSnap.id,
          ...docSnap.data(),
        }) as Expense
    );
  } catch (error) {
    console.error('Error listing expenses:', error);
    throw toFirestoreError(error);
  }
}
