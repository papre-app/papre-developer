/**
 * Create multiple agreements in a single batch call (up to 50).
 *
 * Usage:
 *   PAPRE_API_KEY=papre_test_sk_... npx tsx batch-create.ts
 */
import { PapreClient } from '@papre/sdk';

const papre = new PapreClient({
  apiKey: process.env.PAPRE_API_KEY!,
});

const participants = [
  { name: 'Alice Johnson', email: 'alice@example.com' },
  { name: 'Bob Smith', email: 'bob@example.com' },
  { name: 'Carol Williams', email: 'carol@example.com' },
];

async function main() {
  const result = await papre.agreements.batchCreate(
    {
      agreements: participants.map((p, i) => ({
        template_id: 'tmpl_adult_waiver',
        signer_email: p.email,
        signer_name: p.name,
        merge_fields: {
          participant_name: p.name,
          event_name: 'Annual Company Retreat',
          event_date: '2026-04-15',
        },
        external_reference: `participant_${i + 1}`,
        external_group_id: 'booking_42',
      })),
    },
    { idempotencyKey: 'booking_42-batch' },
  );

  console.log(`Created: ${result.data.length} agreements`);
  console.log(`Errors: ${result.errors.length}`);

  for (const agreement of result.data) {
    console.log(`  ${agreement.signer_name}: ${agreement.agreement_id} (${agreement.status})`);
  }

  for (const error of result.errors) {
    console.log(`  Index ${error.index} failed: ${error.error.message}`);
  }
}

main().catch(console.error);
