import type { PapreClientOptions } from './types.js';
import { AgreementsAPI } from './agreements.js';
import { TemplatesAPI } from './templates.js';
import { DraftsAPI } from './drafts.js';
import { WebhooksAPI } from './webhooks.js';
import { EmbeddedAPI } from './embedded.js';

const DEFAULT_BASE_URL = 'https://papre-api.vercel.app/api';

/**
 * Papre API client.
 *
 * ```typescript
 * const papre = new PapreClient({ apiKey: 'papre_live_sk_...' });
 * const agreement = await papre.agreements.create({ ... });
 * ```
 */
export class PapreClient {
  readonly agreements: AgreementsAPI;
  readonly templates: TemplatesAPI;
  readonly drafts: DraftsAPI;
  readonly webhooks: WebhooksAPI;
  readonly embedded: EmbeddedAPI;

  private apiKey: string;
  private baseUrl: string;

  constructor(options: PapreClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;

    const headers = () => ({
      Authorization: `Bearer ${this.apiKey}`,
    });

    this.agreements = new AgreementsAPI(this.baseUrl, headers);
    this.templates = new TemplatesAPI(this.baseUrl, headers);
    this.drafts = new DraftsAPI(this.baseUrl, headers);
    this.webhooks = new WebhooksAPI(this.baseUrl, headers);
    this.embedded = new EmbeddedAPI(this.baseUrl, headers);
  }
}
