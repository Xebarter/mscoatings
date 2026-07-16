import {
  collection,
  doc,
  query,
  orderBy,
  limit,
  where,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { ensureFirestoreAuthReady, getOfflineSession } from './admin-auth';
import { getExpenses, toFirestoreError } from './firestore';
import { isOnline } from './offline/connectivity';
import { withTimeout } from './offline/firestore-reads';
import { localGet, localSet } from './offline/local-store';
import { LOCAL_EXPENSES_RETENTION } from './offline/limits';
import { syncDocOps } from './offline/flush-queue';
import { serializeDeep, stampTimestamp } from './offline/pending-writes';
import { logDesktopActivity } from './staff-activity';
import type { Expense, ExpenseCategory, SalePaymentMethod } from './types';

const expensesCollection = collection(db, 'expenses');

async function resolveEmail(): Promise<string> {
  if (auth.currentUser?.email) return auth.currentUser.email.toLowerCase();
  const session = await getOfflineSession();
  if (session?.email) return session.email.toLowerCase();
  throw new Error('You must be signed in to manage expenses.');
}

async function patchLocalExpenses(mutator: (items: Expense[]) => Expense[]) {
  const cached = await localGet<{ items: Expense[]; savedAt: number }>('expenses');
  const items = mutator(cached?.items ?? []).slice(0, LOCAL_EXPENSES_RETENTION);
  await localSet('expenses', { items, savedAt: Date.now() });
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
  if (isOnline()) {
    try {
      await withTimeout(ensureFirestoreAuthReady(), 2_000);
    } catch {
      /* continue offline */
    }
  }
  const email = await resolveEmail();

  try {
    const createdAt = Timestamp.now();
    const expenseRef = doc(expensesCollection);
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

    const expense: Expense = { id: expenseRef.id, ...data };

    await patchLocalExpenses((items) => [
      {
        ...expense,
        createdAt: stampTimestamp(createdAt) as unknown as Expense['createdAt'],
        date: stampTimestamp(data.date) as unknown as Expense['date'],
      },
      ...items,
    ]);

    await syncDocOps({
      id: `expense-create-${expenseRef.id}`,
      kind: 'expense.create',
      ops: [
        {
          op: 'set',
          collection: 'expenses',
          docId: expenseRef.id,
          data: serializeDeep(data) as Record<string, unknown>,
        },
      ],
    });

    logDesktopActivity({
      action: 'expense.create',
      summary: `Expense recorded · ${input.category} · UGX ${input.amount.toLocaleString()}`,
      resourceType: 'expense',
      resourceId: expenseRef.id,
      metrics: {
        category: input.category,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        offline: !isOnline(),
      },
    });

    return expense;
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function updateExpense(expenseId: string, input: ExpenseInput): Promise<void> {
  validateExpenseInput(input);
  if (isOnline()) {
    try {
      await withTimeout(ensureFirestoreAuthReady(), 2_000);
    } catch {
      /* continue offline */
    }
  }

  try {
    const cached = await localGet<{ items: Expense[] }>('expenses');
    const existing = cached?.items?.find((e) => e.id === expenseId);
    if (!existing) {
      throw new Error('Expense not found offline. Sync online once to refresh.');
    }

    const dateTs = Timestamp.fromDate(input.date);
    const updates = {
      date: dateTs,
      category: input.category,
      purpose: input.purpose.trim(),
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      ...(input.payee?.trim() ? { payee: input.payee.trim() } : {}),
      ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    };

    await patchLocalExpenses((items) =>
      items.map((e) =>
        e.id === expenseId
          ? {
              ...e,
              ...updates,
              date: stampTimestamp(dateTs) as unknown as Expense['date'],
            }
          : e
      )
    );

    await syncDocOps({
      id: `expense-update-${expenseId}`,
      kind: 'expense.update',
      ops: [
        {
          op: 'set',
          collection: 'expenses',
          docId: expenseId,
          data: serializeDeep(updates) as Record<string, unknown>,
          merge: true,
        },
      ],
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
        offline: !isOnline(),
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
  if (isOnline()) {
    try {
      await withTimeout(ensureFirestoreAuthReady(), 2_000);
    } catch {
      /* continue offline */
    }
  }

  try {
    await patchLocalExpenses((items) => items.filter((e) => e.id !== expenseId));

    await syncDocOps({
      id: `expense-delete-${expenseId}`,
      kind: 'expense.delete',
      ops: [
        {
          op: 'delete',
          collection: 'expenses',
          docId: expenseId,
        },
      ],
    });

    logDesktopActivity({
      action: 'expense.delete',
      summary: `Expense deleted${meta?.category ? ` · ${meta.category}` : ''}`,
      resourceType: 'expense',
      resourceId: expenseId,
      metrics: {
        ...(meta?.category ? { category: meta.category } : {}),
        ...(meta?.amount !== undefined ? { amount: meta.amount } : {}),
        offline: !isOnline(),
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
    if (isOnline()) {
      try {
        await withTimeout(ensureFirestoreAuthReady(), 2_000);
      } catch {
        /* fall through to mirror */
      }
    }

    let expenses = await getExpenses();
    const max = options?.limit ?? 1000;

    if (options?.from) {
      const fromMs = options.from.getTime();
      expenses = expenses.filter((e) => {
        const d = getExpenseDate(e.date);
        return d.getTime() >= fromMs;
      });
    }
    if (options?.to) {
      const toMs = options.to.getTime();
      expenses = expenses.filter((e) => {
        const d = getExpenseDate(e.date);
        return d.getTime() <= toMs;
      });
    }

    return expenses
      .sort((a, b) => getExpenseDate(b.date).getTime() - getExpenseDate(a.date).getTime())
      .slice(0, max);
  } catch (error) {
    console.error('Error listing expenses:', error);
    throw toFirestoreError(error);
  }
}

function getExpenseDate(value: Expense['date']): Date {
  if (!value) return new Date();
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (typeof value === 'object' && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return new Date(String(value));
}
