import type {
  Agreement,
  AuditTrail,
  BatchCreateParams,
  BatchCreateResult,
  CreateAgreementParams,
  ListAgreementsParams,
  PaginatedResponse,
  SearchAgreementsParams,
  SignerStatus,
} from './types.js';
import { throwFromResponse } from './errors.js';

export class AgreementsAPI {
  constructor(
    private baseUrl: string,
    private headers: () => Record<string, string>,
  ) {}

  /** Create a new agreement from a template. */
  async create(
    params: CreateAgreementParams,
    options?: { idempotencyKey?: string },
  ): Promise<Agreement> {
    const headers: Record<string, string> = {
      ...this.headers(),
      'Content-Type': 'application/json',
    };
    if (options?.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }
    const res = await fetch(`${this.baseUrl}/v1/agreements`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    if (!res.ok) await throwFromResponse(res);
    return res.json() as Promise<Agreement>;
  }

  /** Get a single agreement by ID. */
  async get(
    id: string,
    options?: { includeContent?: boolean },
  ): Promise<Agreement> {
    const params = options?.includeContent ? '?include=content' : '';
    const res = await fetch(`${this.baseUrl}/v1/agreements/${id}${params}`, {
      headers: this.headers(),
    });
    if (!res.ok) await throwFromResponse(res);
    return res.json() as Promise<Agreement>;
  }

  /** List agreements with filters. */
  async list(
    params?: ListAgreementsParams,
  ): Promise<PaginatedResponse<Agreement>> {
    const query = params ? '?' + toSearchParams(params as unknown as Record<string, unknown>) : '';
    const res = await fetch(`${this.baseUrl}/v1/agreements${query}`, {
      headers: this.headers(),
    });
    if (!res.ok) await throwFromResponse(res);
    return res.json() as Promise<PaginatedResponse<Agreement>>;
  }

  /** Search agreements by text query. */
  async search(
    params: SearchAgreementsParams,
  ): Promise<PaginatedResponse<Agreement>> {
    const query = '?' + toSearchParams(params as unknown as Record<string, unknown>);
    const res = await fetch(`${this.baseUrl}/v1/agreements/search${query}`, {
      headers: this.headers(),
    });
    if (!res.ok) await throwFromResponse(res);
    return res.json() as Promise<PaginatedResponse<Agreement>>;
  }

  /** Create up to 50 agreements in a single call. */
  async batchCreate(
    params: BatchCreateParams,
    options?: { idempotencyKey?: string },
  ): Promise<BatchCreateResult> {
    const headers: Record<string, string> = {
      ...this.headers(),
      'Content-Type': 'application/json',
    };
    if (options?.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }
    const res = await fetch(`${this.baseUrl}/v1/agreements/batch`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    if (!res.ok) await throwFromResponse(res);
    return res.json() as Promise<BatchCreateResult>;
  }

  /** Cancel a pending agreement. */
  async cancel(id: string): Promise<Agreement> {
    const res = await fetch(`${this.baseUrl}/v1/agreements/${id}/cancel`, {
      method: 'POST',
      headers: this.headers(),
    });
    if (!res.ok) await throwFromResponse(res);
    return res.json() as Promise<Agreement>;
  }

  /** Resend the signing email. */
  async resend(id: string): Promise<Agreement> {
    const res = await fetch(`${this.baseUrl}/v1/agreements/${id}/resend`, {
      method: 'POST',
      headers: this.headers(),
    });
    if (!res.ok) await throwFromResponse(res);
    return res.json() as Promise<Agreement>;
  }

  /** Get agreement status (supports public access via status_token). */
  async getStatus(
    id: string,
    statusToken?: string,
  ): Promise<{ status: string }> {
    const query = statusToken ? `?status_token=${statusToken}` : '';
    const res = await fetch(
      `${this.baseUrl}/v1/agreements/${id}/status${query}`,
      { headers: this.headers() },
    );
    if (!res.ok) await throwFromResponse(res);
    return res.json() as Promise<{ status: string }>;
  }

  /** Get the signed document metadata, or PDF binary. */
  async getDocument(
    id: string,
    format?: 'json' | 'pdf',
  ): Promise<Response> {
    const query = format === 'pdf' ? '?format=pdf' : '';
    const res = await fetch(
      `${this.baseUrl}/v1/agreements/${id}/document${query}`,
      { headers: this.headers() },
    );
    if (!res.ok) await throwFromResponse(res);
    return res;
  }

  /** Download the PDF certificate of completion. */
  async getCertificate(id: string): Promise<Response> {
    const res = await fetch(
      `${this.baseUrl}/v1/agreements/${id}/certificate`,
      { headers: this.headers() },
    );
    if (!res.ok) await throwFromResponse(res);
    return res;
  }

  /** Get the full audit trail for an agreement. */
  async getAuditTrail(id: string): Promise<AuditTrail> {
    const res = await fetch(
      `${this.baseUrl}/v1/agreements/${id}/audit-trail`,
      { headers: this.headers() },
    );
    if (!res.ok) await throwFromResponse(res);
    return res.json() as Promise<AuditTrail>;
  }

  /** Get per-signer status for a multi-signer agreement. */
  async getSigners(id: string): Promise<{ signers: SignerStatus[] }> {
    const res = await fetch(
      `${this.baseUrl}/v1/agreements/${id}/signers`,
      { headers: this.headers() },
    );
    if (!res.ok) await throwFromResponse(res);
    return res.json() as Promise<{ signers: SignerStatus[] }>;
  }

  /** Regenerate the signing URL (invalidates the old one). */
  async regenerateSigningUrl(
    id: string,
  ): Promise<{ agreement_id: string; signing_url: string; expires_at: string }> {
    const res = await fetch(
      `${this.baseUrl}/v1/agreements/${id}/signing-url`,
      { method: 'POST', headers: this.headers() },
    );
    if (!res.ok) await throwFromResponse(res);
    return res.json();
  }
}

function toSearchParams(obj: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  }
  return params.toString();
}
