# Papre REST API Reference

**v1.3 | March 2026**

---

## Changelog

### v1.3 (2026-03-26)

**Signing Security:**
- New section 16: Signing Security — document integrity, signer identity verification, and evidence hashing.
- Agreements now store `document_hash` (SHA-256 of rendered document) and `signer_identity_hash` (SHA-256 of normalized email+name) at creation time.
- `POST /v1/sign/{token}` now supports optional `signer_email` and `signer_name` in the request body for identity verification. Document tamper detection recomputes the document hash and compares to the creation-time reference.
- Embedded signing (`POST /v1/embed/signing-intent`) no longer derives signer identity from `signer_fields`. Identity-related keys (`customerEmail`, `customerName`, etc.) are stripped from `signer_fields` automatically.
- `POST /v1/embed/sign` no longer overrides `signer_name`/`signer_email` from intent data. Signer identity is immutable after agreement creation.
- Signing evidence now includes `ip_address` and `user_agent`. An `evidence_hash` (SHA-256) is computed and stored alongside the agreement.
- New error codes: `document_tampered` (409), `signer_mismatch` (403), `signer_identity_mismatch` (403).
- Phase 3 (future): `PapreSigningRegistry` on-chain contract for queryable verification of document, identity, and evidence hashes.

---

### v1.2 (2026-03-25)

**Drafts API (Phase 1B):**
- New section 11: full Drafts API covering create, list, get, update, delete, and send endpoints.
- Drafts allow partial agreement creation — fields can be filled incrementally before sending.
- New auth scopes: `drafts:read`, `drafts:write`.

**Template Content Endpoint (Phase 1A):**
- `GET /v1/templates/{id}/content` — returns raw template body and a preview with merge fields filled using sample data.

**Agreement Enhancements:**
- `GET /v1/agreements/{id}?include=content` — optionally embed filled document content in the agreement response.
- `POST /v1/agreements/{id}/signing-url` — regenerate a signing URL after the original expires.
- `GET /v1/agreements/{id}/audit-trail` — full event history for an agreement.
- `GET /v1/agreements/{id}/certificate` — download a PDF certificate of completion.
- `GET /v1/agreements/{id}/signers` — per-signer status for multi-signer agreements.
- `GET /v1/agreements/search?q=term` — full-text search across agreements.
- `embed_mode: true` on agreement creation for embedded signing flows.

**Embedded Signing (Phase 2):**
- New section 12: embedded signing flow with `POST /v1/embed/signing-intent` and `POST /v1/embed/sign`.
- New auth scope: `agreements:sign`.

**Multi-Signer (Phase 4):**
- `signers[]` array on agreement creation to support multiple signers.
- `signing_order` field: `parallel` (default) or `sequential`.
- New section 13: Multi-Signer Agreements.

**Auth Scopes:**
- New section 14: Auth Scopes reference covering all scopes.

**Draft Lifecycle:**
- New section 15: Draft Lifecycle explaining the draft-to-agreement flow.

---

### v1.1 (2026-02-25)

**Document Rendering on Signing Page:**
- `GET /v1/sign/{token}` now returns `filled_document` — the complete agreement text with merge fields populated, rendered as markdown. The signing page displays this document for the signer to review before signing.

**Merge Fields in API Responses:**
- All agreement responses (`GET /v1/agreements`, `GET /v1/agreements/{id}`, `POST /v1/agreements`, batch, signing) now include `merge_fields` — the key-value pairs used to populate the template.

**PDF Document Enhancement:**
- `GET /v1/agreements/{id}/document?format=pdf` now renders the full filled agreement text in the PDF body with proper formatting, word-wrapping, and multi-page support. Previously only showed a metadata table.

**Dashboard Integration:**
- New endpoint: `GET /v1/dashboard/agreements` (Privy token auth) — returns v1 API agreements for the web Dashboard. API-created agreements now appear alongside on-chain agreements in the user's Dashboard.

**Test Coverage:**
- Added 79 unit tests covering agreement CRUD, merge field utilities, signing endpoint, and dashboard endpoint.

---

## Purpose

This document defines every data point the Papre API needs to expose so that any integration can create waiver agreements, route them to the correct signers, track signing status, and receive completion notifications.

The API is designed generically so any application with a Papre account can integrate agreements into their workflows.

## Current Platform Capabilities

The Papre platform (pap.re) currently supports creating and managing waivers with an originator (the business) and a signer, coordinated via email for blockchain-based signing. The API needs to expose these capabilities programmatically so external systems can create and manage agreements without using the Papre web interface directly.

---

## 1. Authentication & Account

Your application needs to authenticate as a Papre account holder. Each Papre account corresponds to a single Privy-authenticated user — there is no separate org or team layer. One API key per account.

### 1.1 Required Endpoints

| Endpoint           | Method | Purpose                                              |
|--------------------|--------|------------------------------------------------------|
| `/v1/auth/api-key` | POST   | Generate or validate an API key for a Papre account  |
| `/v1/account/me`   | GET    | Return the authenticated account's profile           |

### 1.2 Data Points Needed

| Field            | Type   | Description                                                  |
|------------------|--------|--------------------------------------------------------------|
| `api_key`        | string | Live API key. Prefixed `papre_live_` (see Section 8).        |
| `test_api_key`   | string | Test/sandbox API key. Prefixed `papre_test_` (see Section 8). Returned alongside `api_key` in a single call. |
| `account_id`     | string | Unique Papre account identifier for the originator.          |
|                  |        | Maps 1:1 to a Privy user — no org/team abstraction needed.   |
| `account_name`   | string | Business name associated with the account                    |
| `account_email`  | string | Primary email for the account (used as originator email)     |
| `webhook_secret` | string | Shared secret for verifying inbound webhook signatures       |

**Note:** The `POST /v1/auth/api-key` endpoint returns both `api_key` and `test_api_key` in a single response, along with `account_id` and `webhook_secret`. There is no separate endpoint for test keys.

---

## 2. API Conventions

These conventions apply to every endpoint in the API.

### 2.1 Versioning

All endpoints are prefixed with `/v1/`. Future breaking changes will increment to `/v2/`, etc. The version prefix is required on every request.

```
https://api.papre.com/v1/templates
https://api.papre.com/v1/agreements
```

### 2.2 Authentication

All requests must include the API key in the `Authorization` header:

```
Authorization: Bearer papre_live_sk_abc123...
```

### 2.3 Pagination

All list endpoints support pagination via query parameters:

| Parameter  | Type    | Default | Description                |
|------------|---------|---------|----------------------------|
| `page`     | integer | 1       | Page number (1-indexed)    |
| `per_page` | integer | 25      | Items per page (max 100)   |

List responses use a standard envelope:

```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "per_page": 25,
    "total_items": 142,
    "total_pages": 6
  }
}
```

### 2.4 Error Format

All errors return a consistent JSON structure:

```json
{
  "error": {
    "code": "invalid_template_id",
    "message": "Template 'tmpl_xyz' not found or is not active.",
    "status": 404
  }
}
```

| Field     | Type    | Description                                  |
|-----------|---------|----------------------------------------------|
| `code`    | string  | Machine-readable error code (snake_case)     |
| `message` | string  | Human-readable explanation                   |
| `status`  | integer | HTTP status code (mirrored in response)      |

### 2.5 Rate Limiting

Rate limit status is communicated via response headers on every request:

| Header                  | Description                                    |
|-------------------------|------------------------------------------------|
| `X-RateLimit-Limit`     | Max requests allowed in the current window     |
| `X-RateLimit-Remaining` | Requests remaining in the current window       |
| `X-RateLimit-Reset`     | Unix timestamp when the window resets          |

When the limit is exceeded, the API returns `429 Too Many Requests` with the standard error format.

### 2.6 Idempotency

POST endpoints that create resources accept an `Idempotency-Key` header to prevent duplicate creation on retries:

```
Idempotency-Key: booking-12345-participant-67890
```

If a request with the same idempotency key has already been processed, the API returns the original response with a `200` status instead of creating a duplicate. Keys expire after 24 hours.

---

## 3. Waiver Templates

Businesses create waiver templates in the Papre dashboard, then reference them by ID when creating agreements via the API. Your application needs to list available templates and understand their merge fields.

### 3.1 Required Endpoints

| Endpoint                        | Method | Purpose                                                  |
|---------------------------------|--------|----------------------------------------------------------|
| `/v1/templates`                 | GET    | List templates for this account, filtered by type        |
| `/v1/templates/{id}`            | GET    | Get a single template with its merge field definitions   |
| `/v1/templates/{id}/content`    | GET    | Raw template body and filled preview (see 3.5)           |

### 3.2 Query Parameters for `GET /v1/templates`

