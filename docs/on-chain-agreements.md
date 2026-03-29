# On-Chain Agreements

## How Papre Agreements Work On-Chain

Papre uses a **microkernel architecture** where:

- **Agreements** are ERC-1167 minimal proxy clones that hold all storage
- **Clauses** are stateless logic contracts called via `delegatecall`
- **Storage** uses ERC-7201 namespaced slots to prevent collisions between clauses

### The Proxy Pattern

A factory deploys one template implementation once. Every subsequent agreement is a cheap ERC-1167 clone of that template — a ~45 byte forwarding contract that costs a fraction of a full deployment. Each clone gets its own isolated storage but shares the template's bytecode.

Clauses are called via `delegatecall` from the agreement proxy. Because `delegatecall` executes the clause's code in the context of the calling contract, the clause reads and writes the agreement's storage, not its own. Clauses carry no state of their own — they are pure logic. Storage collisions between clauses are prevented by ERC-7201 namespaced slots: each clause hashes a unique string to derive its storage slot, so they can never overlap.

```
User → Agreement Proxy (holds storage) → delegatecall → Clause Logic (stateless)
```

---

## SimpleDocumentAgreement

The primary contract for multi-party document signing. It composes two clauses:

- **SignatureClauseLogicV3** — ERC-191/EIP-712 signature verification and signer tracking
- **DeclarativeClauseLogicV3** — IPFS content anchoring (stores and retrieves the `bundlerCid`)

A single deployed `SimpleDocumentAgreement` template supports an unlimited number of independent instances. Each call to `createInstance` produces a new `instanceId` that is completely isolated from all others.

### Creating an Instance

```typescript
import { createWalletClient, http } from 'viem';
import { avalancheFuji } from 'viem/chains';
import SIMPLE_DOCUMENT_AGREEMENT_ABI from '../contracts/abis/SimpleDocumentAgreement';

const SIMPLE_DOCUMENT_ADDRESS = '0x667eE25546DD318Ef4CBD6b6d826C23a3644Dd63';

const tx = await walletClient.writeContract({
  address: SIMPLE_DOCUMENT_ADDRESS,
  abi: SIMPLE_DOCUMENT_AGREEMENT_ABI,
  functionName: 'createInstance',
  args: [
    ['0xSigner1...', '0xSigner2...'], // signers — must be non-empty
    'bafybeigdyr...',                  // bundlerCid — IPFS CID of the agreement bundle
  ],
  chain: avalancheFuji,
});
```

The returned `instanceId` is a `uint256` auto-incremented counter. Listen for the `InstanceCreated` event on the receipt to capture it reliably:

```typescript
const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
const log = receipt.logs.find(/* parse InstanceCreated event */);
// instanceId is log.args.instanceId
```

### Signing

Any address registered as a signer on a given instance can call `sign`. Pass `'0x'` as the signature bytes for click-to-sign flows where no cryptographic signature is required. When the last required signer submits, the contract emits `Completed`.

```typescript
await walletClient.writeContract({
  address: SIMPLE_DOCUMENT_ADDRESS,
  abi: SIMPLE_DOCUMENT_AGREEMENT_ABI,
  functionName: 'sign',
  args: [instanceId, '0x'], // signature bytes — can be empty for click-to-sign
  chain: avalancheFuji,
});
```

### Reading Status

**Important:** `getStatus`, `hasSigned`, `isTrustedAttestor`, and `getSignatureTimestamp` use `delegatecall` internally and are therefore marked `nonpayable` (not `view`) in the ABI. They do not modify state, but Solidity cannot guarantee that through the compiler when `delegatecall` is involved. Use `readContract` (which sends an `eth_call`) to read them gas-free — do not use `simulateContract` and pay gas unnecessarily.

```typescript
import { createPublicClient, http } from 'viem';
import { avalancheFuji } from 'viem/chains';
import SIMPLE_DOCUMENT_AGREEMENT_ABI from '../contracts/abis/SimpleDocumentAgreement';

const publicClient = createPublicClient({
  chain: avalancheFuji,
  transport: http('https://api.avax-test.network/ext/bc/C/rpc'),
});

const [creator, signers, bundlerCid, signedCount, isComplete] =
  await publicClient.readContract({
    address: SIMPLE_DOCUMENT_ADDRESS,
    abi: SIMPLE_DOCUMENT_AGREEMENT_ABI,
    functionName: 'getStatus',
    args: [instanceId],
  });
```

