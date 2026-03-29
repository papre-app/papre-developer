import type {
  Agreement,
  CreateDraftParams,
  Draft,
  PaginatedResponse,
  UpdateDraftParams,
} from './types.js';
import { throwFromResponse } from './errors.js';

export class DraftsAPI {
  constructor(
    private baseUrl: string,
    private headers: () => Record<string, string>,
  ) {}

  /** Create a draft agreement. */
  async create(params: CreateDraftParams): Promise<Draft> {
    const res = await fetch(`${this.baseUrl}/v1/drafts`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) await throwFromResponse(res);
    return res.json() as Promise<Draft>;
  }

  /** Get a draft with filled content preview. */
  async get(id: string): Promise<Draft> {
    const res = await fetch(`${this.baseUrl}/v1/drafts/${id}`, {
      headers: this.headers(),
    });
    if (!res.ok) await throwFromResponse(res);
    return res.json() as Promise<Draft>;
  }

  /** List drafts for the authenticated account. */
  async list(params?: {
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<Draft>> {
    const query = params
      ? '?' + new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]),
        )
      : '';
    const res = await fetch(`${this.baseUrl}/v1/drafts${query}`, {
      headers: this.headers(),
    });
    if (!res.ok) await throwFromResponse(res);
    return res.json() as Promise<PaginatedResponse<Draft>>;
  }

  /** Update a draft (merge_fields are merged, not replaced). */
  async update(id: string, params: UpdateDraftParams): Promise<Draft> {
    const res = await fetch(`${this.baseUrl}/v1/drafts/${id}`, {
      method: 'PATCH',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) await throwFromResponse(res);
    return res.json() as Promise<Draft>;
  }

  /** Permanently delete a draft. */
  async delete(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/v1/drafts/${id}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok) await throwFromResponse(res);
  }

  /** Convert a draft into a live agreement and send for signing. */
  async send(id: string): Promise<Agreement> {
    const res = await fetch(`${this.baseUrl}/v1/drafts/${id}/send`, {
      method: 'POST',
      headers: this.headers(),
    });
    if (!res.ok) await throwFromResponse(res);
    return res.json() as Promise<Agreement>;
  }
}
