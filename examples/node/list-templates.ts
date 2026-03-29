/**
 * List available templates and inspect their merge fields.
 *
 * Usage:
 *   PAPRE_API_KEY=papre_test_sk_... npx tsx list-templates.ts
 */
import { PapreClient } from '@papre/sdk';

const papre = new PapreClient({
  apiKey: process.env.PAPRE_API_KEY!,
});

async function main() {
  // List all waiver templates
  const { data: waivers } = await papre.templates.list({ type: 'waiver' });

  for (const template of waivers) {
    console.log(`\n--- ${template.template_name} (${template.template_id}) ---`);
    console.log(`Type: ${template.template_type}`);
    console.log(`Status: ${template.status}`);
    console.log('Merge fields:');
    for (const field of template.merge_fields) {
      const required = field.required ? '(required)' : '(optional)';
      console.log(`  ${field.field_key}: ${field.field_type} ${required} — "${field.field_label}"`);
    }
  }

  // Get template content with sample data
  if (waivers.length > 0) {
    const content = await papre.templates.getContent(waivers[0].template_id, {
      participant_name: 'Jane Doe',
      event_name: 'Team Building Day',
      event_date: '2026-05-01',
    });
    console.log('\n--- Filled Preview ---');
    console.log(content.filled_preview);
  }
}

main().catch(console.error);
