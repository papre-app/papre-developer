<p align="center">
  <img src="assets/papre-logo.svg" alt="Papre" width="200" />
</p>

<h1 align="center">Papre Developer</h1>

<p align="center">
  <strong>Composable agreement infrastructure with blockchain attestation.</strong>
  <br />
  REST API for signature-as-a-service + on-chain smart contracts on Avalanche.
</p>

<p align="center">
  <a href="docs/api-reference.md">API Reference</a> &middot;
  <a href="docs/embedded-signing.md">Embedded Signing</a> &middot;
  <a href="docs/signing-security.md">Signing Security</a> &middot;
  <a href="docs/on-chain-agreements.md">On-Chain Contracts</a> &middot;
  <a href="sdk/">SDK</a>
</p>

---

## What is Papre?

Papre is agreement infrastructure with two layers:

1. **REST API** — Create, send, track, and sign agreements programmatically. Templates with merge fields, batch creation, embedded signing, webhooks, PDF certificates, and audit trails.

2. **On-Chain Contracts** — Smart contracts on Avalanche where agreements are compositions of atomic clauses (signature, escrow, milestone, arbitration, deadline). Every signing event is attested on-chain with document and evidence hashes.

## What You Can Build

- **Event waivers** — Booking platforms that create per-participant waivers and track signing in real time
- **Embedded contracts** — SaaS products with signing built into the user flow, no redirect needed
- **Freelance agreements** — Escrow-backed service contracts with milestone payments
- **Multi-party NDAs** — Parallel or sequential signing with per-signer status tracking
- **Automated compliance** — Webhook-driven workflows that react to signing events instantly

## Quick Start

```bash
npm install @papre/sdk
```

```typescript
import { PapreClient } from '@papre/sdk';

const papre = new PapreClient({ apiKey: 'papre_test_sk_...' });

// Create an agreement and send it for signing
const agreement = await papre.agreements.create({
  template_id: 'tmpl_adult_waiver',
  signer_email: 'alice@example.com',
  signer_name: 'Alice Johnson',
  merge_fields: {
    participant_name: 'Alice Johnson',
    event_name: 'Annual Company Retreat',
    event_date: '2026-04-15',
  },
});

console.log(agreement.signing_url); // Send this to the signer
```

## API at a Glance

| Endpoint Group | What It Does |
|----------------|-------------|
| **[Templates](docs/api-reference.md#3-waiver-templates)** | List templates, inspect merge fields, preview content |
| **[Agreements](docs/api-reference.md#4-agreement-waiver-creation)** | Create, list, search, cancel, resend — single or batch (50/call) |
| **[Drafts](docs/api-reference.md#11-drafts-api-phase-1b)** | Incremental agreement building before sending |
| **[Signing](docs/api-reference.md#9-signing-page-api)** | Token-based signing page with document rendering |
| **[Embedded Signing](docs/embedded-signing.md)** | Sign inside your own page — no redirect, no external domain |
| **[Webhooks](docs/webhooks.md)** | Real-time events: signed, viewed, expired, declined, cancelled |
| **[Documents](docs/api-reference.md#7-signed-document-retrieval)** | PDF downloads, certificates of completion |
| **[Audit Trail](docs/api-reference.md#56-audit-trail)** | Full event history with timestamps and actors |
| **[Multi-Signer](docs/api-reference.md#13-multi-signer-agreements-phase-4)** | Parallel or sequential signing with per-signer status |
| **[Security](docs/signing-security.md)** | Three-hash verification: document, identity, evidence |

## On-Chain Integration

Papre agreements live on Avalanche. Read on-chain status with [viem](https://viem.sh):

```typescript
import { createPublicClient, http } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { SIMPLE_DOCUMENT_AGREEMENT_ABI } from './contracts/abis/SimpleDocumentAgreement';

const client = createPublicClient({ chain: avalancheFuji, transport: http() });

const [creator, signers, bundlerCid, signedCount, isComplete] =
  await client.readContract({
    address: '0x667eE25546DD318Ef4CBD6b6d826C23a3644Dd63',
    abi: SIMPLE_DOCUMENT_AGREEMENT_ABI,
    functionName: 'getStatus',
    args: [1n],
  });
```

See [On-Chain Agreements](docs/on-chain-agreements.md) for the full contract reference and [deployed addresses](contracts/addresses.json).

## Architecture

```
Your Application
    |
    |  REST API (HTTPS)
    v
Papre API (papre-api.vercel.app)
    |
    |-- Templates, Agreements, Drafts, Webhooks
    |-- Document hashing (SHA-256) at creation
    |-- Signer identity hashing at creation
    |
    |  On signing:
    |-- Evidence hash (IP, user agent, timestamp)
    |-- Blockchain attestation
    v
Avalanche (on-chain)
    |
    |-- ERC-1167 proxy agreements
    |-- Stateless clause logic (delegatecall)
    |-- Immutable signing records
    |-- Event logs (InstanceCreated, Signed, Completed)
```

## Repository Structure

```
papre-developer/
  docs/
    api-reference.md          Full v1.3 API specification (30+ endpoints)
    embedded-signing.md       Step-by-step embedded signing guide
    webhooks.md               Webhook events, payloads, HMAC verification
    signing-security.md       Three-hash security model + on-chain registry roadmap
    on-chain-agreements.md    Smart contract reference + viem examples
  sdk/                        @papre/sdk — zero-dependency TypeScript SDK
  examples/
    node/                     TypeScript examples (create, batch, embed, webhooks)
    python/                   Python examples (requests-based)
    curl/                     Copy-pasteable cURL commands for every endpoint
    viem/                     On-chain reads and event watching
  contracts/
    abis/                     Contract ABIs (JSON + typed TypeScript)
    addresses.json            Deployed addresses on Avalanche Fuji
```

## Authentication

All API requests use Bearer token authentication:

```
Authorization: Bearer papre_live_sk_...
```

Keys prefixed `papre_test_` operate in sandbox mode — no emails sent, no blockchain transactions, signing auto-completes.

## Networks

| Network | Chain ID | Status | Explorer |
|---------|----------|--------|----------|
| Avalanche Fuji | 43113 | Testnet (active) | [Snowtrace](https://testnet.snowtrace.io) |
| Avalanche C-Chain | 43114 | Mainnet (coming soon) | [Snowtrace](https://snowtrace.io) |

## License

MIT