| Parameter  | Type    | Required | Description                                                                                                    |
|------------|---------|----------|----------------------------------------------------------------------------------------------------------------|
| `type`     | string  | Yes      | Filter by template type: `waiver`, `agreement`, `consent`, etc. Only returns templates matching the specified type. |
| `status`   | string  | No       | Filter by status: `active`, `draft`, `archived`. Defaults to `active`.                                         |
| `page`     | integer | No       | Page number (see Section 2.3)                                                                                  |
| `per_page` | integer | No       | Items per page (see Section 2.3)                                                                               |

### 3.3 Data Points Needed (per template)

**List view** (`GET /v1/templates`):

| Field           | Type     | Description                                                    |
|-----------------|----------|----------------------------------------------------------------|
| `template_id`   | string   | Unique identifier for the template                             |
| `template_name` | string   | Human-readable name (e.g., "Adult Liability Waiver")           |
| `template_type` | string   | Category: `waiver`, `agreement`, `consent`, etc.               |
| `merge_fields`  | array    | List of dynamic fields the template expects (see 3.4)          |
| `status`        | string   | Whether the template is `active` / `draft` / `archived`        |
| `created_at`    | datetime | When the template was created                                  |
| `updated_at`    | datetime | Last modification timestamp                                    |

**Single template** (`GET /v1/templates/{id}`) returns all fields above plus:

| Field           | Type           | Description                                             |
|-----------------|----------------|---------------------------------------------------------|
| `description`   | string \| null | Detailed description of the template (not in list view) |

### 3.4 Merge Fields Definition

Each template defines what dynamic data it expects so your application knows what to pass when creating an agreement. For a booking platform, the waiver template will have fields like participant name, event name, event date, etc.

| Field         | Type    | Description                                                |
|---------------|---------|------------------------------------------------------------|
| `field_key`   | string  | Machine-readable key (e.g., `participant_name`)            |
| `field_label` | string  | Human label (e.g., "Participant Full Name")                |
| `field_type`  | string  | Data type: `text`, `date`, `email`, `number`               |
| `required`    | boolean | Whether this field must be provided at creation time       |

### 3.5 Template Content Endpoint

`GET /v1/templates/{id}/content` returns the raw template body and an optional filled preview using caller-supplied sample values.

**Query Parameters:**

| Parameter       | Type   | Required | Description                                                    |
|-----------------|--------|----------|----------------------------------------------------------------|
| `sample_fields` | object | No       | JSON-encoded key-value pairs to use as merge field values in the preview |

**Response (HTTP `200`):**

```json
{
  "template_id": "tmpl_adult_waiver",
  "raw_content": "## Liability Waiver\n\nI, {{participant_name}}, acknowledge that I am participating in {{event_name}} on {{event_date}}...",
  "filled_preview": "## Liability Waiver\n\nI, Alice Johnson, acknowledge that I am participating in Annual Company Retreat on 2026-03-15...",
  "merge_fields": [
    { "field_key": "participant_name", "field_label": "Participant Full Name", "field_type": "text", "required": true },
    { "field_key": "event_name", "field_label": "Event Name", "field_type": "text", "required": true },
    { "field_key": "event_date", "field_label": "Event Date", "field_type": "date", "required": true }
  ]
}
```

| Field           | Type   | Description                                                       |
|-----------------|--------|-------------------------------------------------------------------|
| `template_id`   | string | Identifier of the template                                        |
| `raw_content`   | string | Template body with `{{field_key}}` placeholders intact            |
| `filled_preview`| string | Template body with placeholders replaced by `sample_fields` values, or placeholder labels where no sample was supplied |
| `merge_fields`  | array  | Full merge field definitions (same shape as Section 3.4)          |

---

## 4. Agreement (Waiver) Creation

This is the most critical endpoint. Your application creates one agreement per participant, per booking. It must support setting the signer's email, populating merge fields, and optionally specifying a different signing experience for minors vs. adults.

### 4.1 Required Endpoints

| Endpoint                       | Method | Purpose                                                       |
|--------------------------------|--------|---------------------------------------------------------------|
| `/v1/agreements`               | POST   | Create a new agreement from a template and send for signing   |
| `/v1/agreements/batch`         | POST   | Create multiple agreements in one call (see 4.4)              |
| `/v1/agreements/{id}`          | GET    | Retrieve a single agreement's full details and status         |
| `/v1/agreements`               | GET    | List agreements with filters (status, date range, reference)  |
| `/v1/agreements/{id}/resend`   | POST   | Resend the signing link email to the signer                   |
| `/v1/agreements/{id}/cancel`   | POST   | Cancel/void a pending agreement                               |

### 4.2 Create Agreement — Request

This is what your application sends TO the API when creating a waiver for each participant.

**Headers:**

| Header            | Required    | Description                                                                                                      |
|-------------------|-------------|------------------------------------------------------------------------------------------------------------------|
| `Authorization`   | Yes         | `Bearer papre_live_sk_...`                                                                                       |
| `Idempotency-Key` | Recommended | Prevents duplicate creation on retry (see Section 2.6). Suggested format: `{booking_id}-{participant_id}`        |

**Body:**

| Field                | Type     | Required | Description                                                                                                                                                                                |
|----------------------|----------|----------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `template_id`        | string   | Yes      | Which waiver template to use                                                                                                                                                               |
| `signer_email`       | string   | Yes*     | Email address that receives the signing link. Required unless `signers[]` is provided (see Section 13). |
| `signer_name`        | string   | Yes*     | Full name of the person who will sign. Required unless `signers[]` is provided (see Section 13).        |
| `signers`            | array    | No       | Array of signer objects for multi-signer agreements (see Section 13). If provided, `signer_email` and `signer_name` are ignored. |
| `signing_order`      | string   | No       | `parallel` (default) or `sequential`. Only meaningful when `signers[]` has more than one entry.         |
| `merge_fields`       | object   | Yes      | Key-value pairs matching the template's defined merge fields                                                                                                                               |
| `external_reference` | string   | No       | Your application's internal ID (e.g., `participant_id`) for correlation                                                                                                                              |
| `external_group_id`  | string   | No       | Group/booking reference for batch lookups                                                                                                                                                  |
| `callback_url`       | string   | No       | Override webhook URL for this specific agreement                                                                                                                                           |
| `redirect_url`       | string   | No       | Where to send the signer after completing signing. Defaults to a Papre-hosted confirmation page. |
| `expiration`         | datetime | No       | When the signing link expires                                                                                                                                                              |
| `metadata`           | object   | No       | Arbitrary key-value data returned in webhooks                                                                                                                                              |
| `embed_mode`         | boolean  | No       | Set `true` to prepare this agreement for embedded signing. Suppresses the signing email and returns a signing intent token instead. See Section 12. |

### 4.3 Create Agreement — Response

What the API returns after successfully creating an agreement. The response includes the full agreement object from `the standard agreement formatter`:

| Field                 | Type           | Description                                                                      |
|-----------------------|----------------|----------------------------------------------------------------------------------|
| `agreement_id`        | string         | Papre's unique ID for this agreement (the `waiver_id` your application stores)         |
| `template_id`         | string         | Template used to create this agreement                                           |
| `status`              | string         | Initial status: `pending` or `sent`                                              |
| `signer_email`        | string         | Confirmed email the signing link was sent to (null for multi-signer; see `signers`) |
| `signer_name`         | string         | Name of the signer (null for multi-signer; see `signers`)                        |
| `signers`             | array \| null  | Array of signer objects when `signers[]` was provided at creation (see Section 13) |
| `signing_url`         | string         | Direct URL the signer uses to sign (for admin Copy Link feature; null for multi-signer) |
| `merge_fields`        | object         | Key-value pairs of populated merge field values                                  |
| `signed_at`           | datetime       | Null at creation                                                                 |
| `blockchain_tx`       | string \| null | Null at creation                                                                 |
| `signed_document_url` | string \| null | Null at creation                                                                 |
| `external_reference`  | string \| null | Echoed back for integration correlation                                               |
| `external_group_id`   | string \| null | Group/booking reference echoed back                                              |
| `metadata`            | object \| null | Arbitrary data echoed back                                                       |
| `created_at`          | datetime       | Timestamp of creation                                                            |
| `expires_at`          | datetime       | When the signing link expires (if set)                                           |
| `viewed_at`           | datetime       | Null at creation                                                                 |
| `reminder_count`      | integer        | 0 at creation                                                                    |
| `embed_mode`          | boolean        | Whether this agreement was created in embedded signing mode                      |

### 4.4 Batch Agreement Creation

For bookings with multiple participants, your application can create all agreements in a single API call instead of looping.

**`POST /v1/agreements/batch`**

**Headers:**

| Header             | Required    | Description                                                                       |
|--------------------|-------------|-----------------------------------------------------------------------------------|
| `Authorization`    | Yes         | `Bearer papre_live_sk_...`                                                        |
| `Idempotency-Key`  | Recommended | Prevents duplicate batch on retry. Suggested format: `{booking_id}-batch`         |

**Request Body:**

