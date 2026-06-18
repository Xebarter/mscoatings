export type PaytotaPurchaseStatus =
  | 'created'
  | 'pending'
  | 'pending_execute'
  | 'paid'
  | 'error'
  | 'cancelled'
  | string;

export type PaytotaEventType =
  | 'purchase.created'
  | 'purchase.paid'
  | 'purchase.payment_failure'
  | 'purchase.cancelled'
  | 'purchase.pending_execute'
  | string;

export interface PaytotaPurchaseProduct {
  name: string;
  price: string;
}

export interface CreatePaytotaPurchaseInput {
  reference: string;
  client: {
    email: string;
    phone: string;
    country: string;
    full_name?: string;
  };
  products: PaytotaPurchaseProduct[];
  currency: string;
  successRedirect: string;
  failureRedirect: string;
  cancelRedirect: string;
}

export interface PaytotaPurchaseResponse {
  id: string;
  status: PaytotaPurchaseStatus;
  checkout_url: string;
  reference: string;
  event_type?: PaytotaEventType;
}

export interface PaytotaWebhookPayload {
  id: string;
  status: PaytotaPurchaseStatus;
  reference: string;
  event_type: PaytotaEventType;
  checkout_url?: string;
  transaction_data?: {
    payment_method?: string;
  };
}
