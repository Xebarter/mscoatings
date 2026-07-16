import { collection, doc, addDoc, updateDoc, deleteDoc, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { ensureFirestoreAuthReady, getOfflineSession } from './admin-auth';
import { toFirestoreError } from './firestore';
import { getDocsHybrid } from './offline/firestore-reads';
import { logDesktopActivity } from './staff-activity';
import type { Expense, ExpenseCategory, SalePaymentMethod } from './types';

const expensesCollection = collection(db, 'expenses');

async function resolveEmail(): Promise<string> {
  if (auth.currentUser?.email) return auth.currentUser.email.toLowerCase();
  const session = await getOfflineSession();
  if (session?.email) return session.email.toLowerCase();
  throw new Error('You must be signed in to manage expenses.');
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

export async function addExpense(input: ExpenseInput): Promise<Expense> {
  validateExpenseInput(input);
  await ensureFirestoreAuthReady();
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

    logDesktopActivity({
      action: 'expense.create',
      summary: `Expense recorded · ${input.category} · UGX ${input.amount.toLocaleString()}`,
      resourceType: 'expense',
      resourceId: docRef.id,
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

export async function updateExpense(expenseId: string, input: ExpenseInput): Promise<void> {
  validateExpenseInput(input);
  await ensureFirestoreAuthReady();

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

    logDesktopActivity({
      action: 'expense.update',
      summary: `Expense updated · ${input.category} · UGX ${input.amount.toLocaleString()}`,
      resourceType: 'expense',
      resourceId: expenseId,
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

export async function deleteExpense(
  expenseId: string,
  meta?: { category?: string; amount?: number }
): Promise<void> {
  await ensureFirestoreAuthReady();

  try {
    await deleteDoc(doc(expensesCollection, expenseId));

    logDesktopActivity({
      action: 'expense.delete',
      summary: `Expense deleted${meta?.category ? ` · ${meta.category}` : ''}`,
      resourceType: 'expense',
      resourceId: expenseId,
      metrics: {
        ...(meta?.category ? { category: meta.category } : {}),
        ...(meta?.amount !== undefined ? { amount: meta.amount } : {}),
      },
    });
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function listExpenses(options?: {
  from?: Date;
  to?: Date;
  limit?: number;
}): Promise<Expense[]> {
  try {
    await ensureFirestoreAuthReady();
    const max = options?.limit ?? 1000;

    const constraints = [] as ReturnType<typeof where>[];
    if (options?.from) {
      constraints.push(where('date', '>=', Timestamp.fromDate(options.from)));
    }
    if (options?.to) {
      constraints.push(where('date', '<=', Timestamp.fromDate(options.to)));
    }

    const q = query(expensesCollection, ...constraints, orderBy('date', 'desc'), limit(max));
    const snapshot = await getDocsHybrid(q);
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