Maximum batch size: **50 agreements** per call.

```json
{
  "agreements": [
    {
      "template_id": "tmpl_adult_waiver",
      "signer_email": "alice@example.com",
      "signer_name": "Alice Johnson",
      "merge_fields": {
        "participant_name": "Alice Johnson",
        "event_name": "Annual Company Retreat",
        "event_date": "2026-03-15"
      },
      "external_reference": "participant_101",
      "external_group_id": "booking_42"
    },
    {
      "template_id": "tmpl_minor_waiver",
      "signer_email": "bob@example.com",
      "signer_name": "Bob Smith",
      "merge_fields": {
        "participant_name": "Charlie Smith",
        "guardian_name": "Bob Smith",
        "event_name": "Annual Company Retreat",
        "event_date": "2026-03-15"
      },
      "external_reference": "participant_102",
      "external_group_id": "booking_42"
    }
  ]
}
```

Each item in `agreements` accepts the same fields as the single-create endpoint (Section 4.2 body).

**Response:**

```json
{
  "data": [
    {
      "agreement_id": "agr_abc123",
      "template_id": "tmpl_adult_waiver",
      "status": "sent",
      "signer_email": "alice@example.com",
      "signer_name": "Alice Johnson",
      "signing_url": "https://sign.papre.com/agr_abc123",
      "signed_at": null,
      "blockchain_tx": null,
      "signed_document_url": null,
      "external_reference": "participant_101",
      "external_group_id": "booking_42",
      "metadata": null,
      "created_at": "2026-03-10T14:30:00Z",
      "expires_at": null,
      "viewed_at": null,
      "reminder_count": 0
    }
  ],
  "errors": []
}
```

Each item in `data` is a full agreement object (same shape as Section 4.3).

**HTTP Status Codes:**

| Status | Condition                                                  |
|--------|------------------------------------------------------------|
| `201`  | All agreements created successfully (empty `errors` array) |
| `201`  | Partial success — some created, some failed (`data` and `errors` both non-empty) |
| `422`  | All agreements failed validation (empty `data` array)      |

If some agreements in the batch fail validation while others succeed, the response includes both `data` (successful) and `errors` (failed) arrays. Each error entry includes the array index and error details:

```json
{
  "data": [ ... ],
  "errors": [
    {
      "index": 2,
      "error": {
        "code": "invalid_template_id",
        "message": "Template 'tmpl_xyz' not found or is not active.",
        "status": 422
      }
    }
  ]
}
```

---

## 5. Agreement Status & Retrieval

Your application needs to check agreement status on demand (not just via webhooks) for admin views, page loads, and fallback verification.

### 5.1 Agreement Status Values

| Status      | Meaning                                    | Integration Behavior                                        |
|-------------|--------------------------------------------|--------------------------------------------------------|
| `pending`   | Created but signing email not yet sent     | Show "Sending..." in admin                             |
| `sent`      | Signing link emailed to signer             | Show "Awaiting Signature"                              |
| `viewed`    | Signer has opened the signing link         | Show "Viewed" (optional but nice)                      |
| `signed`    | Signer completed signing on blockchain     | Mark participant waiver as signed, trigger rollup      |
| `expired`   | Signing link expired before completion     | Show "Expired" with option to recreate                 |
| `cancelled` | Agreement voided by originator             | Mark as cancelled in your application                            |
| `declined`  | Signer explicitly declined to sign         | Alert admin, flag participant                          |
| `draft`     | Saved as draft, not yet sent               | Show "Draft" in admin; see Section 11                  |

### 5.2 Get Agreement Response

Full agreement details returned by `GET /v1/agreements/{id}`:

| Field                 | Type           | Description                                                    |
|-----------------------|----------------|----------------------------------------------------------------|
| `agreement_id`        | string         | Unique identifier                                              |
| `template_id`         | string         | Template used to create this agreement                         |
| `status`              | string         | Current status (see 5.1)                                       |
| `signer_email`        | string         | Who received the signing link                                  |
| `signer_name`         | string         | Name of the signer                                             |
| `signing_url`         | string         | The signing link URL                                           |
| `merge_fields`        | object         | Key-value pairs of populated merge field values                |
| `signed_at`           | datetime       | Timestamp when signed (null if not yet signed)                 |
| `blockchain_tx`       | string \| null | Transaction hash on Avalanche (proof of signing)               |
| `signed_document_url` | string \| null | URL to download the signed PDF/document                        |
| `external_reference`  | string \| null | Your application's reference ID echoed back                          |
| `external_group_id`   | string \| null | Group/booking reference echoed back                            |
| `metadata`            | object \| null | Arbitrary data echoed back                                     |
| `created_at`          | datetime       | When created                                                   |
| `expires_at`          | datetime       | When the signing link expires                                  |
| `viewed_at`           | datetime       | When the signer first opened the link (if tracked)             |
| `reminder_count`      | integer        | Number of reminder emails sent by Papre (if applicable)        |

**Including document content in the response:**

Append `?include=content` to embed the filled document text directly in the agreement response. This avoids a separate call to the signing page endpoint when the document content is needed alongside agreement metadata.

```
GET /v1/agreements/agr_abc123?include=content
```

When `include=content` is present, the response adds:

| Field            | Type           | Description                                                        |
|------------------|----------------|--------------------------------------------------------------------|
| `filled_document`| string \| null | Complete agreement text with merge fields populated. Null if template content is unavailable. |

### 5.3 List Agreements

`GET /v1/agreements` supports filtering and pagination:

| Parameter            | Type     | Required | Description                                         |
|----------------------|----------|----------|-----------------------------------------------------|
| `status`             | string   | No       | Filter by status (see 5.1)                          |
| `external_group_id`  | string   | No       | Filter by booking/group reference                   |
| `external_reference` | string   | No       | Filter by your application's participant reference             |
| `template_id`        | string   | No       | Filter by template                                  |
| `created_after`      | datetime | No       | Only agreements created after this timestamp         |
| `created_before`     | datetime | No       | Only agreements created before this timestamp        |
| `page`               | integer  | No       | Page number (see Section 2.3)                        |
| `per_page`           | integer  | No       | Items per page (see Section 2.3)                     |

Response uses the standard pagination envelope (Section 2.3) wrapping an array of agreement objects.

### 5.4 Resend & Cancel Responses

Both `POST /v1/agreements/{id}/resend` and `POST /v1/agreements/{id}/cancel` return the full updated agreement object (same shape as Section 5.2) reflecting the new state.

### 5.5 Regenerate Signing URL

`POST /v1/agreements/{id}/signing-url` generates a new signing URL for an agreement whose original URL has expired or been used. The old URL is invalidated.

**Request body:** No body required.

**Response (HTTP `200`):**

```json
{
  "agreement_id": "agr_abc123",
  "signing_url": "https://sign.papre.com/agr_abc123?t=new_token_xyz",
  "expires_at": "2026-04-25T00:00:00Z"
}
```

**Error responses:**

| Status | Condition                                               |
|--------|---------------------------------------------------------|
| `404`  | Agreement not found                                     |
| `409`  | Agreement is already signed, cancelled, or declined     |

### 5.6 Audit Trail

`GET /v1/agreements/{id}/audit-trail` returns the full event history for an agreement in chronological order. Useful for compliance review and debugging.

**Response (HTTP `200`):**

```json
{
  "agreement_id": "agr_abc123",
  "events": [
    {
      "event_type": "agreement.created",
      "timestamp": "2026-03-10T14:30:00Z",
      "actor": "api_key",
      "details": { "template_id": "tmpl_adult_waiver" }
    },
    {
      "event_type": "agreement.sent",
      "timestamp": "2026-03-10T14:30:01Z",
      "actor": "system",
      "details": { "signer_email": "alice@example.com" }
    },
    {
      "event_type": "agreement.viewed",
      "timestamp": "2026-03-15T10:28:00Z",
      "actor": "signer",
      "details": { "ip_address": "203.0.113.12", "user_agent": "Mozilla/5.0..." }
    },
    {
      "event_type": "agreement.signed",
      "timestamp": "2026-03-15T10:30:00Z",
      "actor": "signer",
      "details": {
        "blockchain_tx": "0xabc123...",
        "document_hash": "sha256:def456..."
      }
    }
  ]
}
```

| Field        | Type     | Description                                        |
|--------------|----------|----------------------------------------------------|
| `event_type` | string   | Event name (mirrors webhook event types, Section 6.4) |
| `timestamp`  | datetime | When the event occurred                            |
| `actor`      | string   | Who triggered it: `api_key`, `signer`, `system`, `originator` |
| `details`    | object   | Event-specific data (contents vary by event type)  |

### 5.7 Certificate of Completion

`GET /v1/agreements/{id}/certificate` downloads a PDF certificate of completion suitable for record-keeping. The certificate includes signer identity, signing timestamp, document hash, and blockchain proof.

