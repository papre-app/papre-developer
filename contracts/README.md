# Papre Smart Contracts

Papre agreements live on-chain as composable smart contracts on Avalanche. This directory contains the ABIs and deployed addresses you need to interact with them.

## Architecture

Papre uses a **microkernel pattern** where agreements are minimal data containers and clauses are single-purpose logic primitives:

```
User -> Agreement (ERC-1167 proxy) -> delegatecall -> ClauseLogic (stateless)
                    |
            ERC-7201 Storage (namespaced, in proxy)
```

- **Agreements** are ERC-1167 minimal proxy clones that hold all storage
- **Clauses** are stateless logic contracts called via `delegatecall`
- **Storage** uses ERC-7201 namespaced slots to prevent collisions between clauses

## Deployed Contracts (Fuji Testnet — Chain ID 43113)

### Templates

| Template | Address | Description |
|----------|---------|-------------|
| SimpleDocument | `0x667e...Dd63` | Multi-party document signing |
| FreelanceService | `0xb881...819E` | One-time service with escrow |
| MilestonePayment | `0x6AC7...afF2` | Multi-stage payments with escrow |
| Retainer | `0x73D3...b192` | Recurring monthly payments |
| SafetyNet | `0x2BfD...67Dc` | Arbitration-based dispute resolution |
| NDA | `0xFaB6...0C1D` | Non-disclosure agreements |

### Clauses

| Clause | Address | Description |
|--------|---------|-------------|
| Signature | `0x9A6d...7D6E` | ERC-191/EIP-712 signature verification |
| Escrow | `0xA992...D6E` | Value custody with conditional release |
| PartyRegistry | `0x1a44...269c` | Agreement participant management |
| Declarative | `0xDfBE...dF7` | Off-chain content anchoring |
| Milestone | `0x3D83...2504` | Multi-stage payment tracking |
| Deadline | `0x894A...BF416` | Time-based constraints |
| Arbitration | `0xa65F...62f3` | Dispute resolution logic |
| CrossChain | `0x417E...93B` | Cross-chain operations |

### Infrastructure

| Contract | Address | Description |
|----------|---------|-------------|
| Factory | `0x62CE...9Ce2` | Creates new agreement instances (ERC-1167 clones) |
| PartyEscrowFactory | `0x192c...ECD0` | Deploys per-agreement escrow proxies |

## Usage

### With viem (TypeScript)

```typescript
import { createPublicClient, http } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { SIMPLE_DOCUMENT_AGREEMENT_ABI } from './abis/SimpleDocumentAgreement';

const client = createPublicClient({
  chain: avalancheFuji,
  transport: http(),
});

// Read agreement status (use eth_call — not a view function due to delegatecall)
const [creator, signers, bundlerCid, signedCount, isComplete] = await client.readContract({
  address: '0x667eE25546DD318Ef4CBD6b6d826C23a3644Dd63',
  abi: SIMPLE_DOCUMENT_AGREEMENT_ABI,
  functionName: 'getStatus',
  args: [1n], // instanceId
});
```

### With ethers.js

```typescript
import { ethers } from 'ethers';
import abi from './abis/SimpleDocumentAgreement.json';

const provider = new ethers.JsonRpcProvider('https://api.avax-test.network/ext/bc/C/rpc');
const contract = new ethers.Contract('0x667eE25546DD318Ef4CBD6b6d826C23a3644Dd63', abi, provider);

const status = await contract.getStatus(1);
```

### Important: delegatecall Read Functions

`getStatus`, `hasSigned`, `isTrustedAttestor`, and `getSignatureTimestamp` use `delegatecall` internally to read from clause storage. They are **not** marked as `view` in the ABI, but they do not modify state. Always call them using `eth_call` (which is the default behavior of `readContract` in viem and `contract.functionName()` in ethers).

## Full Addresses

See [addresses.json](./addresses.json) for all deployed contract addresses in machine-readable format.
