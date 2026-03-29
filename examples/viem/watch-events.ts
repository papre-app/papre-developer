/**
 * Watch for on-chain agreement events using viem.
 *
 * Usage:
 *   npx tsx watch-events.ts
 */
import { createPublicClient, http, parseAbiItem } from 'viem';
import { avalancheFuji } from 'viem/chains';

// SimpleDocumentAgreement on Fuji testnet
const CONTRACT_ADDRESS = '0x667eE25546DD318Ef4CBD6b6d826C23a3644Dd63' as const;

const client = createPublicClient({
  chain: avalancheFuji,
  transport: http(),
});

async function main() {
  console.log('Watching for agreement events on Fuji testnet...\n');

  // Watch for new agreement instances
  const unwatchCreated = client.watchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: [
      parseAbiItem(
        'event InstanceCreated(uint256 indexed instanceId, address indexed creator, string bundlerCid, address[] signers)',
      ),
    ],
    eventName: 'InstanceCreated',
    onLogs: (logs) => {
      for (const log of logs) {
        console.log(`[InstanceCreated] Instance #${log.args.instanceId}`);
        console.log(`  Creator: ${log.args.creator}`);
        console.log(`  Bundler CID: ${log.args.bundlerCid}`);
        console.log(`  Signers: ${log.args.signers?.join(', ')}`);
        console.log();
      }
    },
  });

  // Watch for signatures
  const unwatchSigned = client.watchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: [
      parseAbiItem(
        'event Signed(uint256 indexed instanceId, address indexed signer, uint256 timestamp)',
      ),
    ],
    eventName: 'Signed',
    onLogs: (logs) => {
      for (const log of logs) {
        console.log(`[Signed] Instance #${log.args.instanceId}`);
        console.log(`  Signer: ${log.args.signer}`);
        console.log(`  Timestamp: ${new Date(Number(log.args.timestamp) * 1000).toISOString()}`);
        console.log();
      }
    },
  });

  // Watch for completions
  const unwatchCompleted = client.watchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: [parseAbiItem('event Completed(uint256 indexed instanceId)')],
    eventName: 'Completed',
    onLogs: (logs) => {
      for (const log of logs) {
        console.log(`[Completed] Instance #${log.args.instanceId} — all parties signed!`);
        console.log();
      }
    },
  });

  // Keep the process running
  console.log('Press Ctrl+C to stop.\n');
  process.on('SIGINT', () => {
    unwatchCreated();
    unwatchSigned();
    unwatchCompleted();
    process.exit(0);
  });

  // Prevent Node from exiting
  await new Promise(() => {});
}

main().catch(console.error);