**Response (HTTP `200`):**
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="{agreement_id}-certificate.pdf"`

**Error: Agreement not yet signed (HTTP `409`):**

```json
{
  "error": {
    "code": "agreement_not_signed",
    "message": "Certificate is not available until the agreement is signed.",
    "status": 409
  }
}
```

### 5.8 Search Agreements

`GET /v1/agreements/search` performs full-text search across an account's agreements.

**Query Parameters:**

| Parameter  | Type    | Required | Description                                                              |
|------------|---------|----------|--------------------------------------------------------------------------|
| `q`        | string  | Yes      | Search term. Matched against signer name, signer email, merge field values, and external references. |
| `status`   | string  | No       | Filter results by status (see 5.1)                                       |
| `page`     | integer | No       | Page number (see Section 2.3)                                            |
| `per_page` | integer | No       | Items per page (see Section 2.3)                                         |

**Response:** Standard pagination envelope (Section 2.3) wrapping an array of agreement objects. Each object matches the shape in Section 5.2.

**Example:**

```
GET /v1/agreements/search?q=alice+johnson&status=signed
```

---

## 6. Webhooks (Papre -> Integration)

Webhooks are how your application learns about signing events in real-time. This is the backbone of the waiver rollup logic.

### 6.1 Webhook Registration

| Endpoint            | Method | Purpose                                                  |
|---------------------|--------|----------------------------------------------------------|
| `/v1/webhooks`      | POST   | Register a webhook URL for this account                  |
| `/v1/webhooks`      | GET    | List registered webhooks (paginated, see Section 2.3)    |
| `/v1/webhooks/{id}` | DELETE | Remove a webhook                                         |

**Create Webhook Response** (HTTP `201`):

```json
{
  "webhook_id": "whk_abc12345",
  "url": "https://example.com/webhook",
  "events": ["agreement.signed", "agreement.viewed"],
  "created_at": "2026-03-10T14:30:00Z"
}
```

Note: No `secret` field is returned — the shared `webhook_secret` for HMAC verification is provided once via the `POST /v1/auth/api-key` response (Section 1.2).

**Delete Webhook Response** (HTTP `200`):

```json
{
  "deleted": true
}
```

### 6.2 Webhook Payload (what Papre POSTs to your application)

Your application receives this at its registered endpoint (e.g., `/wp-json/tk-events/v1/waiver/webhook`):

| Field                 | Type     | Description                                                                                            |
|-----------------------|----------|--------------------------------------------------------------------------------------------------------|
| `event_type`          | string   | Event name (see 6.4)                                                                                   |
| `agreement_id`        | string   | Which agreement this event is about                                                                    |
| `status`              | string   | New status of the agreement                                                                            |
| `signer_email`        | string   | Email of the signer                                                                                    |
| `signer_name`         | string   | Name of the signer                                                                                     |
| `signed_at`           | datetime | When signing occurred (for signed events)                                                              |
| `blockchain_tx`       | string   | Transaction hash (for signed events)                                                                   |
| `signed_document_url` | string   | URL to the signed document (for signed events)                                                         |
| `external_reference`  | string   | Your application's `participant_id` for direct lookup                                                            |
| `external_group_id`   | string   | Your application's `booking_id` for group operations                                                             |
| `metadata`            | object   | Arbitrary data your application sent at creation                                                             |
| `timestamp`           | datetime | When this webhook event was generated                                                                  |
| `signature`           | string   | HMAC signature for webhook verification                                                                |

### 6.3 Webhook Security

The webhook must include a verifiable signature so your application can confirm it's legitimately from Papre. The standard approach is an HMAC-SHA256 of the payload body using the `webhook_secret` as the key, sent in the `X-Papre-Signature` header.

Verification pseudocode:

```
expected = HMAC-SHA256(webhook_secret, raw_request_body)
actual   = request.headers["X-Papre-Signature"]
valid    = constant_time_compare(expected, actual)
```

### 6.4 Webhook Events

| Event                  | Fired When                              |
|------------------------|-----------------------------------------|
| `agreement.created`    | Agreement created (including drafts sent) |
| `agreement.signed`     | Signer completes signing                |
| `agreement.viewed`     | Signer opens the signing link           |
| `agreement.expired`    | Signing link expires before completion  |
| `agreement.declined`   | Signer explicitly declines to sign      |
| `agreement.cancelled`  | Originator cancels/voids the agreement  |
| `draft.created`        | Draft saved via the Drafts API          |
| `draft.updated`        | Draft fields updated                    |
| `draft.sent`           | Draft finalized and sent for signing    |
| `draft.deleted`        | Draft deleted                           |

---

## 7. Signed Document Retrieval

After signing, the admin needs to download the completed waiver. Your application's admin panel has a "Download Signed Waiver" button per participant.

PDF documents are generated server-side by Papre from the signed agreement data and the filled template content. The PDF includes the complete agreement text with merge fields populated, signer details, and signing proof. Your application downloads the finished PDF via the API — it does not need to generate or render any documents itself.

### 7.1 Required Endpoints

| Endpoint                         | Method | Purpose                                |
|----------------------------------|--------|----------------------------------------|
| `/v1/agreements/{id}/document`   | GET    | Retrieve signed document metadata or download PDF |

### 7.2 Dual-Mode Behavior

This endpoint operates in two modes depending on the `format` query parameter:

**Default (no `format` param) — JSON metadata:**

Returns metadata about the signed document:

```json
{
  "signed_document_url": "/api/v1/agreements/{id}/document?format=pdf",
  "document_format": "pdf",
  "blockchain_tx": "0xabc123...",
  "blockchain_explorer_url": "https://testnet.snowtrace.io/tx/0xabc123..."
}
```

| Field                    | Type           | Description                                                    |
|--------------------------|----------------|----------------------------------------------------------------|
| `signed_document_url`    | string         | URL to download the PDF (append `?format=pdf`)                 |
| `document_format`        | string         | Format of the signed document (`pdf`)                          |
| `blockchain_tx`          | string \| null | Transaction hash for verification (null if not available)      |
| `blockchain_explorer_url`| string \| null | Direct link to the transaction on Avalanche explorer           |

**With `?format=pdf` — Binary PDF download:**

Returns the PDF file directly with:
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="{agreement_id}-signed.pdf"`

**Error: Agreement not yet signed (HTTP `409`):**

```json
{
  "error": {
    "code": "agreement_not_signed",
    "message": "Document is not available until the agreement is signed.",
    "status": 409
  }
}
```

---

## 8. Sandbox / Test Mode

The API supports a sandbox mode for development and testing, following the Stripe key-prefix pattern.

### 8.1 API Key Prefixes

| Prefix               | Environment | Description                                                                      |
|----------------------|-------------|----------------------------------------------------------------------------------|
| `papre_live_sk_...`  | Production  | Real agreements, real blockchain transactions, real emails                        |
| `papre_test_sk_...`  | Sandbox     | Test agreements with realistic responses, no email side effects                   |

The API determines the mode from the key prefix — there is no separate base URL or toggle. Both key types authenticate against the same endpoints.

### 8.2 Sandbox Behavior

| Capability           | Sandbox Behavior                                                            |
|----------------------|-----------------------------------------------------------------------------|
| Agreement creation   | Returns real-looking response with test `agreement_id`                      |
| Signing URL          | Points to a Papre-hosted test signing page (auto-completes after 2 seconds) |
| Webhooks             | Fires real webhook payloads to the registered URL                           |
| Email delivery       | No emails sent to signers                                                   |
| Blockchain           | Creates real attestations on **Fuji testnet** (Avalanche testnet) — `blockchain_tx` contains a real transaction hash, not a placeholder |
| Document retrieval   | Returns a sample PDF with "TEST" watermark                                  |
| Rate limits          | Same limits as production                                                   |

**Important:** Unlike many sandbox environments, Papre test mode creates real blockchain attestations on the Fuji testnet. The `blockchain_tx` values are valid transaction hashes that can be verified on the Fuji explorer.

### 8.3 Signing UX

The default signing experience is a **Papre-hosted signing page** — the signer clicks the `signing_url` from their email, signs on Papre's platform, and is redirected to the `redirect_url` (or a default confirmation page).

In test mode, the signing page displays a **TEST MODE banner** and auto-completes signing after 2 seconds — no manual interaction required.

For embedded signing directly inside a third-party site, use `embed_mode: true` at agreement creation and follow the flow in Section 12.

---

## 9. Signing Page API

The signing page is a public endpoint that does not require API key authentication — the signing token in the URL serves as authentication.

### 9.1 Endpoints

| Endpoint              | Method | Purpose                                                |
|-----------------------|--------|--------------------------------------------------------|
| `/v1/sign/{token}`    | GET    | Load agreement data for the signing page               |
| `/v1/sign/{token}`    | POST   | Submit signature for the agreement                     |

### 9.2 GET — Load Signing Page