### Watching Events

```typescript
// Watch for new instances being created
publicClient.watchContractEvent({
  address: SIMPLE_DOCUMENT_ADDRESS,
  abi: SIMPLE_DOCUMENT_AGREEMENT_ABI,
  eventName: 'InstanceCreated',
  onLogs: (logs) => {
    for (const log of logs) {
      console.log('New instance:', log.args.instanceId);
      console.log('Creator:', log.args.creator);
      console.log('Signers:', log.args.signers);
    }
  },
});

// Watch for signatures
publicClient.watchContractEvent({
  address: SIMPLE_DOCUMENT_ADDRESS,
  abi: SIMPLE_DOCUMENT_AGREEMENT_ABI,
  eventName: 'Signed',
  onLogs: (logs) => {
    for (const log of logs) {
      console.log('Signed by:', log.args.signer, 'at', log.args.timestamp);
    }
  },
});

// Watch for completion (all signers have signed)
publicClient.watchContractEvent({
  address: SIMPLE_DOCUMENT_ADDRESS,
  abi: SIMPLE_DOCUMENT_AGREEMENT_ABI,
  eventName: 'Completed',
  onLogs: (logs) => {
    for (const log of logs) {
      console.log('Agreement complete, instanceId:', log.args.instanceId);
    }
  },
});
```

---

## Write Functions

| Function | Parameters | Description |
|----------|------------|-------------|
| `createInstance` | `signers: address[]`, `bundlerCid: string` | Creates a new signing instance. `signers` must be non-empty. `bundlerCid` must be a non-empty string (IPFS CID). Returns `instanceId`. |
| `sign` | `instanceId: uint256`, `signature: bytes` | Records a signature for the caller on the given instance. Caller must be a registered signer and must not have already signed. Pass `'0x'` for click-to-sign. |
| `claimSignerSlot` | `instanceId: uint256`, `slotIndex: uint256`, `attestation: bytes` | Allows an address to claim an anonymous signer slot by presenting an attestation signed by a trusted attestor. Used when the signer's address is not known at instance creation time. |
| `setTrustedAttestor` | `attestor: address`, `trusted: bool` | Grants or revokes trusted attestor status. Only callable by the agreement creator. Trusted attestors can issue attestations for `claimSignerSlot`. |

---

## Read Functions

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `getStatus` | `instanceId: uint256` | `(creator: address, signerList: address[], bundlerCid: string, signedCount: uint256, isComplete: bool)` | Full snapshot of an instance. Uses `delegatecall` internally — use `readContract` (eth_call), not a view call. |
| `hasSigned` | `instanceId: uint256`, `signer: address` | `bool` | Whether the given address has signed this instance. Uses `delegatecall` internally — use `readContract`. |
| `isTrustedAttestor` | `attestor: address` | `bool` | Whether the given address is a trusted attestor for this agreement. Uses `delegatecall` internally — use `readContract`. |
| `getSignatureTimestamp` | `instanceId: uint256`, `signer: address` | `uint256` | Unix timestamp at which the signer signed. Returns `0` if unsigned. Uses `delegatecall` internally — use `readContract`. |
| `getBundlerCid` | `instanceId: uint256` | `string` | The IPFS CID of the agreement content bundle. True `view` function. |
| `getSigners` | `instanceId: uint256` | `address[]` | The ordered list of signers registered on the instance. True `view` function. |
| `getCreator` | `instanceId: uint256` | `address` | The address that called `createInstance`. True `view` function. |
| `instanceCount` | _(none)_ | `uint256` | Total number of instances created across all time. The next `instanceId` will be this value. True `view` function. |

---

## Events

| Event | Parameters | When it fires |
|-------|------------|---------------|
| `InstanceCreated` | `instanceId` (indexed), `creator` (indexed), `bundlerCid`, `signers` | Once per `createInstance` call. Use this to capture the `instanceId` from a transaction receipt. |
| `Signed` | `instanceId` (indexed), `signer` (indexed), `timestamp` | Each time a signer successfully calls `sign` or `claimSignerSlot`. |
| `Completed` | `instanceId` (indexed) | When the final required signer signs, making `signedCount == signers.length`. Emitted in the same transaction as the final `Signed` event. |
| `SignerSlotClaimed` | `instanceId` (indexed), `slotIndex` (indexed), `claimer` (indexed) | When an address successfully claims an anonymous signer slot via `claimSignerSlot`. |

