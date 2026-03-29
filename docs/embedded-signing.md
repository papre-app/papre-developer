# Papre Embedded Signing Guide

March 2026

---

## Overview

By default, Papre signs agreements through a **Papre-hosted signing page** — the signer receives an email, clicks the link, and signs on `sign.papre.com`. This is the simplest integration path and requires no frontend work from the business.

**Embedded signing** is for businesses that want the signing experience to happen inside their own page — no redirect, no external domain, no break in the user flow. The document is rendered in-place, the signer clicks a consent button, and the signature is submitted via the Papre API without the user ever leaving the business's site.

Common use cases:
- Booking confirmation pages where the waiver is signed immediately after payment
- Account signup flows that include a terms agreement
- In-app document signing for SaaS products
- Any flow where redirecting to an external URL would break UX continuity

---

## Architecture

```
Business Server
  │
  ├── POST /v1/agreements  (embed_mode: true)
  │       Returns: agreement_id (no email sent)
  │
  └── POST /v1/auth/browser-session  (scope: agreements:sign, agreement_id: agr_xxx)
          Returns: browser_session_token (short-lived, safe for browser)
              │
              ▼
Business Frontend  (receives browser_session_token from server)
  │
  ├── POST /v1/embed/signing-intent  (Authorization: Bearer <browser_session_token>)
  │       Returns: intent_token, filled_document, document_hash
  │       [Render document to the user]
  │       [User reads and clicks "I Agree"]
  │
  └── POST /v1/embed/sign  (Authorization: Bearer <browser_session_token>)
          Body: intent_token, document_hash, consent_given: true
          Returns: signed_at, blockchain_tx, certificate_url
              │
              ▼
Business Server  (receives webhook)
  └── POST to registered webhook URL
          Event: agreement.signed
```

The `browser_session_token` is the key security boundary. It is issued server-side (so the API key is never exposed to the browser), scoped to a single agreement, and expires after 30 minutes.

---

## Step-by-Step Integration

### Step 1: Create an Embed-Mode Agreement (Server)

Call `POST /v1/agreements` with `embed_mode: true`. This creates the agreement in Papre's system but suppresses the signing email. No link is sent to the signer.

```bash
curl -X POST https://api.papre.com/v1/agreements \
  -H "Authorization: Bearer papre_live_sk_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "tmpl_adult_waiver",
    "signer_email": "alice@example.com",
    "signer_name": "Alice Johnson",
    "merge_fields": {
      "participant_name": "Alice Johnson",
      "event_name": "Sunset Kayak Tour",
      "event_date": "2026-03-15"
    },
    "embed_mode": true,
    "external_reference": "participant_101"
  }'
```

**Response:**

```json
{
  "agreement_id": "agr_abc123",
  "template_id": "tmpl_adult_waiver",
  "status": "pending",
  "embed_mode": true,
  "signer_email": "alice@example.com",
  "signer_name": "Alice Johnson",
  "signing_url": null,
  "merge_fields": { ... },
  "created_at": "2026-03-15T10:00:00Z"
}
```

Note: `signing_url` is `null` for embed-mode agreements. There is no link to share.

### Step 2: Issue a Browser Session Token (Server)

Issue a short-lived token scoped to this specific agreement and deliver it to your frontend. The API key used here must remain on your server — never send `papre_live_sk_...` to a browser.

```bash
curl -X POST https://api.papre.com/v1/auth/browser-session \
  -H "Authorization: Bearer papre_live_sk_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "agreements:sign",
    "agreement_id": "agr_abc123",
    "ttl": 1800
  }'
```

**Response:**

```json
{
  "browser_session_token": "bst_xyz789...",
  "expires_at": "2026-03-15T10:30:00Z",
  "scope": "agreements:sign",
  "agreement_id": "agr_abc123"
}
```

Deliver `browser_session_token` and `agreement_id` to your frontend — for example, embed them in the page HTML or return them from a JSON endpoint called by your frontend JavaScript.

### Step 3: Prepare the Signing Session (Frontend)

On your frontend, call `POST /v1/embed/signing-intent` with the browser session token. This fetches the filled document and returns an `intent_token` that will be submitted with the signature.

```javascript
async function prepareSigningSession(agreementId, browserSessionToken) {
  const response = await fetch('https://api.papre.com/v1/embed/signing-intent', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${browserSessionToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ agreement_id: agreementId })
  });

  if (!response.ok) {
    throw new Error('Failed to prepare signing session');
  }

  return response.json();
  // Returns: { intent_token, filled_document, document_hash, expires_at }
}
```

**Response shape:**

```json
{
  "agreement_id": "agr_abc123",
  "intent_token": "sit_def456...",
  "filled_document": "## Liability Waiver\n\nI, Alice Johnson, acknowledge that I am participating in Sunset Kayak Tour on 2026-03-15...",
  "document_hash": "sha256:abc123def456...",
  "expires_at": "2026-03-15T10:30:00Z"
}
```

### Step 4: Display the Document and Collect Consent (Frontend)

Render `filled_document` to the user. The signing experience requires the user to actively affirm consent — do not auto-accept or skip this step.

Minimum required UI:
- The complete document text, scrollable if long
- A clearly labeled consent checkbox or button (e.g., "I have read and agree to the above")
- A submit button that only activates after the consent element is engaged

Example HTML pattern:

```html
<div id="signing-container">
  <div id="document-body" class="document-scroll">
    <!-- render filled_document as Markdown or pre-formatted text -->
  </div>

  <div id="consent-section">
    <label>
      <input type="checkbox" id="consent-checkbox" />
      I have read the above agreement and consent to sign electronically.
    </label>
    <button id="sign-button" disabled>Sign Agreement</button>
  </div>
</div>

<script>
  document.getElementById('consent-checkbox').addEventListener('change', (e) => {
    document.getElementById('sign-button').disabled = !e.target.checked;
  });
</script>
```

