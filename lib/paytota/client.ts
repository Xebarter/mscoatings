import { getPaytotaConfig } from './config';
import type {
  CreatePaytotaPurchaseInput,
  PaytotaPurchaseResponse,
} from './types';

class PaytotaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string
  ) {
    super(message);
    this.name = 'PaytotaApiError';
  }
}

async function paytotaRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { baseUrl, secretKey } = getPaytotaConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const body = await response.text();

  if (!response.ok) {
    throw new PaytotaApiError(
      `Paytota API error (${response.status})`,
      response.status,
      body
    );
  }

  return body ? (JSON.parse(body) as T) : ({} as T);
}

export async function createPaytotaPurchase(
  input: CreatePaytotaPurchaseInput
): Promise<PaytotaPurchaseResponse> {
  const { brandId } = getPaytotaConfig();

  return paytotaRequest<PaytotaPurchaseResponse>('/api/v1/purchases/', {
    method: 'POST',
    body: JSON.stringify({
      client: input.client,
      purchase: {
        currency: input.currency,
        products: input.products,
      },
      reference: input.reference,
      brand_id: brandId,
      skip_capture: false,
      success_redirect: input.successRedirect,
      failure_redirect: input.failureRedirect,
      cancel_redirect: input.cancelRedirect,
    }),
  });
}

export async function getPaytotaPurchase(
  purchaseId: string
): Promise<PaytotaPurchaseResponse> {
  return paytotaRequest<PaytotaPurchaseResponse>(
    `/api/v1/purchases/${purchaseId}/`
  );
}
