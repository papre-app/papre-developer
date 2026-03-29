# Signing Security

## Overview

Papre uses a **three-hash verification model** to ensure document integrity, signer identity, and evidence preservation for every signed agreement. Each hash is computed server-side, stored on the agreement record, and included in the on-chain attestation.

The three hashes are:

| Hash | What it covers |
|------|----------------|
| `document_hash` | Integrity of the rendered document content |
| `signer_identity_hash` | Identity of the intended signer |
| `evidence_hash` | Full signing evidence: IP, user agent, timestamp, method, and more |

Together they create an audit trail that proves: the right person signed the right document at the right time, and the document had not been altered between creation and signing.

---

## Document Hash

**Computed at:** Agreement creation — both `POST /v1/agreements` and when a draft is sent via `POST /v1/drafts/{id}/send`.

**What is hashed:** The fully rendered document. This means the template content with all merge fields applied — not just the template ID or metadata. The rendering pipeline runs `fetchTemplateContent()` followed by `preprocessAndApply()`, then SHA-256 is computed over the resulting string.

**Stored as:** `document_hash` on the agreement record (hex string, 64 characters).

**Verified at sign time:** When a signer submits their signature (either via the direct link or the embedded flow), Papre re-renders the document from the current template and the agreement's stored merge fields, then computes the hash again. If the re-computed hash does not match `document_hash`, the signing request is rejected with `409 document_tampered`.

This means if a template is edited after an agreement is created, signers cannot inadvertently sign a different document than the one originally prepared. The hash is the proof of exactly what was presented.

**Null handling:** If the template has no content at creation time, `document_hash` is stored as `null` and tamper detection is skipped for that agreement.

---

## Signer Identity Hash

**Computed at:** Agreement creation.

**What is hashed:**

```
SHA-256(JSON.stringify({
  email: lowercase(trim(signer_email)),
  name:  trim(signer_name)
}))
```

The email is lowercased and trimmed, the name is trimmed, and the object is serialized with keys in that fixed order before hashing. This normalization ensures that `Alice@Example.com` and `alice@example.com` produce the same hash.

**Stored as:** `signer_identity_hash` on the agreement record.

**Verified at sign time:**

- **Direct link signing (`POST /v1/sign/{token}`):** If the POST body includes a `signer_email` field, the identity hash is recomputed from the submitted email + the name stored in the agreement. A mismatch returns `403 signer_mismatch`. If `signer_email` is omitted, the check is skipped (backwards compatible with older integrations).
- **Embedded signing intent (`POST /v1/embed/signing-intent`):** The signer identity is always taken from the agreement record — never from any `signer_fields` passed in the request. Any identity-related keys (`customerEmail`, `customerName`, `signer_email`, `signer_name`, `signerEmail`, `signerName`, `email`, `name`) are automatically stripped from `signer_fields` before processing.
- **Embedded sign (`POST /v1/embed/sign`):** The `signer_identity_hash` captured during the signing-intent step is compared to the agreement's stored hash. A mismatch returns `403 signer_identity_mismatch`.

---

## Evidence Hash

**Computed at:** Sign time, for both the direct-link and embedded flows.

**What is hashed:** A JSON object representing the complete signing evidence, with keys sorted alphabetically for deterministic serialization:

```
SHA-256(JSON.stringify(evidence, sortedKeys))
```

The evidence object includes:

| Field | Type | Description |
|-------|------|-------------|
| `method` | string | `"direct_link"` or `"embed_widget"` |
| `consent_given` | boolean | Always `true` — required to sign |
| `consent_text` | string | The exact consent text presented (embedded flow only) |
| `ip_address` | string or null | Signer's IP address from request headers |
| `user_agent` | string or null | Signer's browser user agent |
| `timestamp` | datetime | When the signature was submitted |
| `signature_type` | string | `"click"`, `"typed"`, `"drawn"`, or `"wallet"` (embedded flow only) |
| `review_duration_ms` | number or null | How long the signer reviewed the document (embedded flow only) |
| `embed_origin` | string or null | The embedding site's origin (embedded flow only) |
| `document_hash_verified` | boolean | Whether document integrity was checked (embedded flow only) |
| `signer_identity_verified` | boolean | Whether signer identity was verified (direct link only) |
| `document_integrity_verified` | boolean | Whether document tamper check passed (direct link only) |

**Stored as:** `evidence_hash` on the agreement record. The full `signing_evidence` object is also stored alongside it for human-readable audit access.

---

## Verification Flow

The full lifecycle from document creation to on-chain attestation:

```
Document Created
  │
  ├── template + merge_fields → fully rendered document → SHA-256 → document_hash
  ├── signer_email (normalized) + signer_name → SHA-256 → signer_identity_hash
  └── Both hashes stored in agreement record
              │
              ▼
Signer Opens Document
  │
  └── Document re-rendered from stored template + merge_fields → SHA-256
              │
              ▼
Match Check
  │
  ├── Hashes match → proceed
  └── Hashes differ → 409 document_tampered, signing rejected
              │
              ▼
Signature Recorded
  │
  ├── Signer identity verified → signer_identity_hash compared
  └── Evidence object assembled → SHA-256 → evidence_hash
              │
              ▼
Blockchain Attestation
  └── All three hashes included in on-chain attestation record
```

---

## On-Chain Registry (Roadmap)

All three hashes will be recorded on-chain via a `PapreSigningRegistry` contract, making every signed agreement independently verifiable by anyone with the agreement ID — no Papre infrastructure required to audit.

The registry interface:

```solidity
function registerDocument(
    bytes32 agreementHash,
    bytes32 documentHash,
    bytes32 signerIdentityHash
) external;

function attestSigning(
    bytes32 agreementHash,
    bytes32 evidenceHash
) external;

function verifyDocument(
    bytes32 agreementHash,
    bytes32 documentHash
) external view returns (bool);

function getRecord(
    bytes32 agreementHash
) external view returns (Record memory);
```

Key properties:

- `agreementHash` is SHA-256 of the agreement ID — the stable key linking the on-chain record back to Papre's system
- Only the server's attestation wallet can call `registerDocument` and `attestSigning`
- `verifyDocument` and `getRecord` are public — anyone can verify a signing event without trusting Papre
- Events emitted: `DocumentRegistered`, `SigningAttested`

Until the registry is deployed, Papre uses a self-transaction attestation (a zero-value transaction to a known address) as the on-chain proof mechanism. The transaction hash returned in `blockchain_tx` on the agreement record and in webhook payloads is this attestation.

---

## Error Codes

| Code | HTTP Status | When It Occurs |
|------|-------------|----------------|
| `document_tampered` | 409 | The document hash at sign time does not match the creation-time hash. The template was likely modified after the agreement was created. |
| `signer_mismatch` | 403 | The `signer_email` submitted in a direct-link signing request does not match the identity hash stored on the agreement. |
| `signer_identity_mismatch` | 403 | The signer identity computed during an embedded signing-intent request does not match the identity hash stored on the agreement. |

When any of these errors is returned, the signing attempt is rejected and no signature is recorded. The agreement remains in `pending` status.