Returns the agreement data needed to render the signing UI.

**Response when signing is available (HTTP `200`):**

```json
{
  "agreement": {
    "agreement_id": "agr_abc123",
    "template_id": "tmpl_adult_waiver",
    "status": "sent",
    "signer_email": "alice@example.com",
    "signer_name": "Alice Johnson",
    "signing_url": "...",
    "merge_fields": {
      "participant_name": "Alice Johnson",
      "event_name": "Annual Company Retreat",
      "event_date": "2026-03-15"
    },
    "signed_at": null,
    "blockchain_tx": null,
    "signed_document_url": null,
    "external_reference": "participant_101",
    "external_group_id": "booking_42",
    "metadata": null,
    "created_at": "2026-03-10T14:30:00Z",
    "expires_at": null,
    "viewed_at": null,
    "reminder_count": 0
  },
  "signing_available": true,
  "test_mode": false,
  "filled_document": "## Liability Waiver\n\nI, Alice Johnson, acknowledge that I am participating in Annual Company Retreat on 2026-03-15..."
}
```

**Response for terminal states (already signed, expired, cancelled) (HTTP `200`):**

```json
{
  "agreement": { ... },
  "signing_available": false,
  "status_message": "This agreement has already been signed."
}
```

### 9.3 POST — Submit Signature

Signs the agreement and records the blockchain attestation.

**Request body (optional — for identity verification):**

```json
{
  "action": "sign",
  "signer_email": "alice@example.com",
  "signer_name": "Alice Johnson"
}
```

| Field          | Type   | Required | Description                                                                |
|----------------|--------|----------|----------------------------------------------------------------------------|
| `action`       | string | No       | `"sign"` (default) or `"decline"`                                          |
| `signer_email` | string | No       | If provided, verified against the agreement's locked `signer_identity_hash`. Returns 403 if mismatch. |
| `signer_name`  | string | No       | Used with `signer_email` for identity verification                         |

**Security checks (v1.3):**

1. **Document tamper detection:** The rendered document hash is recomputed from the current template + stored merge fields and compared to the `document_hash` stored at creation. If the template has changed, signing is rejected with `409 document_tampered`.
2. **Signer identity verification:** If `signer_email` is provided in the body and the agreement has a `signer_identity_hash`, the identity is verified. Mismatch returns `403 signer_mismatch`. If `signer_email` is omitted, the check is skipped (backwards compatible).
3. **Evidence collection:** IP address, user agent, timestamp, and verification flags are collected and hashed into an `evidence_hash` stored with the agreement.

**Response (HTTP `200`):**

```json
{
  "status": "signed",
  "signed_at": "2026-03-15T10:30:00.000Z",
  "blockchain_tx": "0xabc123...",
  "redirect_url": "https://example.com/thank-you"
}
```

| Field           | Type           | Description                                          |
|-----------------|----------------|------------------------------------------------------|
| `status`        | string         | Always `"signed"` on success                         |
| `signed_at`     | datetime       | When the signature was recorded                      |
| `blockchain_tx` | string \| null | Transaction hash (null if attestation failed)        |
| `redirect_url`  | string \| null | Where to redirect the signer (null if not configured)|

**Error: Document tampered (HTTP `409`):**

```json
{
  "error": {
    "code": "document_tampered",
    "message": "The agreement document has changed since creation. This agreement cannot be signed."
  }
}
```

**Error: Signer identity mismatch (HTTP `403`):**

```json
{
  "error": {
    "code": "signer_mismatch",
    "message": "The provided signer identity does not match this agreement."
  }
}
```

**Error: Terminal or expired agreement (HTTP `409`):**

Returns the standard error format (Section 2.4) with an appropriate error code.

---

## 10. API Response Notes

### 10.1 List Endpoint Envelope

All list endpoints (`GET /v1/agreements`, `GET /v1/templates`, `GET /v1/webhooks`, `GET /v1/drafts`) use the standard pagination envelope:

```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "per_page": 25,
    "total_items": 142,
    "total_pages": 6
  }
}
```

### 10.2 Mutation Responses

| Endpoint                                | Returns                                                    |
|-----------------------------------------|------------------------------------------------------------|
| `POST /v1/agreements`                   | Full agreement object (Section 4.3)                        |
| `POST /v1/agreements/{id}/resend`       | Full updated agreement object                              |
| `POST /v1/agreements/{id}/cancel`       | Full updated agreement object (status: `cancelled`)        |
| `POST /v1/agreements/{id}/signing-url`  | `{ agreement_id, signing_url, expires_at }`                |
| `POST /v1/webhooks`                     | Webhook object: `{ webhook_id, url, events, created_at }`  |
| `DELETE /v1/webhooks/{id}`              | `{ deleted: true }` with HTTP 200                          |
| `POST /v1/drafts`                       | Full draft object (Section 11.3)                           |
| `PATCH /v1/drafts/{id}`                 | Full updated draft object                                  |
| `POST /v1/drafts/{id}/send`             | Full agreement object (draft converted to agreement)       |
| `DELETE /v1/drafts/{id}`               | `{ deleted: true }` with HTTP 200                          |

---

## 11. Drafts API (Phase 1B)

Drafts let integrations build agreements incrementally — capture partial data, save, and send later. A draft is a pre-agreement record that exists in Papre storage but has not been sent to any signer. Sending a draft converts it into a live agreement and triggers the signing email (or sets up the embedded signing session if `embed_mode` was set).

### 11.1 Endpoints

| Endpoint                  | Method | Purpose                                              |
|---------------------------|--------|------------------------------------------------------|
| `/v1/drafts`              | POST   | Create a new draft with partial or full fields       |
| `/v1/drafts`              | GET    | List drafts with optional filters                    |
| `/v1/drafts/{id}`         | GET    | Get a single draft, including filled content preview |
| `/v1/drafts/{id}`         | PATCH  | Update draft fields (merge, not replace)             |
| `/v1/drafts/{id}`         | DELETE | Delete a draft permanently                           |
| `/v1/drafts/{id}/send`    | POST   | Finalize and send — converts draft to agreement      |

**Auth:** All draft endpoints require `Authorization: Bearer papre_live_sk_...` plus `drafts:write` scope (for mutations) or `drafts:read` scope (for reads). See Section 14.

### 11.2 Create Draft — Request

`POST /v1/drafts`

All fields are optional at creation time. You can create an empty draft and fill it via PATCH, or create a fully specified draft and send immediately.

**Body:**

| Field                | Type     | Required | Description                                                                  |
|----------------------|----------|----------|------------------------------------------------------------------------------|
| `template_id`        | string   | No       | Template to base the agreement on. Can be set or changed via PATCH.          |
| `signer_email`       | string   | No       | Signer's email. Required before sending.                                     |
| `signer_name`        | string   | No       | Signer's full name. Required before sending.                                 |
| `signers`            | array    | No       | Multi-signer array. Required before sending if using multi-signer flow.      |
| `signing_order`      | string   | No       | `parallel` or `sequential`. Only relevant when `signers[]` has multiple entries. |
| `merge_fields`       | object   | No       | Key-value pairs for template merge fields. Required fields must be present before sending. |
| `external_reference` | string   | No       | Your application's internal reference ID for this draft                                |
| `external_group_id`  | string   | No       | Group/booking reference                                                      |
| `expiration`         | datetime | No       | When the eventual signing link should expire                                 |
| `metadata`           | object   | No       | Arbitrary key-value data returned in webhooks                                |
| `embed_mode`         | boolean  | No       | Set `true` if this draft will use embedded signing when sent                 |
| `callback_url`       | string   | No       | Override webhook URL for the eventual agreement                              |
| `redirect_url`       | string   | No       | Where to send the signer after signing                                       |

**Response (HTTP `201`):** Full draft object (see Section 11.3).

### 11.3 Draft Object

The draft object is returned by all draft endpoints.

| Field                | Type           | Description                                                        |
|----------------------|----------------|--------------------------------------------------------------------|
| `draft_id`           | string         | Unique identifier for this draft                                   |
| `template_id`        | string \| null | Template selected, or null if not yet set                          |
| `signer_email`       | string \| null | Signer email, or null                                              |
| `signer_name`        | string \| null | Signer name, or null                                               |
| `signers`            | array \| null  | Multi-signer array, or null                                        |
| `signing_order`      | string         | `parallel` or `sequential`                                         |
| `merge_fields`       | object         | Partial or complete merge field values                             |
| `missing_fields`     | array          | Keys of required merge fields not yet supplied. Empty array means ready to send. |
| `filled_preview`     | string \| null | Template body with current merge fields applied. Null if no template is set. |
| `ready_to_send`      | boolean        | True when all required fields are present and the draft can be sent |
| `external_reference` | string \| null | Your application's reference ID                                              |
| `external_group_id`  | string \| null | Group/booking reference                                            |
| `expiration`         | datetime \| null | When the eventual signing link expires                            |
| `metadata`           | object \| null | Arbitrary data                                                     |
| `embed_mode`         | boolean        | Whether this draft will use embedded signing                       |
| `created_at`         | datetime       | When the draft was created                                         |
| `updated_at`         | datetime       | When the draft was last modified                                   |

