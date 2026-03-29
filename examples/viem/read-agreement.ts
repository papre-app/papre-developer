/**
 * Read on-chain agreement status using viem.
 *
 * Usage:
 *   npx tsx read-agreement.ts
 */
import { createPublicClient, http } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { SIMPLE_DOCUMENT_AGREEMENT_ABI } from '../../contracts/abis/SimpleDocumentAgreement.js';

// SimpleDocumentAgreement on Fuji testnet
const CONTRACT_ADDRESS = '0x667eE25546DD318Ef4CBD6b6d826C23a3644Dd63' as const;

const client = createPublicClient({
  chain: avalancheFuji,
  transport: http(),
});

async function main() {
  const instanceId = 1n; // Change to your instance ID

  // Read agreement status
  // Note: getStatus uses delegatecall internally, so it's not marked as `view`,
  // but readContract uses eth_call which works for gas-free reads.
  const [creator, signers, bundlerCid, signedCount, isComplete] =
    await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: SIMPLE_DOCUMENT_AGREEMENT_ABI,
      functionName: 'getStatus',
      args: [instanceId],
    });

  console.log('Agreement Status:');
  console.log(`  Creator: ${creator}`);
  console.log(`  Signers: ${signers.join(', ')}`);
  console.log(`  Bundler CID: ${bundlerCid}`);
  console.log(`  Signed: ${signedCount}/${signers.length}`);
  console.log(`  Complete: ${isComplete}`);

  // Check if a specific address has signed
  if (signers.length > 0) {
    const hasSigned = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: SIMPLE_DOCUMENT_AGREEMENT_ABI,
      functionName: 'hasSigned',
      args: [instanceId, signers[0]],
    });
    console.log(`\n  ${signers[0]} signed: ${hasSigned}`);
  }

  // Get total instance count
  const totalInstances = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: SIMPLE_DOCUMENT_AGREEMENT_ABI,
    functionName: 'instanceCount',
  });
  console.log(`\nTotal agreements on this contract: ${totalInstances}`);
}

main().catch(console.error);
