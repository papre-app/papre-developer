/**
 * Create an agreement from a template and send it for signing.
 *
 * Usage:
 *   PAPRE_API_KEY=papre_test_sk_... npx tsx create-agreement.ts
 */
import { PapreClient } from '@papre-app/sdk';

const papre = new PapreClient({
  apiKey: process.env.PAPRE_API_KEY!,
});

async function main() {
  // 1. List available templates
  const { data: templates } = await papre.templates.list({ type: 'waiver' });
  console.log(`Found ${templates.length} waiver templates`);

  const template = templates[0];
  console.log(`Using template: ${template.template_name} (${template.template_id})`);
  console.log('Required fields:', template.merge_fields.map((f) => f.field_key));

  // 2. Create an agreement
  const agreement = await papre.agreements.create({
    template_id: template.template_id,
    signer_email: 'alice@example.com',
    signer_name: 'Alice Johnson',
    merge_fields: {
      participant_name: 'Alice Johnson',
      event_name: 'Annual Company Retreat',
      event_date: '2026-04-15',
    },
    external_reference: 'participant_101',
  });

  console.log(`Agreement created: ${agreement.agreement_id}`);
  console.log(`Status: ${agreement.status}`);
  console.log(`Signing URL: ${agreement.signing_url}`);

  // 3. Check status later
  const updated = await papre.agreements.get(agreement.agreement_id);
  console.log(`Current status: ${updated.status}`);
}

main().catch(console.error);