**Example draft object:**

```json
{
  "draft_id": "dft_abc123",
  "template_id": "tmpl_adult_waiver",
  "signer_email": null,
  "signer_name": null,
  "signers": null,
  "signing_order": "parallel",
  "merge_fields": {
    "event_name": "Annual Company Retreat",
    "event_date": "2026-03-15"
  },
  "missing_fields": ["participant_name", "signer_email", "signer_name"],
  "filled_preview": "## Liability Waiver\n\nI, {{participant_name}}, acknowledge that I am participating in Annual Company Retreat on 2026-03-15...",
  "ready_to_send": false,
  "external_reference": null,
  "external_group_id": "booking_42",
  "expiration": null,
  "metadata": null,
  "embed_mode": false,
  "created_at": "2026-03-10T14:00:00Z",
  "updated_at": "2026-03-10T14:00:00Z"
}
```

### 11.4 List Drafts

`GET /v1/drafts`

| Parameter            | Type     | Required | Description                                              |
|----------------------|----------|----------|----------------------------------------------------------|
| `external_group_id`  | string   | No       | Filter by group/booking reference                        |
| `template_id`        | string   | No       | Filter by template                                       |
| `ready_to_send`      | boolean  | No       | `true` to return only drafts ready to send               |
| `created_after`      | datetime | No       | Only drafts created after this timestamp                 |
| `created_before`     | datetime | No       | Only drafts created before this timestamp                |
| `page`               | integer  | No       | Page number (see Section 2.3)                            |
| `per_page`           | integer  | No       | Items per page (see Section 2.3)                         |

Response uses the standard pagination envelope wrapping an array of draft objects.

### 11.5 Update Draft

`PATCH /v1/drafts/{id}`

Updates are **merged** into the existing draft — you only send the fields you want to change. To clear a field, pass `null` explicitly.

**Body:** Any subset of the create-draft fields (Section 11.2).

**Example — add signer info to an existing draft:**

```json
{
  "signer_email": "alice@example.com",
  "signer_name": "Alice Johnson",
  "merge_fields": {
    "participant_name": "Alice Johnson"
  }
}
```

Note: `merge_fields` on a PATCH is also merged at the key level. To replace all merge fields, delete and recreate the draft.

**Response (HTTP `200`):** Full updated draft object. Check `ready_to_send` and `missing_fields` to determine if the draft can now be sent.

### 11.6 Delete Draft

`DELETE /v1/drafts/{id}`

Permanently deletes a draft. This action cannot be undone. Agreements that were already sent from this draft are unaffected.

**Response (HTTP `200`):**

```json
{
  "deleted": true
}
```

**Error: Draft not found or already sent (HTTP `404`):**

```json
{
  "error": {
    "code": "draft_not_found",
    "message": "Draft 'dft_abc123' not found.",
    "status": 404
  }
}
```

### 11.7 Send Draft

`POST /v1/drafts/{id}/send`

Converts a draft into a live agreement. The draft must have `ready_to_send: true` before this call succeeds. On success, the draft is deleted and the resulting agreement is returned.

**Request body:** No body required. Optionally, pass `callback_url` or `redirect_url` to override values set on the draft.

**Response (HTTP `201`):** Full agreement object (same shape as Section 4.3). The `draft_id` field is included for correlation:

```json
{
  "agreement_id": "agr_xyz789",
  "draft_id": "dft_abc123",
  "template_id": "tmpl_adult_waiver",
  "status": "sent",
  "signer_email": "alice@example.com",
  "signer_name": "Alice Johnson",
  "signing_url": "https://sign.papre.com/agr_xyz789",
  ...
}
```

**Error: Draft not ready to send (HTTP `422`):**

```json
{
  "error": {
    "code": "draft_not_ready",
    "message": "Draft has missing required fields: participant_name.",
    "status": 422,
    "missing_fields": ["participant_name"]
  }
}
```

---

## 12. Embedded Signing (Phase 2)

Embedded signing lets businesses render the signing experience inside their own page rather than redirecting to a Papre-hosted URL. The full flow is described in the companion guide `API-v1-Embedded-Signing.md`.

### 12.1 Overview

The embedded signing flow has two server-side steps and two client-side steps:

1. **Server: Create agreement** with `embed_mode: true`. No email is sent.
2. **Server: Issue a browser session** with `scope: agreements:sign` (Section 14).
3. **Client: Prepare signing session** via `POST /v1/embed/signing-intent`.
4. **Client: Submit signature** via `POST /v1/embed/sign`.

### 12.2 Endpoints

| Endpoint                       | Method | Auth              | Purpose                                              |
|--------------------------------|--------|-------------------|------------------------------------------------------|
| `/v1/embed/signing-intent`     | POST   | Browser session   | Prepare a signing session for an embed-mode agreement |
| `/v1/embed/sign`               | POST   | Browser session   | Submit the embedded signature                         |

### 12.3 POST /v1/embed/signing-intent

Prepares a signing session. Returns the filled document for display and a session token to be used in the sign call. This is called from the business's frontend, not their server.

**Auth:** `Authorization: Bearer <browser_session_token>` — a short-lived token issued by the server via `POST /v1/auth/browser-session` (see Section 14). Must have `agreements:sign` scope.

**Request Body:**

| Field          | Type   | Required | Description                                              |
|----------------|--------|----------|----------------------------------------------------------|
| `agreement_id` | string | Yes      | ID of the embed-mode agreement to sign                   |

**Response (HTTP `200`):**

```json
{
  "agreement_id": "agr_abc123",
  "intent_token": "sit_xyz789",
  "filled_document": "## Liability Waiver\n\nI, Alice Johnson, acknowledge...",
  "document_hash": "sha256:abc123def456...",
  "expires_at": "2026-03-15T11:00:00Z"
}
```

| Field             | Type     | Description                                                           |
|-------------------|----------|-----------------------------------------------------------------------|
| `agreement_id`    | string   | Agreement being signed                                                |
| `intent_token`    | string   | Short-lived token to include in the `POST /v1/embed/sign` call        |
| `filled_document` | string   | Complete agreement text to display to the signer                      |
| `document_hash`   | string   | SHA-256 hash of the document content. Include in signing evidence.    |
| `expires_at`      | datetime | When this signing intent expires (typically 30 minutes)               |

**Error: Agreement not in embed mode (HTTP `409`):**

```json
{
  "error": {
    "code": "not_embed_mode",
    "message": "Agreement 'agr_abc123' was not created with embed_mode: true.",
    "status": 409
  }
}
```

### 12.4 POST /v1/embed/sign

Submits the signer's explicit consent and records the blockchain attestation.

**Auth:** `Authorization: Bearer <browser_session_token>` — same token as used for signing-intent. Must have `agreements:sign` scope.

**Request Body:**

| Field              | Type    | Required | Description                                                             |
|--------------------|---------|----------|-------------------------------------------------------------------------|
| `agreement_id`     | string  | Yes      | Agreement being signed                                                  |
| `intent_token`     | string  | Yes      | Token from the signing-intent response                                  |
| `document_hash`    | string  | Yes      | SHA-256 hash from the signing-intent response. Verifies the signer reviewed the correct document. |
| `consent_given`    | boolean | Yes      | Must be `true`. Explicit record that the signer confirmed consent.      |
| `signer_ip`        | string  | No       | Signer's IP address for signing evidence (recommended)                  |
| `signer_user_agent`| string  | No       | Signer's browser user agent for signing evidence (recommended)          |

**Response (HTTP `200`):**

```json
{
  "status": "signed",
  "agreement_id": "agr_abc123",
  "signed_at": "2026-03-15T10:30:00.000Z",
  "blockchain_tx": "0xabc123...",
  "certificate_url": "/v1/agreements/agr_abc123/certificate"
}
```

| Field             | Type           | Description                                          |
|-------------------|----------------|------------------------------------------------------|
| `status`          | string         | Always `"signed"` on success                         |
| `agreement_id`    | string         | Agreement that was signed                            |
| `signed_at`       | datetime       | When the signature was recorded                      |
| `blockchain_tx`   | string \| null | Transaction hash (null if attestation failed)        |
| `certificate_url` | string         | URL to download the PDF certificate of completion    |

**Error: document_hash mismatch (HTTP `422`):**

```json
{
  "error": {
    "code": "document_hash_mismatch",
    "message": "The document hash does not match the signing intent. The document may have changed.",
    "status": 422
  }
}
```

---

## 13. Multi-Signer Agreements (Phase 4)

Multi-signer agreements require two or more parties to sign. Each signer receives their own signing link and the agreement reaches `signed` status only when all required signers have completed.

