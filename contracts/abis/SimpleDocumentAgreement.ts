/**
 * SimpleDocumentAgreement ABI — typed for viem
 *
 * Multi-party document signing agreement using SignatureClauseLogicV3 + DeclarativeClauseLogicV3.
 *
 * Note: getStatus, hasSigned, and isTrustedAttestor use delegatecall internally
 * to read storage, so they are not marked as view even though they don't modify state.
 * Call them using eth_call for gas-free reads.
 */
export const SIMPLE_DOCUMENT_AGREEMENT_ABI = [
  {
    type: "constructor",
    inputs: [
      { name: "declarativeLogic", type: "address" },
      { name: "signatureLogic", type: "address" },
    ],
  },

  // Errors
  { type: "error", name: "InvalidBundlerCid", inputs: [] },
  { type: "error", name: "NoSignersProvided", inputs: [] },
  { type: "error", name: "InstanceDoesNotExist", inputs: [] },
  { type: "error", name: "NotASigner", inputs: [] },
  { type: "error", name: "AlreadySigned", inputs: [] },
  {
    type: "error",
    name: "DelegatecallFailed",
    inputs: [{ name: "reason", type: "string" }],
  },

  // Events
  {
    type: "event",
    name: "InstanceCreated",
    inputs: [
      { name: "instanceId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "bundlerCid", type: "string", indexed: false },
      { name: "signers", type: "address[]", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Signed",
    inputs: [
      { name: "instanceId", type: "uint256", indexed: true },
      { name: "signer", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Completed",
    inputs: [{ name: "instanceId", type: "uint256", indexed: true }],
  },
  {
    type: "event",
    name: "SignerSlotClaimed",
    inputs: [
      { name: "instanceId", type: "uint256", indexed: true },
      { name: "slotIndex", type: "uint256", indexed: true },
      { name: "claimer", type: "address", indexed: true },
    ],
  },

  // Write Functions
  {
    type: "function",
    name: "createInstance",
    stateMutability: "nonpayable",
    inputs: [
      { name: "signers", type: "address[]" },
      { name: "bundlerCid", type: "string" },
    ],
    outputs: [{ name: "instanceId", type: "uint256" }],
  },
  {
    type: "function",
    name: "sign",
    stateMutability: "nonpayable",
    inputs: [
      { name: "instanceId", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimSignerSlot",
    stateMutability: "nonpayable",
    inputs: [
      { name: "instanceId", type: "uint256" },
      { name: "slotIndex", type: "uint256" },
      { name: "attestation", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setTrustedAttestor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "attestor", type: "address" },
      { name: "trusted", type: "bool" },
    ],
    outputs: [],
  },

  // Read Functions (use eth_call — not marked as view due to delegatecall)
  {
    type: "function",
    name: "getStatus",
    stateMutability: "nonpayable",
    inputs: [{ name: "instanceId", type: "uint256" }],
    outputs: [
      { name: "creator", type: "address" },
      { name: "signerList", type: "address[]" },
      { name: "bundlerCid", type: "string" },
      { name: "signedCount", type: "uint256" },
      { name: "isComplete", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "hasSigned",
    stateMutability: "nonpayable",
    inputs: [
      { name: "instanceId", type: "uint256" },
      { name: "signer", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "isTrustedAttestor",
    stateMutability: "nonpayable",
    inputs: [{ name: "attestor", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "getSignatureTimestamp",
    stateMutability: "nonpayable",
    inputs: [
      { name: "instanceId", type: "uint256" },
      { name: "signer", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },

  // Pure View Functions
  {
    type: "function",
    name: "getBundlerCid",
    stateMutability: "view",
    inputs: [{ name: "instanceId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "getSigners",
    stateMutability: "view",
    inputs: [{ name: "instanceId", type: "uint256" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "getCreator",
    stateMutability: "view",
    inputs: [{ name: "instanceId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "instanceCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "DECLARATIVE_LOGIC",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "SIGNATURE_LOGIC",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;
