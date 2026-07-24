'use client';

import { useState } from 'react';
import type { SalePaymentMethod } from '@/lib/erp-types';
import { formatUgx } from '@/lib/currency';
import {
  Banknote,
  Smartphone,
  X,
} from 'lucide-react';

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  total: number;
  onConfirm: (data: {
    paymentMethod: SalePaymentMethod;
    amountTendered?: number;
    paymentReference?: string;
    customerName?: string;
    customerPhone?: string;
  }) => void;
  isProcessing: boolean;
}

const PAYMENT_METHODS: {
  value: SalePaymentMethod;
  label: string;
  icon: typeof Banknote;
}[] = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
];

export default function CheckoutModal({
  open,
  onClose,
  total,
  onConfirm,
  isProcessing,
}: CheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] =
    useState<SalePaymentMethod>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  if (!open) return null;

  const handleConfirm = () => {
    const name = customerName.trim();
    const phone = customerPhone.trim();
    onConfirm({
      paymentMethod,
      amountTendered: total,
      paymentReference: paymentReference || undefined,
      customerName: name || undefined,
      customerPhone: phone || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Checkout</h3>
            <p className="text-2xl font-bold text-blue-600">{formatUgx(total)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Payment method
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((method) => {
                const Icon = method.icon;
                const selected = paymentMethod === method.value;
                return (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => setPaymentMethod(method.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-center transition ${
                      selected
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="text-xs font-semibold leading-tight">
                      {method.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Customer name{' '}
                <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Walk-in customer"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Phone{' '}
                <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="e.g. 0770123456"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {paymentMethod === 'mobile_money' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Transaction reference
              </label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g. MM receipt number"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex-[2] rounded-xl bg-blue-600 py-3 font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isProcessing ? 'Processing…' : 'Complete sale'}
          </button>
        </div>
      </div>
    </div>
  );
}