### 13.1 Creating a Multi-Signer Agreement

Pass a `signers[]` array instead of `signer_email`/`signer_name` on the create call (Section 4.2).

**Signer Object:**

| Field         | Type   | Required | Description                                                        |
|---------------|--------|----------|--------------------------------------------------------------------|
| `email`       | string | Yes      | Email address for this signer                                      |
| `name`        | string | Yes      | Full name of this signer                                           |
| `role`        | string | No       | Label for this signer's role (e.g., `"contractor"`, `"client"`)    |
| `signing_order` | integer | No     | Position in sequence when `signing_order: sequential`. Lower numbers sign first. |

**Example request body:**

```json
{
  "template_id": "tmpl_freelance_contract",
  "signing_order": "sequential",
  "signers": [
    {
      "email": "contractor@example.com",
      "name": "Alice Johnson",
      "role": "contractor",
      "signing_order": 1
    },
    {
      "email": "client@example.com",
      "name": "Bob Smith",
      "role": "client",
      "signing_order": 2
    }
  ],
  "merge_fields": {
    "project_name": "Website Redesign",
    "start_date": "2026-04-01"
  }
}
```

### 13.2 Signing Order

| Value          | Behavior                                                                |
|----------------|-------------------------------------------------------------------------|
| `parallel`     | All signers receive their signing link immediately. Any order of signing is accepted. |
| `sequential`   | Signers receive their link only after all signers with a lower `signing_order` value have completed. |

### 13.3 Signer Status on an Agreement

`GET /v1/agreements/{id}/signers` returns per-signer signing status.

**Response (HTTP `200`):**

```json
{
  "agreement_id": "agr_abc123",
  "signing_order": "sequential",
  "signers": [
    {
      "signer_id": "sgn_111",
      "email": "contractor@example.com",
      "name": "Alice Johnson",
      "role": "contractor",
      "status": "signed",
      "signed_at": "2026-03-15T10:30:00Z",
      "viewed_at": "2026-03-15T10:28:00Z",
      "signing_url": "https://sign.papre.com/agr_abc123?s=sgn_111",
      "signing_order": 1
    },
    {
      "signer_id": "sgn_222",
      "email": "client@example.com",
      "name": "Bob Smith",
      "role": "client",
      "status": "sent",
      "signed_at": null,
      "viewed_at": null,
      "signing_url": "https://sign.papre.com/agr_abc123?s=sgn_222",
      "signing_order": 2
    }
  ],
  "overall_status": "pending_signatures",
  "signed_count": 1,
  "required_count": 2
}
```

**Overall status values for multi-signer agreements:**

| Value                  | Meaning                                          |
|------------------------|--------------------------------------------------|
| `pending_signatures`   | One or more signers have not yet signed          |
| `fully_signed`         | All signers have signed; agreement is complete   |
| `cancelled`            | Agreement was cancelled by the originator        |

### 13.4 Webhook Behavior for Multi-Signer Agreements

Papre fires `agreement.signed` each time an individual signer completes. A separate `agreement.fully_signed` event fires when all signers have completed.

| Event                       | Fired When                                  |
|-----------------------------|---------------------------------------------|
| `agreement.signed`          | Any individual signer completes             |
| `agreement.fully_signed`    | All signers have completed                  |

The `agreement.fully_signed` payload includes the full `signers[]` array with all signing timestamps and blockchain transaction hashes.

---

## 14. Auth Scopes

API keys carry a set of scopes that control which endpoints they can access. Keys generated via `POST /v1/auth/api-key` carry all scopes by default. Scoped-down keys can be issued for integrations that should only access a subset of the API.

### 14.1 Scope Reference

| Scope               | Endpoints Covered                                                    |
|---------------------|----------------------------------------------------------------------|
| `agreements:read`   | `GET /v1/agreements`, `GET /v1/agreements/{id}`, `GET /v1/agreements/search`, `GET /v1/agreements/{id}/audit-trail`, `GET /v1/agreements/{id}/signers` |
| `agreements:write`  | `POST /v1/agreements`, `POST /v1/agreements/batch`, `POST /v1/agreements/{id}/resend`, `POST /v1/agreements/{id}/cancel`, `POST /v1/agreements/{id}/signing-url` |
| `agreements:sign`   | `POST /v1/embed/signing-intent`, `POST /v1/embed/sign`. Typically granted only to short-lived browser session tokens, not long-lived API keys. |
| `agreements:documents` | `GET /v1/agreements/{id}/document`, `GET /v1/agreements/{id}/certificate` |
| `drafts:read`       | `GET /v1/drafts`, `GET /v1/drafts/{id}`                              |
| `drafts:write`      | `POST /v1/drafts`, `PATCH /v1/drafts/{id}`, `DELETE /v1/drafts/{id}`, `POST /v1/drafts/{id}/send` |
| `templates:read`    | `GET /v1/templates`, `GET /v1/templates/{id}`, `GET /v1/templates/{id}/content` |
| `webhooks:manage`   | `POST /v1/webhooks`, `GET /v1/webhooks`, `DELETE /v1/webhooks/{id}`  |
| `account:read`      | `GET /v1/account/me`                                                 |

### 14.2 Browser Session Tokens

The embedded signing flow requires a short-lived token with `agreements:sign` scope that is safe to expose in a browser. Long-lived API keys must never be sent to a browser.

**Endpoint:** `POST /v1/auth/browser-session`

**Auth:** `Authorization: Bearer papre_live_sk_...` (server-side call)

**Request Body:**

| Field          | Type     | Required | Description                                                        |
|----------------|----------|----------|--------------------------------------------------------------------|
| `scope`        | string   | Yes      | Space-separated list of scopes to grant. For embedded signing, pass `agreements:sign`. |
| `agreement_id` | string   | No       | When provided, restricts the token to operations on this specific agreement only. |
| `ttl`          | integer  | No       | Time-to-live in seconds. Defaults to 1800 (30 minutes). Max 3600.  |

**Response (HTTP `200`):**

```json
{
  "browser_session_token": "bst_abc123xyz...",
  "expires_at": "2026-03-15T11:00:00Z",
  "scope": "agreements:sign",
  "agreement_id": "agr_abc123"
}
```

The `browser_session_token` is passed to the browser and used as the `Authorization: Bearer` token for calls to `/v1/embed/signing-intent` and `/v1/embed/sign`.

---

## 15. Draft Lifecycle

Drafts follow a one-way lifecycle: they are created, optionally updated multiple times, and then either sent (which converts them to agreements) or deleted.

```
POST /v1/drafts  →  [draft: incomplete]
                         ↓
                    PATCH /v1/drafts/{id}  (repeat as needed)
                         ↓
                    [draft: ready_to_send = true]
                         ↓
                    POST /v1/drafts/{id}/send
                         ↓
                    [agreement: sent]  →  webhook: draft.sent
```

### 15.1 Key Rules

- A draft can be updated any number of times before it is sent.
- A draft cannot be sent if any required template fields are missing. The `missing_fields` array in the draft response lists what is still needed.
- Sending a draft is irreversible. The draft record is deleted when the agreement is created.
- Deleting a draft does not affect any agreements that were previously sent from it.
- Drafts do not expire automatically. Implement your own cleanup via `DELETE /v1/drafts/{id}` for drafts that are no longer needed.

### 15.2 When to Use Drafts

Drafts are useful when:
- Participant data is gathered in multiple steps (e.g., a multi-page form) and the agreement should not be sent until all fields are complete.
- A human review step is required before sending.
- The sender wants to preview the filled document before sending.
- The integration builds agreements server-side and sends them in a separate step triggered by a user action.

For direct creation (all data available at once), use `POST /v1/agreements` directly — no draft step is needed.

---

## Summary: Integration <-> API Interaction Flow

1. **Setup:** Admin enters Papre API key in application settings. Integration calls `/v1/account/me` to validate and stores `account_id`. Admin selects waiver templates from `/v1/templates?type=waiver` for adult and minor waivers.

2. **After Payment:** Integration calls `POST /v1/agreements/batch` with all participants for the booking — each entry includes the `template_id`, signer's email, participant details as merge fields, and the `participant_id` as `external_reference`. Alternatively, your application can call `POST /v1/agreements` individually per participant.

3. **API Returns:** Full agreement objects for each participant including `agreement_id` and `signing_url`. Integration stores `agreement_id` as `waiver_id` and `signing_url` as `waiver_signing_url` in the participant record.

4. **Signing Happens:** Signer clicks the email link, signs on Papre's hosted signing page (blockchain-based). Papre fires a webhook to your application.

5. **Webhook Received:** Integration looks up the participant by `external_reference` (`participant_id`), updates `waiver_status` to `signed`, logs in `tk_waiver_log`, recalculates booking rollup.

