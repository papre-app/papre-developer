/**
 * Express webhook handler with HMAC-SHA256 verification.
 *
 * Usage:
 *   PAPRE_WEBHOOK_SECRET=whsec_... npx tsx webhook-handler.ts
 */
import express from 'express';
import crypto from 'crypto';

const app = express();
const WEBHOOK_SECRET = process.env.PAPRE_WEBHOOK_SECRET!;

// Parse raw body for HMAC verification
app.post(
  '/webhooks/papre',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const signature = req.headers['x-papre-signature'] as string;
    const payload = req.body.toString();

    // Verify HMAC-SHA256 signature
    const expected = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Signature verified — process the event
    const event = JSON.parse(payload);

    switch (event.event_type) {
      case 'agreement.signed':
        console.log(`Agreement ${event.agreement_id} signed by ${event.signer_name}`);
        console.log(`Blockchain TX: ${event.blockchain_tx}`);
        // Update your database, trigger downstream actions, etc.
        break;

      case 'agreement.viewed':
        console.log(`Agreement ${event.agreement_id} viewed by signer`);
        break;

      case 'agreement.expired':
        console.log(`Agreement ${event.agreement_id} expired`);
        // Optionally recreate or notify admin
        break;

      case 'agreement.declined':
        console.log(`Agreement ${event.agreement_id} declined`);
        // Alert admin, flag participant
        break;

      case 'agreement.cancelled':
        console.log(`Agreement ${event.agreement_id} cancelled`);
        break;

      default:
        console.log(`Unknown event type: ${event.event_type}`);
    }

    // Always respond 200 quickly — Papre retries on non-2xx
    res.status(200).json({ received: true });
  },
);

app.listen(3000, () => {
  console.log('Webhook handler listening on port 3000');
});
