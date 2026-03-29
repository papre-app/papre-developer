export { PapreClient } from './client.js';
export { PapreError } from './errors.js';
export { WebhooksAPI } from './webhooks.js';

export type {
  // Core resources
  Agreement,
  AgreementStatus,
  Template,
  MergeField,
  Draft,
  Signer,
  SignerStatus,
  Webhook,
  WebhookEvent,
  WebhookEventType,

  // Embedded signing
  BrowserSession,
  SigningIntent,
  SigningResult,

  // Audit trail
  AuditTrail,
  AuditTrailEvent,

  // Template content
  TemplateContent,

  // Pagination
  Pagination,
  PaginatedResponse,

  // Errors
  PapreErrorBody,

  // Request params
  CreateAgreementParams,
  ListAgreementsParams,
  SearchAgreementsParams,
  ListTemplatesParams,
  CreateDraftParams,
  UpdateDraftParams,
  CreateWebhookParams,
  CreateBrowserSessionParams,
  SubmitSignatureParams,
  BatchCreateParams,
  BatchCreateResult,

  // Client
  PapreClientOptions,
} from './types.js';