6. **Admin Actions:** Admin can resend signing emails via `POST /v1/agreements/{id}/resend`, copy the `signing_url`, check status via `GET /v1/agreements/{id}`, and download signed documents via `GET /v1/agreements/{id}/document`.

---

## 16. Signing Security

The v1 API uses three SHA-256 hashes to ensure agreement integrity. All hashes are computed server-side and stored in the agreement record. Phase 3 will also record them on-chain via the `PapreSigningRegistry` contract.

### 16.1 Document Hash

**Computed at:** Agreement creation (`POST /v1/agreements`, `POST /v1/drafts/{id}/send`)

**What's hashed:** The fully rendered document — template content with all merge fields applied (not just metadata). Uses `fetchTemplateContent()` + `preprocessAndApply()` + SHA-256.

**Stored as:** `document_hash` on the agreement record (hex string, 64 chars).

**Verified at:** Sign time. The document is re-rendered from the current template + stored merge fields. If the hash doesn't match (e.g., template was updated), signing is rejected with `409 document_tampered`.

**Null handling:** If the template has no content, `document_hash` is `null` and tamper detection is skipped.

### 16.2 Signer Identity Hash

**Computed at:** Agreement creation.

**What's hashed:** `SHA-256(JSON.stringify({ email: lowercase(trim(signer_email)), name: trim(signer_name) }))`.

**Stored as:** `signer_identity_hash` on the agreement record.

**Verified at:**
- **Direct signing (`POST /v1/sign/{token}`):** If the POST body includes `signer_email`, the identity hash is recomputed and compared to the stored hash. Mismatch returns `403 signer_mismatch`. If omitted, the check is skipped (backwards compatible).
- **Embedded signing (`POST /v1/embed/signing-intent`):** The signer identity is always taken from the agreement record, never from `signer_fields`. Identity-related keys (`customerEmail`, `customerName`, `signer_email`, `signer_name`, `signerEmail`, `signerName`, `email`, `name`) are automatically stripped from `signer_fields`.
- **Embedded sign (`POST /v1/embed/sign`):** The `signer_identity_hash` from the intent is compared to the agreement's stored hash.

### 16.3 Evidence Hash

**Computed at:** Sign time (both direct and embedded flows).

**What's hashed:** `SHA-256(JSON.stringify(evidence, sortedKeys))` — keys sorted alphabetically for deterministic hashing.

**Evidence object includes:**

| Field | Type | Description |
|-------|------|-------------|
| `method` | string | `"direct_link"` or `"embed_widget"` |
| `consent_given` | boolean | Always `true` (required to sign) |
| `consent_text` | string | The exact consent text presented (embedded only) |
| `ip_address` | string \| null | Signer's IP from request headers |
| `user_agent` | string \| null | Signer's browser user agent |
| `timestamp` | datetime | When the signature was submitted |
| `signature_type` | string | `"click"`, `"typed"`, `"drawn"`, or `"wallet"` (embedded only) |
| `review_duration_ms` | number \| null | How long the signer reviewed the document (embedded only) |
| `embed_origin` | string \| null | The embedding site's origin (embedded only) |
| `document_hash_verified` | boolean | Whether document integrity was checked (embedded only) |
| `signer_identity_verified` | boolean | Whether signer identity was verified (direct only) |
| `document_integrity_verified` | boolean | Whether document tamper check passed (direct only) |

**Stored as:** `evidence_hash` on the agreement record. The full `signing_evidence` object is also stored.

### 16.4 Verification Model

```
Agreement Creation:
  template + merge_fields → rendered document → SHA-256 → document_hash
  signer_email + signer_name → normalized → SHA-256 → signer_identity_hash
  Both stored in agreement record (and on-chain in Phase 3)

Sign Time:
  Re-render document → SHA-256 → compare to document_hash → reject if mismatch
  Signer identity → SHA-256 → compare to signer_identity_hash → reject if mismatch
  Build evidence → SHA-256 → evidence_hash
  All three hashes included in blockchain attestation
```

### 16.5 Error Codes

| Code | HTTP | When |
|------|------|------|
| `document_tampered` | 409 | Document hash at sign time doesn't match creation-time hash |
| `signer_mismatch` | 403 | Submitted `signer_email` identity hash doesn't match stored hash |
| `signer_identity_mismatch` | 403 | Embedded signing intent identity doesn't match agreement |

### 16.6 On-Chain Registry (Phase 3 — Future)

A `PapreSigningRegistry` Solidity contract will store all three hashes on-chain, queryable by anyone:

```solidity
function registerDocument(bytes32 agreementHash, bytes32 documentHash, bytes32 signerIdentityHash) external;
function attestSigning(bytes32 agreementHash, bytes32 evidenceHash) external;
function verifyDocument(bytes32 agreementHash, bytes32 documentHash) external view returns (bool);
function getRecord(bytes32 agreementHash) external view returns (Record memory);
```

- `agreementHash` = SHA-256 of the agreement ID
- Only the server's attestation wallet can write; anyone can read/verify
- Events: `DocumentRegistered`, `SigningAttested`

Until the registry is deployed, the existing self-transaction attestation remains as the on-chain proof mechanism.

### 16.7 Backwards Compatibility

- Existing agreements created before v1.3 have `document_hash: null` and `signer_identity_hash: null`. All verification checks skip gracefully when these fields are null.
- The `signer_email` field in `POST /v1/sign/{token}` is optional. Omitting it skips identity verification but the signing evidence records `signer_identity_verified: false`.
- No existing API response shapes are changed. New fields (`document_hash`, `evidence_hash`, `signer_identity_hash`) are additive.

---

## Nice-to-Have (Future)

- **Reminder configuration** — Set reminder schedule per agreement rather than relying solely on application-side cron.
- ~~**Template preview/render endpoint**~~ — **Implemented in v1.1.** The `GET /v1/sign/{token}` response now includes `filled_document` with the complete rendered agreement text. The signing page renders this as formatted markdown for the signer to review before signing.
- **Analytics endpoint** — Aggregate signing stats across an account.
- ~~**Embeddable signing widget SDK**~~ — **Implemented in v1.2.** See Section 12.

---

## Endpoint Summary

All endpoints require `Authorization: Bearer papre_{live|test}_sk_...` header unless noted.

| Endpoint                                | Method | Auth Required          | Section |
|-----------------------------------------|--------|------------------------|---------|
| `/v1/auth/api-key`                      | POST   | Privy token            | 1.1     |
| `/v1/auth/browser-session`              | POST   | API key                | 14.2    |
| `/v1/account/me`                        | GET    | API key                | 1.1     |
| `/v1/templates`                         | GET    | API key                | 3.1     |
| `/v1/templates/{id}`                    | GET    | API key                | 3.1     |
| `/v1/templates/{id}/content`            | GET    | API key                | 3.5     |
| `/v1/agreements`                        | POST   | API key                | 4.1     |
| `/v1/agreements/batch`                  | POST   | API key                | 4.4     |
| `/v1/agreements`                        | GET    | API key                | 5.3     |
| `/v1/agreements/search`                 | GET    | API key                | 5.8     |
| `/v1/agreements/{id}`                   | GET    | API key                | 4.1     |
| `/v1/agreements/{id}/resend`            | POST   | API key                | 4.1     |
| `/v1/agreements/{id}/cancel`            | POST   | API key                | 4.1     |
| `/v1/agreements/{id}/signing-url`       | POST   | API key                | 5.5     |
| `/v1/agreements/{id}/audit-trail`       | GET    | API key                | 5.6     |
| `/v1/agreements/{id}/certificate`       | GET    | API key                | 5.7     |
| `/v1/agreements/{id}/signers`           | GET    | API key                | 13.3    |
| `/v1/agreements/{id}/document`          | GET    | API key                | 7.1     |
| `/v1/drafts`                            | POST   | API key + drafts:write | 11.1    |
| `/v1/drafts`                            | GET    | API key + drafts:read  | 11.4    |
| `/v1/drafts/{id}`                       | GET    | API key + drafts:read  | 11.1    |
| `/v1/drafts/{id}`                       | PATCH  | API key + drafts:write | 11.5    |
| `/v1/drafts/{id}`                       | DELETE | API key + drafts:write | 11.6    |
| `/v1/drafts/{id}/send`                  | POST   | API key + drafts:write | 11.7    |
| `/v1/embed/signing-intent`              | POST   | Browser session        | 12.3    |
| `/v1/embed/sign`                        | POST   | Browser session        | 12.4    |
| `/v1/webhooks`                          | POST   | API key                | 6.1     |
| `/v1/webhooks`                          | GET    | API key                | 6.1     |
| `/v1/webhooks/{id}`                     | DELETE | API key                | 6.1     |
| `/v1/sign/{token}`                      | GET    | Token in URL           | 9.1     |
| `/v1/sign/{token}`                      | POST   | Token in URL           | 9.1     |
| `/v1/dashboard/agreements`              | GET    | Privy token            | —       |

---