### Step 5: Submit the Signature (Frontend)

When the user clicks the sign button, call `POST /v1/embed/sign` with the `intent_token` and `document_hash` from the signing-intent response. Pass `consent_given: true` — this is the explicit legal record that the user affirmed consent.

```javascript
async function submitSignature(agreementId, signingIntent, browserSessionToken) {
  const response = await fetch('https://api.papre.com/v1/embed/sign', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${browserSessionToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      agreement_id: agreementId,
      intent_token: signingIntent.intent_token,
      document_hash: signingIntent.document_hash,
      consent_given: true,
      signer_ip: null,          // collect from your backend if available
      signer_user_agent: navigator.userAgent
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error.message);
  }

  return response.json();
  // Returns: { status: "signed", signed_at, blockchain_tx, certificate_url }
}
```

**Success response:**

```json
{
  "status": "signed",
  "agreement_id": "agr_abc123",
  "signed_at": "2026-03-15T10:30:00.000Z",
  "blockchain_tx": "0xabc123...",
  "certificate_url": "/v1/agreements/agr_abc123/certificate"
}
```

On success, show a confirmation to the user. The `certificate_url` can be used to offer a download link.

### Step 6: Receive the Webhook (Server)

Papre fires `agreement.signed` to your registered webhook URL when signing completes. This is independent of the frontend flow and is the authoritative record that the agreement is signed.

```json
{
  "event_type": "agreement.signed",
  "agreement_id": "agr_abc123",
  "status": "signed",
  "signer_email": "alice@example.com",
  "signer_name": "Alice Johnson",
  "signed_at": "2026-03-15T10:30:00Z",
  "blockchain_tx": "0xabc123...",
  "external_reference": "participant_101",
  "timestamp": "2026-03-15T10:30:01Z"
}
```

Do not treat the frontend API response as the final confirmation — always rely on the webhook for authoritative status updates.

---

## Signing Evidence Model

For each embedded signing event, Papre records the following evidence:

| Evidence Point        | Source             | Description                                                       |
|-----------------------|--------------------|-------------------------------------------------------------------|
| Document hash         | Computed server-side | SHA-256 of the filled document content at time of signing. Proves the signer saw the correct version. |
| Consent attestation   | `consent_given: true` in sign request | Explicit field in the API payload recording that the signer affirmed consent. |
| Signing timestamp     | Server-side         | UTC timestamp recorded when the signature was accepted            |
| Blockchain proof      | Avalanche / Fuji    | Immutable on-chain attestation. Transaction hash is the audit-proof that the signing event occurred. |
| Signer IP             | Passed by client    | Recommended. Record and pass from your server when available.     |
| User agent            | Passed by client    | Browser identity at time of signing.                              |
| Intent token binding  | Server-side         | The `intent_token` ties the signing request to the specific document version fetched in the signing-intent call. |

The `document_hash` verification is the most important security control: when `POST /v1/embed/sign` is called, Papre re-hashes the document and compares it to the hash submitted by the client. If they do not match, the signing request is rejected with `document_hash_mismatch`. This prevents a compromised client from submitting a signature against a different document than the one displayed.

---

## Security Considerations

### Never send the API key to the browser

The `papre_live_sk_...` key has full account access. It must never appear in frontend JavaScript, HTML, or network responses visible to the browser. Always perform step 2 (browser-session issuance) on your server.

### Scope browser session tokens tightly

When issuing a browser session token, always pass `agreement_id` to restrict the token to a single agreement. A token without an `agreement_id` restriction can be used to sign any embed-mode agreement on your account.

### Validate the webhook signature

Do not update agreement status in your database based on the frontend API response alone. Verify the `X-Papre-Signature` header on incoming webhooks and update status only on verified webhook delivery. See the [Webhooks guide](./webhooks.md) for verification code examples.

### Enforce consent UI on your side

The `consent_given: true` field in the sign request is a record that your application explicitly collected consent. Papre trusts this field. It is your responsibility to ensure the checkbox or consent UI was genuinely engaged by the user — do not set `consent_given: true` programmatically without user interaction.

### Token expiry

The `browser_session_token` expires after 30 minutes (configurable up to 60 minutes). The `intent_token` from signing-intent also expires, typically in 30 minutes. If the user takes longer, both calls need to be repeated. Build your frontend to handle `401 Unauthorized` gracefully by re-requesting a fresh token from your server.

---

## Comparison: Email-Link vs. Embedded Signing

| Characteristic          | Email-Link Signing (default)              | Embedded Signing                               |
|-------------------------|-------------------------------------------|------------------------------------------------|
| UX                      | Signer leaves your site                   | Signer stays on your site                      |
| Setup complexity        | Zero — no frontend work                   | Requires server-side token issuance + frontend JS |
| Security boundary       | Token in signed email link                | Browser session token issued server-side       |
| Best for                | Async signing (sign later, off-site)      | Synchronous in-flow signing (sign now, in-page)|
| Email required          | Yes — must send to signer's email          | No — signer_email is stored but no email sent  |
| Signing page hosted by  | Papre (`sign.papre.com`)                  | Business                                       |
| Test mode               | Auto-completes signing after 2 seconds    | Client must call the sign endpoint manually    |
| Blockchain proof        | Yes                                       | Yes                                            |
| Webhook                 | Yes (`agreement.signed`)                  | Yes (`agreement.signed`)                       |
| PDF certificate         | Yes                                       | Yes                                            |

For most integrations, **email-link signing is the right default** — it requires no frontend work and handles the common case where the signer is not present at checkout. Embedded signing is the right choice when the signer is actively present on the page and the business wants a seamless, uninterrupted flow.
