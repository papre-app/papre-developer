# Webhooks

## Overview

Webhooks let Papre notify your server about agreement lifecycle events in real time. Rather than polling the API for status changes, you register a URL and Papre POSTs a signed payload to it whenever a relevant event occurs.

Webhooks fire for events including signing completion, document views, link expiry, and cancellations. They are the authoritative mechanism for updating your system's state — do not rely solely on frontend API responses for status changes.

---

## Registering a Webhook

**POST /v1/webhooks**

**Authentication:** API key required (`Authorization: Bearer papre_live_sk_...`)

**Request Body:**

| Field    | Type            | Required | Description                                      |
|----------|-----------------|----------|--------------------------------------------------|
| `url`    | string          | yes      | HTTPS endpoint Papre will POST events to         |
| `events` | array of strings | yes     | List of event types to subscribe to (see below)  |

**Example request:**

```bash
curl -X POST https://api.papre.com/v1/webhooks \
  -H "Authorization: Bearer papre_live_sk_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://yourapp.com/webhooks/papre",
    "events": ["agreement.signed", "agreement.expired", "agreement.declined"]
  }'
```

**Response (HTTP 201):**

```json
{
  "webhook_id": "whk_abc12345",
  "url": "https://yourapp.com/webhooks/papre",
  "events": ["agreement.signed", "agreement.expired", "agreement.declined"],
  "created_at": "2026-03-10T14:30:00Z"
}
```

Note: No `secret` field is returned in this response. The `webhook_secret` used for HMAC verification is issued once when you generate your API key via `POST /v1/auth/api-key`. Store it securely — it cannot be retrieved again.

---

## Listing Webhooks

**GET /v1/webhooks**

**Authentication:** API key required

Returns all webhooks registered to your account, paginated.

**Example request:**

```bash
curl https://api.papre.com/v1/webhooks \
  -H "Authorization: Bearer papre_live_sk_abc123"
```

**Response (HTTP 200):**

```json
{
  "data": [
    {
      "webhook_id": "whk_abc12345",
      "url": "https://yourapp.com/webhooks/papre",
      "events": ["agreement.signed", "agreement.expired"],
      "created_at": "2026-03-10T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 1
  }
}
```

---

## Deleting a Webhook

**DELETE /v1/webhooks/{id}**

**Authentication:** API key required

**Example request:**

```bash
curl -X DELETE https://api.papre.com/v1/webhooks/whk_abc12345 \
  -H "Authorization: Bearer papre_live_sk_abc123"
```

**Response (HTTP 200):**

```json
{
  "deleted": true
}
```

---

## Event Types

| Event                  | Fired When                                    |
|------------------------|-----------------------------------------------|
| `agreement.signed`     | Signer completes signing                      |
| `agreement.viewed`     | Signer opens the signing link                 |
| `agreement.expired`    | Signing link expires before completion        |
| `agreement.declined`   | Signer explicitly declines to sign            |
| `agreement.cancelled`  | Originator cancels or voids the agreement     |

---

## Payload Structure

Papre POSTs JSON to your registered URL. All events share the same envelope shape — fields not relevant to the event type will be `null`.

| Field                 | Type     | Description                                                          |
|-----------------------|----------|----------------------------------------------------------------------|
| `event_type`          | string   | Event name (e.g., `"agreement.signed"`)                             |
| `agreement_id`        | string   | Which agreement this event is about                                  |
| `status`              | string   | New status of the agreement                                          |
| `signer_email`        | string   | Email of the signer                                                  |
| `signer_name`         | string   | Name of the signer                                                   |
| `signed_at`           | datetime | When signing occurred (present on `agreement.signed` only)           |
| `blockchain_tx`       | string   | Transaction hash (present on `agreement.signed` only)                |
| `signed_document_url` | string   | URL to the signed document (present on `agreement.signed` only)      |
| `external_reference`  | string   | Your identifier passed at agreement creation                         |
| `external_group_id`   | string   | Your group/booking identifier passed at agreement creation           |
| `metadata`            | object   | Arbitrary data your system sent at creation                          |
| `timestamp`           | datetime | When this webhook event was generated                                |
| `signature`           | string   | HMAC-SHA256 signature for verification (also in `X-Papre-Signature`) |

**Full example payload (`agreement.signed`):**

```json
{
  "event_type": "agreement.signed",
  "agreement_id": "agr_abc123",
  "status": "signed",
  "signer_email": "alice@example.com",
  "signer_name": "Alice Johnson",
  "signed_at": "2026-03-15T10:30:00Z",
  "blockchain_tx": "0xabc123def456...",
  "signed_document_url": "https://api.papre.com/v1/agreements/agr_abc123/document",
  "external_reference": "participant_101",
  "external_group_id": "booking_55",
  "metadata": {
    "event_name": "Sunset Kayak Tour",
    "event_date": "2026-03-15"
  },
  "timestamp": "2026-03-15T10:30:01Z",
  "signature": "a1b2c3d4e5f6..."
}
```

---

## Verifying Webhook Signatures

Every webhook request includes an `X-Papre-Signature` header containing an HMAC-SHA256 hex digest of the raw request body, signed with your `webhook_secret`. Always verify this header before processing the payload — reject requests where verification fails.

Use constant-time comparison to prevent timing attacks.

### Node.js

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature, 'hex')
  );
}

// Express middleware example
app.post('/webhooks/papre', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-papre-signature'];
  const secret = process.env.PAPRE_WEBHOOK_SECRET;

  if (!verifyWebhook(req.body, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(req.body);
  // process event...
  res.json({ received: true });
});
```

### Python

```python
import hmac
import hashlib

def verify_webhook(payload: str, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)

# Flask example
from flask import Flask, request, abort
import os

app = Flask(__name__)

@app.route('/webhooks/papre', methods=['POST'])
def webhook():
    signature = request.headers.get('X-Papre-Signature')
    secret = os.environ['PAPRE_WEBHOOK_SECRET']

    if not verify_webhook(request.get_data(as_text=True), signature, secret):
        abort(401)

    event = request.json
    # process event...
    return {'received': True}
```

**Important:** Pass the raw request body — the unparsed bytes — to the HMAC function. Parsing JSON first and re-serializing will produce a different hash if key ordering changes.

---

## Retry Policy

If your endpoint does not return a `2xx` response within 10 seconds, Papre considers the delivery failed and retries:

| Attempt | Delay after previous failure |
|---------|------------------------------|
| 1st retry | 1 second |
| 2nd retry | 10 seconds |
| 3rd retry | 60 seconds |

After 3 failed retries (4 total attempts), the delivery is abandoned and the event is marked as undelivered in your account's webhook delivery log.

Return `200 OK` as quickly as possible — queue heavy processing work asynchronously rather than doing it inline in your webhook handler.
