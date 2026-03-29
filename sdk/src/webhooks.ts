import type {
  CreateWebhookParams,
  PaginatedResponse,
  Webhook,
} from './types.js';
import { throwFromResponse } from './errors.js';

export class WebhooksAPI {
  constructor(
    private baseUrl: string,
    private headers: () => Record<string, string>,
  ) {}

  /** Register a webhook URL. */
  async create(params: CreateWebhookParams): Promise<Webhook> {
    const res = await fetch(`${this.baseUrl}/v1/webhooks`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) await throwFromResponse(res);
    return res.json() as Promise<Webhook>;
  }

  /** List registered webhooks. */
  async list(): Promise<PaginatedResponse<Webhook>> {
    const res = await fetch(`${this.baseUrl}/v1/webhooks`, {
      headers: this.headers(),
    });
    if (!res.ok) await throwFromResponse(res);
    return res.json() as Promise<PaginatedResponse<Webhook>>;
  }

  /** Unregister a webhook. */
  async delete(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/v1/webhooks/${id}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok) await throwFromResponse(res);
  }

  /**
   * Verify a webhook signature (HMAC-SHA256).
   *
   * Use this in your webhook handler to confirm the request came from Papre.
   * Works in both Node.js and browsers (uses crypto.subtle when available).
   *
   * @param payload - The raw request body string
   * @param signature - The value of the `X-Papre-Signature` header
   * @param secret - Your webhook secret from the account profile
   */
  static async verifySignature(
    payload: string,
    signature: string,
    secret: string,
  ): Promise<boolean> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return expected === signature;
  }
}
