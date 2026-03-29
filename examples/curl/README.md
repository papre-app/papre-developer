# Papre API — cURL Examples

All examples use `$PAPRE_API_KEY`. Set it first:

```bash
export PAPRE_API_KEY="papre_test_sk_your_key_here"
```

---

## Authentication

### Get your account profile

```bash
curl -s https://papre-api.vercel.app/api/v1/account/me \
  -H "Authorization: Bearer $PAPRE_API_KEY" | jq
```

---

## Templates

### List waiver templates

```bash
curl -s "https://papre-api.vercel.app/api/v1/templates?type=waiver" \
  -H "Authorization: Bearer $PAPRE_API_KEY" | jq
```

### Get a single template

```bash
curl -s https://papre-api.vercel.app/api/v1/templates/tmpl_adult_waiver \
  -H "Authorization: Bearer $PAPRE_API_KEY" | jq
```

### Preview template content with sample data

```bash
curl -s "https://papre-api.vercel.app/api/v1/templates/tmpl_adult_waiver/content?sample_fields=%7B%22participant_name%22%3A%22Jane%20Doe%22%7D" \
  -H "Authorization: Bearer $PAPRE_API_KEY" | jq
```

---

## Agreements

### Create an agreement

```bash
curl -s -X POST https://papre-api.vercel.app/api/v1/agreements \
  -H "Authorization: Bearer $PAPRE_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-$(date +%s)" \
  -d '{
    "template_id": "tmpl_adult_waiver",
    "signer_email": "alice@example.com",
    "signer_name": "Alice Johnson",
    "merge_fields": {
      "participant_name": "Alice Johnson",
      "event_name": "Annual Company Retreat",
      "event_date": "2026-04-15"
    },
    "external_reference": "participant_101"
  }' | jq
```

### Get agreement details

```bash
curl -s https://papre-api.vercel.app/api/v1/agreements/agr_abc123 \
  -H "Authorization: Bearer $PAPRE_API_KEY" | jq
```

### Get agreement with document content

```bash
curl -s "https://papre-api.vercel.app/api/v1/agreements/agr_abc123?include=content" \
  -H "Authorization: Bearer $PAPRE_API_KEY" | jq
```

### List agreements (with filters)

```bash
curl -s "https://papre-api.vercel.app/api/v1/agreements?status=signed&per_page=10" \
  -H "Authorization: Bearer $PAPRE_API_KEY" | jq
```

### Search agreements

```bash
curl -s "https://papre-api.vercel.app/api/v1/agreements/search?q=alice" \
  -H "Authorization: Bearer $PAPRE_API_KEY" | jq
```

### Batch create agreements

```bash
curl -s -X POST https://papre-api.vercel.app/api/v1/agreements/batch \
  -H "Authorization: Bearer $PAPRE_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: batch-$(date +%s)" \
  -d '{
    "agreements": [
      {
        "template_id": "tmpl_adult_waiver",
        "signer_email": "alice@example.com",
        "signer_name": "Alice Johnson",
        "merge_fields": { "participant_name": "Alice Johnson", "event_name": "Team Offsite", "event_date": "2026-04-15" },
        "external_reference": "p_1",
        "external_group_id": "booking_99"
      },
      {
        "template_id": "tmpl_adult_waiver",
        "signer_email": "bob@example.com",
        "signer_name": "Bob Smith",
        "merge_fields": { "participant_name": "Bob Smith", "event_name": "Team Offsite", "event_date": "2026-04-15" },
        "external_reference": "p_2",
        "external_group_id": "booking_99"
      }
    ]
  }' | jq
```

### Cancel an agreement

```bash
curl -s -X POST https://papre-api.vercel.app/api/v1/agreements/agr_abc123/cancel \
  -H "Authorization: Bearer $PAPRE_API_KEY" | jq
```

### Resend signing email

```bash
curl -s -X POST https://papre-api.vercel.app/api/v1/agreements/agr_abc123/resend \
  -H "Authorization: Bearer $PAPRE_API_KEY" | jq
```

### Get audit trail

```bash
curl -s https://papre-api.vercel.app/api/v1/agreements/agr_abc123/audit-trail \
  -H "Authorization: Bearer $PAPRE_API_KEY" | jq
```

### Download signed PDF

```bash
curl -s https://papre-api.vercel.app/api/v1/agreements/agr_abc123/document?format=pdf \
  -H "Authorization: Bearer $PAPRE_API_KEY" \
  -o signed-agreement.pdf
```

### Download certificate of completion

```bash
curl -s https://papre-api.vercel.app/api/v1/agreements/agr_abc123/certificate \
  -H "Authorization: Bearer $PAPRE_API_KEY" \
  -o certificate.pdf
```

---

## Drafts

### Create a draft

```bash
curl -s -X POST https://papre-api.vercel.app/api/v1/drafts \
  -H "Authorization: Bearer $PAPRE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "tmpl_adult_waiver",
    "signer_email": "alice@example.com",
    "merge_fields": { "participant_name": "Alice Johnson" }
  }' | jq
```

### Update a draft (merge_fields are merged, not replaced)

```bash
curl -s -X PATCH https://papre-api.vercel.app/api/v1/drafts/drf_abc123 \
  -H "Authorization: Bearer $PAPRE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "merge_fields": { "event_name": "Annual Retreat", "event_date": "2026-04-15" }
  }' | jq
```

### Send a draft (converts to live agreement)

```bash
curl -s -X POST https://papre-api.vercel.app/api/v1/drafts/drf_abc123/send \
  -H "Authorization: Bearer $PAPRE_API_KEY" | jq
```

---

## Webhooks

### Register a webhook

```bash
curl -s -X POST https://papre-api.vercel.app/api/v1/webhooks \
  -H "Authorization: Bearer $PAPRE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-server.com/webhooks/papre",
    "events": ["agreement.signed", "agreement.viewed", "agreement.expired"]
  }' | jq
```

### List webhooks

```bash
curl -s https://papre-api.vercel.app/api/v1/webhooks \
  -H "Authorization: Bearer $PAPRE_API_KEY" | jq
```

### Delete a webhook

```bash
curl -s -X DELETE https://papre-api.vercel.app/api/v1/webhooks/whk_abc123 \
  -H "Authorization: Bearer $PAPRE_API_KEY"
```

---

## Embedded Signing

### Create embed-mode agreement (no email sent)

```bash
curl -s -X POST https://papre-api.vercel.app/api/v1/agreements \
  -H "Authorization: Bearer $PAPRE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "tmpl_adult_waiver",
    "signer_email": "alice@example.com",
    "signer_name": "Alice Johnson",
    "merge_fields": { "participant_name": "Alice Johnson", "event_name": "Retreat", "event_date": "2026-04-15" },
    "embed_mode": true
  }' | jq
```

### Issue browser session token

```bash
curl -s -X POST https://papre-api.vercel.app/api/v1/auth/browser-session \
  -H "Authorization: Bearer $PAPRE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "agreements:sign",
    "agreement_id": "agr_abc123",
    "ttl": 1800
  }' | jq
```
