import type {
  ListTemplatesParams,
  PaginatedResponse,
  Template,
  TemplateContent,
} from './types.js';
import { throwFromResponse } from './errors.js';

export class TemplatesAPI {
  constructor(
    private baseUrl: string,
    private headers: () => Record<string, string>,
  ) {}

  /** List templates filtered by type. */
  async list(params: ListTemplatesParams): Promise<PaginatedResponse<Template>> {
    const query = new URLSearchParams();
    query.set('type', params.type);
    if (params.status) query.set('status', params.status);
    if (params.page) query.set('page', String(params.page));
    if (params.per_page) query.set('per_page', String(params.per_page));

    const res = await fetch(`${this.baseUrl}/v1/templates?${query}`, {
      headers: this.headers(),
    });
    if (!res.ok) await throwFromResponse(res);
    return res.json() as Promise<PaginatedResponse<Template>>;
  }

  /** Get a single template with merge field definitions. */
  async get(id: string): Promise<Template> {
    const res = await fetch(`${this.baseUrl}/v1/templates/${id}`, {
      headers: this.headers(),
    });
    if (!res.ok) await throwFromResponse(res);
    return res.json() as Promise<Template>;
  }

  /** Get raw template content and an optional filled preview. */
  async getContent(
    id: string,
    sampleFields?: Record<string, string>,
  ): Promise<TemplateContent> {
    const query = sampleFields
      ? '?sample_fields=' + encodeURIComponent(JSON.stringify(sampleFields))
      : '';
    const res = await fetch(`${this.baseUrl}/v1/templates/${id}/content${query}`, {
      headers: this.headers(),
    });
    if (!res.ok) await throwFromResponse(res);
    return res.json() as Promise<TemplateContent>;
  }
}
