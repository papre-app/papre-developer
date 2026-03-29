// ─── Agreement Status ──────────────────────────────────────────────

export type AgreementStatus =
  | 'pending'
  | 'sent'
  | 'viewed'
  | 'signed'
  | 'expired'
  | 'cancelled'
  | 'declined'
  | 'draft';

// ─── Core Resources ────────────────────────────────────────────────

export interface Agreement {
  agreement_id: string;
  template_id: string;
  status: AgreementStatus;
  signer_email: string | null;
  signer_name: string | null;
  signers: Signer[] | null;
  signing_url: string | null;
  merge_fields: Record<string, unknown>;
  signed_at: string | null;
  blockchain_tx: string | null;
  signed_document_url: string | null;
  external_reference: string | null;
  external_group_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  expires_at: string | null;
  viewed_at: string | null;
  reminder_count: number;
  embed_mode: boolean;
  document_hash: string | null;
  signer_identity_hash: string | null;
  filled_document?: string | null;
}

export interface Template {
  template_id: string;
  template_name: string;
  template_type: string;
  merge_fields: MergeField[];
  status: 'active' | 'draft' | 'archived';
  created_at: string;
  updated_at: string;
  description?: string | null;
}

export interface MergeField {
  field_key: string;
  field_label: string;
  field_type: 'text' | 'date' | 'email' | 'number';
  required: boolean;
}

export interface Draft {
  draft_id: string;
  template_id: string;
  status: 'draft';
  signer_email: string | null;
  signer_name: string | null;
  merge_fields: Record<string, unknown>;
  external_reference: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  filled_document?: string | null;
}

export interface Signer {
  signer_email: string;
  signer_name: string;
  role?: string;
}

export interface SignerStatus extends Signer {
  status: 'pending' | 'sent' | 'viewed' | 'signed' | 'declined';
  signed_at: string | null;
  viewed_at: string | null;
  signing_url: string;
  order: number;
}

export interface Webhook {
  webhook_id: string;
  url: string;
  events: WebhookEventType[];
  created_at: string;
  active: boolean;
}

export type WebhookEventType =
  | 'agreement.signed'
  | 'agreement.viewed'
  | 'agreement.expired'
  | 'agreement.declined'
  | 'agreement.cancelled';

export interface WebhookEvent {
  event_type: WebhookEventType;
  agreement_id: string;
  status: AgreementStatus;
  signer_email: string;
  signer_name: string;
  signed_at?: string;
  blockchain_tx?: string;
  external_reference?: string | null;
  external_group_id?: string | null;
  metadata?: Record<string, unknown> | null;
  timestamp: string;
}

// ─── Embedded Signing ──────────────────────────────────────────────

export interface BrowserSession {
  browser_session_token: string;
  expires_at: string;
  scope: string;
  agreement_id: string;
}

export interface SigningIntent {
  agreement_id: string;
  intent_token: string;
  filled_document: string;
  document_hash: string;
  expires_at: string;
}

export interface SigningResult {
  status: 'signed';
  agreement_id: string;
  signed_at: string;
  blockchain_tx: string | null;
  certificate_url: string;
}

// ─── Audit Trail ───────────────────────────────────────────────────

export interface AuditTrailEvent {
  event_type: string;
  timestamp: string;
  actor: string;
  details: Record<string, unknown>;
}

export interface AuditTrail {
  agreement_id: string;
  events: AuditTrailEvent[];
}

// ─── Template Content ──────────────────────────────────────────────

export interface TemplateContent {
  template_id: string;
  raw_content: string;
  filled_preview: string;
  merge_fields: MergeField[];
}

// ─── Pagination ────────────────────────────────────────────────────

export interface Pagination {
  page: number;
  per_page: number;
  total_items: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

// ─── Errors ────────────────────────────────────────────────────────

export interface PapreErrorBody {
  error: {
    code: string;
    message: string;
    status: number;
  };
}

// ─── Request Parameters ────────────────────────────────────────────

export interface CreateAgreementParams {
  template_id: string;
  signer_email?: string;
  signer_name?: string;
  signers?: Signer[];
  signing_order?: 'parallel' | 'sequential';
  merge_fields: Record<string, unknown>;
  external_reference?: string;
  external_group_id?: string;
  callback_url?: string;
  redirect_url?: string;
  expiration?: string;
  metadata?: Record<string, unknown>;
  embed_mode?: boolean;
}

export interface ListAgreementsParams {
  status?: AgreementStatus;
  external_group_id?: string;
  external_reference?: string;
  template_id?: string;
  created_after?: string;
  created_before?: string;
  page?: number;
  per_page?: number;
}

export interface SearchAgreementsParams {
  q: string;
  status?: AgreementStatus;
  page?: number;
  per_page?: number;
}

export interface ListTemplatesParams {
  type: string;
  status?: 'active' | 'draft' | 'archived';
  page?: number;
  per_page?: number;
}

export interface CreateDraftParams {
  template_id: string;
  signer_email?: string;
  signer_name?: string;
  merge_fields?: Record<string, unknown>;
  external_reference?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateDraftParams {
  signer_email?: string;
  signer_name?: string;
  merge_fields?: Record<string, unknown>;
  external_reference?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateWebhookParams {
  url: string;
  events: WebhookEventType[];
}

export interface CreateBrowserSessionParams {
  scope: 'agreements:sign';
  agreement_id: string;
  ttl?: number;
}

export interface SubmitSignatureParams {
  agreement_id: string;
  intent_token: string;
  document_hash: string;
  consent_given: true;
  signer_ip?: string | null;
  signer_user_agent?: string;
}

export interface BatchCreateParams {
  agreements: CreateAgreementParams[];
}

export interface BatchCreateResult {
  data: Agreement[];
  errors: Array<{
    index: number;
    error: {
      code: string;
      message: string;
      status: number;
    };
  }>;
}

// ─── Client Options ────────────────────────────────────────────────

export interface PapreClientOptions {
  apiKey: string;
  baseUrl?: string;
}