---

## Deployed Contracts (Fuji Testnet)

**Chain ID:** `43113`
**RPC URL:** `https://api.avax-test.network/ext/bc/C/rpc`

### Templates

| Name | Address |
|------|---------|
| `simpleDocument` | `0x667eE25546DD318Ef4CBD6b6d826C23a3644Dd63` |
| `freelanceService` | `0xb8810B5A15AeA03E2B3800387AE2572E8494819E` |
| `milestonePayment` | `0x6AC7d9a9FAd13ff81fb76075D7f40eafF2463BF9` |
| `retainer` | `0x73D3842BA960977E08D1b508ddc6F7C87575b192` |
| `safetyNet` | `0x2BfDFF3949063eE9851630D5f9FCE9abC77C67Dc` |
| `nda` | `0xFaB6356e2b8e1d4E1De0776C5cfC2f50E8E40C1D` |
| `papreboatRental` | `0x223D88C7cfa695f44a68eE491520e7f9535361b8` |

### Clauses

| Name | Address |
|------|---------|
| `signature` | `0x9A6d4412bf93530aFC96eCC3D8F998D72E977D6E` |
| `escrow` | `0xA9923F79997Ca47A21eD21C95A848fFF3F1490fE` |
| `partyRegistry` | `0x1a44086882F966c060C40860cC00006913C0269c` |
| `declarative` | `0xDfBEc9772904b74436DFDf79ee5701BCB2135dF7` |
| `milestone` | `0x3D83a056D2a3F6f962c910158A193C93ae872504` |
| `deadline` | `0x894A34f1002f70CB8CdD3e1D67135d7acdbBF416` |
| `arbitration` | `0xa65F5760dE712b0d32cC35EF97085562f545a6B3` |
| `crossChain` | `0x417E9ec04e8B20901111898D41fE33e168cBB93B` |

### Infrastructure

| Name | Address |
|------|---------|
| `factory` | `0x62CE422EbcB829a754632ed3837d7EdF54E19Ce2` |
| `partyEscrowFactory` | `0x192cb387a48a85A7bD168f08712b67926902ECD0` |

### Adapters

| Name | Address |
|------|---------|
| `milestoneEscrow` | `0xD74F58Ec5AFb9a99c878967a0cf2b851AeD462f1` |
| `deadlineEnforcement` | `0xab8Ca0B56890933024187f1eC072920B00313870` |

---

## Clause Architecture

All Papre agreement templates are assembled from reusable, stateless clause logic contracts. Each clause is deployed once and shared across all agreements that use it.

| Clause Family | What it does |
|---------------|-------------|
| **Signature** | Registers signers, verifies ERC-191 and EIP-712 signatures, tracks per-signer completion state, and records timestamps. The `claimSignerSlot` pattern allows anonymous signers to be resolved at signing time via trusted attestor. |
| **Escrow** | Holds value (native token or ERC-20) in custody on behalf of the agreement. Releases funds conditionally based on state transitions in other clauses (e.g., all parties signed, milestone approved). |
| **Milestone** | Tracks multi-stage payment schedules. Each milestone has its own approval state; funds are released per milestone rather than all-at-once. |
| **Deadline** | Enforces time-based constraints. Can block actions before a start time, after a deadline, or trigger automatic state transitions when a window closes. |
| **Arbitration** | Provides dispute resolution logic. A designated arbitrator (or multisig) can override normal state transitions to resolve disagreements between parties. |
| **Declarative** | Anchors off-chain content to an agreement by storing IPFS CIDs on-chain. The content (PDF, JSON bundle, etc.) lives on IPFS; the CID provides tamper-evident proof of what was agreed to. |
| **PartyRegistry** | Manages participant lists beyond the simple signer array. Used in agreements with distinct roles (e.g., client, contractor, arbitrator) where access control varies by role. |
| **CrossChain** | Handles operations that span multiple chains — receiving messages from bridge protocols or coordinating state with a contract deployed on a different network. |

Because clauses are stateless and called via `delegatecall`, any combination can be composed into a new agreement template without redeploying the clause logic. The clause addresses listed in the [Deployed Contracts](#deployed-contracts-fuji-testnet) table are the shared implementations used by all current templates.
